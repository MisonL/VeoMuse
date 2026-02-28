import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { ApiKeyService } from '../apps/backend/src/services/ApiKeyService';
import { ModelRouter } from '../apps/backend/src/services/ModelRouter';

describe('模型路由推荐验证', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    ApiKeyService.init(['mock-key']);
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    ApiKeyService.init(['mock-key']);
  });

  it('应支持返回新模型 ID（runway-gen3）', async () => {
    global.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        recommendedModelId: 'runway-gen3',
                        reason: '动态镜头效果最佳',
                        confidence: 0.9
                      })
                    }
                  ]
                }
              }
            ]
          })
        )
      )
    );

    const result = await ModelRouter.recommend('高速运镜和动作追踪镜头');
    expect(result.recommendedModelId).toBe('runway-gen3');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('当 AI 返回未知模型时应降级到本地路由', async () => {
    global.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        recommendedModelId: 'unknown-model',
                        reason: '未知',
                        confidence: 0.99
                      })
                    }
                  ]
                }
              }
            ]
          })
        )
      )
    );

    const result = await ModelRouter.recommend('动漫风格特效短视频');
    expect(result.recommendedModelId).toBe('pika-1.5');
    expect(result.reason).toContain('降级');
  });

  it('当未配置 Gemini Key 时应使用本地路由', async () => {
    ApiKeyService.init([]);
    const result = await ModelRouter.recommend('电影级光影与写实质感');

    expect(result.recommendedModelId).toBe('luma-dream');
    expect(result.reason).toContain('本地路由');
  });
});
