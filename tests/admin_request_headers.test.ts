import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { adminGetJson, adminPostJson } from '../apps/frontend/src/utils/eden'

describe('Admin 请求头优化', () => {
  const originFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }) as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originFetch
  })

  it('adminGetJson 不应附带 Content-Type，避免无意义预检', async () => {
    await adminGetJson('/api/admin/metrics')
    const calls = (globalThis.fetch as any).mock.calls as Array<[string, RequestInit]>
    expect(calls.length).toBe(1)
    const [, init] = calls[0]
    const headers = (init.headers || {}) as Record<string, string>
    const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')
    expect(init.method).toBe('GET')
    expect(hasContentType).toBe(false)
  })

  it('adminPostJson 仍应附带 Content-Type: application/json', async () => {
    await adminPostJson('/api/admin/db/repair', { force: false })
    const calls = (globalThis.fetch as any).mock.calls as Array<[string, RequestInit]>
    expect(calls.length).toBe(1)
    const [, init] = calls[0]
    const headers = (init.headers || {}) as Record<string, string>
    expect(init.method).toBe('POST')
    expect(headers['Content-Type']).toBe('application/json')
  })
})
