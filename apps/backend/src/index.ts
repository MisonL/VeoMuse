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
import type { WorkspaceRole } from '@veomuse/shared'

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

const authorizeAdmin = (request: Request, set: { status?: number | string }) => {
  const token = process.env.ADMIN_TOKEN
  if (!token) return true

  const provided = request.headers.get('x-admin-token')
  if (provided === token) return true

  set.status = 401
  return false
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
  const actorName = request.headers.get('x-workspace-actor')?.trim()
  if (!actorName) {
    set.status = 403
    return null
  }

  const actualRole = WorkspaceService.getMemberRole(workspaceId, actorName)
  if (!actualRole) {
    set.status = 403
    return null
  }
  if (WORKSPACE_ROLE_ORDER[actualRole] < WORKSPACE_ROLE_ORDER[requiredRole]) {
    set.status = 403
    return null
  }

  return {
    actorName,
    role: actualRole
  }
}

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

const getCapabilities = () => {
  const configured = (key?: string) => Boolean(key && key.trim().length > 0)

  return {
    models: {
      'veo-3.1': configured(process.env.GEMINI_API_KEYS),
      'kling-v1': configured(process.env.KLING_API_URL) && configured(process.env.KLING_API_KEY),
      'sora-preview': configured(process.env.SORA_API_URL) && configured(process.env.SORA_API_KEY),
      'luma-dream': configured(process.env.LUMA_API_URL) && configured(process.env.LUMA_API_KEY),
      'runway-gen3': configured(process.env.RUNWAY_API_URL) && configured(process.env.RUNWAY_API_KEY),
      'pika-1.5': configured(process.env.PIKA_API_URL) && configured(process.env.PIKA_API_KEY)
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

export const createApp = () => {
  ensureDriversRegistered()
  ModelMarketplaceService.ensureInitialized()

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
    .get('/api/capabilities', () => getCapabilities())
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
    .get('/api/models/policies', () => ({
      success: true,
      policies: ModelMarketplaceService.listPolicies()
    }))
    .post('/api/models/policies', ({ body, set }) => {
      try {
        return {
          success: true,
          policy: ModelMarketplaceService.createPolicy(body)
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
    .patch('/api/models/policies/:id', ({ params, body, set }) => {
      try {
        const policy = ModelMarketplaceService.updatePolicy(params.id, body)
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
    .post('/api/models/policies/:id/simulate', ({ params, body, set }) => {
      const policy = ModelMarketplaceService.getPolicy(params.id)
      if (!policy) {
        set.status = 404
        return { success: false, status: 'error', error: 'Routing policy not found' }
      }
      return {
        success: true,
        decision: ModelMarketplaceService.simulateDecision(body, params.id)
      }
    }, {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        prompt: t.String(),
        budgetUsd: t.Optional(t.Number()),
        priority: t.Optional(t.Union([t.Literal('quality'), t.Literal('speed'), t.Literal('cost')]))
      })
    })
    .get('/api/models/policies/:id/executions', ({ params, query, set }) => {
      const policy = ModelMarketplaceService.getPolicy(params.id)
      if (!policy) {
        set.status = 404
        return { success: false, status: 'error', error: 'Routing policy not found' }
      }
      const limit = Number.parseInt(query.limit || '20', 10)
      const offset = Number.parseInt(query.offset || '0', 10)
      return {
        success: true,
        ...ModelMarketplaceService.listPolicyExecutions(params.id, { limit, offset })
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
    .post('/api/models/policy/simulate', ({ body }) => ({
      success: true,
      decision: ModelMarketplaceService.simulateDecision(body)
    }), {
      body: t.Object({
        prompt: t.String(),
        budgetUsd: t.Optional(t.Number()),
        priority: t.Optional(t.Union([t.Literal('quality'), t.Literal('speed'), t.Literal('cost')]))
      })
    })
    .post('/api/models/recommend', async ({ body }) => await ModelRouter.recommend(body.prompt), { body: t.Object({ prompt: t.String() }) })

    .post('/api/video/generate', async ({ body }) => {
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
      })
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
        worldId: t.Optional(t.String())
      })
    })

    .group('/api/ai', (group) => group
      .post('/alchemy/style-transfer', async ({ body }) => await StyleTransferService.transfer(body), {
        body: t.Object({
          clipId: t.String(),
          style: t.String(),
          referenceModel: t.Optional(t.Union([t.Literal('luma-dream'), t.Literal('kling-v1'), t.Literal('veo-3.1')]))
        })
      })
      .post('/enhance', async ({ body }) => await PromptEnhanceService.enhance(body.prompt), { body: t.Object({ prompt: t.String() }) })
      .post('/translate', async ({ body }) => await TranslationService.translate(body.text, body.targetLang), { body: t.Object({ text: t.String(), targetLang: t.String() }) })
      .post('/director/analyze', async ({ body }) => await AiDirectorService.analyzeScript(body.script), { body: t.Object({ script: t.String() }) })
      .post('/suggest-cuts', async ({ body }) => await AiClipService.suggestCuts(body.description, body.duration), { body: t.Object({ description: t.String(), duration: t.Number() }) })
      .post('/tts', async ({ body }) => await TtsService.synthesize(body.text), { body: t.Object({ text: t.String() }) })
      .post('/voice-morph', async ({ body }) => await VoiceMorphService.morph(body.audioUrl, body.targetVoiceId), { body: t.Object({ audioUrl: t.String(), targetVoiceId: t.String() }) })
      .post('/music-advice', async ({ body }) => await MusicAdviceService.getAdvice(body.description), { body: t.Object({ description: t.String() }) })
      .post('/repair', async ({ body }) => await InpaintService.getRepairAdvice(body.description), { body: t.Object({ description: t.String() }) })
      .post('/analyze-audio', async ({ body }) => await AudioAnalysisService.analyze(body.audioUrl), { body: t.Object({ audioUrl: t.String() }) })
      .post('/spatial/render', async ({ body }) => await SpatialRenderService.reconstruct(body.clipId, body.quality || 'ultra'), { body: t.Object({ clipId: t.String(), quality: t.Optional(t.String()) }) })
      .post('/vfx/apply', async ({ body }) => await VfxService.applyVfx(body), { body: t.Object({ clipId: t.String(), vfxType: t.String(), intensity: t.Optional(t.Number()) }) })
      .post('/sync-lip', async ({ body }) => await LipSyncService.sync(body.videoUrl, body.audioUrl, body.precision || 'high'), { body: t.Object({ videoUrl: t.String(), audioUrl: t.String(), precision: t.Optional(t.String()) }) })
      .post('/relighting/apply', async ({ body }) => await RelightingService.applyRelighting(body.clipId, body.style), { body: t.Object({ clipId: t.String(), style: t.String() }) })
      .post('/creative/run', ({ body }) => ({
        success: true,
        run: CreativePipelineService.createRun(body.script, body.style || 'cinematic', body.context)
      }), {
        body: t.Object({
          script: t.String(),
          style: t.Optional(t.String()),
          context: t.Optional(t.Record(t.String(), t.Any()))
        })
      })
      .get('/creative/run/:id', ({ params, set }) => {
        const run = CreativePipelineService.getRun(params.id)
        if (!run) {
          set.status = 404
          return { success: false, status: 'error', error: 'Creative run not found' }
        }
        return { success: true, run }
      }, {
        params: t.Object({ id: t.String() })
      })
      .post('/creative/run/:id/regenerate', ({ params, body, set }) => {
        const run = CreativePipelineService.regenerateScene(params.id, body.sceneId, body.feedback)
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
      .post('/creative/run/:id/feedback', ({ params, body, set }) => {
        const result = CreativePipelineService.applyFeedback(params.id, body)
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
      .post('/creative/run/:id/commit', ({ params, body, set }) => {
        const run = CreativePipelineService.commitRun(params.id, body || undefined)
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
      .get('/creative/run/:id/versions', ({ params, set }) => {
        const versions = CreativePipelineService.getRunVersions(params.id)
        if (!versions.length) {
          set.status = 404
          return { success: false, status: 'error', error: 'Creative run not found' }
        }
        return { success: true, versions }
      }, {
        params: t.Object({ id: t.String() })
      })
      .group('/actors', (actorsGroup) => actorsGroup
        .get('/', () => ({ success: true, actors: ActorConsistencyService.getAllActors() }))
        .post('/', ({ body }) => ({
          success: true,
          actor: ActorConsistencyService.createActor(body.name, body.refImage)
        }), {
          body: t.Object({
            name: t.String(),
            refImage: t.String()
          })
        })
        .post('/motion-sync', ({ body }) => ActorConsistencyService.syncMotion(body.actorId, body.motionData), {
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
        .post('/generate', async ({ body }) => ({ success: true, status: 'ok', message: 'Actor generation started', actorId: body.actorId }), { body: t.Object({ prompt: t.String(), actorId: t.String(), modelId: t.Optional(t.String()) }) })
      )
    )

    .post('/api/workspaces', ({ body }) => ({
      success: true,
      ...WorkspaceService.createWorkspace(body.name, body.ownerName || 'Owner')
    }), {
      body: t.Object({
        name: t.String(),
        ownerName: t.Optional(t.String())
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
    .post('/api/workspaces/invites/:code/accept', ({ params, body, set }) => {
      const accepted = WorkspaceService.acceptInvite(params.code, body.memberName)
      if (!accepted) {
        set.status = 404
        return { success: false, status: 'error', error: 'Invite not found or expired' }
      }
      return { success: true, ...accepted }
    }, {
      params: t.Object({ code: t.String() }),
      body: t.Object({
        memberName: t.String()
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
        members: WorkspaceService.addMember(params.id, body.name, body.role, authorized.actorName)
      }
    }, {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.String(),
        role: t.Union([t.Literal('owner'), t.Literal('editor'), t.Literal('viewer')])
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
      const project = WorkspaceService.getProject(params.id)
      if (!project) {
        set.status = 404
        return { success: false, status: 'error', error: 'Project not found' }
      }
      const actorName = (request.headers.get('x-workspace-actor') || body.actorName || '').trim()
      const actorRole = WorkspaceService.getMemberRole(project.workspaceId, actorName)
      if (!actorRole || WORKSPACE_ROLE_ORDER[actorRole] < WORKSPACE_ROLE_ORDER.editor) {
        set.status = 403
        return { success: false, status: 'error', error: 'Forbidden: editor membership required' }
      }
      return {
        success: true,
        snapshot: WorkspaceService.createProjectSnapshot(params.id, actorName, body.content || {})
      }
    }, {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        actorName: t.Optional(t.String()),
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
    .post('/api/storage/local-import', async ({ body, set }) => {
      try {
        const rawBase64 = (body.base64Data || '').trim()
        if (!rawBase64) {
          set.status = 400
          return { success: false, status: 'error', error: 'base64Data is required' }
        }

        const bytes = Buffer.from(rawBase64, 'base64')
        if (!bytes.length) {
          set.status = 400
          return { success: false, status: 'error', error: 'base64Data is invalid' }
        }

        const maxBytes = Number.parseInt(process.env.LOCAL_IMPORT_MAX_BYTES || '', 10)
        const hardLimit = Number.isFinite(maxBytes) && maxBytes > 0 ? maxBytes : 200 * 1024 * 1024
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
        const authorized = authorizeWorkspaceRole(workspaceId, request, set, 'editor')
        if (!authorized) {
          return { success: false, status: 'error', error: 'Forbidden: editor membership required' }
        }
        const bytes = new Uint8Array(await request.arrayBuffer())
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

    .post('/api/video/compose', async ({ body, set }) => {
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
    }, { body: t.Object({ timelineData: t.Any() }) })

    .ws('/ws/generation', { open(ws) { ws.send({ message: '已连接到旗舰级总线' }) } })
    .ws('/ws/collab/:workspaceId', {
      open(ws) {
        const params = (ws.data as any)?.params || {}
        const query = (ws.data as any)?.query || {}
        const workspaceId = String(params.workspaceId || query.workspaceId || '')
        const memberName = String(query.memberName || 'Guest')
        if (!workspaceId) {
          ws.send(JSON.stringify({ type: 'error', error: 'workspaceId is required' }))
          ws.close()
          return
        }
        const memberRole = WorkspaceService.getMemberRole(workspaceId, memberName)
        if (!memberRole) {
          ws.send(JSON.stringify({ type: 'error', error: 'Member is not part of workspace' }))
          ws.close()
          return
        }
        const joined = CollaborationService.join(ws as any, {
          workspaceId,
          memberName,
          role: memberRole,
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
