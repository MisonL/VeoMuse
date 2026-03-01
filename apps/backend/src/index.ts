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
import { LocalStorageProvider } from './services/storage/LocalStorageProvider'
import { AuthService } from './services/AuthService'
import { OrganizationService } from './services/OrganizationService'
import { ChannelConfigService } from './services/ChannelConfigService'
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

const isDevRuntime = () => {
  const nodeEnv = String(process.env.NODE_ENV || '').toLowerCase()
  return nodeEnv === 'development' || nodeEnv === 'test'
}

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
    ? organizations.find(item => item.id === headerOrganizationId)?.id
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
      ? (Object.values(capabilities.models).some(Boolean) || Object.values(capabilities.services).some(Boolean))
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
      'runway-gen3': configured(process.env.RUNWAY_API_URL) && configured(process.env.RUNWAY_API_KEY),
      'pika-1.5': configured(process.env.PIKA_API_URL) && configured(process.env.PIKA_API_KEY),
      'openai-compatible': (
        configured(process.env.OPENAI_COMPATIBLE_BASE_URL || process.env.OPENAI_BASE_URL)
        && configured(process.env.OPENAI_COMPATIBLE_API_KEY || process.env.OPENAI_API_KEY)
        && configured(process.env.OPENAI_COMPATIBLE_MODEL || process.env.OPENAI_MODEL)
      )
    },
    services: {
      tts: configured(process.env.TTS_API_URL) && configured(process.env.TTS_API_KEY),
      voiceMorph: configured(process.env.VOICE_MORPH_API_URL) && configured(process.env.VOICE_MORPH_API_KEY),
      spatialRender: configured(process.env.SPATIAL_API_URL) && configured(process.env.SPATIAL_API_KEY),
      vfx: configured(process.env.VFX_API_URL) && configured(process.env.VFX_API_KEY),
      lipSync: configured(process.env.LIP_SYNC_API_URL) && configured(process.env.LIP_SYNC_API_KEY),
      audioAnalysis: configured(process.env.AUDIO_ANALYSIS_API_URL) && configured(process.env.AUDIO_ANALYSIS_API_KEY),
      relighting: configured(process.env.RELIGHT_API_URL) && configured(process.env.RELIGHT_API_KEY),
      styleTransfer: configured(process.env.ALCHEMY_API_URL) && configured(process.env.ALCHEMY_API_KEY),
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

  return timelineData.tracks.some((track: any) => (
    track?.type !== 'text'
    && track?.type !== 'mask'
    && Array.isArray(track?.clips)
    && track.clips.some((clip: any) => typeof clip?.src === 'string' && clip.src.trim().length > 0)
  ))
}

const WS_AUTH_PROTOCOL_PREFIX = 'veomuse-auth.'

const resolveWsAccessToken = (headers: Record<string, unknown>) => {
  const protocolHeader = String(
    headers['sec-websocket-protocol']
    || headers['Sec-WebSocket-Protocol']
    || ''
  )
  const fromProtocol = protocolHeader
    .split(',')
    .map(token => token.trim())
    .find(token => token.startsWith(WS_AUTH_PROTOCOL_PREFIX))
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

  return new Elysia()
    .use(cors())
    .trace(async ({ onHandle, set }) => {
      onHandle(({ begin, onStop }) => {
        onStop(({ end }) => {
          set.headers['Server-Timing'] = `handle;dur=${end - begin};desc="Execution"`
        })
      })
    })
    .onError(({ code, error, set }) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const currentStatus = typeof set.status === 'number' ? set.status : 500
      set.status = currentStatus >= 400 ? currentStatus : 500
      console.error(`🚨 [Global Guard] ${code}: ${errorMessage}`)
      return { success: false, status: 'error', error: errorMessage, code }
    })
    .get('/', () => 'VeoMuse Backend Active')
    .get('/api/health', () => ({ status: 'ok' }))
    .get('/api/capabilities', ({ request, query }) => {
      const workspaceId = query.workspaceId?.trim() || undefined
      return getCapabilities(request, workspaceId)
    }, {
      query: t.Object({
        workspaceId: t.Optional(t.String())
      })
    })
    .post('/api/auth/register', async ({ body, set }) => {
      try {
        const user = await AuthService.register(body.email, body.password)
        const organization = OrganizationService.createOrganization(body.organizationName || `${user.email.split('@')[0]} 的组织`, user.id)
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
    }, {
      body: t.Object({
        email: t.String(),
        password: t.String(),
        organizationName: t.Optional(t.String())
      })
    })
    .post('/api/auth/login', async ({ body, set }) => {
      try {
        const user = await AuthService.login(body.email, body.password)
        const session = AuthService.createSession(user)
        const organizations = OrganizationService.listOrganizationsForUser(user.id)
        return { success: true, session, organizations }
      } catch (error: any) {
        set.status = 401
        return { success: false, status: 'error', error: error?.message || '登录失败' }
      }
    }, {
      body: t.Object({
        email: t.String(),
        password: t.String()
      })
    })
    .post('/api/auth/refresh', ({ body, set }) => {
      try {
        const session = AuthService.rotateSession(body.refreshToken)
        const organizations = OrganizationService.listOrganizationsForUser(session.user.id)
        return { success: true, session, organizations }
      } catch (error: any) {
        set.status = 401
        return { success: false, status: 'error', error: error?.message || '刷新会话失败' }
      }
    }, {
      body: t.Object({
        refreshToken: t.String()
      })
    })
    .post('/api/auth/logout', ({ body }) => {
      AuthService.revokeRefreshToken(body.refreshToken || '')
      return { success: true }
    }, {
      body: t.Object({
        refreshToken: t.Optional(t.String())
      })
    })
    .get('/api/auth/me', ({ request, set }) => {
      const user = requireAuthenticatedUser(request, set)
      if (!user) return { success: false, status: 'error', error: 'Unauthorized' }
      return {
        success: true,
        user,
        organizations: OrganizationService.listOrganizationsForUser(user.id)
      }
    })
    .post('/api/organizations', ({ request, body, set }) => {
      const user = requireAuthenticatedUser(request, set)
      if (!user) return { success: false, status: 'error', error: 'Unauthorized' }
      try {
        const organization = OrganizationService.createOrganization(body.name, user.id)
        return { success: true, organization }
      } catch (error: any) {
        set.status = 400
        return { success: false, status: 'error', error: error?.message || '创建组织失败' }
      }
    }, {
      body: t.Object({
        name: t.String()
      })
    })
    .get('/api/organizations', ({ request, set }) => {
      const user = requireAuthenticatedUser(request, set)
      if (!user) return { success: false, status: 'error', error: 'Unauthorized' }
      return {
        success: true,
        organizations: OrganizationService.listOrganizationsForUser(user.id)
      }
    })
    .get('/api/organizations/:id', ({ params, request, set }) => {
      const authorized = authorizeOrganizationRole(params.id, request, set, 'member')
      if (!authorized) return { success: false, status: 'error', error: 'Forbidden' }
      const organization = OrganizationService.getOrganization(params.id)
      if (!organization) {
        set.status = 404
        return { success: false, status: 'error', error: 'Organization not found' }
      }
      return { success: true, organization, role: authorized.role }
    }, {
      params: t.Object({ id: t.String() })
    })
    .get('/api/organizations/:id/members', ({ params, request, set }) => {
      const authorized = authorizeOrganizationRole(params.id, request, set, 'member')
      if (!authorized) return { success: false, status: 'error', error: 'Forbidden' }
      return {
        success: true,
        members: OrganizationService.listMembers(params.id)
      }
    }, {
      params: t.Object({ id: t.String() })
    })
    .post('/api/organizations/:id/members', ({ params, request, body, set }) => {
      const authorized = authorizeOrganizationRole(params.id, request, set, 'admin')
      if (!authorized) return { success: false, status: 'error', error: 'Forbidden' }
      try {
        const member = OrganizationService.addMemberByEmail(params.id, body.email, body.role)
        return { success: true, member }
      } catch (error: any) {
        set.status = 400
        return { success: false, status: 'error', error: error?.message || '添加成员失败' }
      }
    }, {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        email: t.String(),
        role: t.Union([t.Literal('owner'), t.Literal('admin'), t.Literal('member')])
      })
    })
    .get('/api/channel/providers', () => ({
      success: true,
      providers: ChannelConfigService.listProviders()
    }))
    .post('/api/channels/test', async ({ request, body, set }) => {
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
    }, {
      body: t.Object({
        providerId: t.String(),
        baseUrl: t.Optional(t.String()),
        apiKey: t.Optional(t.String()),
        workspaceId: t.Optional(t.String()),
        extra: t.Optional(t.Record(t.String(), t.Any()))
      })
    })
    .get('/api/organizations/:id/channels', ({ params, request, set }) => {
      const authorized = authorizeOrganizationRole(params.id, request, set, 'member')
      if (!authorized) return { success: false, status: 'error', error: 'Forbidden' }
      return {
        success: true,
        configs: ChannelConfigService.listConfigs(params.id),
        capabilities: getCapabilities(request)
      }
    }, {
      params: t.Object({ id: t.String() })
    })
    .put('/api/organizations/:id/channels/:providerId', ({ params, request, body, set }) => {
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
    }, {
      params: t.Object({ id: t.String(), providerId: t.String() }),
      body: t.Object({
        baseUrl: t.Optional(t.String()),
        apiKey: t.Optional(t.String()),
        enabled: t.Optional(t.Boolean()),
        extra: t.Optional(t.Record(t.String(), t.Any()))
      })
    })
    .get('/api/workspaces/:id/channels', ({ params, request, set }) => {
      const workspace = WorkspaceService.getWorkspace(params.id)
      if (!workspace) {
        set.status = 404
        return { success: false, status: 'error', error: 'Workspace not found' }
      }
      const authorized = authorizeOrganizationRole(workspace.organizationId, request, set, 'member')
      if (!authorized) return { success: false, status: 'error', error: 'Forbidden' }
      return {
        success: true,
        configs: ChannelConfigService.listConfigs(workspace.organizationId, workspace.id),
        capabilities: getCapabilities(request, workspace.id)
      }
    }, {
      params: t.Object({ id: t.String() })
    })
    .put('/api/workspaces/:id/channels/:providerId', ({ params, request, body, set }) => {
      const workspace = WorkspaceService.getWorkspace(params.id)
      if (!workspace) {
        set.status = 404
        return { success: false, status: 'error', error: 'Workspace not found' }
      }
      const authorized = authorizeOrganizationRole(workspace.organizationId, request, set, 'admin')
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
    }, {
      params: t.Object({ id: t.String(), providerId: t.String() }),
      body: t.Object({
        baseUrl: t.Optional(t.String()),
        apiKey: t.Optional(t.String()),
        enabled: t.Optional(t.Boolean()),
        extra: t.Optional(t.Record(t.String(), t.Any()))
      })
    })
    .get('/api/admin/metrics', ({ request, set }) => {
      if (!authorizeAdmin(request, set)) {
        return { success: false, status: 'error', error: 'Unauthorized' }
      }
      return TelemetryService.getInstance().getSummary()
    })
    .get('/api/admin/db/health', ({ request, query, set }) => {
      if (!authorizeAdmin(request, set)) {
        return { success: false, status: 'error', error: 'Unauthorized' }
      }
      const mode = query.mode === 'full' ? 'full' : 'quick'
      return {
        success: true,
        health: LocalDatabaseService.checkIntegrity(mode),
        lastRepair: LocalDatabaseService.getLastRepairReport()
      }
    }, {
      query: t.Object({
        mode: t.Optional(t.Union([t.Literal('quick'), t.Literal('full')]))
      })
    })
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
    .post('/api/admin/db/repair', ({ request, body, set }) => {
      if (!authorizeAdmin(request, set)) {
        return { success: false, status: 'error', error: 'Unauthorized' }
      }
      const repair = LocalDatabaseService.repair({
        force: Boolean(body?.force),
        reason: body?.reason || 'admin-manual'
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
    }, {
      body: t.Optional(t.Object({
        force: t.Optional(t.Boolean()),
        reason: t.Optional(t.String())
      }))
    })
    .get('/api/admin/db/repairs', ({ request, query, set }) => {
      if (!authorizeAdmin(request, set)) {
        return { success: false, status: 'error', error: 'Unauthorized' }
      }
      const limit = Number.parseInt(query.limit || '20', 10)
      const offset = Number.parseInt(query.offset || '0', 10)
      const from = query.from?.trim()
      const to = query.to?.trim()
      const status = query.status?.trim()
      const reason = query.reason?.trim()
      const history = LocalDatabaseService.getRepairHistory({ limit, offset, from, to, status, reason })
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
    }, {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        from: t.Optional(t.String()),
        to: t.Optional(t.String()),
        status: t.Optional(t.String()),
        reason: t.Optional(t.String())
      })
    })

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
    .post('/api/models/policies', ({ body, request, set }) => {
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
    }, {
      body: t.Object({
        name: t.String(),
        description: t.Optional(t.String()),
        priority: t.Optional(t.Union([t.Literal('quality'), t.Literal('speed'), t.Literal('cost')])),
        maxBudgetUsd: t.Optional(t.Number()),
        enabled: t.Optional(t.Boolean()),
        allowedModels: t.Optional(t.Array(t.String())),
        weights: t.Optional(t.Object({
          quality: t.Optional(t.Number()),
          speed: t.Optional(t.Number()),
          cost: t.Optional(t.Number()),
          reliability: t.Optional(t.Number())
        })),
        fallbackPolicyId: t.Optional(t.String())
      })
    })
    .patch('/api/models/policies/:id', ({ params, body, request, set }) => {
      const organizationContext = resolveOrganizationContext(request, set, 'admin')
      if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
      try {
        const policy = ModelMarketplaceService.updatePolicy(organizationContext.organizationId, params.id, body)
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
    }, {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
        priority: t.Optional(t.Union([t.Literal('quality'), t.Literal('speed'), t.Literal('cost')])),
        maxBudgetUsd: t.Optional(t.Number()),
        enabled: t.Optional(t.Boolean()),
        allowedModels: t.Optional(t.Array(t.String())),
        weights: t.Optional(t.Object({
          quality: t.Optional(t.Number()),
          speed: t.Optional(t.Number()),
          cost: t.Optional(t.Number()),
          reliability: t.Optional(t.Number())
        })),
        fallbackPolicyId: t.Optional(t.String())
      })
    })
    .post('/api/models/policies/:id/simulate', ({ params, body, request, set }) => {
      const organizationContext = resolveOrganizationContext(request, set, 'member')
      if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
      const policy = ModelMarketplaceService.getPolicy(params.id, organizationContext.organizationId)
      if (!policy) {
        set.status = 404
        return { success: false, status: 'error', error: 'Routing policy not found' }
      }
      return {
        success: true,
        decision: ModelMarketplaceService.simulateDecision(body, params.id, organizationContext.organizationId)
      }
    }, {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        prompt: t.String(),
        budgetUsd: t.Optional(t.Number()),
        priority: t.Optional(t.Union([t.Literal('quality'), t.Literal('speed'), t.Literal('cost')]))
      })
    })
    .get('/api/models/policies/:id/executions', ({ params, query, request, set }) => {
      const organizationContext = resolveOrganizationContext(request, set, 'member')
      if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
      const policy = ModelMarketplaceService.getPolicy(params.id, organizationContext.organizationId)
      if (!policy) {
        set.status = 404
        return { success: false, status: 'error', error: 'Routing policy not found' }
      }
      const limit = Number.parseInt(query.limit || '20', 10)
      const offset = Number.parseInt(query.offset || '0', 10)
      return {
        success: true,
        ...ModelMarketplaceService.listPolicyExecutions(organizationContext.organizationId, params.id, { limit, offset })
      }
    }, {
      params: t.Object({ id: t.String() }),
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String())
      })
    })
    .get('/api/models/:id/profile', ({ params, set }) => {
      const profile = ModelMarketplaceService.getProfile(params.id)
      if (!profile) {
        set.status = 404
        return { success: false, status: 'error', error: 'Model profile not found' }
      }
      return { success: true, profile }
    }, {
      params: t.Object({ id: t.String() })
    })
    .post('/api/models/policy/simulate', ({ body, request, set }) => {
      const organizationContext = resolveOrganizationContext(request, set, 'member')
      if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
      return {
        success: true,
        decision: ModelMarketplaceService.simulateDecision(body, undefined, organizationContext.organizationId)
      }
    }, {
      body: t.Object({
        prompt: t.String(),
        budgetUsd: t.Optional(t.Number()),
        priority: t.Optional(t.Union([t.Literal('quality'), t.Literal('speed'), t.Literal('cost')]))
      })
    })
    .post('/api/models/recommend', async ({ body }) => await ModelRouter.recommend(body.prompt), { body: t.Object({ prompt: t.String() }) })

    .post('/api/video/generate', async ({ body, request, set }) => {
      const runtimeContext = resolveRuntimeContext(request, set, body.workspaceId)
      if (!runtimeContext) {
        return { success: false, status: 'error', error: 'Forbidden' }
      }
      const normalizedSyncLip = body.syncLip ?? body.sync_lip
      return await VideoOrchestrator.generate(body.modelId || 'veo-3.1', {
        text: body.text,
        negativePrompt: body.negativePrompt,
        options: {
          ...(body.options || {}),
          actorId: body.actorId,
          consistencyStrength: body.consistencyStrength,
          syncLip: normalizedSyncLip,
          worldLink: body.worldLink,
          worldId: body.worldId
        }
      }, runtimeContext)
    }, {
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
    })

    .group('/api/ai', (group) => group
      .post('/alchemy/style-transfer', async ({ body, request, set }) => {
        const runtimeContext = resolveRuntimeContext(request, set, body.workspaceId)
        if (!runtimeContext) return { success: false, status: 'error', error: 'Forbidden' }
        return await StyleTransferService.transfer(body, runtimeContext)
      }, {
        body: t.Object({
          clipId: t.String(),
          style: t.String(),
          referenceModel: t.Optional(t.Union([t.Literal('luma-dream'), t.Literal('kling-v1'), t.Literal('veo-3.1')])),
          workspaceId: t.Optional(t.String())
        })
      })
      .post('/enhance', async ({ body, request, set }) => {
        const user = requireAuthenticatedUser(request, set)
        if (!user) return { success: false, status: 'error', error: 'Unauthorized' }
        try {
          return await PromptEnhanceService.enhance(body.prompt)
        } catch (error) {
          if (isGeminiNotConfiguredError(error)) return buildGeminiNotConfiguredResponse()
          throw error
        }
      }, { body: t.Object({ prompt: t.String() }) })
      .post('/translate', async ({ body, request, set }) => {
        const user = requireAuthenticatedUser(request, set)
        if (!user) return { success: false, status: 'error', error: 'Unauthorized' }
        try {
          return await TranslationService.translate(body.text, body.targetLang)
        } catch (error) {
          if (isGeminiNotConfiguredError(error)) return buildGeminiNotConfiguredResponse()
          throw error
        }
      }, { body: t.Object({ text: t.String(), targetLang: t.String() }) })
      .post('/director/analyze', async ({ body, request, set }) => {
        const user = requireAuthenticatedUser(request, set)
        if (!user) return { success: false, status: 'error', error: 'Unauthorized' }
        return await AiDirectorService.analyzeScript(body.script)
      }, { body: t.Object({ script: t.String() }) })
      .post('/suggest-cuts', async ({ body, request, set }) => {
        const user = requireAuthenticatedUser(request, set)
        if (!user) return { success: false, status: 'error', error: 'Unauthorized' }
        return await AiClipService.suggestCuts(body.description, body.duration)
      }, { body: t.Object({ description: t.String(), duration: t.Number() }) })
      .post('/tts', async ({ body, request, set }) => {
        const runtimeContext = resolveRuntimeContext(request, set, body.workspaceId)
        if (!runtimeContext) return { success: false, status: 'error', error: 'Forbidden' }
        return await TtsService.synthesize(body.text, runtimeContext)
      }, {
        body: t.Object({ text: t.String(), workspaceId: t.Optional(t.String()) })
      })
      .post('/voice-morph', async ({ body, request, set }) => {
        const runtimeContext = resolveRuntimeContext(request, set, body.workspaceId)
        if (!runtimeContext) return { success: false, status: 'error', error: 'Forbidden' }
        return await VoiceMorphService.morph(body.audioUrl, body.targetVoiceId, runtimeContext)
      }, {
        body: t.Object({ audioUrl: t.String(), targetVoiceId: t.String(), workspaceId: t.Optional(t.String()) })
      })
      .post('/music-advice', async ({ body, request, set }) => {
        const user = requireAuthenticatedUser(request, set)
        if (!user) return { success: false, status: 'error', error: 'Unauthorized' }
        try {
          return await MusicAdviceService.getAdvice(body.description)
        } catch (error) {
          if (isGeminiNotConfiguredError(error)) return buildGeminiNotConfiguredResponse()
          throw error
        }
      }, { body: t.Object({ description: t.String() }) })
      .post('/repair', async ({ body, request, set }) => {
        const user = requireAuthenticatedUser(request, set)
        if (!user) return { success: false, status: 'error', error: 'Unauthorized' }
        try {
          return await InpaintService.getRepairAdvice(body.description)
        } catch (error) {
          if (isGeminiNotConfiguredError(error)) return buildGeminiNotConfiguredResponse()
          throw error
        }
      }, { body: t.Object({ description: t.String() }) })
      .post('/analyze-audio', async ({ body, request, set }) => {
        const runtimeContext = resolveRuntimeContext(request, set, body.workspaceId)
        if (!runtimeContext) return { success: false, status: 'error', error: 'Forbidden' }
        return await AudioAnalysisService.analyze(body.audioUrl, runtimeContext)
      }, {
        body: t.Object({ audioUrl: t.String(), workspaceId: t.Optional(t.String()) })
      })
      .post('/spatial/render', async ({ body, request, set }) => {
        const runtimeContext = resolveRuntimeContext(request, set, body.workspaceId)
        if (!runtimeContext) return { success: false, status: 'error', error: 'Forbidden' }
        return await SpatialRenderService.reconstruct(body.clipId, body.quality || 'ultra', runtimeContext)
      }, {
        body: t.Object({ clipId: t.String(), quality: t.Optional(t.String()), workspaceId: t.Optional(t.String()) })
      })
      .post('/vfx/apply', async ({ body, request, set }) => {
        const runtimeContext = resolveRuntimeContext(request, set, body.workspaceId)
        if (!runtimeContext) return { success: false, status: 'error', error: 'Forbidden' }
        return await VfxService.applyVfx(body, runtimeContext)
      }, {
        body: t.Object({ clipId: t.String(), vfxType: t.String(), intensity: t.Optional(t.Number()), workspaceId: t.Optional(t.String()) })
      })
      .post('/sync-lip', async ({ body, request, set }) => {
        const runtimeContext = resolveRuntimeContext(request, set, body.workspaceId)
        if (!runtimeContext) return { success: false, status: 'error', error: 'Forbidden' }
        return await LipSyncService.sync(body.videoUrl, body.audioUrl, body.precision || 'high', runtimeContext)
      }, {
        body: t.Object({ videoUrl: t.String(), audioUrl: t.String(), precision: t.Optional(t.String()), workspaceId: t.Optional(t.String()) })
      })
      .post('/relighting/apply', async ({ body, request, set }) => {
        const runtimeContext = resolveRuntimeContext(request, set, body.workspaceId)
        if (!runtimeContext) return { success: false, status: 'error', error: 'Forbidden' }
        return await RelightingService.applyRelighting(body.clipId, body.style, runtimeContext)
      }, {
        body: t.Object({ clipId: t.String(), style: t.String(), workspaceId: t.Optional(t.String()) })
      })
      .post('/creative/run', ({ body, request, set }) => {
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
      }, {
        body: t.Object({
          script: t.String(),
          style: t.Optional(t.String()),
          context: t.Optional(t.Record(t.String(), t.Any()))
        })
      })
      .get('/creative/run/:id', ({ params, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'member')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        const run = CreativePipelineService.getRun(params.id, organizationContext.organizationId)
        if (!run) {
          set.status = 404
          return { success: false, status: 'error', error: 'Creative run not found' }
        }
        return { success: true, run }
      }, {
        params: t.Object({ id: t.String() })
      })
      .post('/creative/run/:id/regenerate', ({ params, body, request, set }) => {
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
      }, {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          sceneId: t.String(),
          feedback: t.Optional(t.String())
        })
      })
      .post('/creative/run/:id/feedback', ({ params, body, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'member')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        const result = CreativePipelineService.applyFeedback(params.id, body, organizationContext.organizationId)
        if (!result?.run) {
          set.status = 404
          return { success: false, status: 'error', error: 'Creative run not found' }
        }
        return { success: true, ...result }
      }, {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          runFeedback: t.Optional(t.String()),
          sceneFeedbacks: t.Optional(t.Array(t.Object({
            sceneId: t.String(),
            feedback: t.String()
          })))
        })
      })
      .post('/creative/run/:id/commit', ({ params, body, request, set }) => {
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
      }, {
        params: t.Object({ id: t.String() }),
        body: t.Optional(t.Object({
          qualityScore: t.Optional(t.Number()),
          notes: t.Optional(t.Record(t.String(), t.Any()))
        }))
      })
      .get('/creative/run/:id/versions', ({ params, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'member')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        const versions = CreativePipelineService.getRunVersions(params.id, organizationContext.organizationId)
        if (!versions.length) {
          set.status = 404
          return { success: false, status: 'error', error: 'Creative run not found' }
        }
        return { success: true, versions }
      }, {
        params: t.Object({ id: t.String() })
      })
      .group('/actors', (actorsGroup) => actorsGroup
        .get('/', ({ request, set }) => {
          const organizationContext = resolveOrganizationContext(request, set, 'member')
          if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
          return {
            success: true,
            actors: ActorConsistencyService.getAllActors(organizationContext.organizationId)
          }
        })
        .post('/', ({ body, request, set }) => {
          const organizationContext = resolveOrganizationContext(request, set, 'member')
          if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
          return {
            success: true,
            actor: ActorConsistencyService.createActor(body.name, body.refImage, organizationContext.organizationId)
          }
        }, {
          body: t.Object({
            name: t.String(),
            refImage: t.String()
          })
        })
        .post('/motion-sync', ({ body, request, set }) => {
          const organizationContext = resolveOrganizationContext(request, set, 'member')
          if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
          return ActorConsistencyService.syncMotion(body.actorId, body.motionData, organizationContext.organizationId)
        }, {
          body: t.Object({
            actorId: t.String(),
            motionData: t.Object({
              pose: t.Array(t.Object({
                x: t.Number(),
                y: t.Number(),
                z: t.Number()
              })),
              face: t.Optional(t.Object({
                expression: t.Optional(t.String()),
                intensity: t.Optional(t.Number())
              })),
              timestamp: t.Number()
            })
          })
        })
        .post('/generate', async ({ body, request, set }) => {
          const organizationContext = resolveOrganizationContext(request, set, 'member')
          if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
          return { success: true, status: 'ok', message: 'Actor generation started', actorId: body.actorId }
        }, { body: t.Object({ prompt: t.String(), actorId: t.String(), modelId: t.Optional(t.String()) }) })
      )
    )

    .post('/api/workspaces', ({ body, request, set }) => {
      const user = requireAuthenticatedUser(request, set)
      if (!user) return { success: false, status: 'error', error: 'Unauthorized' }
      const organizationId = body.organizationId?.trim() || OrganizationService.listOrganizationsForUser(user.id)[0]?.id || ''
      if (!organizationId) {
        set.status = 403
        return { success: false, status: 'error', error: 'Forbidden: organization membership required' }
      }
      const authorized = authorizeOrganizationRole(organizationId, request, set, 'member')
      if (!authorized) {
        return { success: false, status: 'error', error: 'Forbidden: organization membership required' }
      }
      const fallbackOwnerName = user.email.split('@')[0] || 'Owner'
      return {
        success: true,
        ...WorkspaceService.createWorkspace(body.name, body.ownerName || fallbackOwnerName, organizationId, user.id)
      }
    }, {
      body: t.Object({
        name: t.String(),
        ownerName: t.Optional(t.String()),
        organizationId: t.Optional(t.String())
      })
    })
    .get('/api/workspaces/:id/invites', ({ params, request, set }) => {
      const authorized = authorizeWorkspaceRole(params.id, request, set, 'owner')
      if (!authorized) {
        return { success: false, status: 'error', error: 'Forbidden: owner membership required' }
      }
      return {
        success: true,
        invites: WorkspaceService.listInvites(params.id)
      }
    }, {
      params: t.Object({ id: t.String() })
    })
    .post('/api/workspaces/:id/invites', ({ params, body, request, set }) => {
      const authorized = authorizeWorkspaceRole(params.id, request, set, 'owner')
      if (!authorized) {
        return { success: false, status: 'error', error: 'Forbidden: owner membership required' }
      }
      return {
        success: true,
        invite: WorkspaceService.createInvite(params.id, body.role, authorized.actorName, body.expiresInHours)
      }
    }, {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        role: t.Union([t.Literal('owner'), t.Literal('editor'), t.Literal('viewer')]),
        expiresInHours: t.Optional(t.Number())
      })
    })
    .post('/api/workspaces/invites/:code/accept', ({ params, body, request, set }) => {
      const user = requireAuthenticatedUser(request, set)
      if (!user) return { success: false, status: 'error', error: 'Unauthorized' }
      const memberName = body.memberName?.trim() || user.email.split('@')[0] || 'Member'
      const accepted = WorkspaceService.acceptInvite(params.code, memberName, user.id)
      if (!accepted) {
        set.status = 404
        return { success: false, status: 'error', error: 'Invite not found or expired' }
      }
      return { success: true, ...accepted }
    }, {
      params: t.Object({ code: t.String() }),
      body: t.Object({
        memberName: t.Optional(t.String())
      })
    })
    .get('/api/workspaces/:id/members', ({ params, request, set }) => {
      const authorized = authorizeWorkspaceRole(params.id, request, set, 'viewer')
      if (!authorized) {
        return { success: false, status: 'error', error: 'Forbidden: viewer membership required' }
      }
      return {
        success: true,
        members: WorkspaceService.getMembers(params.id)
      }
    }, {
      params: t.Object({ id: t.String() })
    })
    .get('/api/workspaces/:id/presence', ({ params, request, set }) => {
      const authorized = authorizeWorkspaceRole(params.id, request, set, 'viewer')
      if (!authorized) {
        return { success: false, status: 'error', error: 'Forbidden: viewer membership required' }
      }
      return {
        success: true,
        members: WorkspaceService.listPresence(params.id)
      }
    }, {
      params: t.Object({ id: t.String() })
    })
    .get('/api/workspaces/:id/collab/events', ({ params, query, request, set }) => {
      const authorized = authorizeWorkspaceRole(params.id, request, set, 'viewer')
      if (!authorized) {
        return { success: false, status: 'error', error: 'Forbidden: viewer membership required' }
      }
      return {
        success: true,
        events: WorkspaceService.listCollabEvents(params.id, Number.parseInt(query.limit || '50', 10))
      }
    }, {
      params: t.Object({ id: t.String() }),
      query: t.Object({
        limit: t.Optional(t.String())
      })
    })
    .get('/api/workspaces/:id/projects', ({ params, request, set }) => {
      const authorized = authorizeWorkspaceRole(params.id, request, set, 'viewer')
      if (!authorized) {
        return { success: false, status: 'error', error: 'Forbidden: viewer membership required' }
      }
      return {
        success: true,
        projects: WorkspaceService.listWorkspaceProjects(params.id)
      }
    }, {
      params: t.Object({ id: t.String() })
    })
    .post('/api/workspaces/:id/members', ({ params, body, request, set }) => {
      const authorized = authorizeWorkspaceRole(params.id, request, set, 'owner')
      if (!authorized) {
        return { success: false, status: 'error', error: 'Forbidden: owner membership required' }
      }
      return {
        success: true,
        members: WorkspaceService.addMember(params.id, body.name, body.role, authorized.actorName, body.userId)
      }
    }, {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.String(),
        role: t.Union([t.Literal('owner'), t.Literal('editor'), t.Literal('viewer')]),
        userId: t.Optional(t.String())
      })
    })
    .get('/api/projects/:id/audit', ({ params, request, set }) => {
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
    }, {
      params: t.Object({ id: t.String() })
    })
    .post('/api/projects/:id/snapshots', ({ params, body, request, set }) => {
      const authorized = authorizeProjectRole(params.id, request, set, 'editor')
      if (!authorized) {
        if (set.status === 404) {
          return { success: false, status: 'error', error: 'Project not found' }
        }
        return { success: false, status: 'error', error: 'Forbidden: editor membership required' }
      }
      return {
        success: true,
        snapshot: WorkspaceService.createProjectSnapshot(params.id, authorized.actorName, body.content || {})
      }
    }, {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        content: t.Optional(t.Record(t.String(), t.Any()))
      })
    })
    .get('/api/projects/:id/snapshots', ({ params, query, request, set }) => {
      const authorized = authorizeProjectRole(params.id, request, set, 'viewer')
      if (!authorized) {
        if (set.status === 404) {
          return { success: false, status: 'error', error: 'Project not found' }
        }
        return { success: false, status: 'error', error: 'Forbidden: viewer membership required' }
      }
      return {
        success: true,
        snapshots: WorkspaceService.listProjectSnapshots(params.id, Number.parseInt(query.limit || '20', 10))
      }
    }, {
      params: t.Object({ id: t.String() }),
      query: t.Object({
        limit: t.Optional(t.String())
      })
    })
    .post('/api/storage/local-import', async ({ body, request, set }) => {
      const user = requireAuthenticatedUser(request, set)
      if (!user) return { success: false, status: 'error', error: 'Unauthorized' }
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

        const importDir = resolveImportDir()
        await fs.mkdir(importDir, { recursive: true })
        const safeName = sanitizeImportFileName(body.fileName)
        const filePath = path.join(importDir, `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`)
        await fs.writeFile(filePath, bytes)

        return {
          success: true,
          imported: {
            localPath: filePath,
            bytes: bytes.length
          }
        }
      } catch (error: any) {
        set.status = 400
        return { success: false, status: 'error', error: error?.message || 'local import failed' }
      }
    }, {
      body: t.Object({
        fileName: t.String(),
        base64Data: t.String(),
        contentType: t.Optional(t.String())
      })
    })
    .post('/api/storage/upload-token', ({ body, request, set }) => {
      const workspaceId = body.workspaceId.trim()
      const authorized = authorizeWorkspaceRole(workspaceId, request, set, 'editor')
      if (!authorized) {
        return { success: false, status: 'error', error: 'Forbidden: editor membership required' }
      }
      if (body.projectId && !WorkspaceService.projectBelongsToWorkspace(workspaceId, body.projectId)) {
        set.status = 403
        return { success: false, status: 'error', error: 'Project does not belong to workspace' }
      }
      return {
        success: true,
        token: storageProvider.issueUploadToken(body)
      }
    }, {
      body: t.Object({
        workspaceId: t.String(),
        projectId: t.Optional(t.String()),
        fileName: t.String(),
        contentType: t.Optional(t.String())
      })
    })
    .put('/api/storage/local-upload/:objectKey', async ({ params, request, set }) => {
      try {
        const decodedObjectKey = decodeURIComponent(params.objectKey || '').trim()
        if (!decodedObjectKey) {
          set.status = 400
          return { success: false, status: 'error', error: 'objectKey is required' }
        }
        const workspaceId = decodedObjectKey.split('/').map(segment => segment.trim()).filter(Boolean)[0]
        if (!workspaceId) {
          set.status = 400
          return { success: false, status: 'error', error: 'workspaceId is required in objectKey' }
        }

        const maxUploadBytesRaw = Number.parseInt(process.env.LOCAL_UPLOAD_MAX_BYTES || '', 10)
        const maxUploadBytes = Number.isFinite(maxUploadBytesRaw) && maxUploadBytesRaw > 0 ? maxUploadBytesRaw : 200 * 1024 * 1024
        const contentLength = Number.parseInt(request.headers.get('content-length') || '0', 10)
        if (Number.isFinite(contentLength) && contentLength > maxUploadBytes) {
          set.status = 413
          return { success: false, status: 'error', error: `payload too large: ${contentLength} bytes (max ${maxUploadBytes})` }
        }

        const authorized = authorizeWorkspaceRole(workspaceId, request, set, 'editor')
        if (!authorized) {
          return { success: false, status: 'error', error: 'Forbidden: editor membership required' }
        }
        const bytes = new Uint8Array(await request.arrayBuffer())
        if (bytes.byteLength > maxUploadBytes) {
          set.status = 413
          return { success: false, status: 'error', error: `payload too large: ${bytes.byteLength} bytes (max ${maxUploadBytes})` }
        }
        const result = storageProvider.storeObject(decodedObjectKey, bytes)
        set.status = 201
        return {
          success: true,
          uploaded: {
            objectKey: result.objectKey,
            bytes: result.bytes,
            publicUrl: result.publicUrl
          }
        }
      } catch (error: any) {
        set.status = 400
        return { success: false, status: 'error', error: error?.message || 'local upload failed' }
      }
    }, {
      params: t.Object({
        objectKey: t.String()
      })
    })

    .post('/api/video/compose', async ({ body, request, set }) => {
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

      return await CompositionService.compose(body.timelineData)
    }, {
      body: t.Object({
        timelineData: t.Any(),
        workspaceId: t.Optional(t.String())
      })
    })

    .ws('/ws/generation', { open(ws) { ws.send({ message: '已连接到旗舰级总线' }) } })
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
            return Buffer.from(message.buffer, message.byteOffset, message.byteLength).toString('utf8')
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

if (import.meta.main) {
  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production' && !process.env.JWT_SECRET?.trim()) {
    throw new Error('JWT_SECRET 未配置，生产环境拒绝启动')
  }
  if (!isDevRuntime() && !process.env.ADMIN_TOKEN?.trim()) {
    console.error('[Security] ADMIN_TOKEN 未配置，管理接口已在生产模式禁用。请设置 ADMIN_TOKEN 后重启服务。')
  }
  app.listen({ port: parseInt(process.env.PORT || '33117', 10), hostname: '0.0.0.0' })
  const generatedDir = resolveGeneratedDir()
  const cleanupIntervalMs = parseMs(process.env.CLEANUP_INTERVAL_MS, 86_400_000)
  const cleanupRetentionMs = parseMs(process.env.CLEANUP_RETENTION_MS, 86_400_000)
  const marketplaceMetricIntervalMs = parseMs(process.env.MARKETPLACE_METRIC_INTERVAL_MS, 300_000)
  const dbHealthcheckIntervalMs = parseMs(process.env.DB_HEALTHCHECK_INTERVAL_MS, 0)
  let dbRepairing = false
  void cleanupGeneratedFiles(generatedDir, { maxAgeMs: cleanupRetentionMs, retries: 2 })
  const cleanupTask = startCleanupScheduler(generatedDir, cleanupIntervalMs, cleanupRetentionMs)
  const metricTask = setInterval(() => ModelMarketplaceService.collectAndPersistMetrics(), marketplaceMetricIntervalMs)
  const dbHealthTask = dbHealthcheckIntervalMs > 0
    ? setInterval(() => {
      if (dbRepairing) return
      const health = LocalDatabaseService.checkIntegrity('quick')
      if (health.status === 'ok') return
      if (!LocalDatabaseService.shouldAutoRepair(health)) {
        console.warn(`[DB-AutoRepair] skipped non-corruption health issue: ${health.messages.join('; ') || health.status}`)
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
          console.warn(`[DB-AutoRepair] repaired database, copiedRows=${repair.salvage.copiedRows}`)
        } else if (repair.status === 'failed') {
          console.error(`[DB-AutoRepair] failed: ${repair.error || 'unknown error'}`)
        }
      } finally {
        dbRepairing = false
      }
    }, dbHealthcheckIntervalMs)
    : null

  const dispose = () => {
    clearInterval(cleanupTask)
    clearInterval(metricTask)
    if (dbHealthTask) clearInterval(dbHealthTask)
  }
  process.on('SIGTERM', dispose)
  process.on('SIGINT', dispose)

  console.log(`🚀 VeoMuse 旗舰后端已启动: ${app.server?.port}`)
}

export type App = typeof app
