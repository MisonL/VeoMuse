import { Elysia, t } from 'elysia'
import { ModelMarketplaceService } from '../services/ModelMarketplaceService'
import { VideoOrchestrator } from '../services/VideoOrchestrator'
import { ModelRouter } from '../services/ModelRouter'
import { resolveOrganizationContext } from './context'
import { resolveErrorMessage } from './errors'

export const modelRoutes = () =>
  new Elysia()
    .get('/api/models', () => VideoOrchestrator.getAvailableModels())
    .get('/api/models/marketplace', () => ({
      success: true,
      models: ModelMarketplaceService.listMarketplace()
    }))
    .get('/api/models/policies', ({ request, set }) => {
      const organizationContext = resolveOrganizationContext(request, set, 'member')
      if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
      return {
        success: true,
        policies: ModelMarketplaceService.listPolicies(organizationContext.organizationId)
      }
    })
    .post(
      '/api/models/policies',
      ({ body, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'admin')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        try {
          return {
            success: true,
            policy: ModelMarketplaceService.createPolicy(organizationContext.organizationId, body)
          }
        } catch (error: unknown) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: resolveErrorMessage(error, 'Invalid routing policy payload')
          }
        }
      },
      {
        body: t.Object({
          name: t.String(),
          description: t.Optional(t.String()),
          priority: t.Optional(
            t.Union([t.Literal('quality'), t.Literal('speed'), t.Literal('cost')])
          ),
          maxBudgetUsd: t.Optional(t.Number()),
          enabled: t.Optional(t.Boolean()),
          allowedModels: t.Optional(t.Array(t.String())),
          weights: t.Optional(
            t.Object({
              quality: t.Optional(t.Number()),
              speed: t.Optional(t.Number()),
              cost: t.Optional(t.Number()),
              reliability: t.Optional(t.Number())
            })
          ),
          fallbackPolicyId: t.Optional(t.String())
        })
      }
    )
    .patch(
      '/api/models/policies/:id',
      ({ params, body, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'admin')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        try {
          const policy = ModelMarketplaceService.updatePolicy(
            organizationContext.organizationId,
            params.id,
            body
          )
          if (!policy) {
            set.status = 404
            return { success: false, status: 'error', error: 'Routing policy not found' }
          }
          return { success: true, policy }
        } catch (error: unknown) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: resolveErrorMessage(error, 'Invalid routing policy payload')
          }
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          name: t.Optional(t.String()),
          description: t.Optional(t.String()),
          priority: t.Optional(
            t.Union([t.Literal('quality'), t.Literal('speed'), t.Literal('cost')])
          ),
          maxBudgetUsd: t.Optional(t.Number()),
          enabled: t.Optional(t.Boolean()),
          allowedModels: t.Optional(t.Array(t.String())),
          weights: t.Optional(
            t.Object({
              quality: t.Optional(t.Number()),
              speed: t.Optional(t.Number()),
              cost: t.Optional(t.Number()),
              reliability: t.Optional(t.Number())
            })
          ),
          fallbackPolicyId: t.Optional(t.String())
        })
      }
    )
    .post(
      '/api/models/policies/:id/simulate',
      ({ params, body, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'member')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        const policy = ModelMarketplaceService.getPolicy(
          params.id,
          organizationContext.organizationId
        )
        if (!policy) {
          set.status = 404
          return { success: false, status: 'error', error: 'Routing policy not found' }
        }
        return {
          success: true,
          decision: ModelMarketplaceService.simulateDecision(
            body,
            params.id,
            organizationContext.organizationId
          )
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          prompt: t.String(),
          budgetUsd: t.Optional(t.Number()),
          priority: t.Optional(
            t.Union([t.Literal('quality'), t.Literal('speed'), t.Literal('cost')])
          )
        })
      }
    )
    .post(
      '/api/models/policies/:id/execute',
      ({ params, body, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'member')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        const policy = ModelMarketplaceService.getPolicy(
          params.id,
          organizationContext.organizationId
        )
        if (!policy) {
          set.status = 404
          return { success: false, status: 'error', error: 'Routing policy not found' }
        }
        return {
          success: true,
          decision: ModelMarketplaceService.executeDecision(
            body,
            params.id,
            organizationContext.organizationId
          )
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          prompt: t.String(),
          budgetUsd: t.Optional(t.Number()),
          priority: t.Optional(
            t.Union([t.Literal('quality'), t.Literal('speed'), t.Literal('cost')])
          )
        })
      }
    )
    .get(
      '/api/models/policies/:id/executions',
      ({ params, query, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'member')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        const policy = ModelMarketplaceService.getPolicy(
          params.id,
          organizationContext.organizationId
        )
        if (!policy) {
          set.status = 404
          return { success: false, status: 'error', error: 'Routing policy not found' }
        }
        const limit = Number.parseInt(query.limit || '20', 10)
        const offset = Number.parseInt(query.offset || '0', 10)
        return {
          success: true,
          ...ModelMarketplaceService.listPolicyExecutions(
            organizationContext.organizationId,
            params.id,
            { limit, offset }
          )
        }
      },
      {
        params: t.Object({ id: t.String() }),
        query: t.Object({
          limit: t.Optional(t.String()),
          offset: t.Optional(t.String())
        })
      }
    )
    .post(
      '/api/models/policies/:id/sandbox/simulate-batch',
      ({ params, body, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'member')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        const policy = ModelMarketplaceService.getPolicy(
          params.id,
          organizationContext.organizationId
        )
        if (!policy) {
          set.status = 404
          return { success: false, status: 'error', error: 'Routing policy not found' }
        }
        try {
          return {
            success: true,
            result: ModelMarketplaceService.simulateDecisionBatch(
              organizationContext.organizationId,
              params.id,
              body.scenarios
            )
          }
        } catch (error: unknown) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: resolveErrorMessage(error, 'Invalid batch simulation payload')
          }
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          scenarios: t.Array(
            t.Object({
              prompt: t.String(),
              budgetUsd: t.Optional(t.Number()),
              priority: t.Optional(
                t.Union([t.Literal('quality'), t.Literal('speed'), t.Literal('cost')])
              )
            })
          )
        })
      }
    )
    .get(
      '/api/models/policies/:id/alerts',
      ({ params, query, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'member')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        const policy = ModelMarketplaceService.getPolicy(
          params.id,
          organizationContext.organizationId
        )
        if (!policy) {
          set.status = 404
          return { success: false, status: 'error', error: 'Routing policy not found' }
        }
        const limit = Number.parseInt(query.limit || '50', 10)
        return {
          success: true,
          config: ModelMarketplaceService.getPolicyAlertConfig(
            organizationContext.organizationId,
            params.id
          ),
          alerts: ModelMarketplaceService.listPolicyAlerts(
            organizationContext.organizationId,
            params.id,
            limit
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
    .put(
      '/api/models/policies/:id/alerts/config',
      ({ params, body, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'admin')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        const policy = ModelMarketplaceService.getPolicy(
          params.id,
          organizationContext.organizationId
        )
        if (!policy) {
          set.status = 404
          return { success: false, status: 'error', error: 'Routing policy not found' }
        }
        try {
          return {
            success: true,
            config: ModelMarketplaceService.updatePolicyAlertConfig(
              organizationContext.organizationId,
              params.id,
              body
            )
          }
        } catch (error: unknown) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: resolveErrorMessage(error, 'Invalid alert config payload')
          }
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          enabled: t.Optional(t.Boolean()),
          channels: t.Optional(t.Array(t.String())),
          warningThresholdRatio: t.Optional(t.Number()),
          criticalThresholdRatio: t.Optional(t.Number())
        })
      }
    )
    .get(
      '/api/models/:id/profile',
      ({ params, set }) => {
        const profile = ModelMarketplaceService.getProfile(params.id)
        if (!profile) {
          set.status = 404
          return { success: false, status: 'error', error: 'Model profile not found' }
        }
        return { success: true, profile }
      },
      {
        params: t.Object({ id: t.String() })
      }
    )
    .post(
      '/api/models/policy/simulate',
      ({ body, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'member')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        return {
          success: true,
          decision: ModelMarketplaceService.simulateDecision(
            body,
            undefined,
            organizationContext.organizationId
          )
        }
      },
      {
        body: t.Object({
          prompt: t.String(),
          budgetUsd: t.Optional(t.Number()),
          priority: t.Optional(
            t.Union([t.Literal('quality'), t.Literal('speed'), t.Literal('cost')])
          )
        })
      }
    )
    .post(
      '/api/models/policy/execute',
      ({ body, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'member')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        return {
          success: true,
          decision: ModelMarketplaceService.executeDecision(
            body,
            undefined,
            organizationContext.organizationId
          )
        }
      },
      {
        body: t.Object({
          prompt: t.String(),
          budgetUsd: t.Optional(t.Number()),
          priority: t.Optional(
            t.Union([t.Literal('quality'), t.Literal('speed'), t.Literal('cost')])
          )
        })
      }
    )
    .post('/api/models/recommend', async ({ body }) => await ModelRouter.recommend(body.prompt), {
      body: t.Object({ prompt: t.String() })
    })
