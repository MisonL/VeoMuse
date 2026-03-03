import { afterEach, describe, expect, it } from 'bun:test'
import { app } from '../apps/backend/src/index'
import { getLocalDb } from '../apps/backend/src/services/LocalDatabaseService'
import { createAuthHeaders, createTestSession } from './helpers/auth'

type TestSession = Awaited<ReturnType<typeof createTestSession>>

const templateSeedPrefix = `test-template-seed-${Date.now()}`

afterEach(() => {
  getLocalDb()
    .prepare(`DELETE FROM project_templates WHERE id LIKE ?`)
    .run(`${templateSeedPrefix}-%`)
})

const bootstrapProjectWithMembers = async (label: string) => {
  const owner = await createTestSession(`${label}-owner`)
  const editor = await createTestSession(`${label}-editor`)
  const viewer = await createTestSession(`${label}-viewer`)

  const createWorkspaceResp = await app.handle(
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
  const createWorkspaceData = (await createWorkspaceResp.json()) as any
  expect(createWorkspaceResp.status).toBe(200)
  expect(createWorkspaceData.success).toBe(true)

  const workspaceId = String(createWorkspaceData.workspace?.id || '')
  const projectId = String(createWorkspaceData.defaultProject?.id || '')
  const organizationId = String(
    createWorkspaceData.defaultProject?.organizationId || owner.organizationId
  )
  expect(workspaceId).toContain('ws_')
  expect(projectId).toContain('prj_')

  const createInviteCode = async (role: 'editor' | 'viewer') => {
    const inviteResp = await app.handle(
      new Request(`http://localhost/api/workspaces/${workspaceId}/invites`, {
        method: 'POST',
        headers: createAuthHeaders(owner.accessToken, {
          organizationId: owner.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({ role, expiresInHours: 12 })
      })
    )
    const inviteData = (await inviteResp.json()) as any
    expect(inviteResp.status).toBe(200)
    expect(inviteData.success).toBe(true)
    return String(inviteData.invite?.code || '')
  }

  const acceptInvite = async (session: TestSession, code: string, memberName: string) => {
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

  const editorCode = await createInviteCode('editor')
  const viewerCode = await createInviteCode('viewer')

  await acceptInvite(editor, editorCode, `${label}-editor-member`)
  await acceptInvite(viewer, viewerCode, `${label}-viewer-member`)

  return { owner, editor, viewer, projectId, organizationId }
}

const seedTemplate = (projectId: string, organizationId: string, actorName: string) => {
  const id = `${templateSeedPrefix}-${crypto.randomUUID()}`
  const createdAt = new Date().toISOString()
  const template = {
    timeline: {
      tracks: [
        { id: 'track-v1', type: 'video', preset: 'cinematic-intro' },
        { id: 'track-a1', type: 'audio', preset: 'ambient-build' }
      ]
    },
    metadata: {
      from: 'api-draft-test',
      version: 1
    }
  }

  getLocalDb()
    .prepare(
      `
    INSERT INTO project_templates (
      id, organization_id, project_id, name, description, template_json, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
    )
    .run(
      id,
      organizationId,
      projectId,
      '片头节奏模板',
      '用于模板 list/apply 接口草稿验证',
      JSON.stringify(template),
      actorName,
      createdAt,
      createdAt
    )

  return id
}

describe('项目模板与批量片段更新 API（接口期望草稿）', () => {
  it('templates: 应支持 viewer 列表读取，editor 执行 apply', async () => {
    const { owner, editor, viewer, projectId, organizationId } =
      await bootstrapProjectWithMembers('templates-api')
    const templateId = seedTemplate(projectId, organizationId, 'seed-template-bot')

    const listResp = await app.handle(
      new Request(`http://localhost/api/projects/${projectId}/templates`, {
        headers: createAuthHeaders(viewer.accessToken, { organizationId: viewer.organizationId })
      })
    )
    const listData = (await listResp.json()) as any
    expect(listResp.status).toBe(200)
    expect(listData.success).toBe(true)
    expect(Array.isArray(listData.templates)).toBe(true)
    expect((listData.templates || []).some((template: any) => template.id === templateId)).toBe(
      true
    )

    const viewerApplyResp = await app.handle(
      new Request(`http://localhost/api/projects/${projectId}/templates/apply`, {
        method: 'POST',
        headers: createAuthHeaders(viewer.accessToken, {
          organizationId: viewer.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          templateId,
          options: { dryRun: false }
        })
      })
    )
    expect(viewerApplyResp.status).toBe(403)

    const editorApplyResp = await app.handle(
      new Request(`http://localhost/api/projects/${projectId}/templates/apply`, {
        method: 'POST',
        headers: createAuthHeaders(editor.accessToken, {
          organizationId: editor.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          templateId,
          options: {
            targetTrack: 'track-v1',
            blendMode: 'replace'
          }
        })
      })
    )
    const editorApplyData = (await editorApplyResp.json()) as any
    expect(editorApplyResp.status).toBe(200)
    expect(editorApplyData.success).toBe(true)
    expect(editorApplyData.result?.projectId).toBe(projectId)
    expect(editorApplyData.result?.templateId).toBe(templateId)
    expect(typeof editorApplyData.result?.traceId).toBe('string')

    const auditResp = await app.handle(
      new Request(`http://localhost/api/projects/${projectId}/audit`, {
        headers: createAuthHeaders(owner.accessToken, { organizationId: owner.organizationId })
      })
    )
    const auditData = (await auditResp.json()) as any
    expect(auditResp.status).toBe(200)
    expect(auditData.success).toBe(true)

    const applyLog = (auditData.logs || []).find(
      (log: any) => log.action === 'project.template_applied'
    )
    expect(applyLog).toBeTruthy()
    expect(applyLog.detail?.templateId).toBe(templateId)
    expect(typeof applyLog.traceId).toBe('string')
  })

  it('templates: 不存在模板执行 apply 应返回 404 且标记失败', async () => {
    const { editor, projectId } = await bootstrapProjectWithMembers('templates-apply-not-found')

    const applyResp = await app.handle(
      new Request(`http://localhost/api/projects/${projectId}/templates/apply`, {
        method: 'POST',
        headers: createAuthHeaders(editor.accessToken, {
          organizationId: editor.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          templateId: `tpl-missing-${Date.now()}`,
          options: { dryRun: false }
        })
      })
    )
    const applyData = (await applyResp.json()) as any
    expect(applyResp.status).toBe(404)
    expect(applyData.success).toBe(false)
    expect(String(applyData.error || '')).toContain('Template not found')
  })

  it('clips batch update: 应返回统计回执并可在审计日志观测到关键字段', async () => {
    const { owner, editor, viewer, projectId } =
      await bootstrapProjectWithMembers('clips-batch-api')

    const viewerBatchResp = await app.handle(
      new Request(`http://localhost/api/projects/${projectId}/clips/batch-update`, {
        method: 'POST',
        headers: createAuthHeaders(viewer.accessToken, {
          organizationId: viewer.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          operations: [{ clipId: 'clip-viewer', patch: { start: 1 } }]
        })
      })
    )
    expect(viewerBatchResp.status).toBe(403)

    const operations = [
      { clipId: 'clip-a', patch: { start: 0, end: 4, label: 'intro' } },
      { clipId: 'clip-b', patch: {} },
      { clipId: '', patch: { speed: 1.2 } },
      { clipId: 'clip-c', patch: { transition: 'fade' } }
    ]

    const editorBatchResp = await app.handle(
      new Request(`http://localhost/api/projects/${projectId}/clips/batch-update`, {
        method: 'POST',
        headers: createAuthHeaders(editor.accessToken, {
          organizationId: editor.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({ operations })
      })
    )
    const editorBatchData = (await editorBatchResp.json()) as any
    expect(editorBatchResp.status).toBe(200)
    expect(editorBatchData.success).toBe(true)
    expect(editorBatchData.result?.projectId).toBe(projectId)
    expect(editorBatchData.result?.requested).toBe(4)
    expect(editorBatchData.result?.accepted).toBe(2)
    expect(editorBatchData.result?.skipped).toBe(1)
    expect(editorBatchData.result?.rejected).toBe(1)
    expect(editorBatchData.result?.updated).toBe(2)
    expect(typeof editorBatchData.result?.traceId).toBe('string')

    const auditResp = await app.handle(
      new Request(`http://localhost/api/projects/${projectId}/audit`, {
        headers: createAuthHeaders(owner.accessToken, { organizationId: owner.organizationId })
      })
    )
    const auditData = (await auditResp.json()) as any
    expect(auditResp.status).toBe(200)
    expect(auditData.success).toBe(true)

    const batchLog = (auditData.logs || []).find(
      (log: any) =>
        log.action === 'project.clips_batch_updated' &&
        log.traceId === editorBatchData.result?.traceId
    )
    expect(batchLog).toBeTruthy()
    expect(batchLog.detail?.requested).toBe(4)
    expect(batchLog.detail?.accepted).toBe(2)
    expect(batchLog.detail?.skipped).toBe(1)
    expect(batchLog.detail?.rejected).toBe(1)
    expect(batchLog.detail?.updated).toBe(2)
    expect(Array.isArray(batchLog.detail?.clipIds)).toBe(true)
    expect(batchLog.detail?.clipIds).toEqual(['clip-a', 'clip-c'])
  })
})
