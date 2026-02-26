import { Elysia, t } from 'elysia'
import { cors } from '@elysiajs/cors'
import fs from 'fs/promises'
import path from 'path'
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
import { TelemetryService } from './services/TelemetryService'

ApiKeyService.init(process.env.GEMINI_API_KEYS || '');
VideoOrchestrator.registerDriver(new GeminiDriver());
VideoOrchestrator.registerDriver(new KlingDriver());
VideoOrchestrator.registerDriver(new SoraDriver());
VideoOrchestrator.registerDriver(new LumaDriver());
VideoOrchestrator.registerDriver(new RunwayDriver());
VideoOrchestrator.registerDriver(new PikaDriver());

const app = new Elysia()
  .use(cors())
  .onError(({ code, error, set }) => {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`🚨 [Global Guard] ${code}: ${errorMessage}`);
    set.status = 500;
    return { success: false, error: errorMessage, code };
  })
  .get('/', () => 'VeoMuse Backend Active')
  .get('/api/health', () => ({ status: 'ok' }))
  .get('/api/admin/metrics', () => TelemetryService.getInstance().getSummary())
  
  .get('/api/models', () => VideoOrchestrator.getAvailableModels())
  .post('/api/models/recommend', async ({ body }) => await ModelRouter.recommend(body.prompt), { body: t.Object({ prompt: t.String() }) })
  
  .post('/api/video/generate', async ({ body }) => {
    return await VideoOrchestrator.generate(body.modelId || 'veo-3.1', {
      text: body.text, negativePrompt: body.negativePrompt, options: body.options
    });
  }, {
    body: t.Object({
      text: t.String(),
      modelId: t.Optional(t.String()),
      negativePrompt: t.Optional(t.String()),
      options: t.Optional(t.Any())
    })
  })
  
  .group('/api/ai', (app) => app
    .post('/alchemy/style-transfer', async () => ({ success: true, operationName: `alc_${Date.now()}` }), { body: t.Object({ clipId: t.String(), style: t.String() }) })
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
    .post('/vfx/apply', async ({ body }) => await VfxService.applyVfx(body as any), { body: t.Object({ clipId: t.String(), vfxType: t.String() }) })
    .post('/sync-lip', async ({ body }) => await LipSyncService.sync(body.videoUrl, body.audioUrl, body.precision || 'high'), { body: t.Object({ videoUrl: t.String(), audioUrl: t.String(), precision: t.Optional(t.String()) }) })
    // 添加 actors 路由以对齐前端调用
    .group('/actors', (app) => app
      .post('/generate', async ({ body }) => ({ success: true, message: 'Actor generation started' }), { body: t.Object({ prompt: t.String(), actorId: t.String(), modelId: t.Optional(t.String()) }) })
    )
  )
  
  .post('/api/video/compose', async ({ body }) => await CompositionService.compose(body.timelineData), { body: t.Object({ timelineData: t.Any() }) })

  .ws('/ws/generation', { open(ws) { ws.send({ message: '已连接到旗舰级总线' }); } })
  .listen({ port: parseInt(process.env.PORT || '3001'), hostname: '0.0.0.0' })

setInterval(async () => {
  const generatedDir = path.resolve(process.cwd(), '../../uploads/generated');
  try {
    const files = await fs.readdir(generatedDir);
    const now = Date.now();
    for (const file of files) {
      const filePath = path.join(generatedDir, file);
      const stats = await fs.stat(filePath);
      if (now - stats.mtimeMs > 86400000) {
        await fs.unlink(filePath);
        console.log(`🧹 已清理过期文件: ${file}`);
      }
    }
  } catch (e) {}
}, 86400000);

console.log(`🚀 VeoMuse 旗舰后端 (Architectural Zen) 已启动: ${app.server?.port}`)

export type App = typeof app
