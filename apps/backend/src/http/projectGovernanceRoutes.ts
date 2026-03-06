import { Elysia, t } from 'elysia'
import { WorkspaceService } from '../services/WorkspaceService'
import { authorizeProjectRole } from './context'
import { resolveErrorMessage } from './errors'

export const projectGovernanceRoutes = () =>
  new Elysia()
    .get(
      '/api/projects/:id/audit',
      ({ params, request, set }) => {
        const authorized = authorizeProjectRole(params.id, request, set, 'viewer')
        if (!authorized) {
          if (set.status === 404) {
            return { success: false, status: 'error', error: 'Project not found' }
          }
          return { success: false, status: 'error', error: 'Forbidden: viewer membership required' }
        }
        return {
          success: true,
          logs: WorkspaceService.listAuditsByProject(params.id)
        }
      },
      {
        params: t.Object({ id: t.String() })
      }
    )
    .post(
      '/api/projects/:id/snapshots',
      ({ params, body, request, set }) => {
        const authorized = authorizeProjectRole(params.id, request, set, 'editor')
        if (!authorized) {
          if (set.status === 404) {
            return { success: false, status: 'error', error: 'Project not found' }
          }
          return { success: false, status: 'error', error: 'Forbidden: editor membership required' }
        }
        return {
          success: true,
          snapshot: WorkspaceService.createProjectSnapshot(
            params.id,
            authorized.actorName,
            body.content || {}
          )
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          content: t.Optional(t.Record(t.String(), t.Any()))
        })
      }
    )
    .get(
      '/api/projects/:id/snapshots',
      ({ params, query, request, set }) => {
        const authorized = authorizeProjectRole(params.id, request, set, 'viewer')
        if (!authorized) {
          if (set.status === 404) {
            return { success: false, status: 'error', error: 'Project not found' }
          }
          return { success: false, status: 'error', error: 'Forbidden: viewer membership required' }
        }
        return {
          success: true,
          snapshots: WorkspaceService.listProjectSnapshots(
            params.id,
            Number.parseInt(query.limit || '20', 10)
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
      '/api/projects/:id/comments',
      ({ params, query, request, set }) => {
        const authorized = authorizeProjectRole(params.id, request, set, 'viewer')
        if (!authorized) {
          if (set.status === 404) {
            return { success: false, status: 'error', error: 'Project not found' }
          }
          return { success: false, status: 'error', error: 'Forbidden: viewer membership required' }
        }
        const page = WorkspaceService.listProjectCommentsPage(
          params.id,
          query.cursor,
          Number.parseInt(query.limit || '20', 10)
        )
        return {
          success: true,
          comments: page.comments,
          page: page.page
        }
      },
      {
        params: t.Object({ id: t.String() }),
        query: t.Object({
          cursor: t.Optional(t.String()),
          limit: t.Optional(t.String())
        })
      }
    )
    .post(
      '/api/projects/:id/comments',
      ({ params, body, request, set }) => {
        const authorized = authorizeProjectRole(params.id, request, set, 'editor')
        if (!authorized) {
          if (set.status === 404) {
            return { success: false, status: 'error', error: 'Project not found' }
          }
          return { success: false, status: 'error', error: 'Forbidden: editor membership required' }
        }
        try {
          return {
            success: true,
            comment: WorkspaceService.createProjectComment(params.id, authorized.actorName, {
              anchor: body.anchor,
              content: body.content,
              mentions: body.mentions
            })
          }
        } catch (error: unknown) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: resolveErrorMessage(error, 'Invalid comment payload')
          }
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          anchor: t.Optional(t.String()),
          content: t.String(),
          mentions: t.Optional(t.Array(t.String()))
        })
      }
    )
    .post(
      '/api/projects/:id/comments/:commentId/resolve',
      ({ params, request, set }) => {
        const authorized = authorizeProjectRole(params.id, request, set, 'editor')
        if (!authorized) {
          if (set.status === 404) {
            return { success: false, status: 'error', error: 'Project not found' }
          }
          return { success: false, status: 'error', error: 'Forbidden: editor membership required' }
        }
        const comment = WorkspaceService.resolveProjectComment(
          params.id,
          params.commentId,
          authorized.actorName
        )
        if (!comment) {
          set.status = 404
          return { success: false, status: 'error', error: 'Comment not found' }
        }
        return {
          success: true,
          comment
        }
      },
      {
        params: t.Object({
          id: t.String(),
          commentId: t.String()
        })
      }
    )
    .get(
      '/api/projects/:id/reviews',
      ({ params, query, request, set }) => {
        const authorized = authorizeProjectRole(params.id, request, set, 'viewer')
        if (!authorized) {
          if (set.status === 404) {
            return { success: false, status: 'error', error: 'Project not found' }
          }
          return { success: false, status: 'error', error: 'Forbidden: viewer membership required' }
        }
        return {
          success: true,
          reviews: WorkspaceService.listProjectReviews(
            params.id,
            Number.parseInt(query.limit || '20', 10)
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
    .post(
      '/api/projects/:id/reviews',
      ({ params, body, request, set }) => {
        const authorized = authorizeProjectRole(params.id, request, set, 'editor')
        if (!authorized) {
          if (set.status === 404) {
            return { success: false, status: 'error', error: 'Project not found' }
          }
          return { success: false, status: 'error', error: 'Forbidden: editor membership required' }
        }
        try {
          return {
            success: true,
            review: WorkspaceService.createProjectReview(params.id, authorized.actorName, body)
          }
        } catch (error: unknown) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: resolveErrorMessage(error, 'Invalid review payload')
          }
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          decision: t.Union([t.Literal('approved'), t.Literal('changes_requested')]),
          summary: t.String(),
          score: t.Optional(t.Number())
        })
      }
    )
    .get(
      '/api/projects/:id/templates',
      ({ params, request, set }) => {
        const authorized = authorizeProjectRole(params.id, request, set, 'viewer')
        if (!authorized) {
          if (set.status === 404) {
            return { success: false, status: 'error', error: 'Project not found' }
          }
          return { success: false, status: 'error', error: 'Forbidden: viewer membership required' }
        }
        return {
          success: true,
          templates: WorkspaceService.listProjectTemplates(params.id)
        }
      },
      {
        params: t.Object({ id: t.String() })
      }
    )
    .post(
      '/api/projects/:id/templates/apply',
      ({ params, body, request, set }) => {
        const authorized = authorizeProjectRole(params.id, request, set, 'editor')
        if (!authorized) {
          if (set.status === 404) {
            return { success: false, status: 'error', error: 'Project not found' }
          }
          return { success: false, status: 'error', error: 'Forbidden: editor membership required' }
        }
        try {
          const result = WorkspaceService.applyProjectTemplate(
            params.id,
            authorized.actorName,
            body.templateId,
            body.options
          )
          if (!result) {
            set.status = 404
            return {
              success: false,
              status: 'error',
              error: 'Template not found'
            }
          }
          return {
            success: true,
            result
          }
        } catch (error: unknown) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: resolveErrorMessage(error, 'Template apply failed')
          }
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          templateId: t.String(),
          options: t.Optional(t.Record(t.String(), t.Any()))
        })
      }
    )
    .post(
      '/api/projects/:id/clips/batch-update',
      ({ params, body, request, set }) => {
        const authorized = authorizeProjectRole(params.id, request, set, 'editor')
        if (!authorized) {
          if (set.status === 404) {
            return { success: false, status: 'error', error: 'Project not found' }
          }
          return { success: false, status: 'error', error: 'Forbidden: editor membership required' }
        }
        try {
          return {
            success: true,
            result: WorkspaceService.batchUpdateProjectClips(
              params.id,
              authorized.actorName,
              body.operations
            )
          }
        } catch (error: unknown) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: resolveErrorMessage(error, 'Invalid clip batch update payload')
          }
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          operations: t.Array(
            t.Object({
              clipId: t.String(),
              patch: t.Record(t.String(), t.Any())
            })
          )
        })
      }
    )
