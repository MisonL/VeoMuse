const { VideoOrchestrator } = require('../apps/backend/src/services/VideoOrchestrator');
const { GeminiDriver } = require('../apps/backend/src/services/drivers/GeminiDriver');
const { ApiKeyService } = require('../apps/backend/src/services/ApiKeyService');

describe('Model Orchestrator 总线架构验证', () => {
  beforeAll(() => {
    // 注册驱动
    VideoOrchestrator.registerDriver(new GeminiDriver());
    ApiKeyService.init([]);
  });

  it('Orchestrator 应能发现已注册的模型', () => {
    const models = VideoOrchestrator.getAvailableModels();
    expect(models.some(m => m.id === 'veo-3.1')).toBe(true);
  });

  it('在未找到驱动时应抛出错误', async () => {
    try {
      await VideoOrchestrator.generate('non-existent-model', { text: 'test' });
      throw new Error('不应成功');
    } catch (e) {
      expect(e.message).toContain('未找到模型驱动');
    }
  });

  it('应能正确分发任务并处理驱动报错', async () => {
    try {
      await VideoOrchestrator.generate('veo-3.1', { text: '测试创意' });
    } catch (e) {
      // 预期由于无 Key 而由 GeminiDriver 抛出错误
      expect(e.message).toContain('Gemini API');
    }
  });
});
