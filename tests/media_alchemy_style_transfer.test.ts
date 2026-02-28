import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { app } from '../apps/backend/src/index';
import { StyleTransferService } from '../apps/backend/src/services/StyleTransferService';

describe('媒体炼金术：风格迁移服务', () => {
  const envBackup: Record<string, string | undefined> = {};
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    envBackup.ALCHEMY_API_URL = process.env.ALCHEMY_API_URL;
    envBackup.ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (envBackup.ALCHEMY_API_URL === undefined) delete process.env.ALCHEMY_API_URL;
    else process.env.ALCHEMY_API_URL = envBackup.ALCHEMY_API_URL;

    if (envBackup.ALCHEMY_API_KEY === undefined) delete process.env.ALCHEMY_API_KEY;
    else process.env.ALCHEMY_API_KEY = envBackup.ALCHEMY_API_KEY;
  });

  it('provider 未配置时应返回 not_implemented', async () => {
    process.env.ALCHEMY_API_URL = '';
    process.env.ALCHEMY_API_KEY = '';

    const response = await app.handle(
      new Request('http://localhost/api/ai/alchemy/style-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clipId: 'clip-1', style: 'van_gogh' })
      })
    );

    const data = await response.json() as any;
    expect(response.status).toBe(200);
    expect(data.status).toBe('not_implemented');
  });

  it('provider 可用时应返回 operationId', async () => {
    process.env.ALCHEMY_API_URL = 'https://mock.alchemy.local';
    process.env.ALCHEMY_API_KEY = 'mock-token';
    global.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            operationId: 'style-op-123',
            message: 'ok'
          })
        )
      )
    );

    const result = await StyleTransferService.transfer({
      clipId: 'clip-2',
      style: 'cyberpunk',
      referenceModel: 'luma-dream'
    });

    expect(result.status).toBe('ok');
    expect(result.operationId).toBe('style-op-123');
    expect(result.style).toBe('cyberpunk');
  });
});
