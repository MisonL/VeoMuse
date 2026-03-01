import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { app } from '../apps/backend/src/index';
import { createAuthHeaders, createTestSession } from './helpers/auth';

describe('World-Link 一致性参数验证', () => {
  const envBackup: Record<string, string | undefined> = {}
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
    envBackup.LUMA_API_URL = process.env.LUMA_API_URL
    envBackup.LUMA_API_KEY = process.env.LUMA_API_KEY
  })

  afterEach(() => {
    global.fetch = originalFetch
    if (envBackup.LUMA_API_URL === undefined) delete process.env.LUMA_API_URL
    else process.env.LUMA_API_URL = envBackup.LUMA_API_URL
    if (envBackup.LUMA_API_KEY === undefined) delete process.env.LUMA_API_KEY
    else process.env.LUMA_API_KEY = envBackup.LUMA_API_KEY
  })

  it('生成接口应透传 worldLink + worldId，并保持跨请求一致', async () => {
    const session = await createTestSession('world-link')
    process.env.LUMA_API_URL = 'https://mock.luma.local'
    process.env.LUMA_API_KEY = 'mock-token'

    const payloads: any[] = []
    global.fetch = mock((_url: string, init?: RequestInit) => {
      payloads.push(JSON.parse(String(init?.body || '{}')))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            operationName: `luma-op-${payloads.length}`,
            message: 'ok'
          })
        )
      )
    })

    const worldId = 'w-city-night-001'

    const response = await app.handle(
      new Request('http://localhost/api/video/generate', {
        method: 'POST',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          modelId: 'luma-dream',
          text: '夜景街道，主角连续跨镜头出现',
          worldLink: true,
          worldId
        })
      })
    );
    const response2 = await app.handle(
      new Request('http://localhost/api/video/generate', {
        method: 'POST',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          modelId: 'luma-dream',
          text: '同一世界观下的第二镜头',
          worldLink: true,
          worldId
        })
      })
    );

    const data = await response.json() as any;
    const data2 = await response2.json() as any;
    expect(response.status).toBe(200);
    expect(response2.status).toBe(200);
    expect(data.provider).toBe('luma-dream');
    expect(data2.provider).toBe('luma-dream');
    expect(data.status).toBe('ok');
    expect(data2.status).toBe('ok');
    expect(payloads.length).toBe(2);
    expect(payloads[0].options?.worldLink).toBe(true);
    expect(payloads[1].options?.worldLink).toBe(true);
    expect(payloads[0].options?.worldId).toBe(worldId);
    expect(payloads[1].options?.worldId).toBe(worldId);
  });
});
