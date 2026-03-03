import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { getLocalDb } from '../apps/backend/src/services/LocalDatabaseService'
import { SloService } from '../apps/backend/src/services/SloService'

const DAY_MS = 86_400_000

describe('SLO 服务聚合', () => {
  const cleanupPrefix = `test-slo-${Date.now()}`
  const backupRequestRetention = process.env.SLO_REQUEST_RETENTION_DAYS
  const backupJourneyRetention = process.env.SLO_JOURNEY_RETENTION_DAYS
  const backupSummaryNonAiCap = process.env.SLO_SUMMARY_NON_AI_SAMPLE_CAP
  const backupSummaryJourneyCap = process.env.SLO_SUMMARY_JOURNEY_SAMPLE_CAP
  const backupBreakdownCap = process.env.SLO_BREAKDOWN_SAMPLE_CAP
  const backupDiagnosticCap = process.env.SLO_DIAGNOSTIC_SAMPLE_CAP

  beforeEach(() => {
    process.env.SLO_REQUEST_RETENTION_DAYS = '14'
    process.env.SLO_JOURNEY_RETENTION_DAYS = '30'
    delete process.env.SLO_SUMMARY_NON_AI_SAMPLE_CAP
    delete process.env.SLO_SUMMARY_JOURNEY_SAMPLE_CAP
    delete process.env.SLO_BREAKDOWN_SAMPLE_CAP
    delete process.env.SLO_DIAGNOSTIC_SAMPLE_CAP
  })

  afterEach(() => {
    const db = getLocalDb()
    db.prepare(`DELETE FROM request_metrics WHERE route_key LIKE ?`).run(`${cleanupPrefix}%`)
    db.prepare(`DELETE FROM request_metrics WHERE request_id LIKE ?`).run('slo-seed-%')
    db.prepare(`DELETE FROM journey_runs WHERE session_id LIKE ?`).run(`${cleanupPrefix}%`)
    db.prepare(`DELETE FROM journey_runs WHERE session_id LIKE ?`).run('slo-seed-%')

    if (backupRequestRetention === undefined) delete process.env.SLO_REQUEST_RETENTION_DAYS
    else process.env.SLO_REQUEST_RETENTION_DAYS = backupRequestRetention

    if (backupJourneyRetention === undefined) delete process.env.SLO_JOURNEY_RETENTION_DAYS
    else process.env.SLO_JOURNEY_RETENTION_DAYS = backupJourneyRetention

    if (backupSummaryNonAiCap === undefined) delete process.env.SLO_SUMMARY_NON_AI_SAMPLE_CAP
    else process.env.SLO_SUMMARY_NON_AI_SAMPLE_CAP = backupSummaryNonAiCap

    if (backupSummaryJourneyCap === undefined) delete process.env.SLO_SUMMARY_JOURNEY_SAMPLE_CAP
    else process.env.SLO_SUMMARY_JOURNEY_SAMPLE_CAP = backupSummaryJourneyCap

    if (backupBreakdownCap === undefined) delete process.env.SLO_BREAKDOWN_SAMPLE_CAP
    else process.env.SLO_BREAKDOWN_SAMPLE_CAP = backupBreakdownCap

    if (backupDiagnosticCap === undefined) delete process.env.SLO_DIAGNOSTIC_SAMPLE_CAP
    else process.env.SLO_DIAGNOSTIC_SAMPLE_CAP = backupDiagnosticCap
  })

  it('应按路由聚合请求分解指标', () => {
    const routeKey = `${cleanupPrefix}/route-breakdown`

    SloService.recordRequestMetric({
      routeKey,
      method: 'GET',
      category: 'system',
      statusCode: 200,
      durationMs: 120,
      success: true
    })
    SloService.recordRequestMetric({
      routeKey,
      method: 'GET',
      category: 'system',
      statusCode: 503,
      durationMs: 380,
      success: false
    })

    const breakdown = SloService.getSloBreakdown(5, 'system', 200)
    const item = breakdown.items.find(
      (entry) => entry.routeKey === routeKey && entry.method === 'GET'
    )

    expect(item).toBeTruthy()
    expect(item?.count).toBe(2)
    expect(item?.successRate).toBe(0.5)
    expect(item?.avgMs).toBe(250)
    expect(item?.p95Ms).toBe(380)
    expect(item?.p99Ms).toBe(380)
  }, 30_000)

  it('应按采样上限聚合 summary、breakdown 与失败诊断', () => {
    process.env.SLO_SUMMARY_NON_AI_SAMPLE_CAP = '3'
    process.env.SLO_SUMMARY_JOURNEY_SAMPLE_CAP = '2'
    process.env.SLO_BREAKDOWN_SAMPLE_CAP = '3'
    process.env.SLO_DIAGNOSTIC_SAMPLE_CAP = '2'

    const now = Date.now()
    const routeKey = `${cleanupPrefix}/route-cap`
    for (let index = 0; index < 6; index += 1) {
      SloService.recordRequestMetric({
        requestId: `${cleanupPrefix}-req-cap-${index}`,
        routeKey,
        method: 'GET',
        category: 'non_ai',
        statusCode: index % 2 === 0 ? 200 : 503,
        durationMs: 100 + index * 10,
        success: index % 2 === 0,
        timestamp: new Date(now + index * 1_000).toISOString()
      })
    }

    for (let index = 0; index < 4; index += 1) {
      SloService.recordJourneyRun({
        flowType: 'first_success_path',
        source: 'frontend',
        sessionId: `${cleanupPrefix}-journey-cap-${index}`,
        idempotencyKey: `${cleanupPrefix}-journey-cap-${index}`,
        stepCount: 3 + index,
        success: index % 2 === 0,
        durationMs: 1000 + index * 50,
        meta:
          index % 2 === 0
            ? {}
            : {
                failedStage: 'export',
                errorKind: 'server',
                httpStatus: 500
              },
        timestamp: new Date(now + index * 1_200).toISOString()
      })
    }

    const summary = SloService.getSloSummary(60)
    expect(summary.counts.nonAiSamples).toBe(3)
    expect(summary.counts.totalJourneys).toBe(2)
    expect(summary.counts.sampledNonAiCap).toBe(3)
    expect(summary.counts.sampledJourneyCap).toBe(2)

    const breakdown = SloService.getSloBreakdown(60, 'non_ai', 1)
    expect(breakdown.totalRequests).toBe(3)
    expect(breakdown.sampledRequestCap).toBe(3)

    const diagnostics = SloService.getJourneyFailureDiagnostics(60, 1)
    expect(diagnostics.counts.totalFailJourneys).toBe(2)
    expect(diagnostics.counts.sampledFailureCap).toBe(2)
  })

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
    const staleRequestCount = db
      .prepare(`SELECT COUNT(1) as count FROM request_metrics WHERE route_key = ?`)
      .get(staleRoute) as { count: number }
    const freshRequestCount = db
      .prepare(`SELECT COUNT(1) as count FROM request_metrics WHERE route_key = ?`)
      .get(freshRoute) as { count: number }
    const staleJourneyCount = db
      .prepare(`SELECT COUNT(1) as count FROM journey_runs WHERE session_id = ?`)
      .get(staleSession) as { count: number }
    const freshJourneyCount = db
      .prepare(`SELECT COUNT(1) as count FROM journey_runs WHERE session_id = ?`)
      .get(freshSession) as { count: number }

    expect(staleRequestCount.count).toBe(0)
    expect(staleJourneyCount.count).toBe(0)
    expect(freshRequestCount.count).toBe(1)
    expect(freshJourneyCount.count).toBe(1)
  }, 20_000)

  it('应支持注入 SLO 合规样本用于门禁预热', () => {
    const seeded = SloService.seedSyntheticSamples({
      nonAiSamples: 20,
      journeySamples: 10,
      source: 'ci'
    })

    expect(seeded.applied.nonAiSamples).toBe(20)
    expect(seeded.applied.journeySamples).toBe(10)
    expect(seeded.source).toBe('ci')
    expect(seeded.seedId.startsWith('slo-seed-ci-')).toBe(true)

    const db = getLocalDb()
    const requestCount = db
      .prepare(
        `
      SELECT COUNT(1) as count
      FROM request_metrics
      WHERE request_id LIKE ?
    `
      )
      .get(`${seeded.seedId}-req-%`) as { count: number }
    const journeyCount = db
      .prepare(
        `
      SELECT COUNT(1) as count
      FROM journey_runs
      WHERE session_id LIKE ?
    `
      )
      .get(`${seeded.seedId}-journey-%`) as { count: number }

    expect(requestCount.count).toBe(20)
    expect(journeyCount.count).toBe(10)

    const summary = SloService.getSloSummary(60)
    expect(summary.counts.nonAiSamples).toBeGreaterThanOrEqual(20)
    expect(summary.counts.totalJourneys).toBeGreaterThanOrEqual(10)
  })
})
