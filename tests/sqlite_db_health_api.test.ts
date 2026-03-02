import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { app } from '../apps/backend/src/index'

describe('数据库健康检查 API', () => {
  const backupAdminToken = process.env.ADMIN_TOKEN

  beforeEach(() => {
    process.env.ADMIN_TOKEN = 'unit-test-admin-token'
  })

  afterEach(() => {
    if (backupAdminToken === undefined) delete process.env.ADMIN_TOKEN
    else process.env.ADMIN_TOKEN = backupAdminToken
  })

  it('未携带管理员令牌时应返回 401', async () => {
    const response = await app.handle(new Request('http://localhost/api/admin/db/health'))
    const data = await response.json() as any

    expect(response.status).toBe(401)
    expect(data.success).toBe(false)
  })

  it('携带管理员令牌时应返回数据库健康信息', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/admin/db/health?mode=full', {
        headers: { 'x-admin-token': 'unit-test-admin-token' }
      })
    )
    const data = await response.json() as any

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(['ok', 'corrupted', 'error']).toContain(data.health.status)
    expect(Array.isArray(data.health.messages)).toBe(true)
    expect(typeof data.health.dbPath).toBe('string')
  }, 20_000)
})
