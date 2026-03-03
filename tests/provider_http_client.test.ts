import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import {
  ProviderHttpClient,
  ProviderHttpError
} from '../apps/backend/src/services/providers/ProviderHttpClient'

describe('ProviderHttpClient', () => {
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('应在上游 5xx 后重试并最终成功', async () => {
    let attempt = 0
    global.fetch = mock(() => {
      attempt += 1
      if (attempt === 1) {
        return Promise.resolve(new Response('temporary', { status: 503 }))
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    })

    const result = await ProviderHttpClient.requestJson<{ ok: boolean }>(
      'https://mock.provider.local/task',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'hello' })
      },
      {
        maxRetries: 1,
        retryDelayMs: 1
      }
    )

    expect(result.data.ok).toBe(true)
    expect(result.meta.attemptCount).toBe(2)
  })

  it('请求超时时应返回 timeout 错误码', async () => {
    global.fetch = mock(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal as AbortSignal | undefined
          if (signal?.aborted) {
            reject(signal.reason || new Error('aborted'))
            return
          }
          signal?.addEventListener(
            'abort',
            () => {
              reject(new Error('aborted'))
            },
            { once: true }
          )
        })
    )

    await expect(
      ProviderHttpClient.requestJson(
        'https://slow.provider.local/job',
        {
          method: 'GET'
        },
        {
          timeoutMs: 50,
          maxRetries: 0
        }
      )
    ).rejects.toBeInstanceOf(ProviderHttpError)

    try {
      await ProviderHttpClient.requestJson(
        'https://slow.provider.local/job',
        {
          method: 'GET'
        },
        {
          timeoutMs: 50,
          maxRetries: 0
        }
      )
    } catch (error) {
      const normalized = error as ProviderHttpError
      expect(normalized.code).toBe('timeout')
      return
    }

    throw new Error('expected timeout error')
  })
})
