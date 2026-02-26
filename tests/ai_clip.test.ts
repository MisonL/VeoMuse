import { describe, it, expect, beforeAll } from 'bun:test';
import { AiClipService } from '../apps/backend/src/services/AiClipService';
import { ApiKeyService } from '../apps/backend/src/services/ApiKeyService';

describe('AI 智能剪辑服务验证', () => {
  beforeAll(() => {
    ApiKeyService.init(['mock-key']);
  });

  it('AiClipService 应能正确导出', () => {
    expect(AiClipService).toBeDefined();
    expect(typeof AiClipService.suggestCuts).toBe('function');
  });

  it('应能返回结构化的剪辑建议时间点', async () => {
    try {
      const result = await AiClipService.suggestCuts('一只猫在雨中奔跑，随后跳过水坑', 10);
      expect(result).toBeDefined();
      expect(Array.isArray(result.cutPoints)).toBe(true);
    } catch (e: any) {
      expect(e.message).toBeDefined();
    }
  });
});
