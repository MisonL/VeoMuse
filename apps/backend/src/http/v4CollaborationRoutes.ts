import { Elysia, t } from 'elysia'
import { CollaborationV4Service } from '../services/CollaborationV4Service'
import { authorizeProjectRole, authorizeWorkspaceRole } from './context'
import { resolveErrorMessage } from './errors'

export const v4CollaborationRoutes = () =>
  new Elysia()
    .get(
      '/api/v4/projects/:projectId/comment-threads',
      ({ params, query, request, set }) => {
        const authorized = authorizeProjectRole(params.projectId, request, set, 'viewer')
        if (!authorized) {
          if (set.status === 404) {
            return { success: false, status: 'error', error: 'Project not found' }
          }
          return { success: false, status: 'error', error: 'Forbidden: viewer membership required' }
        }
        const pageResult = CollaborationV4Service.listCommentThreadsPage(
          params.projectId,
          query.cursor,
          Number.parseInt(query.limit || '20', 10)
        )
        return {
          success: true,
          threads: pageResult.threads,
          page: pageResult.page
        }
      },
      {
        params: t.Object({
          projectId: t.String()
        }),
        query: t.Object({
          cursor: t.Optional(t.String()),
          limit: t.Optional(t.String())
        })
      }
    )
    .post(
      '/api/v4/projects/:projectId/comment-threads',
      ({ params, body, request, set }) => {
        const authorized = authorizeProjectRole(params.projectId, request, set, 'editor')
        if (!authorized) {
          if (set.status === 404) {
            return { success: false, status: 'error', error: 'Project not found' }
          }
          return { success: false, status: 'error', error: 'Forbidden: editor membership required' }
        }
        try {
          return {
            success: true,
            thread: CollaborationV4Service.createCommentThread(
              params.projectId,
              authorized.actorName,
              body
            )
          }
        } catch (error: unknown) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: resolveErrorMessage(error, '评论线程创建失败')
          }
        }
      },
      {
        params: t.Object({
          projectId: t.String()
        }),
        body: t.Object({
          anchor: t.Optional(t.String()),
          content: t.String(),
          mentions: t.Optional(t.Array(t.String()))
        })
      }
    )
    .post(
      '/api/v4/projects/:projectId/comment-threads/:threadId/replies',
      ({ params, body, request, set }) => {
        const authorized = authorizeProjectRole(params.projectId, request, set, 'editor')
        if (!authorized) {
          if (set.status === 404) {
            return { success: false, status: 'error', error: 'Project not found' }
          }
          return { success: false, status: 'error', error: 'Forbidden: editor membership required' }
        }
        try {
          return {
            success: true,
            reply: CollaborationV4Service.createCommentReply(
              params.projectId,
              params.threadId,
              authorized.actorName,
              body
            )
          }
        } catch (error: unknown) {
          const message = resolveErrorMessage(error, '')
          if (message.includes('不存在')) {
            set.status = 404
          } else {
            set.status = 400
          }
          return { success: false, status: 'error', error: message || '评论回复创建失败' }
        }
      },
      {
        params: t.Object({
          projectId: t.String(),
          threadId: t.String()
        }),
        body: t.Object({
          content: t.String(),
          mentions: t.Optional(t.Array(t.String()))
        })
      }
    )
    .post(
      '/api/v4/projects/:projectId/comment-threads/:threadId/resolve',
      ({ params, request, set }) => {
        const authorized = authorizeProjectRole(params.projectId, request, set, 'editor')
        if (!authorized) {
          if (set.status === 404) {
            return { success: false, status: 'error', error: 'Project not found' }
          }
          return { success: false, status: 'error', error: 'Forbidden: editor membership required' }
        }
        const thread = CollaborationV4Service.resolveCommentThread(
          params.projectId,
          params.threadId,
          authorized.actorName
        )
        if (!thread) {
          set.status = 404
          return { success: false, status: 'error', error: 'Comment thread not found' }
        }
        return { success: true, thread }
      },
      {
        params: t.Object({
          projectId: t.String(),
          threadId: t.String()
        })
      }
    )
    .get(
      '/api/v4/workspaces/:workspaceId/permissions',
      ({ params, request, set }) => {
        const authorized = authorizeWorkspaceRole(params.workspaceId, request, set, 'viewer')
        if (!authorized) {
          return { success: false, status: 'error', error: 'Forbidden: viewer membership required' }
        }
        try {
          return {
            success: true,
            permissions: CollaborationV4Service.listWorkspaceRolePermissions(params.workspaceId)
          }
        } catch (error: unknown) {
          const message = resolveErrorMessage(error, '')
          if (message.includes('不存在')) set.status = 404
          return { success: false, status: 'error', error: message || '角色权限读取失败' }
        }
      },
      {
        params: t.Object({
          workspaceId: t.String()
        })
      }
    )
    .put(
      '/api/v4/workspaces/:workspaceId/permissions/:role',
      ({ params, body, request, set }) => {
        const authorized = authorizeWorkspaceRole(params.workspaceId, request, set, 'owner')
        if (!authorized) {
          return { success: false, status: 'error', error: 'Forbidden: owner membership required' }
        }
        try {
          return {
            success: true,
            permission: CollaborationV4Service.setWorkspaceRolePermissions(
              params.workspaceId,
              params.role,
              {
                permissions: body.permissions,
                updatedBy: body.updatedBy || authorized.actorName
              }
            )
          }
        } catch (error: unknown) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: resolveErrorMessage(error, '角色权限写入失败')
          }
        }
      },
      {
        params: t.Object({
          workspaceId: t.String(),
          role: t.Union([t.Literal('owner'), t.Literal('editor'), t.Literal('viewer')])
        }),
        body: t.Object({
          permissions: t.Record(t.String(), t.Boolean()),
          updatedBy: t.Optional(t.String())
        })
      }
    )
    .post(
      '/api/v4/projects/:projectId/timeline/merge',
      ({ params, body, request, set }) => {
        const authorized = authorizeProjectRole(params.projectId, request, set, 'editor')
        if (!authorized) {
          if (set.status === 404) {
            return { success: false, status: 'error', error: 'Project not found' }
          }
          return { success: false, status: 'error', error: 'Forbidden: editor membership required' }
        }
        try {
          return {
            success: true,
            merge: CollaborationV4Service.mergeTimeline(
              params.projectId,
              authorized.actorName,
              body
            )
          }
        } catch (error: unknown) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: resolveErrorMessage(error, 'Timeline merge 失败')
          }
        }
      },
      {
        params: t.Object({
          projectId: t.String()
        }),
        body: t.Object({
          sourceRevision: t.Optional(t.String()),
          targetRevision: t.Optional(t.String()),
          conflicts: t.Optional(t.Array(t.Any())),
          result: t.Optional(t.Record(t.String(), t.Any())),
          status: t.Optional(t.Union([t.Literal('merged'), t.Literal('conflict')]))
        })
      }
    )
