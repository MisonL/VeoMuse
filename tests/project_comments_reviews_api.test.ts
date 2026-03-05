import { describe, expect, it } from 'bun:test'
import { app } from '../apps/backend/src/index'
import { getLocalDb } from '../apps/backend/src/services/LocalDatabaseService'
import { createAuthHeaders, createTestSession } from './helpers/auth'

type TestSession = Awaited<ReturnType<typeof createTestSession>>

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

  return { owner, editor, viewer, workspaceId, projectId }
}

describe('项目评论与评审 API（接口期望草稿）', () => {
  it('comments: 应支持 editor 创建与 resolve，viewer 可读不可写，并支持 cursor 翻页', async () => {
    const { owner, editor, viewer, projectId } = await bootstrapProjectWithMembers('comments-api')

    const viewerCreateResp = await app.handle(
      new Request(`http://localhost/api/projects/${projectId}/comments`, {
        method: 'POST',
        headers: createAuthHeaders(viewer.accessToken, {
          organizationId: viewer.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          anchor: 'timeline:track-v1:clip-1',
          content: 'viewer 不应有写权限',
          mentions: ['owner']
        })
      })
    )
    expect(viewerCreateResp.status).toBe(403)

    const createFirstResp = await app.handle(
      new Request(`http://localhost/api/projects/${projectId}/comments`, {
        method: 'POST',
        headers: createAuthHeaders(editor.accessToken, {
          organizationId: editor.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          anchor: 'timeline:track-v1:clip-1',
          content: '请确认第一镜头色温偏冷',
          mentions: ['owner', 'viewer']
        })
      })
    )
    const createFirstData = (await createFirstResp.json()) as any
    expect(createFirstResp.status).toBe(200)
    expect(createFirstData.success).toBe(true)
    expect(createFirstData.comment?.projectId).toBe(projectId)
    const firstCommentId = String(createFirstData.comment?.id || '')
    expect(firstCommentId.startsWith('pc_')).toBe(true)

    const createSecondResp = await app.handle(
      new Request(`http://localhost/api/projects/${projectId}/comments`, {
        method: 'POST',
        headers: createAuthHeaders(editor.accessToken, {
          organizationId: editor.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          content: '第二条评论用于 cursor 翻页验证',
          mentions: ['owner']
        })
      })
    )
    const createSecondData = (await createSecondResp.json()) as any
    expect(createSecondResp.status).toBe(200)
    expect(createSecondData.success).toBe(true)
    const secondCommentId = String(createSecondData.comment?.id || '')

    const sameTimestamp = new Date().toISOString()
    getLocalDb()
      .prepare(`UPDATE project_comments SET created_at = ?, updated_at = ? WHERE id IN (?, ?)`)
      .run(sameTimestamp, sameTimestamp, firstCommentId, secondCommentId)

    const listFirstPageResp = await app.handle(
      new Request(`http://localhost/api/projects/${projectId}/comments?limit=1`, {
        headers: createAuthHeaders(viewer.accessToken, { organizationId: viewer.organizationId })
      })
    )
    const listFirstPageData = (await listFirstPageResp.json()) as any
    expect(listFirstPageResp.status).toBe(200)
    expect(listFirstPageData.success).toBe(true)
    expect(Array.isArray(listFirstPageData.comments)).toBe(true)
    expect(listFirstPageData.comments.length).toBe(1)
    expect(Boolean(listFirstPageData.page?.hasMore)).toBe(true)

    const firstPageCommentId = String(listFirstPageData.comments[0]?.id || '')
    const cursor = String(listFirstPageData.page?.nextCursor || '')
    expect(firstPageCommentId.length).toBeGreaterThan(0)
    expect(cursor.length).toBeGreaterThan(0)
    expect(cursor.includes('|')).toBe(true)

    const listSecondPageResp = await app.handle(
      new Request(
        `http://localhost/api/projects/${projectId}/comments?limit=10&cursor=${encodeURIComponent(cursor)}`,
        {
          headers: createAuthHeaders(viewer.accessToken, { organizationId: viewer.organizationId })
        }
      )
    )
    const listSecondPageData = (await listSecondPageResp.json()) as any
    expect(listSecondPageResp.status).toBe(200)
    expect(listSecondPageData.success).toBe(true)
    expect(Array.isArray(listSecondPageData.comments)).toBe(true)
    expect(
      listSecondPageData.comments.every((comment: any) => comment.id !== firstPageCommentId)
    ).toBe(true)

    const viewerResolveResp = await app.handle(
      new Request(`http://localhost/api/projects/${projectId}/comments/${firstCommentId}/resolve`, {
        method: 'POST',
        headers: createAuthHeaders(viewer.accessToken, {
          organizationId: viewer.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({})
      })
    )
    expect(viewerResolveResp.status).toBe(403)

    const editorResolveResp = await app.handle(
      new Request(`http://localhost/api/projects/${projectId}/comments/${firstCommentId}/resolve`, {
        method: 'POST',
        headers: createAuthHeaders(editor.accessToken, {
          organizationId: editor.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({})
      })
    )
    const editorResolveData = (await editorResolveResp.json()) as any
    expect(editorResolveResp.status).toBe(200)
    expect(editorResolveData.success).toBe(true)
    expect(editorResolveData.comment?.id).toBe(firstCommentId)
    expect(editorResolveData.comment?.status).toBe('resolved')

    const auditResp = await app.handle(
      new Request(`http://localhost/api/projects/${projectId}/audit`, {
        headers: createAuthHeaders(owner.accessToken, { organizationId: owner.organizationId })
      })
    )
    const auditData = (await auditResp.json()) as any
    expect(auditResp.status).toBe(200)
    expect(auditData.success).toBe(true)
    expect(
      (auditData.logs || []).some((log: any) => log.action === 'project.comment_created')
    ).toBe(true)
    expect(
      (auditData.logs || []).some((log: any) => log.action === 'project.comment_resolved')
    ).toBe(true)
  })

  it('reviews: 应支持 editor 创建、viewer 列表读取', async () => {
    const { owner, editor, viewer, projectId } = await bootstrapProjectWithMembers('reviews-api')

    const viewerCreateResp = await app.handle(
      new Request(`http://localhost/api/projects/${projectId}/reviews`, {
        method: 'POST',
        headers: createAuthHeaders(viewer.accessToken, {
          organizationId: viewer.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          decision: 'approved',
          summary: 'viewer 不应有评审写权限',
          score: 7.5
        })
      })
    )
    expect(viewerCreateResp.status).toBe(403)

    const createApprovedResp = await app.handle(
      new Request(`http://localhost/api/projects/${projectId}/reviews`, {
        method: 'POST',
        headers: createAuthHeaders(editor.accessToken, {
          organizationId: editor.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          decision: 'approved',
          summary: '节奏与镜头衔接符合预期',
          score: 8.8
        })
      })
    )
    const createApprovedData = (await createApprovedResp.json()) as any
    expect(createApprovedResp.status).toBe(200)
    expect(createApprovedData.success).toBe(true)
    expect(createApprovedData.review?.decision).toBe('approved')

    const createChangesResp = await app.handle(
      new Request(`http://localhost/api/projects/${projectId}/reviews`, {
        method: 'POST',
        headers: createAuthHeaders(editor.accessToken, {
          organizationId: editor.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          decision: 'changes_requested',
          summary: '请缩短片头并增强字幕对比'
        })
      })
    )
    const createChangesData = (await createChangesResp.json()) as any
    expect(createChangesResp.status).toBe(200)
    expect(createChangesData.success).toBe(true)
    expect(createChangesData.review?.decision).toBe('changes_requested')

    const listResp = await app.handle(
      new Request(`http://localhost/api/projects/${projectId}/reviews?limit=10`, {
        headers: createAuthHeaders(viewer.accessToken, { organizationId: viewer.organizationId })
      })
    )
    const listData = (await listResp.json()) as any
    expect(listResp.status).toBe(200)
    expect(listData.success).toBe(true)
    expect(Array.isArray(listData.reviews)).toBe(true)
    expect(listData.reviews.length).toBeGreaterThanOrEqual(2)
    expect((listData.reviews || []).some((review: any) => review.decision === 'approved')).toBe(
      true
    )
    expect(
      (listData.reviews || []).some((review: any) => review.decision === 'changes_requested')
    ).toBe(true)

    const auditResp = await app.handle(
      new Request(`http://localhost/api/projects/${projectId}/audit`, {
        headers: createAuthHeaders(owner.accessToken, { organizationId: owner.organizationId })
      })
    )
    const auditData = (await auditResp.json()) as any
    expect(auditResp.status).toBe(200)
    expect(auditData.success).toBe(true)
    expect((auditData.logs || []).some((log: any) => log.action === 'project.review_created')).toBe(
      true
    )
  })
})
