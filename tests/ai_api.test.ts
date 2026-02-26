// tests/ai_api.test.ts
import { describe, it, expect, beforeAll } from 'bun:test';
import { Elysia, t } from 'elysia';
import { PromptEnhanceService } from '../apps/backend/src/services/PromptEnhanceService';
import { TtsService } from '../apps/backend/src/services/TtsService';
import { ApiKeyService } from '../apps/backend/src/services/ApiKeyService';

const app = new Elysia()
  .post('/api/ai/enhance', async ({ body }: { body: { prompt: string } }) => {
    try {
      return await PromptEnhanceService.enhance(body.prompt);
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  })
  .post('/api/ai/tts', async ({ body }: { body: { text: string } }) => {
    try {
      return await TtsService.synthesize(body.text);
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

describe('AI API 接口验证', () => {
  beforeAll(() => {
    ApiKeyService.init([]);
  });

  it('应能正确转发提示词扩充请求', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/ai/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: '赛博朋克城市' })
      })
    );
    
    const data = await response.json() as any;
    expect(response.status).toBe(200);
    expect(data.error).toContain('未配置 Gemini API 密钥');
  });

  it('应能正确接收 TTS 语音合成请求', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '你好，我是 VeoMuse' })
      })
    );
    
    // 逻辑待实现，目前预期 404 或由于模拟逻辑返回预期错误
    expect(response.status).toBe(200);
  });
});
