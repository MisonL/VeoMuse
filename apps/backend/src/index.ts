import { Elysia, t } from 'elysia'
import { cors } from '@elysiajs/cors'
import { VideoService } from './services/VideoService'
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
  .get('/', () => 'VeoMuse 旗舰版后端 (Peak Stability)')
  .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))
  .group('/api', (app) => 
    app
      .get('/models', () => VideoOrchestrator.getAvailableModels())
      .post('/models/recommend', async ({ body }) => {
        try { return await ModelRouter.recommend(body.prompt); } 
        catch (e: any) { return { success: false, error: e.message }; }
      }, { body: t.Object({ prompt: t.String() }) })
      .post('/video/generate', async ({ body }) => {
        try {
          return await VideoOrchestrator.generate(body.modelId || 'veo-3.1', {
            text: body.text, negativePrompt: body.negativePrompt, options: body.options
          });
        } catch (e: any) { return { success: false, error: e.message }; }
      }, {
        body: t.Object({
          text: t.String(),
          modelId: t.Optional(t.String()),
          negativePrompt: t.Optional(t.String()),
          options: t.Optional(t.Any())
        })
      })
      .post('/ai/alchemy/style-transfer', async ({ body }) => {
        return { success: true, operationName: `alchemy_vfx_${Date.now()}` };
      }, { body: t.Object({ clipId: t.String(), style: t.String() }) })
      .post('/ai/enhance', async ({ body }) => {
        try { return await PromptEnhanceService.enhance(body.prompt); } 
        catch (e: any) { return { success: false, error: e.message }; }
      }, { body: t.Object({ prompt: t.String() }) })
      .post('/ai/translate', async ({ body }) => {
        try { return await TranslationService.translate(body.text, body.targetLang); }
        catch (e: any) { return { success: false, error: e.message }; }
      }, { body: t.Object({ text: t.String(), targetLang: t.String() }) })
      .post('/ai/director/analyze', async ({ body }) => {
        try { return await AiDirectorService.analyzeScript(body.script); }
        catch (e: any) { return { success: false, error: e.message }; }
      }, { body: t.Object({ script: t.String() }) })
      .post('/ai/suggest-cuts', async ({ body }) => {
        try { return await AiClipService.suggestCuts(body.description, body.duration); } 
        catch (e: any) { return { success: false, error: e.message }; }
      }, { body: t.Object({ description: t.String(), duration: t.Number() }) })
      .post('/ai/tts', async ({ body }) => {
        try { return await TtsService.synthesize(body.text); } 
        catch (e: any) { return { success: false, error: e.message }; }
      }, { body: t.Object({ text: t.String() }) })
      .post('/ai/music-advice', async ({ body }) => {
        try { return await MusicAdviceService.getAdvice(body.description); } 
        catch (e: any) { return { success: false, error: e.message }; }
      }, { body: t.Object({ description: t.String() }) })
      .post('/ai/repair', async ({ body }) => {
        try { return await InpaintService.getRepairAdvice(body.description); }
        catch (e: any) { return { success: false, error: e.message }; }
      }, { body: t.Object({ description: t.String() }) })
      .post('/ai/analyze-audio', async ({ body }) => {
        try { return await AudioAnalysisService.analyze(body.audioUrl); }
        catch (e: any) { return { success: false, error: e.message }; }
      }, { body: t.Object({ audioUrl: t.String() }) })
      .post('/ai/voice-morph', async ({ body }) => {
        try { return await VoiceMorphService.morph(body.audioUrl, body.targetVoiceId); }
        catch (e: any) { return { success: false, error: e.message }; }
      }, { body: t.Object({ audioUrl: t.String(), targetVoiceId: t.String() }) })
      .post('/ai/spatial/render', async ({ body }) => {
        try { return await SpatialRenderService.reconstruct(body.clipId, body.quality || 'ultra'); }
        catch (e: any) { return { success: false, error: e.message }; }
      }, { body: t.Object({ clipId: t.String(), quality: t.Optional(t.String()) }) })
      .post('/video/compose', async ({ body }) => {
        try { return await CompositionService.compose(body.timelineData); } 
        catch (e: any) { return { success: false, error: e.message }; }
      }, { body: t.Object({ timelineData: t.Any() }) })
  )
  .ws('/ws/generation', {
    open(ws) { ws.send({ message: '已连接到旗舰级总线' }); }
  })
  .listen(process.env.PORT || 3001)

console.log(`🚀 VeoMuse 旗舰后端 (Peak Stability) 已启动: ${app.server?.port}`)

export type App = typeof app
