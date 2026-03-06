import { Elysia, t } from 'elysia'
import { PromptEnhanceService } from '../services/PromptEnhanceService'
import { AiClipService } from '../services/AiClipService'
import { TtsService } from '../services/TtsService'
import { MusicAdviceService } from '../services/MusicAdviceService'
import { AiDirectorService } from '../services/AiDirectorService'
import { InpaintService } from '../services/InpaintService'
import { AudioAnalysisService } from '../services/AudioAnalysisService'
import { VoiceMorphService } from '../services/VoiceMorphService'
import { TranslationService } from '../services/TranslationService'
import { SpatialRenderService } from '../services/SpatialRenderService'
import { VfxService } from '../services/VfxService'
import { LipSyncService } from '../services/LipSyncService'
import { RelightingService } from '../services/RelightingService'
import { StyleTransferService } from '../services/StyleTransferService'
import { ActorConsistencyService } from '../services/ActorConsistencyService'
import { CreativePipelineService } from '../services/CreativePipelineService'
import {
  buildGeminiNotConfiguredResponse,
  isGeminiNotConfiguredError,
  requireAuthenticatedUser,
  resolveOrganizationContext,
  resolveRuntimeContext
} from './context'

export const aiRoutes = () =>
  new Elysia().group('/api/ai', (group) =>
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
          const run = CreativePipelineService.getRun(params.id, organizationContext.organizationId)
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
            if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
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
