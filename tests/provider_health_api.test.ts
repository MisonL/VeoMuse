import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { app } from '../apps/backend/src/index'

describe('Provider 健康检查 API', () => {
  const backupAdminToken = process.env.ADMIN_TOKEN
  const envBackup: Record<string, string | undefined> = {}
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    process.env.ADMIN_TOKEN = 'provider-health-admin-token'
    originalFetch = global.fetch
    for (const key of ['VFX_API_URL', 'VFX_API_KEY', 'TTS_API_URL', 'TTS_API_KEY']) {
      envBackup[key] = process.env[key]
      process.env[key] = ''
    }
  })

  afterEach(() => {
    global.fetch = originalFetch
    if (backupAdminToken === undefined) delete process.env.ADMIN_TOKEN
    else process.env.ADMIN_TOKEN = backupAdminToken

    for (const [key, value] of Object.entries(envBackup)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('未携带管理员令牌应返回 401', async () => {
    const response = await app.handle(new Request('http://localhost/api/admin/providers/health'))
    const payload = (await response.json()) as any
    expect(response.status).toBe(401)
    expect(payload.success).toBe(false)
  })

  it('应返回 provider 健康汇总', async () => {
    process.env.VFX_API_URL = 'https://mock.vfx.local'
    process.env.VFX_API_KEY = 'mock-vfx-token'

    global.fetch = mock((url: string) => {
      if (url.includes('mock.vfx.local')) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    })

    const response = await app.handle(
      new Request('http://localhost/api/admin/providers/health', {
        headers: { 'x-admin-token': 'provider-health-admin-token' }
      })
    )
    const payload = (await response.json()) as any

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(Array.isArray(payload.providers)).toBe(true)
    const vfx = payload.providers.find((item: any) => item.providerId === 'vfx')
    expect(vfx).toBeTruthy()
    expect(vfx.configured).toBe(true)
    expect(['ok', 'degraded']).toContain(vfx.status)
  })

  it('按 provider 查询不存在 id 时应返回 404', async () => {
    const providerId = 'unknown-provider'
    const response = await app.handle(
      new Request(`http://localhost/api/admin/providers/health/${providerId}`, {
        headers: { 'x-admin-token': 'provider-health-admin-token' }
      })
    )
    const payload = (await response.json()) as any

    expect(response.status).toBe(404)
    expect(payload.success).toBe(false)
  })
})
