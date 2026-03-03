import { describe, expect, it } from 'bun:test'
import { CollaborationService } from '../apps/backend/src/services/CollaborationService'
import { WorkspaceService } from '../apps/backend/src/services/WorkspaceService'

class MockWs {
  data?: Record<string, any>
  sent: string[] = []

  send(payload: any) {
    this.sent.push(typeof payload === 'string' ? payload : JSON.stringify(payload))
  }
}

const parseMessages = (ws: MockWs) =>
  ws.sent
    .map((row) => {
      try {
        return JSON.parse(row)
      } catch {
        return null
      }
    })
    .filter(Boolean) as Array<Record<string, any>>

describe('协作服务 WS 会话', () => {
  it('应支持加入、心跳、协同事件广播与离开', () => {
    const created = WorkspaceService.createWorkspace(`协作测试-${Date.now()}`, 'Owner A')
    expect(created.workspace?.id).toContain('ws_')
    expect(created.defaultProject?.id).toContain('prj_')

    const workspaceId = created.workspace!.id
    const projectId = created.defaultProject!.id
    WorkspaceService.addMember(workspaceId, 'Editor B', 'editor', 'Owner A')
    const ownerWs = new MockWs()
    const editorWs = new MockWs()

    CollaborationService.join(ownerWs as any, {
      workspaceId,
      memberName: 'Owner A',
      role: 'owner',
      sessionId: 'sess-owner'
    })
    CollaborationService.join(editorWs as any, {
      workspaceId,
      memberName: 'Editor B',
      role: 'editor',
      sessionId: 'sess-editor'
    })

    expect(parseMessages(ownerWs).some((item) => item.type === 'presence.snapshot')).toBe(true)
    expect(
      parseMessages(ownerWs).some(
        (item) => item.type === 'presence.joined' && item.memberName === 'Editor B'
      )
    ).toBe(true)
    expect(parseMessages(editorWs).some((item) => item.type === 'presence.snapshot')).toBe(true)

    CollaborationService.onMessage(ownerWs as any, JSON.stringify({ type: 'presence.heartbeat' }))
    expect(
      parseMessages(ownerWs).some(
        (item) => item.type === 'ack' && item.ackType === 'presence.heartbeat'
      )
    ).toBe(true)

    CollaborationService.onMessage(
      ownerWs as any,
      JSON.stringify({
        type: 'timeline.patch',
        projectId,
        payload: {
          source: 'unit-test',
          patch: 'clip moved'
        }
      })
    )

    expect(
      parseMessages(ownerWs).some(
        (item) => item.type === 'ack' && item.ackType === 'timeline.patch'
      )
    ).toBe(true)
    expect(
      parseMessages(editorWs).some(
        (item) => item.type === 'collab.event' && item.eventType === 'timeline.patch'
      )
    ).toBe(true)

    const history = WorkspaceService.listCollabEvents(workspaceId, 50)
    expect(history.some((item) => item.eventType === 'timeline.patch')).toBe(true)

    CollaborationService.onMessage(editorWs as any, JSON.stringify({ type: 'presence.leave' }))
    expect(
      parseMessages(ownerWs).some(
        (item) => item.type === 'presence.left' && item.memberName === 'Editor B'
      )
    ).toBe(true)

    CollaborationService.leave(ownerWs as any)
  })

  it('收到非法消息时应返回 error', () => {
    const created = WorkspaceService.createWorkspace(`协作异常-${Date.now()}`, 'Owner A')
    const workspaceId = created.workspace!.id

    const ws = new MockWs()
    CollaborationService.join(ws as any, {
      workspaceId,
      memberName: 'Owner A',
      role: 'owner',
      sessionId: 'sess-invalid'
    })

    CollaborationService.onMessage(ws as any, 'not-json')
    expect(
      parseMessages(ws).some(
        (item) => item.type === 'error' && item.error === 'Invalid message payload'
      )
    ).toBe(true)

    CollaborationService.leave(ws as any)
  })

  it('应拒绝非成员接入与跨空间 projectId 事件', () => {
    const workspaceA = WorkspaceService.createWorkspace(`协作隔离-A-${Date.now()}`, 'Owner A')
    const workspaceB = WorkspaceService.createWorkspace(`协作隔离-B-${Date.now()}`, 'Owner B')
    const workspaceIdA = workspaceA.workspace!.id
    const projectIdB = workspaceB.defaultProject!.id

    const ownerWs = new MockWs()
    const outsiderWs = new MockWs()

    const joinedOwner = CollaborationService.join(ownerWs as any, {
      workspaceId: workspaceIdA,
      memberName: 'Owner A',
      role: 'owner',
      sessionId: 'sess-owner-safe'
    })
    const joinedOutsider = CollaborationService.join(outsiderWs as any, {
      workspaceId: workspaceIdA,
      memberName: 'Not Member',
      role: 'owner',
      sessionId: 'sess-outsider'
    })

    expect(joinedOwner).toBe(true)
    expect(joinedOutsider).toBe(false)
    expect(
      parseMessages(outsiderWs).some(
        (item) => item.type === 'error' && item.error === 'Member is not part of workspace'
      )
    ).toBe(true)

    CollaborationService.onMessage(
      ownerWs as any,
      JSON.stringify({
        type: 'timeline.patch',
        projectId: projectIdB,
        payload: { source: 'isolation-test' }
      })
    )

    const ownerMessages = parseMessages(ownerWs)
    expect(
      ownerMessages.some(
        (item) => item.type === 'error' && item.error === 'Project does not belong to workspace'
      )
    ).toBe(true)
    expect(
      ownerMessages.some((item) => item.type === 'ack' && item.ackType === 'timeline.patch')
    ).toBe(false)

    const historyA = WorkspaceService.listCollabEvents(workspaceIdA, 50)
    expect(historyA.some((item) => item.projectId === projectIdB)).toBe(false)

    CollaborationService.leave(ownerWs as any)
  }, 30_000)
})
