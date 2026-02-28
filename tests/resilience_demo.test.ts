import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { PromptEnhanceService } from '../apps/backend/src/services/PromptEnhanceService';
import { ApiKeyService } from '../apps/backend/src/services/ApiKeyService';

describe('BaseAiService 健壮性与性能量化演示', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    let attempt = 0;
    global.fetch = mock(() => {
      attempt++;
      if (attempt < 3) return Promise.resolve(new Response('oops', { status: 500 }));
      return Promise.resolve(new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify({
          enhanced: 'ok',
          negative: 'none',
          style_suggestion: 'cinematic'
        }) }] } }]
      })));
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('应在请求失败时触发指数退避重试并打印性能指标', async () => {
    ApiKeyService.init(['mock-key']);
    const result = await PromptEnhanceService.enhance('一只赛博朋克风格的赛马');
    expect(result.enhanced).toBe('ok');
  });
});
