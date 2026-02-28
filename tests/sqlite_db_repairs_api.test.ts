import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { app } from '../apps/backend/src/index'

describe('数据库修复历史 API', () => {
  const backupAdminToken = process.env.ADMIN_TOKEN

  beforeEach(() => {
    process.env.ADMIN_TOKEN = 'unit-test-admin-token'
  })

  afterEach(() => {
    if (backupAdminToken === undefined) delete process.env.ADMIN_TOKEN
    else process.env.ADMIN_TOKEN = backupAdminToken
  })

  it('应返回修复历史记录列表', async () => {
    await app.handle(
      new Request('http://localhost/api/admin/db/repair', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': 'unit-test-admin-token'
        },
        body: JSON.stringify({
          force: false,
          reason: 'history-unit-test'
        })
      })
    )

    const response = await app.handle(
      new Request('http://localhost/api/admin/db/repairs?limit=10', {
        headers: { 'x-admin-token': 'unit-test-admin-token' }
      })
    )
    const data = await response.json() as any

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(Array.isArray(data.repairs)).toBe(true)
    expect(data.repairs.length).toBeGreaterThan(0)
    expect(data.repairs.some((item: any) => item.reason === 'history-unit-test')).toBe(true)
    expect(typeof data.page?.total).toBe('number')
    expect(typeof data.page?.hasMore).toBe('boolean')
    expect(typeof data.page?.limit).toBe('number')
    expect(typeof data.page?.offset).toBe('number')
  })

  it('应支持按时间范围过滤修复历史', async () => {
    const mark = Date.now()
    await app.handle(
      new Request('http://localhost/api/admin/db/repair', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': 'unit-test-admin-token'
        },
        body: JSON.stringify({
          force: false,
          reason: 'history-range-test'
        })
      })
    )

    const futureFrom = new Date(mark + 60_000).toISOString()
    const futureResponse = await app.handle(
      new Request(`http://localhost/api/admin/db/repairs?limit=10&from=${encodeURIComponent(futureFrom)}`, {
        headers: { 'x-admin-token': 'unit-test-admin-token' }
      })
    )
    const futureData = await futureResponse.json() as any
    expect(futureResponse.status).toBe(200)
    expect(futureData.success).toBe(true)
    expect(Array.isArray(futureData.repairs)).toBe(true)
    expect(futureData.repairs.length).toBe(0)
    expect(futureData.page?.hasMore).toBe(false)

    const pastFrom = new Date(mark - 60_000).toISOString()
    const presentTo = new Date(Date.now() + 5_000).toISOString()
    const rangeResponse = await app.handle(
      new Request(
        `http://localhost/api/admin/db/repairs?limit=10&from=${encodeURIComponent(pastFrom)}&to=${encodeURIComponent(presentTo)}&status=ok`,
        { headers: { 'x-admin-token': 'unit-test-admin-token' } }
      )
    )
    const rangeData = await rangeResponse.json() as any
    expect(rangeResponse.status).toBe(200)
    expect(rangeData.success).toBe(true)
    expect(rangeData.repairs.some((item: any) => item.reason === 'history-range-test')).toBe(true)
    expect(typeof rangeData.page?.total).toBe('number')
  })

  it('应支持 reason 关键词与 offset 分页过滤', async () => {
    const prefix = `history-keyword-${Date.now()}`

    for (const suffix of ['first', 'second']) {
      await app.handle(
        new Request('http://localhost/api/admin/db/repair', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-token': 'unit-test-admin-token'
          },
          body: JSON.stringify({
            force: false,
            reason: `${prefix}-${suffix}`
          })
        })
      )
    }

    const firstPageResponse = await app.handle(
      new Request(
        `http://localhost/api/admin/db/repairs?limit=1&offset=0&reason=${encodeURIComponent(prefix)}&status=ok`,
        { headers: { 'x-admin-token': 'unit-test-admin-token' } }
      )
    )
    const firstPageData = await firstPageResponse.json() as any
    expect(firstPageResponse.status).toBe(200)
    expect(firstPageData.success).toBe(true)
    expect(firstPageData.repairs.length).toBe(1)
    expect(String(firstPageData.repairs[0].reason)).toContain(prefix)
    expect(firstPageData.page?.hasMore).toBe(true)
    expect(firstPageData.page?.offset).toBe(0)
    expect(firstPageData.page?.limit).toBe(1)
    expect(firstPageData.page?.total).toBe(2)

    const secondPageResponse = await app.handle(
      new Request(
        `http://localhost/api/admin/db/repairs?limit=1&offset=1&reason=${encodeURIComponent(prefix)}&status=ok`,
        { headers: { 'x-admin-token': 'unit-test-admin-token' } }
      )
    )
    const secondPageData = await secondPageResponse.json() as any
    expect(secondPageResponse.status).toBe(200)
    expect(secondPageData.success).toBe(true)
    expect(secondPageData.repairs.length).toBe(1)
    expect(String(secondPageData.repairs[0].reason)).toContain(prefix)
    expect(secondPageData.repairs[0].reason).not.toBe(firstPageData.repairs[0].reason)
    expect(secondPageData.page?.hasMore).toBe(false)
    expect(secondPageData.page?.offset).toBe(1)
    expect(secondPageData.page?.limit).toBe(1)
    expect(secondPageData.page?.total).toBe(2)
  })
})
