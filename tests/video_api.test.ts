// tests/video_api.test.ts
import { describe, it, expect, beforeAll } from 'bun:test';
import { Elysia, t } from 'elysia';
import { VideoService } from '../apps/backend/src/services/VideoService';
import { ApiKeyService } from '../apps/backend/src/services/ApiKeyService';

// 模拟待实现的路由
const app = new Elysia()
  .post('/api/video/generate', async ({ body }: { body: any }) => {
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
  });

describe('Video API 连通性验证', () => {
  beforeAll(() => {
    ApiKeyService.init([]);
  });

  it('应能正确处理视频生成请求', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '测试生成视频' })
      })
    );
    
    const data = await response.json() as any;
    expect(data.success).toBe(false);
    expect(data.error).toContain('所有 API 密钥均不可用');
  });
});
