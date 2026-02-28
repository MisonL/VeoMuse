import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { app } from '../apps/backend/src/index';
import { VfxService } from '../apps/backend/src/services/VfxService';

describe('影棚特效链路验证', () => {
  const envBackup: Record<string, string | undefined> = {};
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    envBackup.VFX_API_URL = process.env.VFX_API_URL;
    envBackup.VFX_API_KEY = process.env.VFX_API_KEY;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (envBackup.VFX_API_URL === undefined) delete process.env.VFX_API_URL;
    else process.env.VFX_API_URL = envBackup.VFX_API_URL;

    if (envBackup.VFX_API_KEY === undefined) delete process.env.VFX_API_KEY;
    else process.env.VFX_API_KEY = envBackup.VFX_API_KEY;
  });

  it('provider 未配置时应返回 not_implemented', async () => {
    process.env.VFX_API_URL = '';
    process.env.VFX_API_KEY = '';

    const response = await app.handle(
      new Request('http://localhost/api/ai/vfx/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clipId: 'clip-vfx-1',
          vfxType: 'magic-particles',
          intensity: 0.8
        })
      })
    );

    const data = await response.json() as any;
    expect(response.status).toBe(200);
    expect(data.status).toBe('not_implemented');
  });

  it('provider 可用时应返回 operationId', async () => {
    process.env.VFX_API_URL = 'https://mock.vfx.local';
    process.env.VFX_API_KEY = 'mock-token';
    global.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            operationId: 'vfx-op-9'
          })
        )
      )
    );

    const result = await VfxService.applyVfx({
      clipId: 'clip-vfx-2',
      vfxType: 'cyber-glitch',
      intensity: 0.7
    });
    expect(result.status).toBe('ok');
    expect(result.operationId).toBe('vfx-op-9');
  });
});
