import { Elysia, t } from 'elysia'
import { cors } from '@elysiajs/cors'
import { VideoService } from './services/VideoService'
import { ApiKeyService } from './services/ApiKeyService'
import { PromptEnhanceService } from './services/PromptEnhanceService'
import { AiClipService } from './services/AiClipService'
import { CompositionService } from './services/CompositionService'

// 初始化 API 密钥
ApiKeyService.init(process.env.GEMINI_API_KEYS || '');

const app = new Elysia()
  .use(cors())
  .get('/', () => 'VeoMuse 旗舰版后端已就绪')
  .get('/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString()
  }))
  .group('/api', (app) => 
    app
      .post('/video/generate', async ({ body }) => {
        try {
          return await VideoService.generateFromText(body);
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      }, {
        body: t.Object({
          text: t.String(),
          negativePrompt: t.Optional(t.String()),
          model: t.Optional(t.String())
        })
      })
      .post('/ai/enhance', async ({ body }) => {
        try {
          return await PromptEnhanceService.enhance(body.prompt);
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      }, {
        body: t.Object({
          prompt: t.String()
        })
      })
      .post('/ai/suggest-cuts', async ({ body }) => {
        try {
          return await AiClipService.suggestCuts(body.description, body.duration);
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      }, {
        body: t.Object({
          description: t.String(),
          duration: t.Number()
        })
      })
      .post('/video/compose', async ({ body }) => {
        try {
          return await CompositionService.compose(body.timelineData);
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      }, {
        body: t.Object({
          timelineData: t.Any() // 在实际项目中可定义更精细的 TypeBox 模型
        })
      })
  )
  // WebSocket 用于实时进度推送
  .ws('/ws/generation', {
    open(ws) {
      console.log('🔌 WebSocket 连接已开启');
      ws.send({ message: '已连接到生成进度频道' });
    },
    message(ws, message) {
      console.log('📩 收到消息:', message);
    }
  })
  .listen(process.env.PORT || 3001)

console.log(`🚀 VeoMuse 旗舰后端已在 ${app.server?.hostname}:${app.server?.port} 启动`)

export type App = typeof app
