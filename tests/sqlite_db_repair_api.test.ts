import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { app } from '../apps/backend/src/index'

describe('数据库修复 API', () => {
  const backupAdminToken = process.env.ADMIN_TOKEN

  beforeEach(() => {
    process.env.ADMIN_TOKEN = 'unit-test-admin-token'
  })

  afterEach(() => {
    if (backupAdminToken === undefined) delete process.env.ADMIN_TOKEN
    else process.env.ADMIN_TOKEN = backupAdminToken
  })

  it('应支持管理员触发非强制修复检查', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/admin/db/repair', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': 'unit-test-admin-token'
        },
        body: JSON.stringify({
          force: false,
          reason: 'unit-test-check'
        })
      })
    )
    const data = await response.json() as any

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(['ok', 'repaired']).toContain(data.repair.status)
    expect(typeof data.repair.dbPath).toBe('string')
    expect(Array.isArray(data.repair.actions)).toBe(true)
  })
})
