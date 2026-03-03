import { afterEach, describe, expect, it } from 'bun:test'
import {
  isTransientHttpStatus,
  requestJsonWithRetry
} from '../apps/frontend/src/components/Editor/comparison-lab/api'

const originalFetch = globalThis.fetch

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('ComparisonLab API 重试策略', () => {
  it('GET 请求遇到瞬时 5xx 时应自动重试并成功', async () => {
    let called = 0
    globalThis.fetch = async () => {
      called += 1
      if (called === 1) {
        return jsonResponse({ success: false, error: 'temporary unavailable' }, 503)
      }
      return jsonResponse({ success: true, data: { ok: true } }, 200)
    }

    const payload = await requestJsonWithRetry<{ success: boolean; data: { ok: boolean } }>(
      '/api/mock/retry-get',
      { method: 'GET' },
      { maxRetries: 2, baseDelayMs: 0, jitterMs: 0 }
    )

    expect(payload.success).toBe(true)
    expect(payload.data.ok).toBe(true)
    expect(called).toBe(2)
  })

  it('非幂等 POST 遇到 503 时不应重试', async () => {
    let called = 0
    globalThis.fetch = async () => {
      called += 1
      return jsonResponse({ success: false, error: 'temporary unavailable' }, 503)
    }

    await expect(
      requestJsonWithRetry(
        '/api/mock/non-idempotent',
        { method: 'POST', body: JSON.stringify({ value: 1 }) },
        { maxRetries: 2, baseDelayMs: 0, jitterMs: 0 }
      )
    ).rejects.toThrow('temporary unavailable')

    expect(called).toBe(1)
  })

  it('显式幂等 POST 在网络失败后应重试', async () => {
    let called = 0
    globalThis.fetch = async () => {
      called += 1
      if (called === 1) {
        throw new Error('fetch failed')
      }
      return jsonResponse({ success: true, id: 'ok' }, 200)
    }

    const payload = await requestJsonWithRetry<{ success: boolean; id: string }>(
      '/api/mock/idempotent-post',
      { method: 'POST', body: JSON.stringify({ key: 'dedupe-key' }) },
      { idempotent: true, maxRetries: 2, baseDelayMs: 0, jitterMs: 0 }
    )

    expect(payload.success).toBe(true)
    expect(payload.id).toBe('ok')
    expect(called).toBe(2)
  })

  it('4xx（非 429）应判定为非瞬时错误', () => {
    expect(isTransientHttpStatus(429)).toBe(true)
    expect(isTransientHttpStatus(503)).toBe(true)
    expect(isTransientHttpStatus(403)).toBe(false)
    expect(isTransientHttpStatus(400)).toBe(false)
  })
})
