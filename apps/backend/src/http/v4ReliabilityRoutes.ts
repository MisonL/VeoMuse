import { Elysia, t } from 'elysia'
import { ReliabilityService } from '../services/ReliabilityService'
import { authorizeAdmin } from './context'
import { resolveErrorMessage } from './errors'

export const v4ReliabilityRoutes = () =>
  new Elysia()
    .get(
      '/api/v4/admin/reliability/error-budget',
      ({ request, query, set }) => {
        if (!authorizeAdmin(request, set)) {
          return { success: false, status: 'error', error: 'Unauthorized' }
        }
        const policy = ReliabilityService.getErrorBudgetPolicy(query.policyId || undefined)
        return {
          success: true,
          policy,
          evaluation: ReliabilityService.evaluateErrorBudget(policy.id)
        }
      },
      {
        query: t.Object({
          policyId: t.Optional(t.String())
        })
      }
    )
    .put(
      '/api/v4/admin/reliability/error-budget',
      ({ request, body, set }) => {
        if (!authorizeAdmin(request, set)) {
          return { success: false, status: 'error', error: 'Unauthorized' }
        }
        try {
          const policy = ReliabilityService.upsertErrorBudgetPolicy({
            policyId: body.policyId,
            scope: body.scope,
            targetSlo: body.targetSlo,
            windowDays: body.windowDays,
            warningThresholdRatio: body.warningThresholdRatio,
            alertThresholdRatio: body.alertThresholdRatio,
            freezeDeployOnBreach: body.freezeDeployOnBreach,
            meta: body.meta,
            updatedBy: body.updatedBy || 'admin'
          })
          return {
            success: true,
            policy,
            evaluation: ReliabilityService.evaluateErrorBudget(policy.id)
          }
        } catch (error: unknown) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: resolveErrorMessage(error, '错误预算策略更新失败')
          }
        }
      },
      {
        body: t.Object({
          policyId: t.Optional(t.String()),
          scope: t.Optional(t.String()),
          targetSlo: t.Optional(t.Number()),
          windowDays: t.Optional(t.Number()),
          warningThresholdRatio: t.Optional(t.Number()),
          alertThresholdRatio: t.Optional(t.Number()),
          freezeDeployOnBreach: t.Optional(t.Boolean()),
          updatedBy: t.Optional(t.String()),
          meta: t.Optional(t.Record(t.String(), t.Any()))
        })
      }
    )
    .post(
      '/api/v4/admin/reliability/drills/rollback',
      ({ request, body, set }) => {
        if (!authorizeAdmin(request, set)) {
          return { success: false, status: 'error', error: 'Unauthorized' }
        }
        try {
          return {
            success: true,
            drill: ReliabilityService.createRollbackDrill({
              policyId: body.policyId,
              environment: body.environment,
              status: body.status,
              triggerType: body.triggerType,
              initiatedBy: body.initiatedBy || 'admin',
              summary: body.summary,
              plan: body.plan,
              result: body.result,
              startedAt: body.startedAt,
              completedAt: body.completedAt
            })
          }
        } catch (error: unknown) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: resolveErrorMessage(error, '回滚演练创建失败')
          }
        }
      },
      {
        body: t.Object({
          policyId: t.Optional(t.String()),
          environment: t.Optional(t.String()),
          status: t.Optional(
            t.Union([
              t.Literal('scheduled'),
              t.Literal('running'),
              t.Literal('completed'),
              t.Literal('failed')
            ])
          ),
          triggerType: t.Optional(t.String()),
          initiatedBy: t.Optional(t.String()),
          summary: t.Optional(t.String()),
          plan: t.Optional(t.Record(t.String(), t.Any())),
          result: t.Optional(t.Record(t.String(), t.Any())),
          startedAt: t.Optional(t.String()),
          completedAt: t.Optional(t.String())
        })
      }
    )
    .get(
      '/api/v4/admin/reliability/drills/:drillId',
      ({ params, request, set }) => {
        if (!authorizeAdmin(request, set)) {
          return { success: false, status: 'error', error: 'Unauthorized' }
        }
        const drill = ReliabilityService.getRollbackDrill(params.drillId)
        if (!drill) {
          set.status = 404
          return { success: false, status: 'error', error: 'Rollback drill not found' }
        }
        return { success: true, drill }
      },
      {
        params: t.Object({
          drillId: t.String()
        })
      }
    )
    .get(
      '/api/v4/admin/reliability/alerts',
      ({ request, query, set }) => {
        if (!authorizeAdmin(request, set)) {
          return { success: false, status: 'error', error: 'Unauthorized' }
        }
        return {
          success: true,
          alerts: ReliabilityService.listAlerts({
            level: query.level,
            status: query.status,
            limit: Number.parseInt(query.limit || '50', 10)
          })
        }
      },
      {
        query: t.Object({
          level: t.Optional(
            t.Union([t.Literal('info'), t.Literal('warning'), t.Literal('critical')])
          ),
          status: t.Optional(t.Union([t.Literal('open'), t.Literal('acknowledged')])),
          limit: t.Optional(t.String())
        })
      }
    )
    .post(
      '/api/v4/admin/reliability/alerts/:alertId/ack',
      ({ params, body, request, set }) => {
        if (!authorizeAdmin(request, set)) {
          return { success: false, status: 'error', error: 'Unauthorized' }
        }
        const alert = ReliabilityService.acknowledgeAlert(
          params.alertId,
          body?.acknowledgedBy || 'admin',
          body?.note
        )
        if (!alert) {
          set.status = 404
          return { success: false, status: 'error', error: 'Reliability alert not found' }
        }
        return { success: true, alert }
      },
      {
        params: t.Object({
          alertId: t.String()
        }),
        body: t.Optional(
          t.Object({
            acknowledgedBy: t.Optional(t.String()),
            note: t.Optional(t.String())
          })
        )
      }
    )
