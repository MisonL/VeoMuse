const { VideoService } = require('../apps/backend/src/services/VideoService');
const { ApiKeyService } = require('../apps/backend/src/services/ApiKeyService');

describe('VideoService 旗舰版迁移验证', () => {
  beforeAll(() => {
    // 初始化空密钥进行测试
    ApiKeyService.init([]);
  });

  test('VideoService 应能正确导出', () => {
    expect(VideoService).toBeDefined();
    expect(typeof VideoService.generateFromText).toBe('function');
  });

  test('在没有密钥时调用应抛出错误', async () => {
    try {
      await VideoService.generateFromText({ text: 'test创意' });
      throw new Error('不应成功');
    } catch (e) {
      expect(e.message).toContain('所有 API 密钥均不可用');
    }
  });

  test('init 应能正确处理密钥字符串', () => {
    ApiKeyService.init('key1, key2 ');
    expect(ApiKeyService.getAvailableKeys()).toEqual(['key1', 'key2']);
  });
});
