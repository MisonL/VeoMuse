import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { ApiKeyService } from './services/ApiKeyService'
import { VideoOrchestrator } from './services/VideoOrchestrator'
import { GeminiDriver } from './services/drivers/GeminiDriver'
import { KlingDriver } from './services/drivers/KlingDriver'
import { SoraDriver } from './services/drivers/SoraDriver'
import { LumaDriver } from './services/drivers/LumaDriver'
import { RunwayDriver } from './services/drivers/RunwayDriver'
import { PikaDriver } from './services/drivers/PikaDriver'
import { OpenAiCompatibleDriver } from './services/drivers/OpenAiCompatibleDriver'
import { ModelMarketplaceService } from './services/ModelMarketplaceService'
import { LocalStorageProvider } from './services/storage/LocalStorageProvider'
import { OrganizationService } from './services/OrganizationService'
import { SloService } from './services/SloService'
import { appMetaRoutes } from './http/appMetaRoutes'
import { videoComposeRoute } from './http/videoComposeRoute'
import { adminRuntimeRoutes } from './http/adminRuntimeRoutes'
import { aiRoutes } from './http/aiRoutes'
import { authRoutes } from './http/authRoutes'
import { organizationRoutes } from './http/organizationRoutes'
import { channelConfigRoutes } from './http/channelConfigRoutes'
import { journeyTelemetryRoutes } from './http/journeyTelemetryRoutes'
import { modelRoutes } from './http/modelRoutes'
import { videoGenerationRoutes } from './http/videoGenerationRoutes'
import { workspaceRoutes } from './http/workspaceRoutes'
import { projectGovernanceRoutes } from './http/projectGovernanceRoutes'
import { storageRoutes } from './http/storageRoutes'
import { v4ReliabilityRoutes } from './http/v4ReliabilityRoutes'
import { v4CreativeRoutes } from './http/v4CreativeRoutes'
import { v4CollaborationRoutes } from './http/v4CollaborationRoutes'
import { normalizeRoutePath, resolveMetricCategory, resolveStatusCode } from './http/metrics'
import { startAppRuntime } from './runtime/bootstrap'

const ensureDriversRegistered = (() => {
  let initialized = false

  return () => {
    if (initialized) return
    ApiKeyService.init(process.env.GEMINI_API_KEYS || '')
    VideoOrchestrator.registerDriver(new GeminiDriver())
    VideoOrchestrator.registerDriver(new KlingDriver())
    VideoOrchestrator.registerDriver(new SoraDriver())
    VideoOrchestrator.registerDriver(new LumaDriver())
    VideoOrchestrator.registerDriver(new RunwayDriver())
    VideoOrchestrator.registerDriver(new PikaDriver())
    VideoOrchestrator.registerDriver(new OpenAiCompatibleDriver())
    initialized = true
  }
})()

const storageProvider = new LocalStorageProvider()

export const createApp = () => {
  ensureDriversRegistered()
  ModelMarketplaceService.ensureInitialized()
  OrganizationService.ensureDefaultOrganization()
  const requestStartAt = new WeakMap<Request, number>()
  const requestPathname = new WeakMap<Request, string>()
  type RequestContextLike = {
    request?: Request
    set?: {
      status?: number | string
      headers?: Record<string, string>
    }
    code?: string
    error?: unknown
  }
  const readRequestContext = (context: unknown): RequestContextLike => {
    if (!context || typeof context !== 'object') return {}
    return context as RequestContextLike
  }

  const finalizeRequestMetric = (
    request: Request | null | undefined,
    status: number | string | undefined
  ) => {
    if (!request) return
    const startedAt = requestStartAt.get(request)
    if (!startedAt) return
    requestStartAt.delete(request)
    const pathname =
      requestPathname.get(request) ||
      (() => {
        try {
          return new URL(request.url).pathname || '/'
        } catch {
          return '/'
        }
      })()
    requestPathname.delete(request)
    const durationMs = Math.max(0, Number((performance.now() - startedAt).toFixed(2)))
    const statusCode = resolveStatusCode(status)
    const category = resolveMetricCategory(pathname)
    SloService.recordRequestMetric({
      requestId: request.headers.get('x-request-id') || undefined,
      routeKey: normalizeRoutePath(pathname),
      method: request.method || 'GET',
      category,
      statusCode,
      durationMs,
      success: statusCode < 400
    })
  }

  return new Elysia()
    .use(cors())
    .onRequest((context) => {
      const request = readRequestContext(context).request
      if (!request) return
      requestStartAt.set(request, performance.now())
      try {
        requestPathname.set(request, new URL(request.url).pathname || '/')
      } catch {
        requestPathname.set(request, '/')
      }
    })
    .trace(async ({ onHandle, set }) => {
      onHandle(({ begin, onStop }) => {
        onStop(({ end }) => {
          set.headers['Server-Timing'] = `handle;dur=${end - begin};desc="Execution"`
        })
      })
    })
    .onAfterHandle((context) => {
      const normalized = readRequestContext(context)
      const request = normalized.request
      const status = normalized.set?.status
      finalizeRequestMetric(request, status)
    })
    .onError((context) => {
      const normalized = readRequestContext(context)
      const code = String(normalized.code || 'UNKNOWN')
      const error = normalized.error
      const set = normalized.set || {}
      const request = normalized.request
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const currentStatus = typeof set.status === 'number' ? set.status : 500
      set.status = currentStatus >= 400 ? currentStatus : 500
      finalizeRequestMetric(request, set.status)
      console.error(`🚨 [Global Guard] ${code}: ${errorMessage}`)
      return { success: false, status: 'error', error: errorMessage, code }
    })
    .use(appMetaRoutes(storageProvider.type))
    .use(authRoutes())
    .use(organizationRoutes())
    .use(channelConfigRoutes(storageProvider.type))
    .use(adminRuntimeRoutes())
    .use(journeyTelemetryRoutes())
    .use(modelRoutes())
    .use(videoGenerationRoutes())
    .use(aiRoutes())

    .use(v4ReliabilityRoutes())
    .use(v4CollaborationRoutes())
    .use(v4CreativeRoutes())
    .use(workspaceRoutes())
    .use(projectGovernanceRoutes())
    .use(storageRoutes(storageProvider))

    .use(videoComposeRoute)

    .ws('/ws/generation', {
      open(ws) {
        ws.send({ message: '已连接到旗舰级总线' })
      }
    })
}

export const app = createApp()

if (import.meta.main) {
  startAppRuntime({ app })
}

export type App = typeof app
