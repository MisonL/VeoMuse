import { Elysia, t } from 'elysia'
import { OrganizationService } from '../services/OrganizationService'
import { SloService } from '../services/SloService'
import { WorkspaceService } from '../services/WorkspaceService'
import { requireAuthenticatedUser } from './context'

export const journeyTelemetryRoutes = () =>
  new Elysia().post(
    '/api/telemetry/journey',
    ({ body, request, set }) => {
      const user = requireAuthenticatedUser(request, set)
      if (!user) return { success: false, status: 'error', error: 'Unauthorized' }
      const flowType = body.flowType
      const source = body.source === 'e2e' ? 'e2e' : 'frontend'
      const workspaceId = body.workspaceId?.trim() || ''
      const organizationFromHeader = request.headers.get('x-organization-id')?.trim() || ''
      const organizationFromBody = body.organizationId?.trim() || ''
      let organizationId = organizationFromBody || organizationFromHeader || ''

      if (!Number.isFinite(body.stepCount) || body.stepCount < 1) {
        set.status = 400
        return { success: false, status: 'error', error: 'stepCount must be >= 1' }
      }

      if (workspaceId) {
        const member = WorkspaceService.getMemberByUserId(workspaceId, user.id)
        if (!member) {
          set.status = 403
          return {
            success: false,
            status: 'error',
            error: 'Forbidden: workspace membership required'
          }
        }
        const workspace = WorkspaceService.getWorkspace(workspaceId)
        if (workspace?.organizationId) organizationId = workspace.organizationId
      }

      if (organizationId) {
        const role = OrganizationService.getMemberRole(organizationId, user.id)
        if (!role) {
          set.status = 403
          return {
            success: false,
            status: 'error',
            error: 'Forbidden: organization membership required'
          }
        }
      } else {
        organizationId = OrganizationService.listOrganizationsForUser(user.id)[0]?.id || ''
      }

      const journey = SloService.recordJourneyRun({
        flowType,
        source,
        userId: user.id,
        organizationId: organizationId || null,
        workspaceId: workspaceId || null,
        sessionId: body.sessionId?.trim() || null,
        idempotencyKey: body.idempotencyKey?.trim() || null,
        stepCount: body.stepCount,
        success: body.success,
        durationMs: body.durationMs,
        meta: body.meta
      })

      return { success: true, journey, deduplicated: Boolean(journey.deduplicated) }
    },
    {
      body: t.Object({
        flowType: t.Union([t.Literal('first_success_path')]),
        source: t.Optional(t.Union([t.Literal('frontend'), t.Literal('e2e')])),
        stepCount: t.Number(),
        success: t.Boolean(),
        durationMs: t.Optional(t.Number()),
        organizationId: t.Optional(t.String()),
        workspaceId: t.Optional(t.String()),
        sessionId: t.Optional(t.String()),
        idempotencyKey: t.Optional(t.String()),
        meta: t.Optional(t.Record(t.String(), t.Any()))
      })
    }
  )
