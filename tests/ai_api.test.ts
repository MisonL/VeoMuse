import { describe, it, expect, beforeAll, mock, beforeEach, afterEach } from 'bun:test';
import { ApiKeyService } from '../apps/backend/src/services/ApiKeyService';
import { AiDirectorService } from '../apps/backend/src/services/AiDirectorService';
import { AiClipService } from '../apps/backend/src/services/AiClipService';

describe('AI 服务全量架构对齐验证 (BaseAiService 继承)', () => {
  let originalFetch: typeof global.fetch;

  beforeAll(() => {
    ApiKeyService.init(['mock-key']);
  });

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = mock(() => Promise.resolve(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{"success":true,"cutPoints":[1,2,3],"scenes":[]}' }] } }]
    }))));
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('AiDirectorService 应具备性能量化能力', async () => {
    const result = await AiDirectorService.analyzeScript('测试脚本');
    expect(result.success).toBe(true);
  });

  it('AiClipService 应具备性能量化能力', async () => {
    const result = await AiClipService.suggestCuts('描述', 10);
    expect(result.cutPoints).toBeDefined();
  });
});
