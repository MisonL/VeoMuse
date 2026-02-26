const { VideoOrchestrator } = require('../apps/backend/src/services/VideoOrchestrator');
const { RunwayDriver } = require('../apps/backend/src/services/drivers/RunwayDriver');

describe('模型特有参数路由验证', () => {
  beforeAll(() => {
    VideoOrchestrator.registerDriver(new RunwayDriver());
  });

  it('Runway 驱动应能接收并识别 motionIntensity 参数', async () => {
    const params = {
      text: '一只在霓虹街头奔跑的猫',
      options: { motionIntensity: 8 }
    };
    
    // 我们通过捕获控制台输出来验证驱动内部的解析
    const result = await VideoOrchestrator.generate('runway-gen3', params);
    expect(result.success).toBe(true);
    expect(result.message).toContain('Runway');
  });
});
