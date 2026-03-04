import { Elysia, t } from 'elysia'
import { cors } from '@elysiajs/cors'
import path from 'path'
import fs from 'fs/promises'
import { ApiKeyService } from './services/ApiKeyService'
import { PromptEnhanceService } from './services/PromptEnhanceService'
import { AiClipService } from './services/AiClipService'
import { CompositionService } from './services/CompositionService'
import { TtsService } from './services/TtsService'
import { MusicAdviceService } from './services/MusicAdviceService'
import { VideoOrchestrator } from './services/VideoOrchestrator'
import { GeminiDriver } from './services/drivers/GeminiDriver'
import { KlingDriver } from './services/drivers/KlingDriver'
import { SoraDriver } from './services/drivers/SoraDriver'
import { LumaDriver } from './services/drivers/LumaDriver'
import { RunwayDriver } from './services/drivers/RunwayDriver'
import { PikaDriver } from './services/drivers/PikaDriver'
import { OpenAiCompatibleDriver } from './services/drivers/OpenAiCompatibleDriver'
import { ModelRouter } from './services/ModelRouter'
import { AiDirectorService } from './services/AiDirectorService'
import { InpaintService } from './services/InpaintService'
import { AudioAnalysisService } from './services/AudioAnalysisService'
import { VoiceMorphService } from './services/VoiceMorphService'
import { TranslationService } from './services/TranslationService'
import { SpatialRenderService } from './services/SpatialRenderService'
import { VfxService } from './services/VfxService'
import { LipSyncService } from './services/LipSyncService'
import { RelightingService } from './services/RelightingService'
import { TelemetryService } from './services/TelemetryService'
import { StyleTransferService } from './services/StyleTransferService'
import { ActorConsistencyService } from './services/ActorConsistencyService'
import { cleanupGeneratedFiles, startCleanupScheduler } from './services/CleanupSchedulerService'
import { LocalDatabaseService } from './services/LocalDatabaseService'
import { ModelMarketplaceService } from './services/ModelMarketplaceService'
import { CreativePipelineService } from './services/CreativePipelineService'
import { WorkspaceService } from './services/WorkspaceService'
import { CollaborationService } from './services/CollaborationService'
import { ReliabilityService } from './services/ReliabilityService'
import { CollaborationV4Service } from './services/CollaborationV4Service'
import { CreativeWorkflowService } from './services/CreativeWorkflowService'
import { ProviderHealthService } from './services/ProviderHealthService'
import {
  VideoGenerationService,
  VideoGenerationValidationError
} from './services/VideoGenerationService'
import type { VideoGenerationJobStatus } from './services/VideoGenerationService'
import { LocalStorageProvider } from './services/storage/LocalStorageProvider'
import { AuthService } from './services/AuthService'
import { OrganizationService } from './services/OrganizationService'
import { ChannelConfigService } from './services/ChannelConfigService'
import { OrganizationGovernanceService } from './services/OrganizationGovernanceService'
import { SloService } from './services/SloService'
import type { WorkspaceRole, OrganizationRole } from '@veomuse/shared'

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

const resolveGeneratedDir = () => {
  const baseUploadsDir = process.env.UPLOADS_PATH
    ? path.resolve(process.env.UPLOADS_PATH)
    : path.resolve(process.cwd(), '../../uploads')
  return path.join(baseUploadsDir, 'generated')
}

const resolveImportDir = () => {
  const baseUploadsDir = process.env.UPLOADS_PATH
    ? path.resolve(process.env.UPLOADS_PATH)
    : path.resolve(process.cwd(), '../../uploads')
  return path.join(baseUploadsDir, 'imports')
}

const sanitizeImportFileName = (fileName: string) => {
  const base = path.basename(fileName || '').trim()
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, '_')
  if (safe) return safe
  return `asset-${Date.now()}.bin`
}
const storageProvider = new LocalStorageProvider()

const isLikelyDynamicSegment = (segment: string) => {
  if (!segment) return false
  if (/^\d+$/.test(segment)) return true
  if (/^[a-f0-9]{8,}$/i.test(segment)) return true
  if (/^[a-f0-9-]{16,}$/i.test(segment)) return true
  if (
    /^(ws|prj|project|policy|scene|run|invite|member|audit|dbr|org|user)_[a-z0-9_-]+$/i.test(
      segment
    )
  )
    return true
  if (/^[A-Za-z0-9_-]{20,}$/.test(segment)) return true
  return false
}

const normalizeRoutePath = (pathname: string) => {
  const cleaned = pathname.trim()
  if (!cleaned) return '/'
  return cleaned
    .split('/')
    .map((segment, index) => {
      if (index === 0 || !segment) return segment
      return isLikelyDynamicSegment(segment) ? ':id' : segment
    })
    .join('/')
}

const resolveMetricCategory = (pathname: string) => {
  if (!pathname.startsWith('/api/')) return 'system' as const
  if (pathname === '/api/health') return 'system' as const
  if (pathname.startsWith('/api/admin/')) return 'system' as const
  if (pathname.startsWith('/api/telemetry/')) return 'system' as const
  if (
    pathname.startsWith('/api/ai/') ||
    pathname === '/api/video/generate' ||
    pathname.startsWith('/api/video/generations') ||
    pathname === '/api/video/compose' ||
    pathname === '/api/models/recommend'
  ) {
    return 'ai' as const
  }
  return 'non_ai' as const
}

const resolveStatusCode = (status: number | string | undefined) => {
  if (typeof status === 'number' && Number.isFinite(status)) return status
  if (typeof status === 'string') {
    const parsed = Number.parseInt(status, 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return 200
}

const isDevRuntime = () => {
  const nodeEnv = String(process.env.NODE_ENV || '').toLowerCase()
  return nodeEnv === 'development' || nodeEnv === 'test'
}

const parseBooleanEnv = (value: string | undefined) => {
  if (!value) return false
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

const isSloAdminSeedEnabled = () => parseBooleanEnv(process.env.SLO_ADMIN_SEED_ENABLED)

const authorizeAdmin = (request: Request, set: { status?: number | string }) => {
  const token = process.env.ADMIN_TOKEN
  if (!token) {
    if (isDevRuntime()) return true
    set.status = 503
    return false
  }

  const provided = request.headers.get('x-admin-token')
  if (provided === token) return true

  set.status = 401
  return false
}

const getAuthenticatedUser = (request: Request) => {
  const authorization = request.headers.get('authorization') || ''
  const token = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : ''
  if (!token) return null
  return AuthService.verifyAccessToken(token)
}

const requireAuthenticatedUser = (request: Request, set: { status?: number | string }) => {
  const user = getAuthenticatedUser(request)
  if (!user) {
    set.status = 401
    return null
  }
  return user
}

const ORGANIZATION_ROLE_ORDER: Record<OrganizationRole, number> = {
  member: 1,
  admin: 2,
  owner: 3
}

const authorizeOrganizationRole = (
  organizationId: string,
  request: Request,
  set: { status?: number | string },
  requiredRole: OrganizationRole
) => {
  const user = requireAuthenticatedUser(request, set)
  if (!user) return null
  const actualRole = OrganizationService.getMemberRole(organizationId, user.id)
  if (!actualRole || ORGANIZATION_ROLE_ORDER[actualRole] < ORGANIZATION_ROLE_ORDER[requiredRole]) {
    set.status = 403
    return null
  }
  return {
    user,
    role: actualRole
  }
}

const WORKSPACE_ROLE_ORDER: Record<WorkspaceRole, number> = {
  viewer: 1,
  editor: 2,
  owner: 3
}

const authorizeWorkspaceRole = (
  workspaceId: string,
  request: Request,
  set: { status?: number | string },
  requiredRole: WorkspaceRole
) => {
  const user = requireAuthenticatedUser(request, set)
  if (!user) return null

  const member = WorkspaceService.getMemberByUserId(workspaceId, user.id)
  if (!member) {
    set.status = 403
    return null
  }

  const actualRole = member.role
  if (WORKSPACE_ROLE_ORDER[actualRole] < WORKSPACE_ROLE_ORDER[requiredRole]) {
    set.status = 403
    return null
  }

  return {
    user,
    actorName: member.name,
    role: actualRole,
    member
  }
}

const resolveOrganizationContext = (
  request: Request,
  set: { status?: number | string },
  requiredRole: OrganizationRole = 'member'
) => {
  const user = requireAuthenticatedUser(request, set)
  if (!user) return null
  const organizations = OrganizationService.listOrganizationsForUser(user.id)
  if (!organizations.length) {
    set.status = 403
    return null
  }
  const headerOrganizationId = request.headers.get('x-organization-id')?.trim()
  const matchedOrganizationId = headerOrganizationId
    ? organizations.find((item) => item.id === headerOrganizationId)?.id
    : organizations[0]?.id
  if (!matchedOrganizationId) {
    set.status = 403
    return null
  }
  const role = OrganizationService.getMemberRole(matchedOrganizationId, user.id)
  if (!role || ORGANIZATION_ROLE_ORDER[role] < ORGANIZATION_ROLE_ORDER[requiredRole]) {
    set.status = 403
    return null
  }
  return {
    user,
    organizationId: matchedOrganizationId,
    role
  }
}

const resolveRuntimeContext = (
  request: Request,
  set: { status?: number | string },
  workspaceId?: string
) => {
  const user = requireAuthenticatedUser(request, set)
  if (!user) return null
  const headerWorkspaceId = request.headers.get('x-workspace-id')?.trim()
  const finalWorkspaceId = workspaceId?.trim() || headerWorkspaceId || undefined

  if (finalWorkspaceId) {
    const workspace = WorkspaceService.getWorkspace(finalWorkspaceId)
    if (!workspace) {
      set.status = 404
      return null
    }
    const orgRole = OrganizationService.getMemberRole(workspace.organizationId, user.id)
    if (!orgRole) {
      set.status = 403
      return null
    }
    const workspaceMember = WorkspaceService.getMemberByUserId(finalWorkspaceId, user.id)
    if (!workspaceMember) {
      set.status = 403
      return null
    }
    return {
      organizationId: workspace.organizationId,
      workspaceId: finalWorkspaceId,
      actorName: workspaceMember.name,
      user
    }
  }

  const organizationContext = resolveOrganizationContext(request, set, 'member')
  if (!organizationContext) return null

  return {
    organizationId: organizationContext.organizationId,
    workspaceId: undefined,
    actorName: organizationContext.user.email.split('@')[0] || 'member',
    user: organizationContext.user
  }
}

const isGeminiNotConfiguredError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || '')
  return message.includes('GEMINI_API_KEYS') || message.includes('未配置 Gemini API 密钥')
}

const buildGeminiNotConfiguredResponse = () => ({
  success: false,
  status: 'not_implemented',
  message: 'Gemini provider 未配置 (GEMINI_API_KEYS)'
})

const authorizeProjectRole = (
  projectId: string,
  request: Request,
  set: { status?: number | string },
  requiredRole: WorkspaceRole
) => {
  const project = WorkspaceService.getProject(projectId)
  if (!project) {
    set.status = 404
    return null
  }

  const authorized = authorizeWorkspaceRole(project.workspaceId, request, set, requiredRole)
  if (!authorized) return null

  return {
    ...authorized,
    workspaceId: project.workspaceId,
    project
  }
}

const resolveVideoGenerationJobContext = (
  jobId: string,
  request: Request,
  set: { status?: number | string }
) => {
  const organizationContext = resolveOrganizationContext(request, set, 'member')
  if (!organizationContext) return null
  const job = VideoGenerationService.getById(jobId, organizationContext.organizationId)
  if (!job) {
    set.status = 404
    return null
  }
  if (job.workspaceId) {
    const member = WorkspaceService.getMemberByUserId(job.workspaceId, organizationContext.user.id)
    if (!member) {
      set.status = 403
      return null
    }
  }
  return {
    organizationContext,
    job
  }
}

const getCapabilities = (request?: Request, workspaceId?: string) => {
  if (request) {
    const runtimeContext = resolveRuntimeContext(request, {}, workspaceId)
    const capabilities = runtimeContext
      ? ChannelConfigService.getCapabilities({
          organizationId: runtimeContext.organizationId,
          workspaceId: runtimeContext.workspaceId
        })
      : null
    const hasConfigured = capabilities
      ? Object.values(capabilities.models).some(Boolean) ||
        Object.values(capabilities.services).some(Boolean)
      : false
    if (capabilities && hasConfigured) {
      return {
        models: capabilities.models,
        services: {
          ...capabilities.services,
          marketplace: true,
          creativePipeline: true,
          workspace: true,
          collaboration: true,
          storageProvider: storageProvider.type
        },
        timestamp: new Date().toISOString()
      }
    }
  }
  const configured = (key?: string) => Boolean(key && key.trim().length > 0)

  return {
    models: {
      'veo-3.1': configured(process.env.GEMINI_API_KEYS),
      'kling-v1': configured(process.env.KLING_API_URL) && configured(process.env.KLING_API_KEY),
      'sora-preview': configured(process.env.SORA_API_URL) && configured(process.env.SORA_API_KEY),
      'luma-dream': configured(process.env.LUMA_API_URL) && configured(process.env.LUMA_API_KEY),
      'runway-gen3':
        configured(process.env.RUNWAY_API_URL) && configured(process.env.RUNWAY_API_KEY),
      'pika-1.5': configured(process.env.PIKA_API_URL) && configured(process.env.PIKA_API_KEY),
      'openai-compatible':
        configured(process.env.OPENAI_COMPATIBLE_BASE_URL || process.env.OPENAI_BASE_URL) &&
        configured(process.env.OPENAI_COMPATIBLE_API_KEY || process.env.OPENAI_API_KEY) &&
        configured(process.env.OPENAI_COMPATIBLE_MODEL || process.env.OPENAI_MODEL)
    },
    services: {
      tts: configured(process.env.TTS_API_URL) && configured(process.env.TTS_API_KEY),
      voiceMorph:
        configured(process.env.VOICE_MORPH_API_URL) && configured(process.env.VOICE_MORPH_API_KEY),
      spatialRender:
        configured(process.env.SPATIAL_API_URL) && configured(process.env.SPATIAL_API_KEY),
      vfx: configured(process.env.VFX_API_URL) && configured(process.env.VFX_API_KEY),
      lipSync: configured(process.env.LIP_SYNC_API_URL) && configured(process.env.LIP_SYNC_API_KEY),
      audioAnalysis:
        configured(process.env.AUDIO_ANALYSIS_API_URL) &&
        configured(process.env.AUDIO_ANALYSIS_API_KEY),
      relighting:
        configured(process.env.RELIGHT_API_URL) && configured(process.env.RELIGHT_API_KEY),
      styleTransfer:
        configured(process.env.ALCHEMY_API_URL) && configured(process.env.ALCHEMY_API_KEY),
      marketplace: true,
      creativePipeline: true,
      workspace: true,
      collaboration: true,
      storageProvider: storageProvider.type
    },
    timestamp: new Date().toISOString()
  }
}

const hasRenderableSources = (timelineData: any) => {
  if (!timelineData || !Array.isArray(timelineData.tracks)) return false

  return timelineData.tracks.some(
    (track: any) =>
      track?.type !== 'text' &&
      track?.type !== 'mask' &&
      Array.isArray(track?.clips) &&
      track.clips.some((clip: any) => typeof clip?.src === 'string' && clip.src.trim().length > 0)
  )
}

const buildQuotaExceededResponse = (
  reason: 'request' | 'storage' | 'concurrency',
  check: {
    limit: number
    current: number
    upcoming: number
    remaining: number
    usage: unknown
    quota: unknown
  }
) => {
  const reasonMessage =
    reason === 'request'
      ? '组织请求配额已达上限'
      : reason === 'storage'
        ? '组织存储配额已达上限'
        : '组织并发配额已达上限'
  return {
    success: false,
    status: 'error',
    code: 'QUOTA_EXCEEDED',
    reason,
    error: `${reasonMessage}（limit=${check.limit}, current=${check.current}, upcoming=${check.upcoming}）`,
    quota: check.quota,
    usage: check.usage,
    remaining: Number.isFinite(check.remaining) ? check.remaining : null
  }
}

const parseBoundedLimit = (value: string | undefined, fallback: number, max: number) => {
  const parsed = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(max, parsed)
}

const WS_AUTH_PROTOCOL_PREFIX = 'veomuse-auth.'

const resolveWsAccessToken = (headers: Record<string, unknown>) => {
  const protocolHeader = String(
    headers['sec-websocket-protocol'] || headers['Sec-WebSocket-Protocol'] || ''
  )
  const fromProtocol = protocolHeader
    .split(',')
    .map((token) => token.trim())
    .find((token) => token.startsWith(WS_AUTH_PROTOCOL_PREFIX))
  if (fromProtocol) {
    const token = fromProtocol.slice(WS_AUTH_PROTOCOL_PREFIX.length).trim()
    if (token) return token
  }
  const authorizationHeader = String(headers.authorization || headers.Authorization || '').trim()
  if (authorizationHeader.toLowerCase().startsWith('bearer ')) {
    const token = authorizationHeader.slice(7).trim()
    if (token) return token
  }
  return ''
}

export const createApp = () => {
  ensureDriversRegistered()
  ModelMarketplaceService.ensureInitialized()
  OrganizationService.ensureDefaultOrganization()
  const requestStartAt = new WeakMap<Request, number>()
  const requestPathname = new WeakMap<Request, string>()

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
      const request = (context as any)?.request as Request | undefined
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
      const request = (context as any)?.request as Request | undefined
      const status = (context as any)?.set?.status as number | string | undefined
      finalizeRequestMetric(request, status)
    })
    .onError((context) => {
      const code = (context as any)?.code as string
      const error = (context as any)?.error
      const set = (context as any)?.set as {
        status?: number | string
        headers?: Record<string, string>
      }
      const request = (context as any)?.request as Request | undefined
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const currentStatus = typeof set.status === 'number' ? set.status : 500
      set.status = currentStatus >= 400 ? currentStatus : 500
      finalizeRequestMetric(request, set.status)
      console.error(`🚨 [Global Guard] ${code}: ${errorMessage}`)
      return { success: false, status: 'error', error: errorMessage, code }
    })
    .get('/', () => 'VeoMuse Backend Active')
    .get('/api/health', () => ({ status: 'ok' }))
    .get(
      '/api/capabilities',
      ({ request, query }) => {
        const workspaceId = query.workspaceId?.trim() || undefined
        return getCapabilities(request, workspaceId)
      },
      {
        query: t.Object({
          workspaceId: t.Optional(t.String())
        })
      }
    )
    .post(
      '/api/auth/register',
      async ({ body, set }) => {
        try {
          const user = await AuthService.register(body.email, body.password)
          const organization = OrganizationService.createOrganization(
            body.organizationName || `${user.email.split('@')[0]} 的组织`,
            user.id
          )
          const session = AuthService.createSession(user)
          return {
            success: true,
            session,
            organizations: [organization]
          }
        } catch (error: any) {
          set.status = 400
          return { success: false, status: 'error', error: error?.message || '注册失败' }
        }
      },
      {
        body: t.Object({
          email: t.String(),
          password: t.String(),
          organizationName: t.Optional(t.String())
        })
      }
    )
    .post(
      '/api/auth/login',
      async ({ body, set }) => {
        try {
          const user = await AuthService.login(body.email, body.password)
          const session = AuthService.createSession(user)
          const organizations = OrganizationService.listOrganizationsForUser(user.id)
          return { success: true, session, organizations }
        } catch (error: any) {
          set.status = 401
          return { success: false, status: 'error', error: error?.message || '登录失败' }
        }
      },
      {
        body: t.Object({
          email: t.String(),
          password: t.String()
        })
      }
    )
    .post(
      '/api/auth/refresh',
      ({ body, set }) => {
        try {
          const session = AuthService.rotateSession(body.refreshToken)
          const organizations = OrganizationService.listOrganizationsForUser(session.user.id)
          return { success: true, session, organizations }
        } catch (error: any) {
          set.status = 401
          return { success: false, status: 'error', error: error?.message || '刷新会话失败' }
        }
      },
      {
        body: t.Object({
          refreshToken: t.String()
        })
      }
    )
    .post(
      '/api/auth/logout',
      ({ body }) => {
        AuthService.revokeRefreshToken(body.refreshToken || '')
        return { success: true }
      },
      {
        body: t.Object({
          refreshToken: t.Optional(t.String())
        })
      }
    )
    .get('/api/auth/me', ({ request, set }) => {
      const user = requireAuthenticatedUser(request, set)
      if (!user) return { success: false, status: 'error', error: 'Unauthorized' }
      return {
        success: true,
        user,
        organizations: OrganizationService.listOrganizationsForUser(user.id)
      }
    })
    .post(
      '/api/organizations',
      ({ request, body, set }) => {
        const user = requireAuthenticatedUser(request, set)
        if (!user) return { success: false, status: 'error', error: 'Unauthorized' }
        try {
          const organization = OrganizationService.createOrganization(body.name, user.id)
          return { success: true, organization }
        } catch (error: any) {
          set.status = 400
          return { success: false, status: 'error', error: error?.message || '创建组织失败' }
        }
      },
      {
        body: t.Object({
          name: t.String()
        })
      }
    )
    .get('/api/organizations', ({ request, set }) => {
      const user = requireAuthenticatedUser(request, set)
      if (!user) return { success: false, status: 'error', error: 'Unauthorized' }
      return {
        success: true,
        organizations: OrganizationService.listOrganizationsForUser(user.id)
      }
    })
    .get(
      '/api/organizations/:id',
      ({ params, request, set }) => {
        const authorized = authorizeOrganizationRole(params.id, request, set, 'member')
        if (!authorized) return { success: false, status: 'error', error: 'Forbidden' }
        const organization = OrganizationService.getOrganization(params.id)
        if (!organization) {
          set.status = 404
          return { success: false, status: 'error', error: 'Organization not found' }
        }
        return { success: true, organization, role: authorized.role }
      },
      {
        params: t.Object({ id: t.String() })
      }
    )
    .get(
      '/api/organizations/:id/members',
      ({ params, request, set }) => {
        const authorized = authorizeOrganizationRole(params.id, request, set, 'member')
        if (!authorized) return { success: false, status: 'error', error: 'Forbidden' }
        return {
          success: true,
          members: OrganizationService.listMembers(params.id)
        }
      },
      {
        params: t.Object({ id: t.String() })
      }
    )
    .post(
      '/api/organizations/:id/members',
      ({ params, request, body, set }) => {
        const authorized = authorizeOrganizationRole(params.id, request, set, 'admin')
        if (!authorized) return { success: false, status: 'error', error: 'Forbidden' }
        try {
          const member = OrganizationService.addMemberByEmail(params.id, body.email, body.role)
          return { success: true, member }
        } catch (error: any) {
          set.status = 400
          return { success: false, status: 'error', error: error?.message || '添加成员失败' }
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          email: t.String(),
          role: t.Union([t.Literal('owner'), t.Literal('admin'), t.Literal('member')])
        })
      }
    )
    .get(
      '/api/organizations/:id/quota',
      ({ params, request, set }) => {
        const authorized = authorizeOrganizationRole(params.id, request, set, 'member')
        if (!authorized) return { success: false, status: 'error', error: 'Forbidden' }
        return {
          success: true,
          quota: OrganizationGovernanceService.getQuota(params.id),
          usage: OrganizationGovernanceService.getUsage(params.id)
        }
      },
      {
        params: t.Object({ id: t.String() })
      }
    )
    .put(
      '/api/organizations/:id/quota',
      ({ params, request, body, set }) => {
        const authorized = authorizeOrganizationRole(params.id, request, set, 'admin')
        if (!authorized) return { success: false, status: 'error', error: 'Forbidden' }
        try {
          const quota = OrganizationGovernanceService.upsertQuota({
            organizationId: params.id,
            requestLimit: body.requestLimit,
            storageLimitBytes: body.storageLimitBytes,
            concurrencyLimit: body.concurrencyLimit,
            updatedBy: authorized.user.id
          })
          return {
            success: true,
            quota,
            usage: OrganizationGovernanceService.getUsage(params.id)
          }
        } catch (error: any) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: error?.message || '组织配额更新失败'
          }
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          requestLimit: t.Optional(t.Number({ minimum: 0 })),
          storageLimitBytes: t.Optional(t.Number({ minimum: 0 })),
          concurrencyLimit: t.Optional(t.Number({ minimum: 0 }))
        })
      }
    )
    .get(
      '/api/organizations/:id/audits/export',
      ({ params, query, request, set }) => {
        const authorized = authorizeOrganizationRole(params.id, request, set, 'admin')
        if (!authorized) return { success: false, status: 'error', error: 'Forbidden' }

        const result = OrganizationGovernanceService.exportAudits(params.id, {
          from: query.from,
          to: query.to,
          scope: query.scope,
          format: query.format,
          limit: parseBoundedLimit(query.limit, 1000, 5000)
        })

        if (result.format === 'csv') {
          const fileName = `veomuse-audits-${params.id}-${Date.now()}.csv`
          return new Response(result.csv || '', {
            headers: {
              'content-type': 'text/csv; charset=utf-8',
              'content-disposition': `attachment; filename=\"${fileName}\"`
            }
          })
        }

        return {
          success: true,
          ...result
        }
      },
      {
        params: t.Object({ id: t.String() }),
        query: t.Object({
          from: t.Optional(t.String()),
          to: t.Optional(t.String()),
          scope: t.Optional(
            t.Union([t.Literal('all'), t.Literal('channel'), t.Literal('workspace')])
          ),
          format: t.Optional(t.Union([t.Literal('json'), t.Literal('csv')])),
          limit: t.Optional(t.String())
        })
      }
    )
    .get('/api/channel/providers', () => ({
      success: true,
      providers: ChannelConfigService.listProviders()
    }))
    .post(
      '/api/channels/test',
      async ({ request, body, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'member')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        const requestedWorkspaceId = body.workspaceId?.trim() || ''
        let resolvedWorkspaceId: string | undefined
        if (requestedWorkspaceId) {
          const workspace = WorkspaceService.getWorkspace(requestedWorkspaceId)
          if (!workspace || workspace.organizationId !== organizationContext.organizationId) {
            set.status = 404
            return { success: false, status: 'error', error: 'Workspace not found' }
          }
          const authorized = authorizeWorkspaceRole(requestedWorkspaceId, request, set, 'viewer')
          if (!authorized) return { success: false, status: 'error', error: 'Forbidden' }
          resolvedWorkspaceId = requestedWorkspaceId
        }
        const tested = await ChannelConfigService.testConfig({
          ...body,
          organizationId: organizationContext.organizationId,
          workspaceId: resolvedWorkspaceId
        })
        return tested
      },
      {
        body: t.Object({
          providerId: t.String(),
          baseUrl: t.Optional(t.String()),
          apiKey: t.Optional(t.String()),
          workspaceId: t.Optional(t.String()),
          extra: t.Optional(t.Record(t.String(), t.Any()))
        })
      }
    )
    .get(
      '/api/organizations/:id/channels',
      ({ params, request, set }) => {
        const authorized = authorizeOrganizationRole(params.id, request, set, 'member')
        if (!authorized) return { success: false, status: 'error', error: 'Forbidden' }
        return {
          success: true,
          configs: ChannelConfigService.listConfigs(params.id),
          capabilities: getCapabilities(request)
        }
      },
      {
        params: t.Object({ id: t.String() })
      }
    )
    .put(
      '/api/organizations/:id/channels/:providerId',
      ({ params, request, body, set }) => {
        const authorized = authorizeOrganizationRole(params.id, request, set, 'admin')
        if (!authorized) return { success: false, status: 'error', error: 'Forbidden' }
        try {
          const config = ChannelConfigService.upsertConfig({
            organizationId: params.id,
            providerId: params.providerId,
            baseUrl: body.baseUrl,
            apiKey: body.apiKey,
            enabled: body.enabled,
            extra: body.extra,
            actorUserId: authorized.user.id
          })
          return { success: true, config }
        } catch (error: any) {
          set.status = 400
          return { success: false, status: 'error', error: error?.message || '渠道配置保存失败' }
        }
      },
      {
        params: t.Object({ id: t.String(), providerId: t.String() }),
        body: t.Object({
          baseUrl: t.Optional(t.String()),
          apiKey: t.Optional(t.String()),
          enabled: t.Optional(t.Boolean()),
          extra: t.Optional(t.Record(t.String(), t.Any()))
        })
      }
    )
    .get(
      '/api/workspaces/:id/channels',
      ({ params, request, set }) => {
        const workspace = WorkspaceService.getWorkspace(params.id)
        if (!workspace) {
          set.status = 404
          return { success: false, status: 'error', error: 'Workspace not found' }
        }
        const authorized = authorizeOrganizationRole(
          workspace.organizationId,
          request,
          set,
          'member'
        )
        if (!authorized) return { success: false, status: 'error', error: 'Forbidden' }
        return {
          success: true,
          configs: ChannelConfigService.listConfigs(workspace.organizationId, workspace.id),
          capabilities: getCapabilities(request, workspace.id)
        }
      },
      {
        params: t.Object({ id: t.String() })
      }
    )
    .put(
      '/api/workspaces/:id/channels/:providerId',
      ({ params, request, body, set }) => {
        const workspace = WorkspaceService.getWorkspace(params.id)
        if (!workspace) {
          set.status = 404
          return { success: false, status: 'error', error: 'Workspace not found' }
        }
        const authorized = authorizeOrganizationRole(
          workspace.organizationId,
          request,
          set,
          'admin'
        )
        if (!authorized) return { success: false, status: 'error', error: 'Forbidden' }
        try {
          const config = ChannelConfigService.upsertConfig({
            organizationId: workspace.organizationId,
            workspaceId: workspace.id,
            providerId: params.providerId,
            baseUrl: body.baseUrl,
            apiKey: body.apiKey,
            enabled: body.enabled,
            extra: body.extra,
            actorUserId: authorized.user.id
          })
          return { success: true, config }
        } catch (error: any) {
          set.status = 400
          return { success: false, status: 'error', error: error?.message || '渠道配置保存失败' }
        }
      },
      {
        params: t.Object({ id: t.String(), providerId: t.String() }),
        body: t.Object({
          baseUrl: t.Optional(t.String()),
          apiKey: t.Optional(t.String()),
          enabled: t.Optional(t.Boolean()),
          extra: t.Optional(t.Record(t.String(), t.Any()))
        })
      }
    )
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
    .post(
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
        } catch (error: any) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: error?.message || 'Invalid routing policy payload'
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
        } catch (error: any) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: error?.message || 'Invalid routing policy payload'
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
        } catch (error: any) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: error?.message || 'Invalid batch simulation payload'
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
        } catch (error: any) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: error?.message || 'Invalid alert config payload'
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
    .post('/api/models/recommend', async ({ body }) => await ModelRouter.recommend(body.prompt), {
      body: t.Object({ prompt: t.String() })
    })
    .post(
      '/api/video/generations',
      async ({ body, request, set }) => {
        const runtimeContext = resolveRuntimeContext(request, set, body.workspaceId)
        if (!runtimeContext) {
          return { success: false, status: 'error', error: 'Forbidden' }
        }
        try {
          let requestDenied: ReturnType<
            typeof OrganizationGovernanceService.consumeRequestQuota
          > | null = null
          const submitResult = await OrganizationGovernanceService.withConcurrencyLimit(
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
              return await VideoGenerationService.submit(
                {
                  organizationId: runtimeContext.organizationId,
                  workspaceId: runtimeContext.workspaceId,
                  createdBy: runtimeContext.actorName,
                  modelId: body.modelId,
                  generationMode: body.generationMode,
                  prompt: body.prompt,
                  text: body.text,
                  negativePrompt: body.negativePrompt,
                  options: body.options,
                  actorId: body.actorId,
                  consistencyStrength: body.consistencyStrength,
                  syncLip: body.syncLip,
                  sync_lip: body.sync_lip,
                  worldLink: body.worldLink,
                  worldId: body.worldId,
                  inputs: body.inputs
                },
                runtimeContext
              )
            }
          )

          if (requestDenied) {
            set.status = 429
            return buildQuotaExceededResponse('request', requestDenied)
          }

          return {
            success: true,
            job: submitResult?.job || null,
            providerResult: submitResult?.providerResult || null
          }
        } catch (error: any) {
          const message = String(error?.message || '')
          if (message.includes('并发配额')) {
            const check = OrganizationGovernanceService.checkConcurrencyAllowed(
              runtimeContext.organizationId
            )
            set.status = 429
            return buildQuotaExceededResponse('concurrency', check)
          }
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: message || 'Invalid video generation payload'
          }
        }
      },
      {
        body: t.Object({
          modelId: t.Optional(t.String()),
          generationMode: t.Optional(
            t.Union([
              t.Literal('text_to_video'),
              t.Literal('image_to_video'),
              t.Literal('first_last_frame_transition'),
              t.Literal('video_extend')
            ])
          ),
          prompt: t.Optional(t.String()),
          text: t.Optional(t.String()),
          negativePrompt: t.Optional(t.String()),
          options: t.Optional(t.Any()),
          actorId: t.Optional(t.String()),
          consistencyStrength: t.Optional(t.Number()),
          syncLip: t.Optional(t.Boolean()),
          sync_lip: t.Optional(t.Boolean()),
          worldLink: t.Optional(t.Boolean()),
          worldId: t.Optional(t.String()),
          workspaceId: t.Optional(t.String()),
          inputs: t.Optional(t.Any())
        })
      }
    )
    .get(
      '/api/video/generations/:jobId',
      ({ params, request, set }) => {
        const resolved = resolveVideoGenerationJobContext(params.jobId, request, set)
        if (!resolved) {
          if (set.status === 404) {
            return { success: false, status: 'error', error: 'Generation job not found' }
          }
          if (typeof set.status !== 'number' || set.status < 400) set.status = 403
          return { success: false, status: 'error', error: 'Forbidden' }
        }
        return {
          success: true,
          job: resolved.job
        }
      },
      {
        params: t.Object({
          jobId: t.String()
        })
      }
    )
    .post(
      '/api/video/generations/:jobId/retry',
      async ({ params, request, set }) => {
        const resolved = resolveVideoGenerationJobContext(params.jobId, request, set)
        if (!resolved) {
          if (set.status === 404) {
            return { success: false, status: 'error', error: 'Generation job not found' }
          }
          if (typeof set.status !== 'number' || set.status < 400) set.status = 403
          return { success: false, status: 'error', error: 'Forbidden' }
        }
        const runtimeContext = resolveRuntimeContext(
          request,
          set,
          resolved.job.workspaceId || undefined
        )
        if (!runtimeContext) {
          return { success: false, status: 'error', error: 'Forbidden' }
        }
        try {
          let requestDenied: ReturnType<
            typeof OrganizationGovernanceService.consumeRequestQuota
          > | null = null
          const retryResult = await OrganizationGovernanceService.withConcurrencyLimit(
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
              return await VideoGenerationService.retry(
                resolved.job.id,
                runtimeContext.organizationId,
                runtimeContext
              )
            }
          )
          if (requestDenied) {
            set.status = 429
            return buildQuotaExceededResponse('request', requestDenied)
          }
          return {
            success: true,
            job: retryResult?.job || null,
            providerResult: retryResult?.providerResult || null
          }
        } catch (error: any) {
          const message = String(error?.message || '')
          if (message.includes('并发配额')) {
            const check = OrganizationGovernanceService.checkConcurrencyAllowed(
              runtimeContext.organizationId
            )
            set.status = 429
            return buildQuotaExceededResponse('concurrency', check)
          }
          if (error instanceof VideoGenerationValidationError) {
            set.status = 400
            return {
              success: false,
              status: 'error',
              error: message || 'Video generation retry failed'
            }
          }
          throw error
        }
      },
      {
        params: t.Object({
          jobId: t.String()
        })
      }
    )
    .post(
      '/api/video/generations/:jobId/cancel',
      async ({ params, request, set }) => {
        const resolved = resolveVideoGenerationJobContext(params.jobId, request, set)
        if (!resolved) {
          if (set.status === 404) {
            return { success: false, status: 'error', error: 'Generation job not found' }
          }
          if (typeof set.status !== 'number' || set.status < 400) set.status = 403
          return { success: false, status: 'error', error: 'Forbidden' }
        }
        const runtimeContext = resolveRuntimeContext(
          request,
          set,
          resolved.job.workspaceId || undefined
        )
        if (!runtimeContext) {
          return { success: false, status: 'error', error: 'Forbidden' }
        }
        try {
          const cancelResult = await VideoGenerationService.cancel(
            resolved.job.id,
            runtimeContext.organizationId,
            runtimeContext
          )
          return {
            success: true,
            job: cancelResult.job,
            cancelResult: cancelResult.cancelResult
          }
        } catch (error: any) {
          if (error instanceof VideoGenerationValidationError) {
            set.status = 400
            return {
              success: false,
              status: 'error',
              error: String(error?.message || 'Video generation cancel failed')
            }
          }
          throw error
        }
      },
      {
        params: t.Object({
          jobId: t.String()
        })
      }
    )
    .post(
      '/api/video/generations/:jobId/sync',
      async ({ params, request, set }) => {
        const resolved = resolveVideoGenerationJobContext(params.jobId, request, set)
        if (!resolved) {
          if (set.status === 404) {
            return { success: false, status: 'error', error: 'Generation job not found' }
          }
          if (typeof set.status !== 'number' || set.status < 400) set.status = 403
          return { success: false, status: 'error', error: 'Forbidden' }
        }
        const runtimeContext = resolveRuntimeContext(
          request,
          set,
          resolved.job.workspaceId || undefined
        )
        if (!runtimeContext) {
          return { success: false, status: 'error', error: 'Forbidden' }
        }
        try {
          const syncResult = await VideoGenerationService.syncByJobId(
            resolved.job.id,
            runtimeContext.organizationId,
            runtimeContext
          )
          return {
            success: true,
            job: syncResult.job,
            queryResult: syncResult.queryResult
          }
        } catch (error: any) {
          if (error instanceof VideoGenerationValidationError) {
            set.status = 400
            return {
              success: false,
              status: 'error',
              error: String(error?.message || 'Video generation sync failed')
            }
          }
          throw error
        }
      },
      {
        params: t.Object({
          jobId: t.String()
        })
      }
    )
    .get(
      '/api/video/generations',
      ({ query, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'member')
        if (!organizationContext) {
          return { success: false, status: 'error', error: 'Forbidden' }
        }
        const workspaceId = query.workspaceId?.trim()
        const visibleWorkspaceIds = WorkspaceService.listWorkspaceIdsByUser(
          organizationContext.organizationId,
          organizationContext.user.id
        )
        if (workspaceId) {
          const workspace = WorkspaceService.getWorkspace(workspaceId)
          if (!workspace || workspace.organizationId !== organizationContext.organizationId) {
            set.status = 403
            return { success: false, status: 'error', error: 'Workspace not found in organization' }
          }
          const member = WorkspaceService.getMemberByUserId(
            workspaceId,
            organizationContext.user.id
          )
          if (!member) {
            set.status = 403
            return {
              success: false,
              status: 'error',
              error: 'Forbidden: workspace membership required'
            }
          }
        }
        const listed = VideoGenerationService.list({
          organizationId: organizationContext.organizationId,
          workspaceId: workspaceId || undefined,
          visibleWorkspaceIds: workspaceId ? [workspaceId] : visibleWorkspaceIds,
          status: query.status as VideoGenerationJobStatus | undefined,
          modelId: query.modelId?.trim() || undefined,
          cursor: query.cursor?.trim() || undefined,
          limit: parseBoundedLimit(query.limit, 20, 100)
        })
        return {
          success: true,
          jobs: listed.jobs,
          page: listed.page
        }
      },
      {
        query: t.Object({
          workspaceId: t.Optional(t.String()),
          status: t.Optional(t.String()),
          modelId: t.Optional(t.String()),
          cursor: t.Optional(t.String()),
          limit: t.Optional(t.String())
        })
      }
    )

    .post(
      '/api/video/generate',
      async ({ body, request, set }) => {
        const runtimeContext = resolveRuntimeContext(request, set, body.workspaceId)
        if (!runtimeContext) {
          return { success: false, status: 'error', error: 'Forbidden' }
        }
        try {
          let requestDenied: ReturnType<
            typeof OrganizationGovernanceService.consumeRequestQuota
          > | null = null
          const output = await OrganizationGovernanceService.withConcurrencyLimit(
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

              const driverParams = VideoGenerationService.toDriverParams({
                organizationId: runtimeContext.organizationId,
                workspaceId: runtimeContext.workspaceId,
                createdBy: runtimeContext.actorName,
                modelId: body.modelId,
                text: body.text,
                negativePrompt: body.negativePrompt,
                options: body.options,
                actorId: body.actorId,
                consistencyStrength: body.consistencyStrength,
                syncLip: body.syncLip,
                sync_lip: body.sync_lip,
                worldLink: body.worldLink,
                worldId: body.worldId
              })
              return await VideoOrchestrator.generate(
                body.modelId || 'veo-3.1',
                driverParams,
                runtimeContext
              )
            }
          )

          if (requestDenied) {
            set.status = 429
            return buildQuotaExceededResponse('request', requestDenied)
          }
          return output
        } catch (error: any) {
          const message = String(error?.message || '')
          if (message.includes('并发配额')) {
            const check = OrganizationGovernanceService.checkConcurrencyAllowed(
              runtimeContext.organizationId
            )
            set.status = 429
            return buildQuotaExceededResponse('concurrency', check)
          }
          if (error instanceof VideoGenerationValidationError) {
            set.status = 400
            return {
              success: false,
              status: 'error',
              error: message || 'Invalid video generation payload'
            }
          }
          throw error
        }
      },
      {
        body: t.Object({
          text: t.String(),
          modelId: t.Optional(t.String()),
          negativePrompt: t.Optional(t.String()),
          options: t.Optional(t.Any()),
          actorId: t.Optional(t.String()),
          consistencyStrength: t.Optional(t.Number()),
          syncLip: t.Optional(t.Boolean()),
          sync_lip: t.Optional(t.Boolean()),
          worldLink: t.Optional(t.Boolean()),
          worldId: t.Optional(t.String()),
          workspaceId: t.Optional(t.String())
        })
      }
    )

    .group('/api/ai', (group) =>
      group
        .post(
          '/alchemy/style-transfer',
          async ({ body, request, set }) => {
            const runtimeContext = resolveRuntimeContext(request, set, body.workspaceId)
            if (!runtimeContext) return { success: false, status: 'error', error: 'Forbidden' }
            return await StyleTransferService.transfer(body, runtimeContext)
          },
          {
            body: t.Object({
              clipId: t.String(),
              style: t.String(),
              referenceModel: t.Optional(
                t.Union([t.Literal('luma-dream'), t.Literal('kling-v1'), t.Literal('veo-3.1')])
              ),
              workspaceId: t.Optional(t.String())
            })
          }
        )
        .post(
          '/enhance',
          async ({ body, request, set }) => {
            const user = requireAuthenticatedUser(request, set)
            if (!user) return { success: false, status: 'error', error: 'Unauthorized' }
            try {
              return await PromptEnhanceService.enhance(body.prompt)
            } catch (error) {
              if (isGeminiNotConfiguredError(error)) return buildGeminiNotConfiguredResponse()
              throw error
            }
          },
          { body: t.Object({ prompt: t.String() }) }
        )
        .post(
          '/translate',
          async ({ body, request, set }) => {
            const user = requireAuthenticatedUser(request, set)
            if (!user) return { success: false, status: 'error', error: 'Unauthorized' }
            try {
              return await TranslationService.translate(body.text, body.targetLang)
            } catch (error) {
              if (isGeminiNotConfiguredError(error)) return buildGeminiNotConfiguredResponse()
              throw error
            }
          },
          { body: t.Object({ text: t.String(), targetLang: t.String() }) }
        )
        .post(
          '/director/analyze',
          async ({ body, request, set }) => {
            const user = requireAuthenticatedUser(request, set)
            if (!user) return { success: false, status: 'error', error: 'Unauthorized' }
            return await AiDirectorService.analyzeScript(body.script)
          },
          { body: t.Object({ script: t.String() }) }
        )
        .post(
          '/suggest-cuts',
          async ({ body, request, set }) => {
            const user = requireAuthenticatedUser(request, set)
            if (!user) return { success: false, status: 'error', error: 'Unauthorized' }
            return await AiClipService.suggestCuts(body.description, body.duration)
          },
          { body: t.Object({ description: t.String(), duration: t.Number() }) }
        )
        .post(
          '/tts',
          async ({ body, request, set }) => {
            const runtimeContext = resolveRuntimeContext(request, set, body.workspaceId)
            if (!runtimeContext) return { success: false, status: 'error', error: 'Forbidden' }
            return await TtsService.synthesize(body.text, runtimeContext)
          },
          {
            body: t.Object({ text: t.String(), workspaceId: t.Optional(t.String()) })
          }
        )
        .post(
          '/voice-morph',
          async ({ body, request, set }) => {
            const runtimeContext = resolveRuntimeContext(request, set, body.workspaceId)
            if (!runtimeContext) return { success: false, status: 'error', error: 'Forbidden' }
            return await VoiceMorphService.morph(body.audioUrl, body.targetVoiceId, runtimeContext)
          },
          {
            body: t.Object({
              audioUrl: t.String(),
              targetVoiceId: t.String(),
              workspaceId: t.Optional(t.String())
            })
          }
        )
        .post(
          '/music-advice',
          async ({ body, request, set }) => {
            const user = requireAuthenticatedUser(request, set)
            if (!user) return { success: false, status: 'error', error: 'Unauthorized' }
            try {
              return await MusicAdviceService.getAdvice(body.description)
            } catch (error) {
              if (isGeminiNotConfiguredError(error)) return buildGeminiNotConfiguredResponse()
              throw error
            }
          },
          { body: t.Object({ description: t.String() }) }
        )
        .post(
          '/repair',
          async ({ body, request, set }) => {
            const user = requireAuthenticatedUser(request, set)
            if (!user) return { success: false, status: 'error', error: 'Unauthorized' }
            try {
              return await InpaintService.getRepairAdvice(body.description)
            } catch (error) {
              if (isGeminiNotConfiguredError(error)) return buildGeminiNotConfiguredResponse()
              throw error
            }
          },
          { body: t.Object({ description: t.String() }) }
        )
        .post(
          '/analyze-audio',
          async ({ body, request, set }) => {
            const runtimeContext = resolveRuntimeContext(request, set, body.workspaceId)
            if (!runtimeContext) return { success: false, status: 'error', error: 'Forbidden' }
            return await AudioAnalysisService.analyze(body.audioUrl, runtimeContext)
          },
          {
            body: t.Object({ audioUrl: t.String(), workspaceId: t.Optional(t.String()) })
          }
        )
        .post(
          '/spatial/render',
          async ({ body, request, set }) => {
            const runtimeContext = resolveRuntimeContext(request, set, body.workspaceId)
            if (!runtimeContext) return { success: false, status: 'error', error: 'Forbidden' }
            return await SpatialRenderService.reconstruct(
              body.clipId,
              body.quality || 'ultra',
              runtimeContext
            )
          },
          {
            body: t.Object({
              clipId: t.String(),
              quality: t.Optional(t.String()),
              workspaceId: t.Optional(t.String())
            })
          }
        )
        .post(
          '/vfx/apply',
          async ({ body, request, set }) => {
            const runtimeContext = resolveRuntimeContext(request, set, body.workspaceId)
            if (!runtimeContext) return { success: false, status: 'error', error: 'Forbidden' }
            return await VfxService.applyVfx(body, runtimeContext)
          },
          {
            body: t.Object({
              clipId: t.String(),
              vfxType: t.String(),
              intensity: t.Optional(t.Number()),
              workspaceId: t.Optional(t.String())
            })
          }
        )
        .post(
          '/sync-lip',
          async ({ body, request, set }) => {
            const runtimeContext = resolveRuntimeContext(request, set, body.workspaceId)
            if (!runtimeContext) return { success: false, status: 'error', error: 'Forbidden' }
            return await LipSyncService.sync(
              body.videoUrl,
              body.audioUrl,
              body.precision || 'high',
              runtimeContext
            )
          },
          {
            body: t.Object({
              videoUrl: t.String(),
              audioUrl: t.String(),
              precision: t.Optional(t.String()),
              workspaceId: t.Optional(t.String())
            })
          }
        )
        .post(
          '/relighting/apply',
          async ({ body, request, set }) => {
            const runtimeContext = resolveRuntimeContext(request, set, body.workspaceId)
            if (!runtimeContext) return { success: false, status: 'error', error: 'Forbidden' }
            return await RelightingService.applyRelighting(body.clipId, body.style, runtimeContext)
          },
          {
            body: t.Object({
              clipId: t.String(),
              style: t.String(),
              workspaceId: t.Optional(t.String())
            })
          }
        )
        .post(
          '/creative/run',
          ({ body, request, set }) => {
            const organizationContext = resolveOrganizationContext(request, set, 'member')
            if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
            return {
              success: true,
              run: CreativePipelineService.createRun(body.script, body.style || 'cinematic', {
                ...(body.context || {}),
                organizationId: organizationContext.organizationId,
                actorUserId: organizationContext.user.id
              })
            }
          },
          {
            body: t.Object({
              script: t.String(),
              style: t.Optional(t.String()),
              context: t.Optional(t.Record(t.String(), t.Any()))
            })
          }
        )
        .get(
          '/creative/run/:id',
          ({ params, request, set }) => {
            const organizationContext = resolveOrganizationContext(request, set, 'member')
            if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
            const run = CreativePipelineService.getRun(
              params.id,
              organizationContext.organizationId
            )
            if (!run) {
              set.status = 404
              return { success: false, status: 'error', error: 'Creative run not found' }
            }
            return { success: true, run }
          },
          {
            params: t.Object({ id: t.String() })
          }
        )
        .post(
          '/creative/run/:id/regenerate',
          ({ params, body, request, set }) => {
            const organizationContext = resolveOrganizationContext(request, set, 'member')
            if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
            const run = CreativePipelineService.regenerateScene(
              params.id,
              body.sceneId,
              body.feedback,
              organizationContext.organizationId
            )
            if (!run) {
              set.status = 404
              return { success: false, status: 'error', error: 'Creative scene not found' }
            }
            return { success: true, run }
          },
          {
            params: t.Object({ id: t.String() }),
            body: t.Object({
              sceneId: t.String(),
              feedback: t.Optional(t.String())
            })
          }
        )
        .post(
          '/creative/run/:id/feedback',
          ({ params, body, request, set }) => {
            const organizationContext = resolveOrganizationContext(request, set, 'member')
            if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
            const result = CreativePipelineService.applyFeedback(
              params.id,
              body,
              organizationContext.organizationId
            )
            if (!result?.run) {
              set.status = 404
              return { success: false, status: 'error', error: 'Creative run not found' }
            }
            return { success: true, ...result }
          },
          {
            params: t.Object({ id: t.String() }),
            body: t.Object({
              runFeedback: t.Optional(t.String()),
              sceneFeedbacks: t.Optional(
                t.Array(
                  t.Object({
                    sceneId: t.String(),
                    feedback: t.String()
                  })
                )
              )
            })
          }
        )
        .post(
          '/creative/run/:id/commit',
          ({ params, body, request, set }) => {
            const organizationContext = resolveOrganizationContext(request, set, 'member')
            if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
            const run = CreativePipelineService.commitRun(
              params.id,
              body || undefined,
              organizationContext.organizationId
            )
            if (!run) {
              set.status = 404
              return { success: false, status: 'error', error: 'Creative run not found' }
            }
            return { success: true, run }
          },
          {
            params: t.Object({ id: t.String() }),
            body: t.Optional(
              t.Object({
                qualityScore: t.Optional(t.Number()),
                notes: t.Optional(t.Record(t.String(), t.Any()))
              })
            )
          }
        )
        .get(
          '/creative/run/:id/versions',
          ({ params, request, set }) => {
            const organizationContext = resolveOrganizationContext(request, set, 'member')
            if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
            const versions = CreativePipelineService.getRunVersions(
              params.id,
              organizationContext.organizationId
            )
            if (!versions.length) {
              set.status = 404
              return { success: false, status: 'error', error: 'Creative run not found' }
            }
            return { success: true, versions }
          },
          {
            params: t.Object({ id: t.String() })
          }
        )
        .group('/actors', (actorsGroup) =>
          actorsGroup
            .get('/', ({ request, set }) => {
              const organizationContext = resolveOrganizationContext(request, set, 'member')
              if (!organizationContext)
                return { success: false, status: 'error', error: 'Forbidden' }
              return {
                success: true,
                actors: ActorConsistencyService.getAllActors(organizationContext.organizationId)
              }
            })
            .post(
              '/',
              ({ body, request, set }) => {
                const organizationContext = resolveOrganizationContext(request, set, 'member')
                if (!organizationContext)
                  return { success: false, status: 'error', error: 'Forbidden' }
                return {
                  success: true,
                  actor: ActorConsistencyService.createActor(
                    body.name,
                    body.refImage,
                    organizationContext.organizationId
                  )
                }
              },
              {
                body: t.Object({
                  name: t.String(),
                  refImage: t.String()
                })
              }
            )
            .post(
              '/motion-sync',
              ({ body, request, set }) => {
                const organizationContext = resolveOrganizationContext(request, set, 'member')
                if (!organizationContext)
                  return { success: false, status: 'error', error: 'Forbidden' }
                return ActorConsistencyService.syncMotion(
                  body.actorId,
                  body.motionData,
                  organizationContext.organizationId
                )
              },
              {
                body: t.Object({
                  actorId: t.String(),
                  motionData: t.Object({
                    pose: t.Array(
                      t.Object({
                        x: t.Number(),
                        y: t.Number(),
                        z: t.Number()
                      })
                    ),
                    face: t.Optional(
                      t.Object({
                        expression: t.Optional(t.String()),
                        intensity: t.Optional(t.Number())
                      })
                    ),
                    timestamp: t.Number()
                  })
                })
              }
            )
            .post(
              '/generate',
              async ({ body, request, set }) => {
                const organizationContext = resolveOrganizationContext(request, set, 'member')
                if (!organizationContext)
                  return { success: false, status: 'error', error: 'Forbidden' }
                return {
                  success: true,
                  status: 'ok',
                  message: 'Actor generation started',
                  actorId: body.actorId
                }
              },
              {
                body: t.Object({
                  prompt: t.String(),
                  actorId: t.String(),
                  modelId: t.Optional(t.String())
                })
              }
            )
        )
    )

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
        } catch (error: any) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: error?.message || '错误预算策略更新失败'
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
        } catch (error: any) {
          set.status = 400
          return { success: false, status: 'error', error: error?.message || '回滚演练创建失败' }
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
        } catch (error: any) {
          set.status = 400
          return { success: false, status: 'error', error: error?.message || '评论线程创建失败' }
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
        } catch (error: any) {
          const message = String(error?.message || '')
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
        } catch (error: any) {
          const message = String(error?.message || '')
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
        } catch (error: any) {
          set.status = 400
          return { success: false, status: 'error', error: error?.message || '角色权限写入失败' }
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
        } catch (error: any) {
          set.status = 400
          return { success: false, status: 'error', error: error?.message || 'Timeline merge 失败' }
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
    .get(
      '/api/v4/creative/prompt-workflows',
      ({ query, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'member')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        return {
          success: true,
          workflows: CreativeWorkflowService.listPromptWorkflows(
            organizationContext.organizationId,
            Number.parseInt(query.limit || '50', 10)
          )
        }
      },
      {
        query: t.Object({
          limit: t.Optional(t.String())
        })
      }
    )
    .post(
      '/api/v4/creative/prompt-workflows',
      ({ body, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'member')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        try {
          return {
            success: true,
            workflow: CreativeWorkflowService.createPromptWorkflow({
              organizationId: organizationContext.organizationId,
              name: body.name,
              description: body.description,
              definition: body.definition,
              createdBy: body.createdBy || organizationContext.user.id
            })
          }
        } catch (error: any) {
          set.status = 400
          return { success: false, status: 'error', error: error?.message || '工作流创建失败' }
        }
      },
      {
        body: t.Object({
          name: t.String(),
          description: t.Optional(t.String()),
          definition: t.Optional(t.Record(t.String(), t.Any())),
          createdBy: t.Optional(t.String())
        })
      }
    )
    .get(
      '/api/v4/creative/prompt-workflows/:workflowId/runs',
      ({ params, query, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'member')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        try {
          const result = CreativeWorkflowService.listPromptWorkflowRuns({
            organizationId: organizationContext.organizationId,
            workflowId: params.workflowId,
            limit: Number.parseInt(query.limit || '20', 10),
            cursor: query.cursor
          })
          return {
            success: true,
            runs: result.runs,
            page: result.page
          }
        } catch (error: any) {
          const message = String(error?.message || '')
          if (message.includes('不存在')) {
            set.status = 404
          } else if (message.includes('无权')) {
            set.status = 403
          } else {
            set.status = 400
          }
          return { success: false, status: 'error', error: message || '工作流运行记录查询失败' }
        }
      },
      {
        params: t.Object({
          workflowId: t.String()
        }),
        query: t.Object({
          limit: t.Optional(t.String()),
          cursor: t.Optional(t.String())
        })
      }
    )
    .post(
      '/api/v4/creative/prompt-workflows/:workflowId/run',
      ({ params, body, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'member')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        try {
          return {
            success: true,
            run: CreativeWorkflowService.runPromptWorkflow(params.workflowId, {
              organizationId: organizationContext.organizationId,
              triggerType: body.triggerType,
              input: body.input,
              createdBy: body.createdBy || organizationContext.user.id
            })
          }
        } catch (error: any) {
          const message = String(error?.message || '')
          if (message.includes('不存在')) {
            set.status = 404
          } else {
            set.status = 400
          }
          return { success: false, status: 'error', error: message || '工作流执行失败' }
        }
      },
      {
        params: t.Object({
          workflowId: t.String()
        }),
        body: t.Object({
          triggerType: t.Optional(t.String()),
          input: t.Optional(t.Record(t.String(), t.Any())),
          createdBy: t.Optional(t.String())
        })
      }
    )
    .post(
      '/api/v4/creative/batch-jobs',
      ({ body, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'member')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        try {
          return {
            success: true,
            job: CreativeWorkflowService.createBatchJob({
              organizationId: organizationContext.organizationId,
              workflowRunId: body.workflowRunId,
              jobType: body.jobType,
              payload: body.payload,
              items: body.items,
              createdBy: body.createdBy || organizationContext.user.id
            })
          }
        } catch (error: any) {
          set.status = 400
          return { success: false, status: 'error', error: error?.message || '批处理任务创建失败' }
        }
      },
      {
        body: t.Object({
          workflowRunId: t.Optional(t.String()),
          jobType: t.String(),
          payload: t.Optional(t.Record(t.String(), t.Any())),
          items: t.Optional(
            t.Array(
              t.Object({
                itemKey: t.Optional(t.String()),
                input: t.Optional(t.Record(t.String(), t.Any()))
              })
            )
          ),
          createdBy: t.Optional(t.String())
        })
      }
    )
    .get(
      '/api/v4/creative/batch-jobs',
      ({ query, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'member')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        try {
          const pageResult = CreativeWorkflowService.listBatchJobs({
            organizationId: organizationContext.organizationId,
            workflowRunId: query.workflowRunId,
            jobType: query.jobType,
            status: query.status as 'queued' | 'completed' | 'failed' | undefined,
            limit: Number.parseInt(query.limit || '20', 10),
            cursor: query.cursor
          })
          return {
            success: true,
            jobs: pageResult.jobs,
            page: pageResult.page
          }
        } catch (error: any) {
          set.status = 400
          return { success: false, status: 'error', error: error?.message || '批处理任务查询失败' }
        }
      },
      {
        query: t.Object({
          workflowRunId: t.Optional(t.String()),
          jobType: t.Optional(t.String()),
          status: t.Optional(
            t.Union([t.Literal('queued'), t.Literal('completed'), t.Literal('failed')])
          ),
          limit: t.Optional(t.String()),
          cursor: t.Optional(t.String())
        })
      }
    )
    .get(
      '/api/v4/creative/batch-jobs/:jobId',
      ({ params, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'member')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        const job = CreativeWorkflowService.getBatchJob(params.jobId)
        if (!job) {
          set.status = 404
          return { success: false, status: 'error', error: 'Batch job not found' }
        }
        if (job.organizationId !== organizationContext.organizationId) {
          set.status = 403
          return { success: false, status: 'error', error: 'Forbidden' }
        }
        return { success: true, job }
      },
      {
        params: t.Object({
          jobId: t.String()
        })
      }
    )
    .post(
      '/api/v4/assets/:assetId/reuse',
      ({ params, body, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'member')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        try {
          return {
            success: true,
            record: CreativeWorkflowService.recordAssetReuse({
              organizationId: organizationContext.organizationId,
              assetId: params.assetId,
              sourceProjectId: body.sourceProjectId,
              targetProjectId: body.targetProjectId,
              reusedBy: body.reusedBy || organizationContext.user.id,
              context: body.context
            })
          }
        } catch (error: any) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: error?.message || '资产复用记录创建失败'
          }
        }
      },
      {
        params: t.Object({
          assetId: t.String()
        }),
        body: t.Object({
          sourceProjectId: t.Optional(t.String()),
          targetProjectId: t.Optional(t.String()),
          reusedBy: t.Optional(t.String()),
          context: t.Optional(t.Record(t.String(), t.Any()))
        })
      }
    )
    .get(
      '/api/v4/assets/reuse-history',
      ({ query, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'member')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        return {
          success: true,
          records: CreativeWorkflowService.listAssetReuseHistory({
            organizationId: organizationContext.organizationId,
            assetId: query.assetId,
            sourceProjectId: query.sourceProjectId,
            targetProjectId: query.targetProjectId,
            limit: Number.parseInt(query.limit || '50', 10),
            offset: Number.parseInt(query.offset || '0', 10)
          })
        }
      },
      {
        query: t.Object({
          assetId: t.Optional(t.String()),
          sourceProjectId: t.Optional(t.String()),
          targetProjectId: t.Optional(t.String()),
          limit: t.Optional(t.String()),
          offset: t.Optional(t.String())
        })
      }
    )

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
        } catch (error: any) {
          if (error?.message === 'Workspace not found') {
            set.status = 404
            return { success: false, status: 'error', error: 'Workspace not found' }
          }
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: error?.message || 'Create project failed'
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
        return {
          success: true,
          comments: WorkspaceService.listProjectComments(
            params.id,
            query.cursor,
            Number.parseInt(query.limit || '20', 10)
          )
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
        } catch (error: any) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: error?.message || 'Invalid comment payload'
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
        } catch (error: any) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: error?.message || 'Invalid review payload'
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
        } catch (error: any) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: error?.message || 'Template apply failed'
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
        } catch (error: any) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: error?.message || 'Invalid clip batch update payload'
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
    .post(
      '/api/storage/local-import',
      async ({ body, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'member')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        try {
          const rawBase64 = (body.base64Data || '').trim()
          if (!rawBase64) {
            set.status = 400
            return { success: false, status: 'error', error: 'base64Data is required' }
          }

          const maxBytes = Number.parseInt(process.env.LOCAL_IMPORT_MAX_BYTES || '', 10)
          const hardLimit = Number.isFinite(maxBytes) && maxBytes > 0 ? maxBytes : 200 * 1024 * 1024
          const normalizedBase64 = rawBase64.replace(/\s+/g, '')
          const estimatedBytes = Math.ceil(normalizedBase64.length * 0.75)
          if (estimatedBytes > hardLimit) {
            set.status = 413
            return {
              success: false,
              status: 'error',
              error: `file is too large (estimated): ${estimatedBytes} bytes (max ${hardLimit} bytes)`
            }
          }

          const bytes = Buffer.from(normalizedBase64, 'base64')
          if (!bytes.length) {
            set.status = 400
            return { success: false, status: 'error', error: 'base64Data is invalid' }
          }

          if (bytes.length > hardLimit) {
            set.status = 413
            return {
              success: false,
              status: 'error',
              error: `file is too large: ${bytes.length} bytes (max ${hardLimit} bytes)`
            }
          }

          const storageCheck = OrganizationGovernanceService.checkStorageAllowed(
            organizationContext.organizationId,
            bytes.length
          )
          if (!storageCheck.allowed) {
            set.status = 429
            return buildQuotaExceededResponse('storage', storageCheck)
          }

          const importDir = resolveImportDir()
          await fs.mkdir(importDir, { recursive: true })
          const safeName = sanitizeImportFileName(body.fileName)
          const filePath = path.join(
            importDir,
            `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`
          )
          await fs.writeFile(filePath, bytes)
          const usage = OrganizationGovernanceService.addStorageUsage(
            organizationContext.organizationId,
            bytes.length
          )

          return {
            success: true,
            imported: {
              localPath: filePath,
              bytes: bytes.length
            },
            usage
          }
        } catch (error: any) {
          set.status = 400
          return { success: false, status: 'error', error: error?.message || 'local import failed' }
        }
      },
      {
        body: t.Object({
          fileName: t.String(),
          base64Data: t.String(),
          contentType: t.Optional(t.String())
        })
      }
    )
    .post(
      '/api/storage/upload-token',
      ({ body, request, set }) => {
        const workspaceId = body.workspaceId.trim()
        const authorized = authorizeWorkspaceRole(workspaceId, request, set, 'editor')
        if (!authorized) {
          return { success: false, status: 'error', error: 'Forbidden: editor membership required' }
        }
        if (
          body.projectId &&
          !WorkspaceService.projectBelongsToWorkspace(workspaceId, body.projectId)
        ) {
          set.status = 403
          return { success: false, status: 'error', error: 'Project does not belong to workspace' }
        }
        return {
          success: true,
          token: storageProvider.issueUploadToken(body)
        }
      },
      {
        body: t.Object({
          workspaceId: t.String(),
          projectId: t.Optional(t.String()),
          fileName: t.String(),
          contentType: t.Optional(t.String())
        })
      }
    )
    .put(
      '/api/storage/local-upload/:objectKey',
      async ({ params, request, set }) => {
        try {
          const decodedObjectKey = decodeURIComponent(params.objectKey || '').trim()
          if (!decodedObjectKey) {
            set.status = 400
            return { success: false, status: 'error', error: 'objectKey is required' }
          }
          const workspaceId = decodedObjectKey
            .split('/')
            .map((segment) => segment.trim())
            .filter(Boolean)[0]
          if (!workspaceId) {
            set.status = 400
            return {
              success: false,
              status: 'error',
              error: 'workspaceId is required in objectKey'
            }
          }
          const workspace = WorkspaceService.getWorkspace(workspaceId)
          if (!workspace) {
            set.status = 404
            return { success: false, status: 'error', error: 'Workspace not found' }
          }

          const maxUploadBytesRaw = Number.parseInt(process.env.LOCAL_UPLOAD_MAX_BYTES || '', 10)
          const maxUploadBytes =
            Number.isFinite(maxUploadBytesRaw) && maxUploadBytesRaw > 0
              ? maxUploadBytesRaw
              : 200 * 1024 * 1024
          const contentLength = Number.parseInt(request.headers.get('content-length') || '0', 10)
          if (Number.isFinite(contentLength) && contentLength > maxUploadBytes) {
            set.status = 413
            return {
              success: false,
              status: 'error',
              error: `payload too large: ${contentLength} bytes (max ${maxUploadBytes})`
            }
          }

          const authorized = authorizeWorkspaceRole(workspaceId, request, set, 'editor')
          if (!authorized) {
            return {
              success: false,
              status: 'error',
              error: 'Forbidden: editor membership required'
            }
          }
          const bytes = new Uint8Array(await request.arrayBuffer())
          if (bytes.byteLength > maxUploadBytes) {
            set.status = 413
            return {
              success: false,
              status: 'error',
              error: `payload too large: ${bytes.byteLength} bytes (max ${maxUploadBytes})`
            }
          }
          const storageCheck = OrganizationGovernanceService.checkStorageAllowed(
            workspace.organizationId,
            bytes.byteLength
          )
          if (!storageCheck.allowed) {
            set.status = 429
            return buildQuotaExceededResponse('storage', storageCheck)
          }
          const result = storageProvider.storeObject(decodedObjectKey, bytes)
          const usage = OrganizationGovernanceService.addStorageUsage(
            workspace.organizationId,
            result.bytes
          )
          set.status = 201
          return {
            success: true,
            uploaded: {
              objectKey: result.objectKey,
              bytes: result.bytes,
              publicUrl: result.publicUrl
            },
            usage
          }
        } catch (error: any) {
          set.status = 400
          return { success: false, status: 'error', error: error?.message || 'local upload failed' }
        }
      },
      {
        params: t.Object({
          objectKey: t.String()
        })
      }
    )

    .post(
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
                } catch {
                  // noop
                }
                set.status = 429
                return buildQuotaExceededResponse('storage', storageCheck)
              }
              OrganizationGovernanceService.addStorageUsage(
                runtimeContext.organizationId,
                outputBytes
              )
            }
          }

          return composed
        } catch (error: any) {
          const message = String(error?.message || '')
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

    .ws('/ws/generation', {
      open(ws) {
        ws.send({ message: '已连接到旗舰级总线' })
      }
    })
    .ws('/ws/collab/:workspaceId', {
      open(ws) {
        const params = (ws.data as any)?.params || {}
        const query = (ws.data as any)?.query || {}
        const headers = (ws.data as any)?.headers || {}
        const workspaceId = String(params.workspaceId || query.workspaceId || '')
        if (!workspaceId) {
          ws.send(JSON.stringify({ type: 'error', error: 'workspaceId is required' }))
          ws.close()
          return
        }
        const accessToken = resolveWsAccessToken(headers)
        const user = accessToken ? AuthService.verifyAccessToken(accessToken) : null
        if (!user) {
          ws.send(JSON.stringify({ type: 'error', error: 'Unauthorized websocket request' }))
          ws.close()
          return
        }
        const member = WorkspaceService.getMemberByUserId(workspaceId, user.id)
        if (!member) {
          ws.send(JSON.stringify({ type: 'error', error: 'Member is not part of workspace' }))
          ws.close()
          return
        }
        const joined = CollaborationService.join(ws as any, {
          workspaceId,
          memberName: member.name,
          userId: user.id,
          role: member.role,
          sessionId: query.sessionId ? String(query.sessionId) : undefined
        })
        if (!joined) {
          ws.close()
        }
      },
      message(ws, message) {
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
        CollaborationService.onMessage(ws as any, content)
      },
      close(ws) {
        CollaborationService.leave(ws as any)
      }
    })
}

export const app = createApp()

const parseMs = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const isWeakSecret = (value: string | undefined, placeholders: string[]) => {
  const secret = String(value || '').trim()
  if (!secret) return true
  return placeholders.some((item) => item.toLowerCase() === secret.toLowerCase())
}

if (import.meta.main) {
  const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production'
  if (isProduction) {
    if (!process.env.JWT_SECRET?.trim()) {
      throw new Error('JWT_SECRET 未配置，生产环境拒绝启动')
    }
    if (!process.env.SECRET_ENCRYPTION_KEY?.trim()) {
      throw new Error('SECRET_ENCRYPTION_KEY 未配置，生产环境拒绝启动')
    }
    if (
      isWeakSecret(process.env.REDIS_PASSWORD, [
        'veomuse-redis-change-me',
        'replace-with-strong-password',
        'changeme',
        'change-me'
      ])
    ) {
      throw new Error('REDIS_PASSWORD 未配置强口令，生产环境拒绝启动')
    }
  }
  if (!isDevRuntime() && !process.env.ADMIN_TOKEN?.trim()) {
    console.error(
      '[Security] ADMIN_TOKEN 未配置，管理接口已在生产模式禁用。请设置 ADMIN_TOKEN 后重启服务。'
    )
  }
  app.listen({ port: parseInt(process.env.PORT || '33117', 10), hostname: '0.0.0.0' })
  const generatedDir = resolveGeneratedDir()
  const cleanupIntervalMs = parseMs(process.env.CLEANUP_INTERVAL_MS, 86_400_000)
  const cleanupRetentionMs = parseMs(process.env.CLEANUP_RETENTION_MS, 86_400_000)
  const sloCleanupIntervalMs = parseMs(process.env.SLO_CLEANUP_INTERVAL_MS, 86_400_000)
  const marketplaceMetricIntervalMs = parseMs(process.env.MARKETPLACE_METRIC_INTERVAL_MS, 300_000)
  const dbHealthcheckIntervalMs = parseMs(process.env.DB_HEALTHCHECK_INTERVAL_MS, 0)
  const videoJobAutoSyncEnabled = process.env.VIDEO_JOB_AUTO_SYNC_ENABLED
    ? parseBooleanEnv(process.env.VIDEO_JOB_AUTO_SYNC_ENABLED)
    : true
  const videoJobAutoSyncIntervalMs = parseMs(process.env.VIDEO_JOB_AUTO_SYNC_INTERVAL_MS, 20_000)
  const videoJobAutoSyncBatchSize = parsePositiveInt(process.env.VIDEO_JOB_AUTO_SYNC_BATCH_SIZE, 8)
  const videoJobAutoSyncOlderThanMs = parsePositiveInt(
    process.env.VIDEO_JOB_AUTO_SYNC_OLDER_THAN_MS,
    5_000
  )
  let dbRepairing = false
  let videoJobSyncing = false
  void cleanupGeneratedFiles(generatedDir, { maxAgeMs: cleanupRetentionMs, retries: 2 })
  SloService.cleanupExpiredData()
  const cleanupTask = startCleanupScheduler(generatedDir, cleanupIntervalMs, cleanupRetentionMs)
  const sloCleanupTask = setInterval(() => {
    SloService.cleanupExpiredData()
  }, sloCleanupIntervalMs)
  const metricTask = setInterval(
    () => ModelMarketplaceService.collectAndPersistMetrics(),
    marketplaceMetricIntervalMs
  )
  const dbHealthTask =
    dbHealthcheckIntervalMs > 0
      ? setInterval(() => {
          if (dbRepairing) return
          const health = LocalDatabaseService.checkIntegrity('quick')
          if (health.status === 'ok') return
          if (!LocalDatabaseService.shouldAutoRepair(health)) {
            console.warn(
              `[DB-AutoRepair] skipped non-corruption health issue: ${health.messages.join('; ') || health.status}`
            )
            return
          }
          dbRepairing = true
          try {
            const repair = LocalDatabaseService.repair({
              force: true,
              reason: 'runtime-healthcheck-auto'
            })
            if (repair.status === 'repaired') {
              ModelMarketplaceService.resetAfterDatabaseRecovery()
              console.warn(
                `[DB-AutoRepair] repaired database, copiedRows=${repair.salvage.copiedRows}`
              )
            } else if (repair.status === 'failed') {
              console.error(`[DB-AutoRepair] failed: ${repair.error || 'unknown error'}`)
            }
          } finally {
            dbRepairing = false
          }
        }, dbHealthcheckIntervalMs)
      : null
  const videoJobSyncTask =
    videoJobAutoSyncEnabled && videoJobAutoSyncIntervalMs > 0
      ? setInterval(() => {
          if (videoJobSyncing) return
          videoJobSyncing = true
          void VideoGenerationService.syncPendingJobsBatch({
            limit: videoJobAutoSyncBatchSize,
            olderThanMs: videoJobAutoSyncOlderThanMs
          })
            .then((batch) => {
              if (batch.syncedCount > 0 || batch.failedCount > 0) {
                console.log(
                  `[video-job-sync] scanned=${batch.scannedCount}, synced=${batch.syncedCount}, failed=${batch.failedCount}, skipped=${batch.skippedCount}`
                )
              }
              if (batch.failedCount > 0) {
                const sample = batch.failedJobs
                  .slice(0, 2)
                  .map((item) => `${item.jobId}:${item.error}`)
                  .join('; ')
                console.warn(`[video-job-sync] failed sample: ${sample}`)
              }
            })
            .catch((error: any) => {
              console.warn(
                `[video-job-sync] unexpected error: ${String(
                  error?.message || error || 'unknown sync error'
                )}`
              )
            })
            .finally(() => {
              videoJobSyncing = false
            })
        }, videoJobAutoSyncIntervalMs)
      : null

  const dispose = () => {
    clearInterval(cleanupTask)
    clearInterval(sloCleanupTask)
    clearInterval(metricTask)
    if (dbHealthTask) clearInterval(dbHealthTask)
    if (videoJobSyncTask) clearInterval(videoJobSyncTask)
  }
  process.on('SIGTERM', dispose)
  process.on('SIGINT', dispose)

  console.log(`🚀 VeoMuse 旗舰后端已启动: ${app.server?.port}`)
}

export type App = typeof app
