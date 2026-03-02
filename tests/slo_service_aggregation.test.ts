import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { getLocalDb } from '../apps/backend/src/services/LocalDatabaseService'
import { SloService } from '../apps/backend/src/services/SloService'

const DAY_MS = 86_400_000

describe('SLO 服务聚合', () => {
  const cleanupPrefix = `test-slo-${Date.now()}`
  const backupRequestRetention = process.env.SLO_REQUEST_RETENTION_DAYS
  const backupJourneyRetention = process.env.SLO_JOURNEY_RETENTION_DAYS

  beforeEach(() => {
    process.env.SLO_REQUEST_RETENTION_DAYS = '14'
    process.env.SLO_JOURNEY_RETENTION_DAYS = '30'
  })

  afterEach(() => {
    const db = getLocalDb()
    db.prepare(`DELETE FROM request_metrics WHERE route_key LIKE ?`).run(`${cleanupPrefix}%`)
    db.prepare(`DELETE FROM journey_runs WHERE session_id LIKE ?`).run(`${cleanupPrefix}%`)

    if (backupRequestRetention === undefined) delete process.env.SLO_REQUEST_RETENTION_DAYS
    else process.env.SLO_REQUEST_RETENTION_DAYS = backupRequestRetention

    if (backupJourneyRetention === undefined) delete process.env.SLO_JOURNEY_RETENTION_DAYS
    else process.env.SLO_JOURNEY_RETENTION_DAYS = backupJourneyRetention
  })

  it('应按路由聚合 non-ai 请求分解指标', () => {
    const routeKey = `${cleanupPrefix}/route-breakdown`
    const journeySession = `${cleanupPrefix}/session-breakdown`

    SloService.recordRequestMetric({
      routeKey,
      method: 'GET',
      category: 'non_ai',
      statusCode: 200,
      durationMs: 120,
      success: true
    })
    SloService.recordRequestMetric({
      routeKey,
      method: 'GET',
      category: 'non_ai',
      statusCode: 503,
      durationMs: 380,
      success: false
    })
    SloService.recordJourneyRun({
      flowType: 'first_success_path',
      source: 'frontend',
      sessionId: journeySession,
      stepCount: 4,
      success: true,
      durationMs: 1200,
      meta: { scope: 'aggregation-test' }
    })
    SloService.recordJourneyRun({
      flowType: 'first_success_path',
      source: 'e2e',
      sessionId: journeySession,
      stepCount: 6,
      success: false,
      durationMs: 2200,
      meta: { scope: 'aggregation-test' }
    })

    const breakdown = SloService.getSloBreakdown(5, 'non_ai', 200)
    const item = breakdown.items.find((entry) => entry.routeKey === routeKey && entry.method === 'GET')

    expect(item).toBeTruthy()
    expect(item?.count).toBe(2)
    expect(item?.successRate).toBe(0.5)
    expect(item?.avgMs).toBe(250)
    expect(item?.p95Ms).toBe(380)
    expect(item?.p99Ms).toBe(380)

    const summary = SloService.getSloSummary(5)
    expect(summary.window.minutes).toBe(5)
    expect(summary.current.nonAiApiP95Ms).not.toBeNull()
    expect(summary.sourceBreakdown.frontend?.total || 0).toBeGreaterThanOrEqual(1)
    expect(summary.sourceBreakdown.e2e?.total || 0).toBeGreaterThanOrEqual(1)
  }, 20000)

  it('应按保留策略清理过期 request/journey 数据', () => {
    process.env.SLO_REQUEST_RETENTION_DAYS = '1'
    process.env.SLO_JOURNEY_RETENTION_DAYS = '1'
    const now = Date.now()

    const staleRoute = `${cleanupPrefix}/route-stale`
    const freshRoute = `${cleanupPrefix}/route-fresh`
    const staleSession = `${cleanupPrefix}/session-stale`
    const freshSession = `${cleanupPrefix}/session-fresh`

    SloService.recordRequestMetric({
      routeKey: staleRoute,
      method: 'POST',
      category: 'non_ai',
      statusCode: 200,
      durationMs: 120,
      success: true,
      timestamp: new Date(now - 3 * DAY_MS).toISOString()
    })
    SloService.recordRequestMetric({
      routeKey: freshRoute,
      method: 'POST',
      category: 'non_ai',
      statusCode: 200,
      durationMs: 150,
      success: true,
      timestamp: new Date(now - 15 * 60_000).toISOString()
    })
    SloService.recordJourneyRun({
      flowType: 'first_success_path',
      source: 'frontend',
      sessionId: staleSession,
      stepCount: 5,
      success: true,
      durationMs: 1000,
      timestamp: new Date(now - 4 * DAY_MS).toISOString()
    })
    SloService.recordJourneyRun({
      flowType: 'first_success_path',
      source: 'frontend',
      sessionId: freshSession,
      stepCount: 3,
      success: true,
      durationMs: 900,
      timestamp: new Date(now - 5 * 60_000).toISOString()
    })

    const cleanup = SloService.cleanupExpiredData(now)
    expect(cleanup.removedRequestMetrics).toBeGreaterThanOrEqual(1)
    expect(cleanup.removedJourneyRuns).toBeGreaterThanOrEqual(1)

    const db = getLocalDb()
    const staleRequestCount = db.prepare(`SELECT COUNT(1) as count FROM request_metrics WHERE route_key = ?`).get(staleRoute) as { count: number }
    const freshRequestCount = db.prepare(`SELECT COUNT(1) as count FROM request_metrics WHERE route_key = ?`).get(freshRoute) as { count: number }
    const staleJourneyCount = db.prepare(`SELECT COUNT(1) as count FROM journey_runs WHERE session_id = ?`).get(staleSession) as { count: number }
    const freshJourneyCount = db.prepare(`SELECT COUNT(1) as count FROM journey_runs WHERE session_id = ?`).get(freshSession) as { count: number }

    expect(staleRequestCount.count).toBe(0)
    expect(staleJourneyCount.count).toBe(0)
    expect(freshRequestCount.count).toBe(1)
    expect(freshJourneyCount.count).toBe(1)
  })
})
