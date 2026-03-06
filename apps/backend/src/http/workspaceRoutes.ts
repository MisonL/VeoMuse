import { Elysia, t } from 'elysia'
import { AuthService } from '../services/AuthService'
import { OrganizationService } from '../services/OrganizationService'
import { CollaborationService } from '../services/CollaborationService'
import { WorkspaceService } from '../services/WorkspaceService'
import {
  authorizeOrganizationRole,
  authorizeWorkspaceRole,
  requireAuthenticatedUser,
  resolveWsAccessToken
} from './context'
import { resolveErrorMessage } from './errors'

type CollabSocketLike = {
  data?: Record<string, unknown>
  send: (payload: string | Record<string, unknown>) => void
  close: () => void
}

const isCollabSocketLike = (value: unknown): value is CollabSocketLike => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as { send?: unknown; close?: unknown }
  return typeof candidate.send === 'function' && typeof candidate.close === 'function'
}

const readRecord = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

export const workspaceRoutes = () =>
  new Elysia()
    .post(
      '/api/workspaces',
      ({ body, request, set }) => {
        const user = requireAuthenticatedUser(request, set)
        if (!user) return { success: false, status: 'error', error: 'Unauthorized' }
        const organizationId =
          body.organizationId?.trim() ||
          OrganizationService.listOrganizationsForUser(user.id)[0]?.id ||
          ''
        if (!organizationId) {
          set.status = 403
          return {
            success: false,
            status: 'error',
            error: 'Forbidden: organization membership required'
          }
        }
        const authorized = authorizeOrganizationRole(organizationId, request, set, 'member')
        if (!authorized) {
          return {
            success: false,
            status: 'error',
            error: 'Forbidden: organization membership required'
          }
        }
        const fallbackOwnerName = user.email.split('@')[0] || 'Owner'
        return {
          success: true,
          ...WorkspaceService.createWorkspace(
            body.name,
            body.ownerName || fallbackOwnerName,
            organizationId,
            user.id,
            body.idempotencyKey
          )
        }
      },
      {
        body: t.Object({
          name: t.String(),
          ownerName: t.Optional(t.String()),
          organizationId: t.Optional(t.String()),
          idempotencyKey: t.Optional(t.String())
        })
      }
    )
    .get(
      '/api/workspaces/:id/invites',
      ({ params, request, set }) => {
        const authorized = authorizeWorkspaceRole(params.id, request, set, 'owner')
        if (!authorized) {
          return { success: false, status: 'error', error: 'Forbidden: owner membership required' }
        }
        return {
          success: true,
          invites: WorkspaceService.listInvites(params.id)
        }
      },
      {
        params: t.Object({ id: t.String() })
      }
    )
    .post(
      '/api/workspaces/:id/invites',
      ({ params, body, request, set }) => {
        const authorized = authorizeWorkspaceRole(params.id, request, set, 'owner')
        if (!authorized) {
          return { success: false, status: 'error', error: 'Forbidden: owner membership required' }
        }
        return {
          success: true,
          invite: WorkspaceService.createInvite(
            params.id,
            body.role,
            authorized.actorName,
            body.expiresInHours
          )
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          role: t.Union([t.Literal('owner'), t.Literal('editor'), t.Literal('viewer')]),
          expiresInHours: t.Optional(t.Number())
        })
      }
    )
    .post(
      '/api/workspaces/invites/:code/accept',
      ({ params, body, request, set }) => {
        const user = requireAuthenticatedUser(request, set)
        if (!user) return { success: false, status: 'error', error: 'Unauthorized' }
        const memberName = body.memberName?.trim() || user.email.split('@')[0] || 'Member'
        const accepted = WorkspaceService.acceptInvite(
          params.code,
          memberName,
          user.id,
          body.idempotencyKey
        )
        if (!accepted) {
          set.status = 404
          return { success: false, status: 'error', error: 'Invite not found or expired' }
        }
        return { success: true, ...accepted }
      },
      {
        params: t.Object({ code: t.String() }),
        body: t.Object({
          memberName: t.Optional(t.String()),
          idempotencyKey: t.Optional(t.String())
        })
      }
    )
    .get(
      '/api/workspaces/:id/members',
      ({ params, request, set }) => {
        const authorized = authorizeWorkspaceRole(params.id, request, set, 'viewer')
        if (!authorized) {
          return { success: false, status: 'error', error: 'Forbidden: viewer membership required' }
        }
        return {
          success: true,
          members: WorkspaceService.getMembers(params.id)
        }
      },
      {
        params: t.Object({ id: t.String() })
      }
    )
    .get(
      '/api/workspaces/:id/presence',
      ({ params, request, set }) => {
        const authorized = authorizeWorkspaceRole(params.id, request, set, 'viewer')
        if (!authorized) {
          return { success: false, status: 'error', error: 'Forbidden: viewer membership required' }
        }
        return {
          success: true,
          members: WorkspaceService.listPresence(params.id)
        }
      },
      {
        params: t.Object({ id: t.String() })
      }
    )
    .get(
      '/api/workspaces/:id/collab/events',
      ({ params, query, request, set }) => {
        const authorized = authorizeWorkspaceRole(params.id, request, set, 'viewer')
        if (!authorized) {
          return { success: false, status: 'error', error: 'Forbidden: viewer membership required' }
        }
        return {
          success: true,
          events: WorkspaceService.listCollabEvents(
            params.id,
            Number.parseInt(query.limit || '50', 10)
          )
        }
      },
      {
        params: t.Object({ id: t.String() }),
        query: t.Object({
          limit: t.Optional(t.String())
        })
      }
    )
    .get(
      '/api/workspaces/:id/projects',
      ({ params, request, set }) => {
        const authorized = authorizeWorkspaceRole(params.id, request, set, 'viewer')
        if (!authorized) {
          return { success: false, status: 'error', error: 'Forbidden: viewer membership required' }
        }
        return {
          success: true,
          projects: WorkspaceService.listWorkspaceProjects(params.id)
        }
      },
      {
        params: t.Object({ id: t.String() })
      }
    )
    .post(
      '/api/projects',
      ({ body, request, set }) => {
        const authorized = authorizeWorkspaceRole(body.workspaceId, request, set, 'editor')
        if (!authorized) {
          if (set.status === 401) {
            return { success: false, status: 'error', error: 'Unauthorized' }
          }
          return { success: false, status: 'error', error: 'Forbidden: editor membership required' }
        }
        try {
          const project = WorkspaceService.createProject(
            body.workspaceId,
            body.name,
            authorized.actorName
          )
          return {
            success: true,
            project
          }
        } catch (error: unknown) {
          if (resolveErrorMessage(error, '') === 'Workspace not found') {
            set.status = 404
            return { success: false, status: 'error', error: 'Workspace not found' }
          }
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: resolveErrorMessage(error, 'Create project failed')
          }
        }
      },
      {
        body: t.Object({
          workspaceId: t.String(),
          name: t.String()
        })
      }
    )
    .post(
      '/api/workspaces/:id/members',
      ({ params, body, request, set }) => {
        const authorized = authorizeWorkspaceRole(params.id, request, set, 'owner')
        if (!authorized) {
          return { success: false, status: 'error', error: 'Forbidden: owner membership required' }
        }
        return {
          success: true,
          members: WorkspaceService.addMember(
            params.id,
            body.name,
            body.role,
            authorized.actorName,
            body.userId
          )
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          name: t.String(),
          role: t.Union([t.Literal('owner'), t.Literal('editor'), t.Literal('viewer')]),
          userId: t.Optional(t.String())
        })
      }
    )
    .ws('/ws/collab/:workspaceId', {
      open(ws) {
        if (!isCollabSocketLike(ws)) {
          return
        }
        const socket = ws
        const data = readRecord(socket.data)
        const params = readRecord(data.params)
        const query = readRecord(data.query)
        const headers = readRecord(data.headers)
        const workspaceId = String(params.workspaceId || query.workspaceId || '')
        if (!workspaceId) {
          socket.send(JSON.stringify({ type: 'error', error: 'workspaceId is required' }))
          socket.close()
          return
        }
        const accessToken = resolveWsAccessToken(headers)
        const user = accessToken ? AuthService.verifyAccessToken(accessToken) : null
        if (!user) {
          socket.send(JSON.stringify({ type: 'error', error: 'Unauthorized websocket request' }))
          socket.close()
          return
        }
        const member = WorkspaceService.getMemberByUserId(workspaceId, user.id)
        if (!member) {
          socket.send(JSON.stringify({ type: 'error', error: 'Member is not part of workspace' }))
          socket.close()
          return
        }
        const joined = CollaborationService.join(socket, {
          workspaceId,
          memberName: member.name,
          userId: user.id,
          role: member.role,
          sessionId: query.sessionId ? String(query.sessionId) : undefined
        })
        if (!joined) {
          socket.close()
        }
      },
      message(ws, message) {
        if (!isCollabSocketLike(ws)) return
        const socket = ws
        const content = (() => {
          if (typeof message === 'string') return message
          if (message instanceof Uint8Array) return Buffer.from(message).toString('utf8')
          if (message instanceof ArrayBuffer) return Buffer.from(message).toString('utf8')
          if (ArrayBuffer.isView(message)) {
            return Buffer.from(message.buffer, message.byteOffset, message.byteLength).toString(
              'utf8'
            )
          }
          if (typeof message === 'object' && message !== null) {
            try {
              return JSON.stringify(message)
            } catch {
              return ''
            }
          }
          return ''
        })()
        CollaborationService.onMessage(socket, content)
      },
      close(ws) {
        if (!isCollabSocketLike(ws)) return
        const socket = ws
        CollaborationService.leave(socket)
      }
    })
