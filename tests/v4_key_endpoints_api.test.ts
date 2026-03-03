import { describe, expect, it } from 'bun:test'
import { app } from '../apps/backend/src/index'
import { getLocalDb } from '../apps/backend/src/services/LocalDatabaseService'
import { createAuthHeaders, createTestSession } from './helpers/auth'

type TestSession = Awaited<ReturnType<typeof createTestSession>>
const V4_API_TEST_TIMEOUT_MS = 120_000

const createAdminHeaders = (options?: { contentTypeJson?: boolean }) => {
  const headers: Record<string, string> = {}
  const adminToken = String(process.env.ADMIN_TOKEN || '').trim()
  if (adminToken) headers['x-admin-token'] = adminToken
  if (options?.contentTypeJson) headers['Content-Type'] = 'application/json'
  return headers
}

const buildCaseId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const bootstrapWorkspaceContext = async (label: string) => {
  const owner = await createTestSession(`${label}-owner`)
  const editor = await createTestSession(`${label}-editor`)
  const viewer = await createTestSession(`${label}-viewer`)

  const workspaceResp = await app.handle(
    new Request('http://localhost/api/workspaces', {
      method: 'POST',
      headers: createAuthHeaders(owner.accessToken, {
        organizationId: owner.organizationId,
        contentTypeJson: true
      }),
      body: JSON.stringify({
        name: `${label}-workspace`,
        ownerName: `${label}-owner`
      })
    })
  )
  const workspaceData = (await workspaceResp.json()) as any
  expect(workspaceResp.status).toBe(200)
  expect(workspaceData.success).toBe(true)

  const workspaceId = String(workspaceData.workspace?.id || '')
  const projectId = String(workspaceData.defaultProject?.id || '')

  const inviteAndAccept = async (
    role: 'editor' | 'viewer',
    session: TestSession,
    memberName: string
  ) => {
    const inviteResp = await app.handle(
      new Request(`http://localhost/api/workspaces/${workspaceId}/invites`, {
        method: 'POST',
        headers: createAuthHeaders(owner.accessToken, {
          organizationId: owner.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          role,
          expiresInHours: 12
        })
      })
    )
    const inviteData = (await inviteResp.json()) as any
    expect(inviteResp.status).toBe(200)
    expect(inviteData.success).toBe(true)

    const code = String(inviteData.invite?.code || '')
    expect(code.length).toBeGreaterThan(0)

    const acceptResp = await app.handle(
      new Request(`http://localhost/api/workspaces/invites/${code}/accept`, {
        method: 'POST',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({ memberName })
      })
    )
    const acceptData = (await acceptResp.json()) as any
    expect(acceptResp.status).toBe(200)
    expect(acceptData.success).toBe(true)
  }

  await inviteAndAccept('editor', editor, `${label}-editor`)
  await inviteAndAccept('viewer', viewer, `${label}-viewer`)

  return {
    owner,
    editor,
    viewer,
    workspaceId,
    projectId
  }
}

describe('V4 关键端点 API 回归（Stream D）', () => {
  it(
    'reliability: error budget + drills + alerts 应走通真实 v4 管理端点',
    async () => {
      const policyId = buildCaseId('v4-rel-policy')

      const updateResp = await app.handle(
        new Request('http://localhost/api/v4/admin/reliability/error-budget', {
          method: 'PUT',
          headers: createAdminHeaders({ contentTypeJson: true }),
          body: JSON.stringify({
            policyId,
            scope: 'stream-d',
            targetSlo: 0.985,
            windowDays: 14,
            warningThresholdRatio: 0.6,
            alertThresholdRatio: 0.85,
            freezeDeployOnBreach: true,
            updatedBy: 'stream-d-admin',
            meta: { channel: 'v4-regression' }
          })
        })
      )
      const updateData = (await updateResp.json()) as any
      expect(updateResp.status).toBe(200)
      expect(updateData.success).toBe(true)
      expect(updateData.policy?.id).toBe(policyId)
      expect(updateData.evaluation?.policy?.id).toBe(policyId)

      const getResp = await app.handle(
        new Request(`http://localhost/api/v4/admin/reliability/error-budget?policyId=${policyId}`, {
          headers: createAdminHeaders()
        })
      )
      const getData = (await getResp.json()) as any
      expect(getResp.status).toBe(200)
      expect(getData.success).toBe(true)
      expect(getData.policy?.id).toBe(policyId)

      const drillResp = await app.handle(
        new Request('http://localhost/api/v4/admin/reliability/drills/rollback', {
          method: 'POST',
          headers: createAdminHeaders({ contentTypeJson: true }),
          body: JSON.stringify({
            policyId,
            environment: 'staging',
            status: 'failed',
            triggerType: 'manual',
            initiatedBy: 'stream-d-admin',
            summary: '回滚演练失败，验证告警链路',
            plan: { step: 'rollback' },
            result: { reason: 'smoke-check-failed' }
          })
        })
      )
      const drillData = (await drillResp.json()) as any
      expect(drillResp.status).toBe(200)
      expect(drillData.success).toBe(true)
      const drillId = String(drillData.drill?.id || '')
      expect(drillId.startsWith('drill_')).toBe(true)

      const getDrillResp = await app.handle(
        new Request(`http://localhost/api/v4/admin/reliability/drills/${drillId}`, {
          headers: createAdminHeaders()
        })
      )
      const getDrillData = (await getDrillResp.json()) as any
      expect(getDrillResp.status).toBe(200)
      expect(getDrillData.success).toBe(true)
      expect(getDrillData.drill?.status).toBe('failed')

      const alertsResp = await app.handle(
        new Request(
          'http://localhost/api/v4/admin/reliability/alerts?level=critical&status=open&limit=20',
          {
            headers: createAdminHeaders()
          }
        )
      )
      const alertsData = (await alertsResp.json()) as any
      expect(alertsResp.status).toBe(200)
      expect(alertsData.success).toBe(true)
      expect(Array.isArray(alertsData.alerts)).toBe(true)
      expect(alertsData.alerts.some((item: any) => item?.payload?.drillId === drillId)).toBe(true)

      const targetAlert = (alertsData.alerts || []).find(
        (item: any) => item?.payload?.drillId === drillId
      )
      const alertId = String(targetAlert?.id || '')
      expect(alertId.startsWith('rel_alert_')).toBe(true)

      const ackResp = await app.handle(
        new Request(`http://localhost/api/v4/admin/reliability/alerts/${alertId}/ack`, {
          method: 'POST',
          headers: createAdminHeaders({ contentTypeJson: true }),
          body: JSON.stringify({
            acknowledgedBy: 'stream-d-oncall',
            note: '已确认，进入修复流程'
          })
        })
      )
      const ackData = (await ackResp.json()) as any
      expect(ackResp.status).toBe(200)
      expect(ackData.success).toBe(true)
      expect(ackData.alert?.id).toBe(alertId)
      expect(ackData.alert?.status).toBe('acknowledged')
      expect(typeof ackData.alert?.acknowledgedAt).toBe('string')
      expect(ackData.alert?.payload?.ack?.by).toBe('stream-d-oncall')
      expect(ackData.alert?.payload?.ack?.note).toBe('已确认，进入修复流程')
      expect(typeof ackData.alert?.payload?.ack?.at).toBe('string')
    },
    V4_API_TEST_TIMEOUT_MS
  )

  it(
    'comment-threads: list/create/reply/resolve 应走通真实 v4 评论线程端点',
    async () => {
      const { editor, viewer, projectId } = await bootstrapWorkspaceContext('v4-comment-threads')

      const listBeforeResp = await app.handle(
        new Request(`http://localhost/api/v4/projects/${projectId}/comment-threads?limit=10`, {
          headers: createAuthHeaders(viewer.accessToken, { organizationId: viewer.organizationId })
        })
      )
      const listBeforeData = (await listBeforeResp.json()) as any
      expect(listBeforeResp.status).toBe(200)
      expect(listBeforeData.success).toBe(true)
      expect(Array.isArray(listBeforeData.threads)).toBe(true)
      expect(listBeforeData.page?.limit).toBe(10)
      expect(typeof listBeforeData.page?.hasMore).toBe('boolean')
      expect(
        listBeforeData.page?.nextCursor === null ||
          typeof listBeforeData.page?.nextCursor === 'string'
      ).toBe(true)

      const createResp = await app.handle(
        new Request(`http://localhost/api/v4/projects/${projectId}/comment-threads`, {
          method: 'POST',
          headers: createAuthHeaders(editor.accessToken, {
            organizationId: editor.organizationId,
            contentTypeJson: true
          }),
          body: JSON.stringify({
            anchor: 'timeline:track-v1:clip-hero',
            content: '请补充过渡帧，减少跳切感。',
            mentions: ['qa', 'director']
          })
        })
      )
      const createData = (await createResp.json()) as any
      expect(createResp.status).toBe(200)
      expect(createData.success).toBe(true)
      const threadId = String(createData.thread?.id || '')
      expect(threadId.startsWith('pc_')).toBe(true)

      const replyResp = await app.handle(
        new Request(
          `http://localhost/api/v4/projects/${projectId}/comment-threads/${threadId}/replies`,
          {
            method: 'POST',
            headers: createAuthHeaders(editor.accessToken, {
              organizationId: editor.organizationId,
              contentTypeJson: true
            }),
            body: JSON.stringify({
              content: '已补充过渡帧，并同步调整速度曲线。',
              mentions: ['qa']
            })
          }
        )
      )
      const replyData = (await replyResp.json()) as any
      expect(replyResp.status).toBe(200)
      expect(replyData.success).toBe(true)
      expect(replyData.reply?.threadId).toBe(threadId)

      const resolveResp = await app.handle(
        new Request(
          `http://localhost/api/v4/projects/${projectId}/comment-threads/${threadId}/resolve`,
          {
            method: 'POST',
            headers: createAuthHeaders(editor.accessToken, {
              organizationId: editor.organizationId,
              contentTypeJson: true
            })
          }
        )
      )
      const resolveData = (await resolveResp.json()) as any
      expect(resolveResp.status).toBe(200)
      expect(resolveData.success).toBe(true)
      expect(resolveData.thread?.status).toBe('resolved')
      expect(resolveData.thread?.replyCount).toBeGreaterThanOrEqual(1)

      await Bun.sleep(5)
      const createSecondResp = await app.handle(
        new Request(`http://localhost/api/v4/projects/${projectId}/comment-threads`, {
          method: 'POST',
          headers: createAuthHeaders(editor.accessToken, {
            organizationId: editor.organizationId,
            contentTypeJson: true
          }),
          body: JSON.stringify({
            anchor: 'timeline:track-v2:clip-outro',
            content: '新增第二条线程用于分页游标验证。',
            mentions: ['qa']
          })
        })
      )
      const createSecondData = (await createSecondResp.json()) as any
      expect(createSecondResp.status).toBe(200)
      expect(createSecondData.success).toBe(true)
      const secondThreadId = String(createSecondData.thread?.id || '')
      expect(secondThreadId.startsWith('pc_')).toBe(true)

      const pagedFirstResp = await app.handle(
        new Request(`http://localhost/api/v4/projects/${projectId}/comment-threads?limit=1`, {
          headers: createAuthHeaders(viewer.accessToken, { organizationId: viewer.organizationId })
        })
      )
      const pagedFirstData = (await pagedFirstResp.json()) as any
      expect(pagedFirstResp.status).toBe(200)
      expect(pagedFirstData.success).toBe(true)
      expect(Array.isArray(pagedFirstData.threads)).toBe(true)
      expect(pagedFirstData.threads.length).toBe(1)
      expect(pagedFirstData.page?.limit).toBe(1)
      expect(pagedFirstData.page?.hasMore).toBe(true)
      expect(typeof pagedFirstData.page?.nextCursor).toBe('string')
      const nextCursor = String(pagedFirstData.page?.nextCursor || '')
      expect(nextCursor.length).toBeGreaterThan(0)
      const legacyCommentCursor = nextCursor.split('|')[0] || nextCursor

      const pagedLegacyResp = await app.handle(
        new Request(
          `http://localhost/api/v4/projects/${projectId}/comment-threads?limit=1&cursor=${encodeURIComponent(legacyCommentCursor)}`,
          {
            headers: createAuthHeaders(viewer.accessToken, {
              organizationId: viewer.organizationId
            })
          }
        )
      )
      const pagedLegacyData = (await pagedLegacyResp.json()) as any
      expect(pagedLegacyResp.status).toBe(200)
      expect(pagedLegacyData.success).toBe(true)
      expect(Array.isArray(pagedLegacyData.threads)).toBe(true)

      const pagedSecondResp = await app.handle(
        new Request(
          `http://localhost/api/v4/projects/${projectId}/comment-threads?limit=1&cursor=${encodeURIComponent(nextCursor)}`,
          {
            headers: createAuthHeaders(viewer.accessToken, {
              organizationId: viewer.organizationId
            })
          }
        )
      )
      const pagedSecondData = (await pagedSecondResp.json()) as any
      expect(pagedSecondResp.status).toBe(200)
      expect(pagedSecondData.success).toBe(true)
      expect(Array.isArray(pagedSecondData.threads)).toBe(true)
      expect(pagedSecondData.page?.limit).toBe(1)
      expect(
        pagedSecondData.threads.every((item: any) => item.id !== pagedFirstData.threads[0]?.id)
      ).toBe(true)
      expect(
        [pagedFirstData.threads[0]?.id, pagedSecondData.threads[0]?.id].every(
          (id: any) => typeof id === 'string'
        )
      ).toBe(true)

      const forcedCommentTimestamp = new Date().toISOString()
      getLocalDb()
        .prepare(`UPDATE project_comments SET created_at = ? WHERE id IN (?, ?)`)
        .run(forcedCommentTimestamp, threadId, secondThreadId)

      const sameTimeFirstResp = await app.handle(
        new Request(`http://localhost/api/v4/projects/${projectId}/comment-threads?limit=1`, {
          headers: createAuthHeaders(viewer.accessToken, { organizationId: viewer.organizationId })
        })
      )
      const sameTimeFirstData = (await sameTimeFirstResp.json()) as any
      expect(sameTimeFirstResp.status).toBe(200)
      expect(sameTimeFirstData.success).toBe(true)
      expect(sameTimeFirstData.page?.hasMore).toBe(true)
      expect(typeof sameTimeFirstData.page?.nextCursor).toBe('string')

      const sameTimeCursor = String(sameTimeFirstData.page?.nextCursor || '')
      expect(sameTimeCursor.includes('|')).toBe(true)

      const sameTimeSecondResp = await app.handle(
        new Request(
          `http://localhost/api/v4/projects/${projectId}/comment-threads?limit=1&cursor=${encodeURIComponent(sameTimeCursor)}`,
          {
            headers: createAuthHeaders(viewer.accessToken, {
              organizationId: viewer.organizationId
            })
          }
        )
      )
      const sameTimeSecondData = (await sameTimeSecondResp.json()) as any
      expect(sameTimeSecondResp.status).toBe(200)
      expect(sameTimeSecondData.success).toBe(true)
      expect(sameTimeSecondData.threads.length).toBe(1)

      const sameTimeIds = new Set(
        [sameTimeFirstData.threads[0]?.id, sameTimeSecondData.threads[0]?.id]
          .map((item: any) => String(item || ''))
          .filter(Boolean)
      )
      expect(sameTimeIds.size).toBe(2)
      expect(sameTimeIds.has(threadId)).toBe(true)
      expect(sameTimeIds.has(secondThreadId)).toBe(true)

      const listAfterResp = await app.handle(
        new Request(`http://localhost/api/v4/projects/${projectId}/comment-threads?limit=10`, {
          headers: createAuthHeaders(viewer.accessToken, { organizationId: viewer.organizationId })
        })
      )
      const listAfterData = (await listAfterResp.json()) as any
      expect(listAfterResp.status).toBe(200)
      expect(listAfterData.success).toBe(true)
      expect(listAfterData.page?.limit).toBe(10)
      expect(typeof listAfterData.page?.hasMore).toBe('boolean')
      expect(
        listAfterData.page?.nextCursor === null ||
          typeof listAfterData.page?.nextCursor === 'string'
      ).toBe(true)
      expect(
        listAfterData.threads.some(
          (item: any) => item.id === threadId && item.status === 'resolved'
        )
      ).toBe(true)
      expect(listAfterData.threads.some((item: any) => item.id === secondThreadId)).toBe(true)
    },
    V4_API_TEST_TIMEOUT_MS
  )

  it(
    'workspace permissions: get + put 权限边界应与真实 v4 端点一致',
    async () => {
      const { owner, editor, viewer, workspaceId } = await bootstrapWorkspaceContext(
        'v4-workspace-permissions'
      )

      const getResp = await app.handle(
        new Request(`http://localhost/api/v4/workspaces/${workspaceId}/permissions`, {
          headers: createAuthHeaders(viewer.accessToken, { organizationId: viewer.organizationId })
        })
      )
      const getData = (await getResp.json()) as any
      expect(getResp.status).toBe(200)
      expect(getData.success).toBe(true)
      expect(Array.isArray(getData.permissions)).toBe(true)
      expect(getData.permissions.some((profile: any) => profile.role === 'owner')).toBe(true)

      const role = 'viewer'
      const editorPutResp = await app.handle(
        new Request(`http://localhost/api/v4/workspaces/${workspaceId}/permissions/${role}`, {
          method: 'PUT',
          headers: createAuthHeaders(editor.accessToken, {
            organizationId: editor.organizationId,
            contentTypeJson: true
          }),
          body: JSON.stringify({
            permissions: {
              'project.comments.view': true,
              'asset.reuse.view': true,
              'timeline.merge': false
            },
            updatedBy: 'editor-should-fail'
          })
        })
      )
      expect(editorPutResp.status).toBe(403)

      const ownerPutResp = await app.handle(
        new Request(`http://localhost/api/v4/workspaces/${workspaceId}/permissions/${role}`, {
          method: 'PUT',
          headers: createAuthHeaders(owner.accessToken, {
            organizationId: owner.organizationId,
            contentTypeJson: true
          }),
          body: JSON.stringify({
            permissions: {
              'project.comments.view': true,
              'asset.reuse.view': true,
              'timeline.merge': false
            },
            updatedBy: 'owner-ops'
          })
        })
      )
      const ownerPutData = (await ownerPutResp.json()) as any
      expect(ownerPutResp.status).toBe(200)
      expect(ownerPutData.success).toBe(true)
      expect(ownerPutData.permission?.role).toBe('viewer')
      expect(ownerPutData.permission?.permissions?.['timeline.merge']).toBe(false)
    },
    V4_API_TEST_TIMEOUT_MS
  )

  it(
    'timeline merge: merge 端点应返回冲突状态与归档结果',
    async () => {
      const { editor, viewer, projectId } = await bootstrapWorkspaceContext('v4-timeline-merge')

      const viewerMergeResp = await app.handle(
        new Request(`http://localhost/api/v4/projects/${projectId}/timeline/merge`, {
          method: 'POST',
          headers: createAuthHeaders(viewer.accessToken, {
            organizationId: viewer.organizationId,
            contentTypeJson: true
          }),
          body: JSON.stringify({
            sourceRevision: 'rev-viewer-a',
            targetRevision: 'rev-viewer-b',
            result: { mergedClips: 0 }
          })
        })
      )
      expect(viewerMergeResp.status).toBe(403)

      const mergeResp = await app.handle(
        new Request(`http://localhost/api/v4/projects/${projectId}/timeline/merge`, {
          method: 'POST',
          headers: createAuthHeaders(editor.accessToken, {
            organizationId: editor.organizationId,
            contentTypeJson: true
          }),
          body: JSON.stringify({
            sourceRevision: 'rev-a',
            targetRevision: 'rev-b',
            conflicts: [{ clipId: 'clip-v1', reason: 'overlap' }],
            result: { mergedClips: 2 }
          })
        })
      )
      const mergeData = (await mergeResp.json()) as any
      expect(mergeResp.status).toBe(200)
      expect(mergeData.success).toBe(true)
      expect(mergeData.merge?.id?.startsWith('merge_')).toBe(true)
      expect(mergeData.merge?.status).toBe('conflict')
      expect(Array.isArray(mergeData.merge?.conflicts)).toBe(true)
      expect(mergeData.merge?.conflicts?.length).toBeGreaterThan(0)
    },
    V4_API_TEST_TIMEOUT_MS
  )

  it(
    'creative workflows + batch: workflow list/create/run 与 batch create/get 应联通',
    async () => {
      const session = await createTestSession('v4-creative-workflow')

      const listResp = await app.handle(
        new Request('http://localhost/api/v4/creative/prompt-workflows?limit=20', {
          headers: createAuthHeaders(session.accessToken, {
            organizationId: session.organizationId
          })
        })
      )
      const listData = (await listResp.json()) as any
      expect(listResp.status).toBe(200)
      expect(listData.success).toBe(true)
      expect(Array.isArray(listData.workflows)).toBe(true)

      const createResp = await app.handle(
        new Request('http://localhost/api/v4/creative/prompt-workflows', {
          method: 'POST',
          headers: createAuthHeaders(session.accessToken, {
            organizationId: session.organizationId,
            contentTypeJson: true
          }),
          body: JSON.stringify({
            name: buildCaseId('v4-workflow'),
            description: '用于 Stream D 契约回归',
            definition: {
              template: '为 {{product}} 生成 {{style}} 风格的 8 秒镜头脚本'
            }
          })
        })
      )
      const createData = (await createResp.json()) as any
      expect(createResp.status).toBe(200)
      expect(createData.success).toBe(true)
      const workflowId = String(createData.workflow?.id || '')
      expect(workflowId.startsWith('pwf_')).toBe(true)

      const runResp = await app.handle(
        new Request(`http://localhost/api/v4/creative/prompt-workflows/${workflowId}/run`, {
          method: 'POST',
          headers: createAuthHeaders(session.accessToken, {
            organizationId: session.organizationId,
            contentTypeJson: true
          }),
          body: JSON.stringify({
            triggerType: 'manual',
            input: {
              product: '智能手表',
              style: '电影感'
            }
          })
        })
      )
      const runData = (await runResp.json()) as any
      expect(runResp.status).toBe(200)
      expect(runData.success).toBe(true)
      const workflowRunId = String(runData.run?.id || '')
      expect(workflowRunId.startsWith('pwfr_')).toBe(true)

      await Bun.sleep(5)
      const runSecondResp = await app.handle(
        new Request(`http://localhost/api/v4/creative/prompt-workflows/${workflowId}/run`, {
          method: 'POST',
          headers: createAuthHeaders(session.accessToken, {
            organizationId: session.organizationId,
            contentTypeJson: true
          }),
          body: JSON.stringify({
            triggerType: 'manual',
            input: {
              product: '运动相机',
              style: '纪录片'
            }
          })
        })
      )
      const runSecondData = (await runSecondResp.json()) as any
      expect(runSecondResp.status).toBe(200)
      expect(runSecondData.success).toBe(true)
      const workflowRunIdSecond = String(runSecondData.run?.id || '')
      expect(workflowRunIdSecond.startsWith('pwfr_')).toBe(true)
      expect(workflowRunIdSecond).not.toBe(workflowRunId)

      const runsFirstResp = await app.handle(
        new Request(
          `http://localhost/api/v4/creative/prompt-workflows/${workflowId}/runs?limit=1`,
          {
            headers: createAuthHeaders(session.accessToken, {
              organizationId: session.organizationId
            })
          }
        )
      )
      const runsFirstData = (await runsFirstResp.json()) as any
      expect(runsFirstResp.status).toBe(200)
      expect(runsFirstData.success).toBe(true)
      expect(Array.isArray(runsFirstData.runs)).toBe(true)
      expect(runsFirstData.runs.length).toBe(1)
      expect(runsFirstData.page?.limit).toBe(1)
      expect(runsFirstData.page?.hasMore).toBe(true)
      expect(typeof runsFirstData.page?.nextCursor).toBe('string')
      expect(runsFirstData.runs[0]?.id).toBe(workflowRunIdSecond)

      const runsCursor = String(runsFirstData.page?.nextCursor || '')
      expect(runsCursor.length).toBeGreaterThan(0)
      const legacyRunsCursor = runsCursor.split('|')[0] || runsCursor

      const runsLegacyResp = await app.handle(
        new Request(
          `http://localhost/api/v4/creative/prompt-workflows/${workflowId}/runs?limit=1&cursor=${encodeURIComponent(legacyRunsCursor)}`,
          {
            headers: createAuthHeaders(session.accessToken, {
              organizationId: session.organizationId
            })
          }
        )
      )
      const runsLegacyData = (await runsLegacyResp.json()) as any
      expect(runsLegacyResp.status).toBe(200)
      expect(runsLegacyData.success).toBe(true)
      expect(Array.isArray(runsLegacyData.runs)).toBe(true)

      const runsSecondResp = await app.handle(
        new Request(
          `http://localhost/api/v4/creative/prompt-workflows/${workflowId}/runs?limit=1&cursor=${encodeURIComponent(runsCursor)}`,
          {
            headers: createAuthHeaders(session.accessToken, {
              organizationId: session.organizationId
            })
          }
        )
      )
      const runsSecondData = (await runsSecondResp.json()) as any
      expect(runsSecondResp.status).toBe(200)
      expect(runsSecondData.success).toBe(true)
      expect(Array.isArray(runsSecondData.runs)).toBe(true)
      expect(runsSecondData.page?.limit).toBe(1)
      expect(runsSecondData.runs.some((item: any) => item.id === workflowRunId)).toBe(true)

      const forcedRunTimestamp = new Date().toISOString()
      getLocalDb()
        .prepare(`UPDATE prompt_workflow_runs SET created_at = ? WHERE id IN (?, ?)`)
        .run(forcedRunTimestamp, workflowRunId, workflowRunIdSecond)

      const runsSameTimeFirstResp = await app.handle(
        new Request(
          `http://localhost/api/v4/creative/prompt-workflows/${workflowId}/runs?limit=1`,
          {
            headers: createAuthHeaders(session.accessToken, {
              organizationId: session.organizationId
            })
          }
        )
      )
      const runsSameTimeFirstData = (await runsSameTimeFirstResp.json()) as any
      expect(runsSameTimeFirstResp.status).toBe(200)
      expect(runsSameTimeFirstData.success).toBe(true)
      expect(runsSameTimeFirstData.page?.hasMore).toBe(true)
      expect(typeof runsSameTimeFirstData.page?.nextCursor).toBe('string')

      const runsSameTimeCursor = String(runsSameTimeFirstData.page?.nextCursor || '')
      expect(runsSameTimeCursor.includes('|')).toBe(true)

      const runsSameTimeSecondResp = await app.handle(
        new Request(
          `http://localhost/api/v4/creative/prompt-workflows/${workflowId}/runs?limit=1&cursor=${encodeURIComponent(runsSameTimeCursor)}`,
          {
            headers: createAuthHeaders(session.accessToken, {
              organizationId: session.organizationId
            })
          }
        )
      )
      const runsSameTimeSecondData = (await runsSameTimeSecondResp.json()) as any
      expect(runsSameTimeSecondResp.status).toBe(200)
      expect(runsSameTimeSecondData.success).toBe(true)
      expect(runsSameTimeSecondData.runs.length).toBe(1)

      const sameTimeRunIds = new Set(
        [runsSameTimeFirstData.runs[0]?.id, runsSameTimeSecondData.runs[0]?.id]
          .map((item: any) => String(item || ''))
          .filter(Boolean)
      )
      expect(sameTimeRunIds.size).toBe(2)
      expect(sameTimeRunIds.has(workflowRunId)).toBe(true)
      expect(sameTimeRunIds.has(workflowRunIdSecond)).toBe(true)

      const batchResp = await app.handle(
        new Request('http://localhost/api/v4/creative/batch-jobs', {
          method: 'POST',
          headers: createAuthHeaders(session.accessToken, {
            organizationId: session.organizationId,
            contentTypeJson: true
          }),
          body: JSON.stringify({
            workflowRunId,
            jobType: 'creative.render',
            payload: { priority: 'normal' },
            items: [
              { itemKey: 'shot-1', input: { durationSec: 8 } },
              { itemKey: 'shot-2', input: { durationSec: 6 } }
            ]
          })
        })
      )
      const batchData = (await batchResp.json()) as any
      expect(batchResp.status).toBe(200)
      expect(batchData.success).toBe(true)
      const jobId = String(batchData.job?.id || '')
      expect(jobId.startsWith('batch_')).toBe(true)

      const getBatchResp = await app.handle(
        new Request(`http://localhost/api/v4/creative/batch-jobs/${jobId}`, {
          headers: createAuthHeaders(session.accessToken, {
            organizationId: session.organizationId
          })
        })
      )
      const getBatchData = (await getBatchResp.json()) as any
      expect(getBatchResp.status).toBe(200)
      expect(getBatchData.success).toBe(true)
      expect(getBatchData.job?.id).toBe(jobId)
      expect(getBatchData.job?.totalItems).toBe(2)
      expect(Array.isArray(getBatchData.job?.items)).toBe(true)
    },
    V4_API_TEST_TIMEOUT_MS
  )

  it(
    'assets reuse: reuse + history 应走通真实 v4 端点并可按 assetId 查询',
    async () => {
      const session = await createTestSession('v4-asset-reuse')
      const sourceProjectId = buildCaseId('source-project')
      const targetProjectId = buildCaseId('target-project')
      const assetId = buildCaseId('asset')

      const reuseResp = await app.handle(
        new Request(`http://localhost/api/v4/assets/${assetId}/reuse`, {
          method: 'POST',
          headers: createAuthHeaders(session.accessToken, {
            organizationId: session.organizationId,
            contentTypeJson: true
          }),
          body: JSON.stringify({
            sourceProjectId,
            targetProjectId,
            context: {
              sceneId: 'scene-hero',
              reason: '跨项目镜头复用'
            }
          })
        })
      )
      const reuseData = (await reuseResp.json()) as any
      expect(reuseResp.status).toBe(200)
      expect(reuseData.success).toBe(true)
      expect(reuseData.record?.assetId).toBe(assetId)

      const historyResp = await app.handle(
        new Request(`http://localhost/api/v4/assets/reuse-history?assetId=${assetId}&limit=10`, {
          headers: createAuthHeaders(session.accessToken, {
            organizationId: session.organizationId
          })
        })
      )
      const historyData = (await historyResp.json()) as any
      expect(historyResp.status).toBe(200)
      expect(historyData.success).toBe(true)
      expect(Array.isArray(historyData.records)).toBe(true)
      expect(
        historyData.records.some(
          (item: any) =>
            item.assetId === assetId &&
            item.sourceProjectId === sourceProjectId &&
            item.targetProjectId === targetProjectId
        )
      ).toBe(true)
    },
    V4_API_TEST_TIMEOUT_MS
  )
})
