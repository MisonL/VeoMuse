import { Elysia, t } from 'elysia'
import { isSloAdminSeedEnabled, authorizeAdmin } from './context'
import { TelemetryService } from '../services/TelemetryService'
import { ProviderHealthService } from '../services/ProviderHealthService'
import { SloService } from '../services/SloService'
import { LocalDatabaseService } from '../services/LocalDatabaseService'
import { ModelMarketplaceService } from '../services/ModelMarketplaceService'

export const adminRuntimeRoutes = () =>
  new Elysia()
    .get('/api/admin/metrics', ({ request, set }) => {
      if (!authorizeAdmin(request, set)) {
        return { success: false, status: 'error', error: 'Unauthorized' }
      }
      return TelemetryService.getInstance().getSummary()
    })
    .get('/api/admin/providers/health', async ({ request, set }) => {
      if (!authorizeAdmin(request, set)) {
        return { success: false, status: 'error', error: 'Unauthorized' }
      }
      const providers = await ProviderHealthService.inspect()
      return {
        success: true,
        providers,
        summary: {
          total: providers.length,
          configured: providers.filter((item) => item.configured).length,
          ok: providers.filter((item) => item.status === 'ok').length,
          degraded: providers.filter((item) => item.status === 'degraded').length,
          notImplemented: providers.filter((item) => item.status === 'not_implemented').length
        }
      }
    })
    .get(
      '/api/admin/providers/health/:providerId',
      async ({ request, params, set }) => {
        if (!authorizeAdmin(request, set)) {
          return { success: false, status: 'error', error: 'Unauthorized' }
        }
        const providers = await ProviderHealthService.inspect(params.providerId)
        if (!providers.length) {
          set.status = 404
          return { success: false, status: 'error', error: 'Provider not found' }
        }
        return {
          success: true,
          provider: providers[0]
        }
      },
      {
        params: t.Object({
          providerId: t.String()
        })
      }
    )
    .get(
      '/api/admin/slo/summary',
      ({ request, query, set }) => {
        if (!authorizeAdmin(request, set)) {
          return { success: false, status: 'error', error: 'Unauthorized' }
        }
        const windowMinutes = Number.parseInt(query.windowMinutes || '1440', 10)
        return {
          success: true,
          summary: SloService.getSloSummary(windowMinutes)
        }
      },
      {
        query: t.Object({
          windowMinutes: t.Optional(t.String())
        })
      }
    )
    .get(
      '/api/admin/slo/breakdown',
      ({ request, query, set }) => {
        if (!authorizeAdmin(request, set)) {
          return { success: false, status: 'error', error: 'Unauthorized' }
        }
        const windowMinutes = Number.parseInt(query.windowMinutes || '1440', 10)
        const category = query.category || 'non_ai'
        const limit = Number.parseInt(query.limit || '80', 10)
        return {
          success: true,
          breakdown: SloService.getSloBreakdown(windowMinutes, category, limit)
        }
      },
      {
        query: t.Object({
          windowMinutes: t.Optional(t.String()),
          category: t.Optional(
            t.Union([t.Literal('ai'), t.Literal('non_ai'), t.Literal('system')])
          ),
          limit: t.Optional(t.String())
        })
      }
    )
    .get(
      '/api/admin/slo/journey-failures',
      ({ request, query, set }) => {
        if (!authorizeAdmin(request, set)) {
          return { success: false, status: 'error', error: 'Unauthorized' }
        }
        const windowMinutes = Number.parseInt(query.windowMinutes || '1440', 10)
        const limit = Number.parseInt(query.limit || '10', 10)
        const diagnostics = SloService.getJourneyFailureDiagnostics(windowMinutes, limit)
        return {
          success: true,
          window: diagnostics.window,
          counts: diagnostics.counts,
          items: diagnostics.items,
          updatedAt: diagnostics.updatedAt
        }
      },
      {
        query: t.Object({
          windowMinutes: t.Optional(t.String()),
          limit: t.Optional(t.String())
        })
      }
    )
    .post(
      '/api/admin/slo/seed',
      ({ request, body, set }) => {
        if (!authorizeAdmin(request, set)) {
          return { success: false, status: 'error', error: 'Unauthorized' }
        }
        if (!isSloAdminSeedEnabled()) {
          set.status = 403
          return { success: false, status: 'error', error: 'SLO seed endpoint disabled' }
        }

        const nonAiSamples = Math.floor(Number(body?.nonAiSamples ?? 20))
        const journeySamples = Math.floor(Number(body?.journeySamples ?? 10))
        const source = body?.source === 'manual' ? 'manual' : 'ci'

        if (!Number.isFinite(nonAiSamples) || nonAiSamples < 1 || nonAiSamples > 500) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: 'nonAiSamples must be between 1 and 500'
          }
        }

        if (!Number.isFinite(journeySamples) || journeySamples < 1 || journeySamples > 200) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: 'journeySamples must be between 1 and 200'
          }
        }

        const seed = SloService.seedSyntheticSamples({
          nonAiSamples,
          journeySamples,
          source
        })

        return {
          success: true,
          seed
        }
      },
      {
        body: t.Optional(
          t.Object({
            nonAiSamples: t.Optional(t.Number()),
            journeySamples: t.Optional(t.Number()),
            source: t.Optional(t.Union([t.Literal('ci'), t.Literal('manual')]))
          })
        )
      }
    )
    .get(
      '/api/admin/db/health',
      ({ request, query, set }) => {
        if (!authorizeAdmin(request, set)) {
          return { success: false, status: 'error', error: 'Unauthorized' }
        }
        const mode = query.mode === 'full' ? 'full' : 'quick'
        return {
          success: true,
          health: LocalDatabaseService.checkIntegrity(mode),
          lastRepair: LocalDatabaseService.getLastRepairReport()
        }
      },
      {
        query: t.Object({
          mode: t.Optional(t.Union([t.Literal('quick'), t.Literal('full')]))
        })
      }
    )
    .get('/api/admin/db/runtime', ({ request, set }) => {
      if (!authorizeAdmin(request, set)) {
        return { success: false, status: 'error', error: 'Unauthorized' }
      }
      return {
        success: true,
        runtime: LocalDatabaseService.getRuntimeConfig(),
        health: LocalDatabaseService.checkIntegrity('quick'),
        lastRepair: LocalDatabaseService.getLastRepairReport()
      }
    })
    .post(
      '/api/admin/db/repair',
      ({ request, body, set }) => {
        if (!authorizeAdmin(request, set)) {
          return { success: false, status: 'error', error: 'Unauthorized' }
        }
        const repair = LocalDatabaseService.repair({
          force: Boolean(body?.force),
          reason: body?.reason || 'admin-manual',
          checkMode: body?.checkMode
        })
        if (repair.status === 'repaired') {
          ModelMarketplaceService.resetAfterDatabaseRecovery()
        }
        if (repair.status === 'failed') {
          set.status = 500
        }
        return {
          success: repair.status !== 'failed',
          repair
        }
      },
      {
        body: t.Optional(
          t.Object({
            force: t.Optional(t.Boolean()),
            reason: t.Optional(t.String()),
            checkMode: t.Optional(t.Union([t.Literal('quick'), t.Literal('full')]))
          })
        )
      }
    )
    .get(
      '/api/admin/db/repairs',
      ({ request, query, set }) => {
        if (!authorizeAdmin(request, set)) {
          return { success: false, status: 'error', error: 'Unauthorized' }
        }
        const limit = Number.parseInt(query.limit || '20', 10)
        const offset = Number.parseInt(query.offset || '0', 10)
        const from = query.from?.trim()
        const to = query.to?.trim()
        const status = query.status?.trim()
        const reason = query.reason?.trim()
        const history = LocalDatabaseService.getRepairHistory({
          limit,
          offset,
          from,
          to,
          status,
          reason
        })
        return {
          success: true,
          repairs: history.repairs,
          page: {
            total: history.total,
            hasMore: history.hasMore,
            limit: history.limit,
            offset: history.offset
          }
        }
      },
      {
        query: t.Object({
          limit: t.Optional(t.String()),
          offset: t.Optional(t.String()),
          from: t.Optional(t.String()),
          to: t.Optional(t.String()),
          status: t.Optional(t.String()),
          reason: t.Optional(t.String())
        })
      }
    )
