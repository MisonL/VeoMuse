// tests/ai_api.test.ts
import { describe, it, expect, beforeAll } from 'bun:test';
import { Elysia, t } from 'elysia';
import { PromptEnhanceService } from '../apps/backend/src/services/PromptEnhanceService';
import { ApiKeyService } from '../apps/backend/src/services/ApiKeyService';

const app = new Elysia()
  .post('/api/ai/enhance', async ({ body }: { body: { prompt: string } }) => {
    try {
      return await PromptEnhanceService.enhance(body.prompt);
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
});
