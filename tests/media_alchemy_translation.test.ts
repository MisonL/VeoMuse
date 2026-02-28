import { afterEach, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import { ApiKeyService } from '../apps/backend/src/services/ApiKeyService';
import { TranslationService } from '../apps/backend/src/services/TranslationService';

describe('媒体炼金术：翻译克隆服务', () => {
  let originalFetch: typeof global.fetch;

  beforeAll(() => {
    ApiKeyService.init(['mock-key']);
  });

  beforeEach(() => {
    originalFetch = global.fetch;
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
                        translatedText: 'A girl walks out of the cafe at dawn.',
                        detectedLang: 'zh-CN'
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
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('应返回 translatedText/detectedLang/targetLang 结构', async () => {
    const result = await TranslationService.translate('清晨女孩走出咖啡店。', 'English');

    expect(result.originalText).toContain('清晨');
    expect(result.translatedText).toContain('cafe');
    expect(result.detectedLang).toBe('zh-CN');
    expect(result.targetLang).toBe('English');
  });
});
