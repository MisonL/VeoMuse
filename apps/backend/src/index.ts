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
  .onError(({ code, error, set }) => {
    console.error(`🚨 [API Error] ${code}: ${error.message}`);
    set.status = 500;
    return { success: false, error: error.message, code };
  })
  .get('/', () => 'VeoMuse Backend Active')
  .get('/api/health', () => ({ status: 'ok' }))
  
  // 旗舰版：扁平化路由，确保反向代理兼容性 100%
  .get('/api/models', () => VideoOrchestrator.getAvailableModels())
  .post('/api/models/recommend', async ({ body }) => {
    try { return await ModelRouter.recommend(body.prompt); } 
    catch (e: unknown) { return { success: false, error: (e as Error).message }; }
  }, { body: t.Object({ prompt: t.String() }) })
  
  .post('/api/video/generate', async ({ body }) => {
    try {
      return await VideoOrchestrator.generate(body.modelId || 'veo-3.1', {
        text: body.text, negativePrompt: body.negativePrompt, options: body.options
      });
    } catch (e: unknown) { return { success: false, error: (e as Error).message }; }
  }, {
    body: t.Object({
      text: t.String(),
      modelId: t.Optional(t.String()),
      negativePrompt: t.Optional(t.String()),
      options: t.Optional(t.Any())
    })
  })
  
  .post('/api/ai/enhance', async ({ body }) => {
    try { return await PromptEnhanceService.enhance(body.prompt); } 
    catch (e: unknown) { return { success: false, error: (e as Error).message }; }
  }, { body: t.Object({ prompt: t.String() }) })
  
  .post('/api/ai/director/analyze', async ({ body }) => {
    try { return await AiDirectorService.analyzeScript(body.script); }
    catch (e: unknown) { return { success: false, error: (e as Error).message }; }
  }, { body: t.Object({ script: t.String() }) })
  
  .post('/api/ai/suggest-cuts', async ({ body }) => {
    try { return await AiClipService.suggestCuts(body.description, body.duration); } 
    catch (e: unknown) { return { success: false, error: (e as Error).message }; }
  }, { body: t.Object({ description: t.String(), duration: t.Number() }) })
  
  .post('/api/ai/tts', async ({ body }) => {
    try { return await TtsService.synthesize(body.text); } 
    catch (e: unknown) { return { success: false, error: (e as Error).message }; }
  }, { body: t.Object({ text: t.String() }) })
  
  .post('/api/ai/voice-morph', async ({ body }) => {
    try { return await VoiceMorphService.morph(body.audioUrl, body.targetVoiceId); }
    catch (e: unknown) { return { success: false, error: (e as Error).message }; }
  }, { body: t.Object({ audioUrl: t.String(), targetVoiceId: t.String() }) })
  
  .post('/api/video/compose', async ({ body }) => {
    try { return await CompositionService.compose(body.timelineData); } 
    catch (e: unknown) { return { success: false, error: (e as Error).message }; }
  }, { body: t.Object({ timelineData: t.Any() }) })

  .ws('/ws/generation', {
    open(ws) { ws.send({ message: '已连接到旗舰级总线' }); }
  })
  .listen({
    port: parseInt(process.env.PORT || '3001'),
    hostname: '0.0.0.0'
  })

console.log(`🚀 VeoMuse 旗舰后端已启动: ${app.server?.port}`)

export type App = typeof app
