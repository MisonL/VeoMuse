import type { WorkspaceRole } from '@veomuse/shared'
import { WorkspaceService } from './WorkspaceService'

interface WsLike {
  send: (payload: any) => void
  data?: Record<string, any>
}

interface JoinPayload {
  workspaceId: string
  memberName: string
  userId?: string
  role?: WorkspaceRole
  sessionId?: string
}

interface IncomingCollabMessage {
  type: 'presence.heartbeat' | 'presence.leave' | 'timeline.patch' | 'project.patch' | 'cursor.update'
  projectId?: string
  payload?: Record<string, unknown>
}

const ALLOWED_MESSAGE_TYPES: ReadonlySet<IncomingCollabMessage['type']> = new Set([
  'presence.heartbeat',
  'presence.leave',
  'timeline.patch',
  'project.patch',
  'cursor.update'
])

const parseIncoming = (raw: string): IncomingCollabMessage | null => {
  try {
    const value = JSON.parse(raw)
    if (!value || typeof value !== 'object' || typeof value.type !== 'string') return null
    if (!ALLOWED_MESSAGE_TYPES.has(value.type as IncomingCollabMessage['type'])) return null
    return {
      type: value.type as IncomingCollabMessage['type'],
      projectId: value.projectId ? String(value.projectId) : undefined,
      payload: value.payload && typeof value.payload === 'object' ? value.payload : {}
    }
  } catch {
    return null
  }
}

const safeSend = (ws: WsLike, payload: Record<string, unknown>) => {
  try {
    ws.send(JSON.stringify(payload))
  } catch {
    // noop
  }
}

export class CollaborationService {
  private static sessions = new Map<string, Map<string, WsLike>>()
  private static sessionMeta = new WeakMap<WsLike, {
    workspaceId: string
    sessionId: string
    memberName: string
    userId: string | null
    role: WorkspaceRole
  }>()

  private static workspaceMap(workspaceId: string) {
    let map = this.sessions.get(workspaceId)
    if (!map) {
      map = new Map<string, WsLike>()
      this.sessions.set(workspaceId, map)
    }
    return map
  }

  private static resolveSession(ws: WsLike) {
    const meta = this.sessionMeta.get(ws)
    const data = (ws.data || {}) as Record<string, any>
    const query = (data.query || {}) as Record<string, any>
    const params = (data.params || {}) as Record<string, any>
    const roleFromQuery = query.role === 'owner' || query.role === 'editor' ? query.role : 'viewer'
    const roleFromData = data.role === 'owner' || data.role === 'editor' || data.role === 'viewer' ? data.role : undefined
    const userId = meta?.userId || data.userId || query.userId || null

    return {
      workspaceId: meta?.workspaceId || data.workspaceId || params.workspaceId || query.workspaceId || null,
      sessionId: meta?.sessionId || data.sessionId || query.sessionId || null,
      memberName: meta?.memberName || data.memberName || query.memberName || 'Guest',
      userId: userId ? String(userId) : null,
      role: (meta?.role || roleFromData || roleFromQuery || 'viewer') as WorkspaceRole
    }
  }

  static join(ws: WsLike, payload: JoinPayload) {
    const sessionId = payload.sessionId?.trim() || `sess_${crypto.randomUUID()}`
    const workspaceId = payload.workspaceId.trim()
    const memberName = payload.memberName.trim() || 'Guest'
    const userId = payload.userId?.trim() || null
    const member = userId
      ? WorkspaceService.getMemberByUserId(workspaceId, userId)
      : WorkspaceService.getMember(workspaceId, memberName)
    if (!member) {
      safeSend(ws, {
        type: 'error',
        error: 'Member is not part of workspace'
      })
      return false
    }
    const role = member.role
    const resolvedMemberName = member.name

    ws.data = {
      ...(ws.data || {}),
      workspaceId,
      sessionId,
      memberName: resolvedMemberName,
      userId,
      role,
      __collabJoined: true
    }
    this.sessionMeta.set(ws, {
      workspaceId,
      sessionId,
      memberName: resolvedMemberName,
      userId,
      role
    })

    this.workspaceMap(workspaceId).set(sessionId, ws)
    WorkspaceService.upsertPresence(workspaceId, sessionId, resolvedMemberName, role)
    WorkspaceService.logCollabEvent(
      workspaceId,
      resolvedMemberName,
      'presence.join',
      { sessionId, role },
      { sessionId }
    )

    const snapshot = WorkspaceService.listPresence(workspaceId)
    safeSend(ws, {
      type: 'presence.snapshot',
      sessionId,
      workspaceId,
      members: snapshot
    })

    this.broadcast(
      workspaceId,
      {
        type: 'presence.joined',
        workspaceId,
        sessionId,
        memberName: resolvedMemberName,
        role,
        members: snapshot
      },
      sessionId
    )

    return true
  }

  static leave(ws: WsLike) {
    const meta = this.sessionMeta.get(ws)
    const data = (ws.data || {}) as Record<string, any>
    const session = this.resolveSession(ws)
    let workspaceId = session.workspaceId ? String(session.workspaceId).trim() : ''
    let sessionId = session.sessionId ? String(session.sessionId).trim() : ''
    let memberName = session.memberName

    if (!meta && data.__collabJoined !== true) {
      if (!workspaceId || !sessionId) return
      const presence = WorkspaceService.getPresenceBySession(workspaceId, sessionId)
      if (!presence) return
      memberName = presence.memberName
      ws.data = {
        ...(ws.data || {}),
        workspaceId,
        sessionId,
        memberName,
        role: presence.role,
        __collabJoined: true
      }
    }

    if (!workspaceId || !sessionId) return

    const map = this.sessions.get(workspaceId)
    map?.delete(sessionId)
    if (map && map.size === 0) this.sessions.delete(workspaceId)
    this.sessionMeta.delete(ws)
    ws.data = {
      ...(ws.data || {}),
      __collabJoined: false
    }

    WorkspaceService.removePresence(workspaceId, sessionId)
    WorkspaceService.logCollabEvent(
      workspaceId,
      memberName,
      'presence.leave',
      { sessionId },
      { sessionId }
    )

    this.broadcast(workspaceId, {
      type: 'presence.left',
      workspaceId,
      sessionId,
      memberName,
      members: WorkspaceService.listPresence(workspaceId)
    })
  }

  static onMessage(ws: WsLike, raw: string) {
    const message = parseIncoming(raw)
    if (!message) {
      safeSend(ws, { type: 'error', error: 'Invalid message payload' })
      return
    }

    const meta = this.sessionMeta.get(ws)
    const data = (ws.data || {}) as Record<string, any>
    const query = (data.query || {}) as Record<string, any>
    const params = (data.params || {}) as Record<string, any>
    const session = this.resolveSession(ws)
    let workspaceId = session.workspaceId
    let sessionId = session.sessionId
    let memberName = session.memberName
    let sessionUserId = session.userId
    let role: WorkspaceRole = session.role

    if (!meta && data.__collabJoined !== true) {
      const fallbackWorkspaceId = String(workspaceId || data.workspaceId || params.workspaceId || query.workspaceId || '').trim()
      const fallbackSessionId = String(sessionId || data.sessionId || query.sessionId || '').trim()
      if (!fallbackWorkspaceId || !fallbackSessionId) {
        safeSend(ws, { type: 'error', error: 'Session not initialized' })
        return
      }
      const presence = WorkspaceService.getPresenceBySession(fallbackWorkspaceId, fallbackSessionId)
      if (!presence) {
        safeSend(ws, { type: 'error', error: 'Session not initialized' })
        return
      }
      workspaceId = fallbackWorkspaceId
      sessionId = fallbackSessionId
      memberName = presence.memberName
      role = presence.role
      ws.data = {
        ...(ws.data || {}),
        workspaceId,
        sessionId,
        memberName,
        role,
        __collabJoined: true
      }
    }

    if (!workspaceId || !sessionId) {
      safeSend(ws, { type: 'error', error: 'Session not initialized' })
      return
    }

    // 某些运行时实现会在 message 回调中丢失 open 阶段注入的 userId；
    // 兜底从 presence(sessionId) 恢复身份，避免协作通道被误判为非成员。
    if (!sessionUserId) {
      const presence = WorkspaceService.getPresenceBySession(workspaceId, sessionId)
      if (presence) {
        memberName = presence.memberName
        role = presence.role
      }
    }

    const currentMember = sessionUserId
      ? WorkspaceService.getMemberByUserId(workspaceId, sessionUserId)
      : WorkspaceService.getMember(workspaceId, memberName)
    if (!currentMember) {
      safeSend(ws, { type: 'error', error: 'Member is not part of workspace' })
      this.leave(ws)
      return
    }
    const currentRole = currentMember.role
    const currentName = currentMember.name
    sessionUserId = currentMember.userId || sessionUserId
    const effectiveMemberName = currentName || memberName
    if (currentRole !== role) {
      role = currentRole
      ws.data = { ...(ws.data || {}), role, memberName: effectiveMemberName }
      this.sessionMeta.set(ws, {
        workspaceId,
        sessionId,
        memberName: effectiveMemberName,
        userId: sessionUserId || null,
        role
      })
    }

    if (message.type === 'presence.heartbeat') {
      WorkspaceService.upsertPresence(workspaceId, sessionId, effectiveMemberName, role)
      safeSend(ws, { type: 'ack', ackType: 'presence.heartbeat', ts: Date.now() })
      return
    }

    if (message.type === 'presence.leave') {
      this.leave(ws)
      return
    }

    if (message.projectId && !WorkspaceService.projectBelongsToWorkspace(workspaceId, message.projectId)) {
      safeSend(ws, { type: 'error', error: 'Project does not belong to workspace' })
      return
    }

    WorkspaceService.upsertPresence(workspaceId, sessionId, effectiveMemberName, role)
    WorkspaceService.logCollabEvent(
      workspaceId,
      effectiveMemberName,
      message.type,
      {
        ...message.payload,
        projectId: message.projectId || null
      },
      { projectId: message.projectId || null, sessionId }
    )

    this.broadcast(
      workspaceId,
      {
        type: 'collab.event',
        eventType: message.type,
        workspaceId,
        projectId: message.projectId || null,
        actorName: effectiveMemberName,
        sessionId,
        payload: message.payload || {},
        ts: Date.now()
      },
      sessionId
    )

    safeSend(ws, {
      type: 'ack',
      ackType: message.type,
      workspaceId,
      sessionId
    })
  }

  private static broadcast(workspaceId: string, payload: Record<string, unknown>, excludeSessionId?: string) {
    const map = this.sessions.get(workspaceId)
    if (!map) return
    map.forEach((client, sid) => {
      if (excludeSessionId && sid === excludeSessionId) return
      safeSend(client, payload)
    })
  }
}
