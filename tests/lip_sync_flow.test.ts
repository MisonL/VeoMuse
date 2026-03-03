import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { LipSyncService } from '../apps/backend/src/services/LipSyncService'
import { app } from '../apps/backend/src/index'
import { createAuthHeaders, createTestSession } from './helpers/auth'

describe('口型同步链路验证', () => {
  const envBackup: Record<string, string | undefined> = {}
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
    envBackup.LIP_SYNC_API_URL = process.env.LIP_SYNC_API_URL
    envBackup.LIP_SYNC_API_KEY = process.env.LIP_SYNC_API_KEY
  })

  afterEach(() => {
    global.fetch = originalFetch
    if (envBackup.LIP_SYNC_API_URL === undefined) delete process.env.LIP_SYNC_API_URL
    else process.env.LIP_SYNC_API_URL = envBackup.LIP_SYNC_API_URL

    if (envBackup.LIP_SYNC_API_KEY === undefined) delete process.env.LIP_SYNC_API_KEY
    else process.env.LIP_SYNC_API_KEY = envBackup.LIP_SYNC_API_KEY
  })

  it('provider 未配置时应返回 not_implemented', async () => {
    process.env.LIP_SYNC_API_URL = ''
    process.env.LIP_SYNC_API_KEY = ''

    const result = await LipSyncService.sync(
      'https://video.local/a.mp4',
      'https://audio.local/a.mp3'
    )
    expect(result.status).toBe('not_implemented')
  })

  it('provider 可用时应返回 syncedVideoUrl', async () => {
    process.env.LIP_SYNC_API_URL = 'https://mock.lipsync.local'
    process.env.LIP_SYNC_API_KEY = 'mock-token'
    global.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            syncedVideoUrl: 'https://cdn.local/synced.mp4',
            operationId: 'lip-op-1'
          })
        )
      )
    )

    const result = await LipSyncService.sync(
      'https://video.local/a.mp4',
      'https://audio.local/a.mp3',
      'high'
    )
    expect(result.status).toBe('ok')
    expect(result.syncedVideoUrl).toContain('synced.mp4')
    expect(result.operationId).toBe('lip-op-1')
  })

  it('生成接口应兼容 sync_lip 并透传为 syncLip', async () => {
    const session = await createTestSession('lip-sync')
    process.env.LUMA_API_URL = 'https://mock.luma.local'
    process.env.LUMA_API_KEY = 'mock-token'

    let capturedBody: any = null
    global.fetch = mock((url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body || '{}'))
      expect(url).toContain('/generate')
      return Promise.resolve(
        new Response(
          JSON.stringify({
            operationName: 'luma-op-1',
            message: 'ok'
          })
        )
      )
    })

    const response = await app.handle(
      new Request('http://localhost/api/video/generate', {
        method: 'POST',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          modelId: 'luma-dream',
          text: '测试口型兼容',
          sync_lip: true
        })
      })
    )
    const data = (await response.json()) as any

    expect(response.status).toBe(200)
    expect(data.status).toBe('ok')
    expect(capturedBody.options?.syncLip).toBe(true)
  })
})
