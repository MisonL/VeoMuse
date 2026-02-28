import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { TelemetryService } from '../apps/backend/src/services/TelemetryService';
import { TtsService } from '../apps/backend/src/services/TtsService';
import { VfxService } from '../apps/backend/src/services/VfxService';
import { app } from '../apps/backend/src/index';

describe('BaseAiService 继承覆盖验证', () => {
  let originalFetch: typeof global.fetch;
  const envBackup: Record<string, string | undefined> = {};

  beforeEach(() => {
    originalFetch = global.fetch;
    envBackup.TTS_API_URL = process.env.TTS_API_URL;
    envBackup.TTS_API_KEY = process.env.TTS_API_KEY;
    envBackup.VFX_API_URL = process.env.VFX_API_URL;
    envBackup.VFX_API_KEY = process.env.VFX_API_KEY;
    envBackup.ADMIN_TOKEN = process.env.ADMIN_TOKEN;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (envBackup.TTS_API_URL === undefined) delete process.env.TTS_API_URL;
    else process.env.TTS_API_URL = envBackup.TTS_API_URL;
    if (envBackup.TTS_API_KEY === undefined) delete process.env.TTS_API_KEY;
    else process.env.TTS_API_KEY = envBackup.TTS_API_KEY;
    if (envBackup.VFX_API_URL === undefined) delete process.env.VFX_API_URL;
    else process.env.VFX_API_URL = envBackup.VFX_API_URL;
    if (envBackup.VFX_API_KEY === undefined) delete process.env.VFX_API_KEY;
    else process.env.VFX_API_KEY = envBackup.VFX_API_KEY;
    if (envBackup.ADMIN_TOKEN === undefined) delete process.env.ADMIN_TOKEN;
    else process.env.ADMIN_TOKEN = envBackup.ADMIN_TOKEN;
  });

  it('TTS 与 VFX 调用后应在遥测中出现对应服务指标', async () => {
    process.env.TTS_API_URL = 'https://mock.tts.local';
    process.env.TTS_API_KEY = 'token-tts';
    process.env.VFX_API_URL = 'https://mock.vfx.local';
    process.env.VFX_API_KEY = 'token-vfx';

    let callIndex = 0;
    global.fetch = mock(() => {
      callIndex += 1;
      if (callIndex === 1) {
        return Promise.resolve(new Response(JSON.stringify({ audioUrl: 'https://cdn.local/tts.mp3' })));
      }
      return Promise.resolve(new Response(JSON.stringify({ operationId: 'vfx-op-77' })));
    });

    const before = TelemetryService.getInstance().getSummary() as any;
    const beforeTts = before.api['AI-TTS']?.count || 0;
    const beforeVfx = before.api['AI-Neural-VFX']?.count || 0;

    const tts = await TtsService.synthesize('测试配音');
    const vfx = await VfxService.applyVfx({ clipId: 'clip-1', vfxType: 'magic-particles', intensity: 0.8 });

    expect(tts.status).toBe('ok');
    expect(vfx.status).toBe('ok');

    const after = TelemetryService.getInstance().getSummary() as any;
    expect((after.api['AI-TTS']?.count || 0)).toBeGreaterThan(beforeTts);
    expect((after.api['AI-Neural-VFX']?.count || 0)).toBeGreaterThan(beforeVfx);

    process.env.ADMIN_TOKEN = 'unit-admin-token';
    const unauthorized = await app.handle(new Request('http://localhost/api/admin/metrics'));
    expect(unauthorized.status).toBe(401);

    const metricsResp = await app.handle(
      new Request('http://localhost/api/admin/metrics', {
        headers: { 'x-admin-token': 'unit-admin-token' }
      })
    );
    const metricsData = await metricsResp.json() as any;
    expect(metricsResp.status).toBe(200);
    expect(metricsData.api?.['AI-TTS']?.count).toBeGreaterThanOrEqual(beforeTts + 1);
    expect(metricsData.api?.['AI-Neural-VFX']?.count).toBeGreaterThanOrEqual(beforeVfx + 1);
  });
});
