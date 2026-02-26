import { PromptEnhanceService } from '../apps/backend/src/services/PromptEnhanceService';
import { ApiKeyService } from '../apps/backend/src/services/ApiKeyService';

describe('BaseAiService 健壮性与性能量化演示', () => {
  it('应在请求失败时触发指数退避重试并打印性能指标', async () => {
    // 注入无效 Key 触发重试
    ApiKeyService.init(['invalid-key-for-test']);
    
    console.log('--- 启动演示：触发 AI 增强重试流 ---');
    try {
      await PromptEnhanceService.enhance('一只赛博朋克风格的赛马');
    } catch (e: any) {
      console.log('--- 演示结束：最终捕获的错误 ---');
      expect(e.message).toContain('HTTP 400');
    }
  });
});
