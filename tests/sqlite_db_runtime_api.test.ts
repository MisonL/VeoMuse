import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { app } from '../apps/backend/src/index'

describe('数据库运行配置 API', () => {
  const backupAdminToken = process.env.ADMIN_TOKEN
  const backupAutoRepair = process.env.DB_AUTO_REPAIR
  const backupHealthcheckMs = process.env.DB_HEALTHCHECK_INTERVAL_MS

  beforeEach(() => {
    process.env.ADMIN_TOKEN = 'unit-test-admin-token'
    process.env.DB_AUTO_REPAIR = 'false'
    process.env.DB_HEALTHCHECK_INTERVAL_MS = '15000'
  })

  afterEach(() => {
    if (backupAdminToken === undefined) delete process.env.ADMIN_TOKEN
    else process.env.ADMIN_TOKEN = backupAdminToken

    if (backupAutoRepair === undefined) delete process.env.DB_AUTO_REPAIR
    else process.env.DB_AUTO_REPAIR = backupAutoRepair

    if (backupHealthcheckMs === undefined) delete process.env.DB_HEALTHCHECK_INTERVAL_MS
    else process.env.DB_HEALTHCHECK_INTERVAL_MS = backupHealthcheckMs
  })

  it('未携带管理员令牌时应返回 401', async () => {
    const response = await app.handle(new Request('http://localhost/api/admin/db/runtime'))
    const data = await response.json() as any

    expect(response.status).toBe(401)
    expect(data.success).toBe(false)
  })

  it('携带管理员令牌时应返回运行配置与健康摘要', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/admin/db/runtime', {
        headers: { 'x-admin-token': 'unit-test-admin-token' }
      })
    )
    const data = await response.json() as any

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(typeof data.runtime?.dbPath).toBe('string')
    expect(data.runtime?.autoRepairEnabled).toBe(false)
    expect(data.runtime?.runtimeHealthcheckIntervalMs).toBe(15000)
    expect(data.runtime?.runtimeHealthcheckEnabled).toBe(true)
    expect(['ok', 'corrupted', 'error']).toContain(data.health?.status)
  })
})
