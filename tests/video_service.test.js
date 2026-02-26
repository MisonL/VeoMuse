const { VideoOrchestrator } = require('../apps/backend/src/services/VideoOrchestrator');
const { GeminiDriver } = require('../apps/backend/src/services/drivers/GeminiDriver');
const { SoraDriver } = require('../apps/backend/src/services/drivers/SoraDriver');
const { KlingDriver } = require('../apps/backend/src/services/drivers/KlingDriver');
const { LumaDriver } = require('../apps/backend/src/services/drivers/LumaDriver');
const { RunwayDriver } = require('../apps/backend/src/services/drivers/RunwayDriver');

describe('Model Orchestrator 全球总线验证 (V3.1 增强版)', () => {
  beforeAll(() => {
    VideoOrchestrator.registerDriver(new GeminiDriver());
    VideoOrchestrator.registerDriver(new SoraDriver());
    VideoOrchestrator.registerDriver(new KlingDriver());
    VideoOrchestrator.registerDriver(new LumaDriver());
    VideoOrchestrator.registerDriver(new RunwayDriver());
  });

  it('Orchestrator 应能发现核心模型集群', () => {
    const models = VideoOrchestrator.getAvailableModels();
    expect(models.some(m => m.id === 'veo-3.1')).toBe(true);
    expect(models.some(m => m.id === 'sora-preview')).toBe(true);
    expect(models.some(m => m.id === 'kling-v1')).toBe(true);
  });

  it('应能分发到即将接入的新渠道 (预期失败直到驱动实现)', () => {
    const models = VideoOrchestrator.getAvailableModels();
    expect(models.some(m => m.id === 'luma-dream')).toBe(true);
    expect(models.some(m => m.id === 'runway-gen3')).toBe(true);
  });
});
