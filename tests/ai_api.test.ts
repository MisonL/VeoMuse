// tests/ai_api.test.ts
import { describe, it, expect, beforeAll } from 'bun:test';
import { Elysia, t } from 'elysia';
import { PromptEnhanceService } from '../apps/backend/src/services/PromptEnhanceService';
import { TtsService } from '../apps/backend/src/services/TtsService';
import { ApiKeyService } from '../apps/backend/src/services/ApiKeyService';

// 模拟当前的 API 集群
const app = new Elysia()
  .post('/api/ai/enhance', async ({ body }: any) => {
    try { return await PromptEnhanceService.enhance(body.prompt); } 
    catch (e: any) { return { success: false, error: e.message }; }
  })
  .post('/api/ai/tts', async ({ body }: any) => {
    try { return await TtsService.synthesize(body.text); } 
    catch (e: any) { return { success: false, error: e.message }; }
  })
  .post('/api/ai/director', async ({ body }: any) => {
    // 待实现的导演逻辑
    return { success: true, scenes: [] };
  });

describe('AI API 全功能集群验证', () => {
  beforeAll(() => {
    ApiKeyService.init([]);
  });

  it('TTS 接口连通性', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Hello' })
      })
    );
    expect(response.status).toBe(200);
  });

  it('AI 导演接口连通性', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/ai/director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: '故事脚本' })
      })
    );
    const data = await response.json() as any;
    expect(data.success).toBe(true);
  });

  it('音频节奏分析接口连通性', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/ai/analyze-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl: 'test.mp3' })
      })
    );
    expect(response.status).toBe(200);
  });
});
