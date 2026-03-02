import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { app } from '../apps/backend/src/index'
import { getLocalDb } from '../apps/backend/src/services/LocalDatabaseService'
import { SloService } from '../apps/backend/src/services/SloService'

describe('SLO 管理接口', () => {
  const backupAdminToken = process.env.ADMIN_TOKEN
  const routePrefix = `test-slo-admin-${Date.now()}`
  const sessionPrefix = `test-slo-admin-session-${Date.now()}`

  beforeEach(() => {
    process.env.ADMIN_TOKEN = 'unit-test-admin-token'
  })

  afterEach(() => {
    const db = getLocalDb()
    db.prepare(`DELETE FROM request_metrics WHERE route_key LIKE ?`).run(`${routePrefix}%`)
    db.prepare(`DELETE FROM journey_runs WHERE session_id LIKE ?`).run(`${sessionPrefix}%`)

    if (backupAdminToken === undefined) delete process.env.ADMIN_TOKEN
    else process.env.ADMIN_TOKEN = backupAdminToken
  })

  it('未携带管理员令牌时应返回 401', async () => {
    const response = await app.handle(new Request('http://localhost/api/admin/slo/summary?windowMinutes=60'))
    const payload = await response.json() as any
    expect(response.status).toBe(401)
    expect(payload.success).toBe(false)
  })

  it('应返回 SLO 摘要与接口分解数据', async () => {
    const routeKey = `${routePrefix}/summary`
    const journeySession = `${sessionPrefix}/summary`

    SloService.recordRequestMetric({
      routeKey,
      method: 'PUT',
      category: 'non_ai',
      statusCode: 200,
      durationMs: 180,
      success: true
    })
    SloService.recordRequestMetric({
      routeKey,
      method: 'PUT',
      category: 'non_ai',
      statusCode: 500,
      durationMs: 420,
      success: false
    })
    SloService.recordJourneyRun({
      flowType: 'first_success_path',
      source: 'frontend',
      sessionId: journeySession,
      stepCount: 4,
      success: true,
      durationMs: 980
    })

    const summaryResp = await app.handle(new Request('http://localhost/api/admin/slo/summary?windowMinutes=60', {
      headers: { 'x-admin-token': 'unit-test-admin-token' }
    }))
    const summaryData = await summaryResp.json() as any

    expect(summaryResp.status).toBe(200)
    expect(summaryData.success).toBe(true)
    expect(summaryData.summary?.window?.minutes).toBe(60)
    expect(summaryData.summary?.counts?.nonAiSamples).toBeGreaterThanOrEqual(1)
    expect(summaryData.summary?.current?.nonAiApiP95Ms).not.toBeNull()
    expect(typeof summaryData.summary?.passFlags?.nonAiApiP95Ms).toBe('boolean')

    const breakdownResp = await app.handle(new Request('http://localhost/api/admin/slo/breakdown?windowMinutes=60&category=non_ai&limit=100', {
      headers: { 'x-admin-token': 'unit-test-admin-token' }
    }))
    const breakdownData = await breakdownResp.json() as any

    expect(breakdownResp.status).toBe(200)
    expect(breakdownData.success).toBe(true)
    expect(Array.isArray(breakdownData.breakdown?.items)).toBe(true)

    const routeItem = (breakdownData.breakdown?.items || []).find((item: any) => (
      item.routeKey === routeKey && item.method === 'PUT'
    ))
    expect(routeItem).toBeTruthy()
    expect(routeItem.count).toBe(2)
    expect(routeItem.successRate).toBe(0.5)
  })
})
