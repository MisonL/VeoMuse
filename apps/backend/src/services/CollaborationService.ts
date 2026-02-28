import type { WorkspaceRole } from '@veomuse/shared'
import { WorkspaceService } from './WorkspaceService'

interface WsLike {
  send: (payload: any) => void
  data?: Record<string, any>
}

interface JoinPayload {
  workspaceId: string
  memberName: string
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

    return {
      workspaceId: meta?.workspaceId || data.workspaceId || params.workspaceId || query.workspaceId || null,
      sessionId: meta?.sessionId || data.sessionId || query.sessionId || null,
      memberName: meta?.memberName || data.memberName || query.memberName || 'Guest',
      role: (meta?.role || roleFromData || roleFromQuery || 'viewer') as WorkspaceRole
    }
  }

  static join(ws: WsLike, payload: JoinPayload) {
    const sessionId = payload.sessionId?.trim() || `sess_${crypto.randomUUID()}`
    const workspaceId = payload.workspaceId.trim()
    const memberName = payload.memberName.trim() || 'Guest'
    const memberRole = WorkspaceService.getMemberRole(workspaceId, memberName)
    if (!memberRole) {
      safeSend(ws, {
        type: 'error',
        error: 'Member is not part of workspace'
      })
      return false
    }
    const role = memberRole

    ws.data = {
      ...(ws.data || {}),
      workspaceId,
      sessionId,
      memberName,
      role
    }
    this.sessionMeta.set(ws, {
      workspaceId,
      sessionId,
      memberName,
      role
    })

    this.workspaceMap(workspaceId).set(sessionId, ws)
    WorkspaceService.upsertPresence(workspaceId, sessionId, memberName, role)
    WorkspaceService.logCollabEvent(
      workspaceId,
      memberName,
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
        memberName,
        role,
        members: snapshot
      },
      sessionId
    )

    return true
  }

  static leave(ws: WsLike) {
    const session = this.resolveSession(ws)
    const workspaceId = session.workspaceId
    const sessionId = session.sessionId
    const memberName = session.memberName
    if (!workspaceId || !sessionId) return

    const map = this.sessions.get(workspaceId)
    map?.delete(sessionId)
    if (map && map.size === 0) this.sessions.delete(workspaceId)
    this.sessionMeta.delete(ws)

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

    const session = this.resolveSession(ws)
    const workspaceId = session.workspaceId
    const sessionId = session.sessionId
    const memberName = session.memberName
    let role: WorkspaceRole = session.role

    if (!workspaceId || !sessionId) {
      safeSend(ws, { type: 'error', error: 'Session not initialized' })
      return
    }

    const currentRole = WorkspaceService.getMemberRole(workspaceId, memberName)
    if (!currentRole) {
      safeSend(ws, { type: 'error', error: 'Member is not part of workspace' })
      this.leave(ws)
      return
    }
    if (currentRole !== role) {
      role = currentRole
      ws.data = { ...(ws.data || {}), role }
      this.sessionMeta.set(ws, {
        workspaceId,
        sessionId,
        memberName,
        role
      })
    }

    if (message.type === 'presence.heartbeat') {
      WorkspaceService.upsertPresence(workspaceId, sessionId, memberName, role)
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

    WorkspaceService.upsertPresence(workspaceId, sessionId, memberName, role)
    WorkspaceService.logCollabEvent(
      workspaceId,
      memberName,
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
        actorName: memberName,
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
