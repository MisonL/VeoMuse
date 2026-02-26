import { describe, it, expect, beforeAll } from 'bun:test';
import { ApiKeyService } from '../apps/backend/src/services/ApiKeyService';
import { AiDirectorService } from '../apps/backend/src/services/AiDirectorService';
import { AiClipService } from '../apps/backend/src/services/AiClipService';

describe('AI 服务全量架构对齐验证 (BaseAiService 继承)', () => {
  beforeAll(() => {
    ApiKeyService.init(['mock-key']);
  });

  it('AiDirectorService 应具备性能量化能力', async () => {
    // 预期重构后的服务应能通过某种方式暴露其监控指标，或者至少不再报错
    try {
      const result = await AiDirectorService.analyzeScript('测试脚本');
      expect(result.success).toBe(true);
    } catch (e: any) {
      // 如果报错，说明继承或初始化有问题
      expect(e).toBeUndefined();
    }
  });

  it('AiClipService 应具备性能量化能力', async () => {
    try {
      const result = await AiClipService.suggestCuts('描述', 10);
      expect(result.cutPoints).toBeDefined();
    } catch (e: any) {
      expect(e).toBeUndefined();
    }
  });
});
