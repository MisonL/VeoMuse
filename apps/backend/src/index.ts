import { Elysia, t } from 'elysia'
import { cors } from '@elysiajs/cors'
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

ApiKeyService.init(process.env.GEMINI_API_KEYS || '');
VideoOrchestrator.registerDriver(new GeminiDriver());
VideoOrchestrator.registerDriver(new KlingDriver());
VideoOrchestrator.registerDriver(new SoraDriver());
VideoOrchestrator.registerDriver(new LumaDriver());
VideoOrchestrator.registerDriver(new RunwayDriver());
VideoOrchestrator.registerDriver(new PikaDriver());

const app = new Elysia()
  .use(cors())
  // 核心升级：全站统一错误拦截，各路由不再编写 try-catch
  .onError(({ code, error, set }) => {
    console.error(`🚨 [Global Guard] ${code}: ${error.message}`);
    set.status = 500;
    return { success: false, error: error.message, code };
  })
  .get('/', () => 'VeoMuse Backend Active')
  .get('/api/health', () => ({ status: 'ok' }))
  
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
  
  .post('/api/ai/alchemy/style-transfer', async () => ({ success: true, operationName: `alc_${Date.now()}` }), { body: t.Object({ clipId: t.String(), style: t.String() }) })
  .post('/api/ai/enhance', async ({ body }) => await PromptEnhanceService.enhance(body.prompt), { body: t.Object({ prompt: t.String() }) })
  .post('/api/ai/translate', async ({ body }) => await TranslationService.translate(body.text, body.targetLang), { body: t.Object({ text: t.String(), targetLang: t.String() }) })
  .post('/api/ai/director/analyze', async ({ body }) => await AiDirectorService.analyzeScript(body.script), { body: t.Object({ script: t.String() }) })
  .post('/api/ai/suggest-cuts', async ({ body }) => await AiClipService.suggestCuts(body.description, body.duration), { body: t.Object({ description: t.String(), duration: t.Number() }) })
  .post('/api/ai/tts', async ({ body }) => await TtsService.synthesize(body.text), { body: t.Object({ text: t.String() }) })
  .post('/api/ai/voice-morph', async ({ body }) => await VoiceMorphService.morph(body.audioUrl, body.targetVoiceId), { body: t.Object({ audioUrl: t.String(), targetVoiceId: t.String() }) })
  .post('/api/ai/music-advice', async ({ body }) => await MusicAdviceService.getAdvice(body.description), { body: t.Object({ description: t.String() }) })
  .post('/api/ai/repair', async ({ body }) => await InpaintService.getRepairAdvice(body.description), { body: t.Object({ description: t.String() }) })
  .post('/api/ai/analyze-audio', async ({ body }) => await AudioAnalysisService.analyze(body.audioUrl), { body: t.Object({ audioUrl: t.String() }) })
  .post('/api/ai/spatial/render', async ({ body }) => await SpatialRenderService.reconstruct(body.clipId, body.quality || 'ultra'), { body: t.Object({ clipId: t.String(), quality: t.Optional(t.String()) }) })
  
  .post('/api/video/compose', async ({ body }) => await CompositionService.compose(body.timelineData), { body: t.Object({ timelineData: t.Any() }) })

  .ws('/ws/generation', { open(ws) { ws.send({ message: '已连接到旗舰级总线' }); } })
  .listen({ port: parseInt(process.env.PORT || '3001'), hostname: '0.0.0.0' })

console.log(`🚀 VeoMuse 旗舰后端 (Architectural Zen) 已启动: ${app.server?.port}`)

export type App = typeof app
