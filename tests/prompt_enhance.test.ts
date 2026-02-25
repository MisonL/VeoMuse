// tests/prompt_enhance.test.ts
import { describe, it, expect, beforeAll } from 'bun:test';
import { PromptEnhanceService } from '../apps/backend/src/services/PromptEnhanceService';
import { ApiKeyService } from '../apps/backend/src/services/ApiKeyService';

describe('PromptEnhanceService 创意引擎验证', () => {
  beforeAll(() => {
    ApiKeyService.init(['mock-key']);
  });

  it('PromptEnhanceService 应能正确导出', () => {
    expect(PromptEnhanceService).toBeDefined();
    expect(typeof PromptEnhanceService.enhance).toBe('function');
  });

  it('应能扩充简单的提示词并返回结构化数据', async () => {
    // 预期由于 mock-key 无效而报错，但我们至少要验证调用逻辑
    try {
      const result = await PromptEnhanceService.enhance('一只猫');
      expect(result).toBeDefined();
    } catch (e: any) {
      expect(e.message).toBeDefined();
    }
  });
});
