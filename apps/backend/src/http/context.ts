import type { OrganizationRole, WorkspaceRole } from '@veomuse/shared'
import { AuthService } from '../services/AuthService'
import { ChannelConfigService } from '../services/ChannelConfigService'
import { OrganizationService } from '../services/OrganizationService'
import { VideoGenerationService } from '../services/VideoGenerationService'
import { WorkspaceService } from '../services/WorkspaceService'

type MutableStatus = { status?: number | string }

const ORGANIZATION_ROLE_ORDER: Record<OrganizationRole, number> = {
  member: 1,
  admin: 2,
  owner: 3
}

const WORKSPACE_ROLE_ORDER: Record<WorkspaceRole, number> = {
  viewer: 1,
  editor: 2,
  owner: 3
}

export const isDevRuntime = () => {
  const nodeEnv = String(process.env.NODE_ENV || '').toLowerCase()
  return nodeEnv === 'development' || nodeEnv === 'test'
}

export const parseBooleanEnv = (value: string | undefined) => {
  if (!value) return false
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

export const isSloAdminSeedEnabled = () => parseBooleanEnv(process.env.SLO_ADMIN_SEED_ENABLED)

export const resolveRequestTraceId = (request: Request, prefix = 'trace') => {
  const fromHeader = String(request.headers.get('x-request-id') || '').trim()
  if (fromHeader) return fromHeader
  return `${prefix}_${crypto.randomUUID()}`
}

export const authorizeAdmin = (request: Request, set: MutableStatus) => {
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

export const getAuthenticatedUser = (request: Request) => {
  const authorization = request.headers.get('authorization') || ''
  const token = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : ''
  if (!token) return null
  return AuthService.verifyAccessToken(token)
}

export const requireAuthenticatedUser = (request: Request, set: MutableStatus) => {
  const user = getAuthenticatedUser(request)
  if (!user) {
    set.status = 401
    return null
  }
  return user
}

export const authorizeOrganizationRole = (
  organizationId: string,
  request: Request,
  set: MutableStatus,
  requiredRole: OrganizationRole
) => {
  const user = requireAuthenticatedUser(request, set)
  if (!user) return null
  const actualRole = OrganizationService.getMemberRole(organizationId, user.id)
  if (!actualRole || ORGANIZATION_ROLE_ORDER[actualRole] < ORGANIZATION_ROLE_ORDER[requiredRole]) {
    set.status = 403
    return null
  }
  return { user, role: actualRole }
}

export const authorizeWorkspaceRole = (
  workspaceId: string,
  request: Request,
  set: MutableStatus,
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
  return { user, actorName: member.name, role: actualRole, member }
}

export const resolveOrganizationContext = (
  request: Request,
  set: MutableStatus,
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

export const resolveRuntimeContext = (
  request: Request,
  set: MutableStatus,
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

export const authorizeProjectRole = (
  projectId: string,
  request: Request,
  set: MutableStatus,
  requiredRole: WorkspaceRole
) => {
  const project = WorkspaceService.getProject(projectId)
  if (!project) {
    set.status = 404
    return null
  }
  const authorized = authorizeWorkspaceRole(project.workspaceId, request, set, requiredRole)
  if (!authorized) return null
  return { ...authorized, workspaceId: project.workspaceId, project }
}

export const resolveVideoGenerationJobContext = (
  jobId: string,
  request: Request,
  set: MutableStatus
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

export const getCapabilities = (
  request: Request | undefined,
  workspaceId: string | undefined,
  storageProviderType: string
) => {
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
          storageProvider: storageProviderType
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
      storageProvider: storageProviderType
    },
    timestamp: new Date().toISOString()
  }
}

type TimelineClip = {
  src?: unknown
}

type TimelineTrack = {
  type?: unknown
  clips?: unknown
}

type TimelineDataLike = {
  tracks?: unknown
}

export const hasRenderableSources = (timelineData: TimelineDataLike | null | undefined) => {
  if (!timelineData || !Array.isArray(timelineData.tracks)) return false
  return timelineData.tracks.some((rawTrack) => {
    const track = rawTrack as TimelineTrack
    if (track.type === 'text' || track.type === 'mask') return false
    if (!Array.isArray(track.clips)) return false
    return track.clips.some((rawClip) => {
      const clip = rawClip as TimelineClip
      return typeof clip.src === 'string' && clip.src.trim().length > 0
    })
  })
}

export const buildQuotaExceededResponse = (
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

export const parseBoundedLimit = (value: string | undefined, fallback: number, max: number) => {
  const parsed = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(max, parsed)
}

const requestBodyTextEncoder = new TextEncoder()

export const resolveRequestBytes = async (
  request: Request,
  parsedBody?: unknown
): Promise<Uint8Array> => {
  if (parsedBody instanceof Uint8Array) {
    return parsedBody
  }
  if (ArrayBuffer.isView(parsedBody)) {
    return new Uint8Array(parsedBody.buffer, parsedBody.byteOffset, parsedBody.byteLength)
  }
  if (parsedBody instanceof ArrayBuffer) {
    return new Uint8Array(parsedBody)
  }
  if (parsedBody instanceof Blob) {
    return new Uint8Array(await parsedBody.arrayBuffer())
  }
  if (typeof parsedBody === 'string') {
    return requestBodyTextEncoder.encode(parsedBody)
  }
  if (request.bodyUsed) {
    throw new Error('request body is not available')
  }
  return new Uint8Array(await request.arrayBuffer())
}

const WS_AUTH_PROTOCOL_PREFIX = 'veomuse-auth.'

export const resolveWsAccessToken = (headers: Record<string, unknown>) => {
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

export const isGeminiNotConfiguredError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || '')
  return message.includes('GEMINI_API_KEYS') || message.includes('未配置 Gemini API 密钥')
}

export const buildGeminiNotConfiguredResponse = () => ({
  success: false,
  status: 'not_implemented',
  message: 'Gemini provider 未配置 (GEMINI_API_KEYS)'
})
