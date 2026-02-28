// tests/prompt_enhance.test.ts
import { describe, it, expect, beforeAll, beforeEach, afterEach, mock } from 'bun:test';
import { PromptEnhanceService } from '../apps/backend/src/services/PromptEnhanceService';
import { ApiKeyService } from '../apps/backend/src/services/ApiKeyService';

describe('PromptEnhanceService 创意引擎验证', () => {
  let originalFetch: typeof global.fetch;

  beforeAll(() => {
    ApiKeyService.init(['mock-key']);
  });

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = mock(() => Promise.resolve(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({
        enhanced: 'cinematic cat running in rain',
        negative: 'blurry',
        style_suggestion: 'neo-noir'
      }) }] } }]
    }))));
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('PromptEnhanceService 应能正确导出', () => {
    expect(PromptEnhanceService).toBeDefined();
    expect(typeof PromptEnhanceService.enhance).toBe('function');
  });

  it('应能扩充简单的提示词并返回结构化数据', async () => {
    const result = await PromptEnhanceService.enhance('一只猫');
    expect(result).toBeDefined();
    expect(result.enhanced).toContain('cat');
    expect(result.negative).toBe('blurry');
  });
});
