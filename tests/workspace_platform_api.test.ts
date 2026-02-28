import { describe, expect, it } from 'bun:test'
import { app } from '../apps/backend/src/index'
import { WorkspaceService } from '../apps/backend/src/services/WorkspaceService'

describe('协作平台化 API', () => {
  it('应支持邀请、接受邀请、在线态、快照与上传令牌', async () => {
    const createResp = await app.handle(
      new Request('http://localhost/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '协作空间 A',
          ownerName: 'Owner A'
        })
      })
    )
    const createData = await createResp.json() as any
    expect(createResp.status).toBe(200)
    expect(createData.success).toBe(true)

    const workspaceId = createData.workspace.id as string
    const projectId = createData.defaultProject.id as string

    const inviteResp = await app.handle(
      new Request(`http://localhost/api/workspaces/${workspaceId}/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-actor': 'Owner A'
        },
        body: JSON.stringify({
          role: 'editor',
          expiresInHours: 12
        })
      })
    )
    const inviteData = await inviteResp.json() as any
    expect(inviteResp.status).toBe(200)
    expect(inviteData.success).toBe(true)
    expect(inviteData.invite.role).toBe('editor')

    const code = inviteData.invite.code as string

    const listInviteResp = await app.handle(
      new Request(`http://localhost/api/workspaces/${workspaceId}/invites`, {
        headers: { 'x-workspace-actor': 'Owner A' }
      })
    )
    const listInviteData = await listInviteResp.json() as any
    expect(listInviteResp.status).toBe(200)
    expect(listInviteData.invites.some((item: any) => item.code === code)).toBe(true)

    const acceptResp = await app.handle(
      new Request(`http://localhost/api/workspaces/invites/${code}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberName: 'Editor B'
        })
      })
    )
    const acceptData = await acceptResp.json() as any
    expect(acceptResp.status).toBe(200)
    expect(acceptData.success).toBe(true)
    expect(acceptData.member.name).toBe('Editor B')
    expect(acceptData.workspace.id).toBe(workspaceId)
    expect(acceptData.defaultProject.id).toBe(projectId)

    const membersResp = await app.handle(
      new Request(`http://localhost/api/workspaces/${workspaceId}/members`, {
        headers: { 'x-workspace-actor': 'Owner A' }
      })
    )
    const membersData = await membersResp.json() as any
    expect(membersResp.status).toBe(200)
    expect(membersData.members.some((item: any) => item.name === 'Editor B')).toBe(true)

    WorkspaceService.upsertPresence(workspaceId, 'sess-test-1', 'Editor B', 'editor')
    const presenceForbiddenResp = await app.handle(
      new Request(`http://localhost/api/workspaces/${workspaceId}/presence`)
    )
    expect(presenceForbiddenResp.status).toBe(403)

    const presenceResp = await app.handle(
      new Request(`http://localhost/api/workspaces/${workspaceId}/presence`, {
        headers: { 'x-workspace-actor': 'Editor B' }
      })
    )
    const presenceData = await presenceResp.json() as any
    expect(presenceResp.status).toBe(200)
    expect(presenceData.success).toBe(true)
    expect(presenceData.members.some((item: any) => item.memberName === 'Editor B')).toBe(true)

    const snapshotResp = await app.handle(
      new Request(`http://localhost/api/projects/${projectId}/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-workspace-actor': 'Owner A' },
        body: JSON.stringify({
          content: {
            timelineVersion: 3,
            note: 'before export'
          }
        })
      })
    )
    const snapshotData = await snapshotResp.json() as any
    expect(snapshotResp.status).toBe(200)
    expect(snapshotData.success).toBe(true)
    expect(snapshotData.snapshot.projectId).toBe(projectId)

    const listSnapshotResp = await app.handle(
      new Request(`http://localhost/api/projects/${projectId}/snapshots?limit=10`, {
        headers: { 'x-workspace-actor': 'Editor B' }
      })
    )
    const listSnapshotData = await listSnapshotResp.json() as any
    expect(listSnapshotResp.status).toBe(200)
    expect(listSnapshotData.success).toBe(true)
    expect(listSnapshotData.snapshots.length).toBeGreaterThan(0)

    const uploadTokenForbiddenResp = await app.handle(
      new Request('http://localhost/api/storage/upload-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          projectId,
          fileName: 'demo.mp4',
          contentType: 'video/mp4'
        })
      })
    )
    expect(uploadTokenForbiddenResp.status).toBe(403)

    const uploadTokenResp = await app.handle(
      new Request('http://localhost/api/storage/upload-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-actor': 'Editor B'
        },
        body: JSON.stringify({
          workspaceId,
          projectId,
          fileName: 'demo.mp4',
          contentType: 'video/mp4'
        })
      })
    )
    const uploadTokenData = await uploadTokenResp.json() as any
    expect(uploadTokenResp.status).toBe(200)
    expect(uploadTokenData.success).toBe(true)
    expect(uploadTokenData.token.provider).toBe('local')
    expect(typeof uploadTokenData.token.objectKey).toBe('string')

    const uploadResp = await app.handle(
      new Request(`http://localhost${uploadTokenData.token.uploadUrl}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream',
          'x-workspace-actor': 'Editor B'
        },
        body: 'binary-content'
      })
    )
    const uploadData = await uploadResp.json() as any
    expect(uploadResp.status).toBe(201)
    expect(uploadData.success).toBe(true)
    expect(uploadData.uploaded.objectKey).toBe(uploadTokenData.token.objectKey)
  })
})
