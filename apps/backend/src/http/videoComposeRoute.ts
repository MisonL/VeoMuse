import fs from 'fs/promises'
import { Elysia, t } from 'elysia'
import { CompositionService } from '../services/CompositionService'
import { OrganizationGovernanceService } from '../services/OrganizationGovernanceService'
import {
  buildQuotaExceededResponse,
  hasRenderableSources,
  resolveRequestTraceId,
  resolveRuntimeContext
} from './context'
import { resolveErrorMessage } from './errors'

export const videoComposeRoute = new Elysia().post(
  '/api/video/compose',
  async ({ body, request, set }) => {
    const runtimeContext = resolveRuntimeContext(request, set, body.workspaceId)
    if (!runtimeContext) {
      return { success: false, status: 'error', error: 'Forbidden' }
    }
    if (!hasRenderableSources(body.timelineData)) {
      set.status = 400
      return {
        success: false,
        status: 'error',
        error: '请先导入并放置至少一个可渲染片段后再导出',
        code: 'VALIDATION'
      }
    }
    try {
      let requestDenied: ReturnType<
        typeof OrganizationGovernanceService.consumeRequestQuota
      > | null = null
      const composed = await OrganizationGovernanceService.withConcurrencyLimit(
        runtimeContext.organizationId,
        async () => {
          const quotaConsumed = OrganizationGovernanceService.consumeRequestQuota(
            runtimeContext.organizationId,
            1
          )
          if (!quotaConsumed.allowed) {
            requestDenied = quotaConsumed
            return null
          }
          return await CompositionService.compose(body.timelineData)
        }
      )

      if (requestDenied) {
        set.status = 429
        return buildQuotaExceededResponse('request', requestDenied)
      }

      if (composed?.success && composed?.outputPath) {
        let outputBytes = 0
        try {
          const stat = await fs.stat(composed.outputPath)
          outputBytes = Number(stat.size || 0)
        } catch {
          outputBytes = 0
        }

        if (outputBytes > 0) {
          const storageCheck = OrganizationGovernanceService.checkStorageAllowed(
            runtimeContext.organizationId,
            outputBytes
          )
          if (!storageCheck.allowed) {
            try {
              await fs.unlink(composed.outputPath)
            } catch (cleanupError: unknown) {
              try {
                await Bun.sleep(80)
                await fs.unlink(composed.outputPath)
              } catch (retryError: unknown) {
                console.warn(
                  `[video-compose] cleanup failed after storage quota denial: trace=${resolveRequestTraceId(
                    request,
                    'trace_compose_cleanup'
                  )}, path=${composed.outputPath}, error=${resolveErrorMessage(
                    cleanupError,
                    'unlink failed'
                  )}, retryError=${resolveErrorMessage(retryError, 'retry unlink failed')}`
                )
              }
            }
            set.status = 429
            return buildQuotaExceededResponse('storage', storageCheck)
          }
          OrganizationGovernanceService.addStorageUsage(runtimeContext.organizationId, outputBytes)
        }
      }

      return composed
    } catch (error: unknown) {
      const message = resolveErrorMessage(error, '')
      if (message.includes('并发配额')) {
        const check = OrganizationGovernanceService.checkConcurrencyAllowed(
          runtimeContext.organizationId
        )
        set.status = 429
        return buildQuotaExceededResponse('concurrency', check)
      }
      throw error
    }
  },
  {
    body: t.Object({
      timelineData: t.Any(),
      workspaceId: t.Optional(t.String())
    })
  }
)
