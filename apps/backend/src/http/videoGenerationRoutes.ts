import { Elysia, t } from 'elysia'
import {
  handleCancelVideoGeneration,
  handleCreateVideoGeneration,
  handleGetVideoGeneration,
  handleLegacyVideoGenerate,
  handleListVideoGenerations,
  handleRetryVideoGeneration,
  handleSyncVideoGeneration
} from './videoGenerationHandlers'

export const videoGenerationRoutes = () =>
  new Elysia()
    .post('/api/video/generations', handleCreateVideoGeneration, {
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
    })
    .get('/api/video/generations/:jobId', handleGetVideoGeneration, {
      params: t.Object({
        jobId: t.String()
      })
    })
    .post('/api/video/generations/:jobId/retry', handleRetryVideoGeneration, {
      params: t.Object({
        jobId: t.String()
      })
    })
    .post('/api/video/generations/:jobId/cancel', handleCancelVideoGeneration, {
      params: t.Object({
        jobId: t.String()
      })
    })
    .post('/api/video/generations/:jobId/sync', handleSyncVideoGeneration, {
      params: t.Object({
        jobId: t.String()
      })
    })
    .get('/api/video/generations', handleListVideoGenerations, {
      query: t.Object({
        workspaceId: t.Optional(t.String()),
        status: t.Optional(t.String()),
        modelId: t.Optional(t.String()),
        cursor: t.Optional(t.String()),
        limit: t.Optional(t.String())
      })
    })
    .post('/api/video/generate', handleLegacyVideoGenerate, {
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
