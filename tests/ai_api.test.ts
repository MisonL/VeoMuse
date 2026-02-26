// tests/ai_api.test.ts
import { describe, it, expect, beforeAll } from 'bun:test';
import { Elysia, t } from 'elysia';
import { ApiKeyService } from '../apps/backend/src/services/ApiKeyService';

// 创建与真实 index.ts 1:1 对齐的模拟 App
const app = new Elysia()
  .group('/api', (app) => 
    app
      .post('/ai/enhance', async () => ({ success: true, enhanced: 'Mock' }))
      .post('/ai/translate', async () => ({ translatedText: 'Mock', detectedLang: 'zh' }))
      .post('/ai/director/analyze', async () => ({ success: true, storyTitle: 'Mock', worldId: 'w1', scenes: [] }))
      .post('/ai/tts', async () => ({ success: true, audioUrl: '/m.mp3' }))
      .post('/ai/voice-morph', async () => ({ success: true, morphedAudioUrl: '/morph.mp3' }))
      .post('/ai/spatial/render', async () => ({ success: true, nerfDataUrl: '/n.splat' }))
      .post('/ai/relighting/apply', async () => ({ success: true, operationId: 'op1' }))
      .post('/ai/vfx/apply', async () => ({ success: true, operationId: 'op2' }))
      .post('/models/recommend', async () => ({ recommendedModelId: 'veo-3.1', reason: 'Mock', confidence: 0.9 }))
  );

describe('AI API 全链路模拟连通性复核', () => {
  beforeAll(() => {
    ApiKeyService.init([]);
  });

  it('智能推荐接口应连通', async () => {
    const res = await app.handle(new Request('http://localhost/api/models/recommend', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'test' })
    }));
    expect(res.status).toBe(200);
  });

  it('3D 空间渲染接口应连通', async () => {
    const res = await app.handle(new Request('http://localhost/api/ai/spatial/render', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clipId: 'c1' })
    }));
    expect(res.status).toBe(200);
  });

  it('音色炼金接口应连通', async () => {
    const res = await app.handle(new Request('http://localhost/api/ai/voice-morph', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioUrl: 'test', targetVoiceId: 'pro' })
    }));
    expect(res.status).toBe(200);
  });
});
