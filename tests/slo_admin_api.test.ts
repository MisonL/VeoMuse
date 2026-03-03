import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { app } from '../apps/backend/src/index'
import { getLocalDb } from '../apps/backend/src/services/LocalDatabaseService'
import { SloService } from '../apps/backend/src/services/SloService'

describe('SLO 管理接口', () => {
  const SLO_ADMIN_API_TEST_TIMEOUT_MS = 120_000
  const backupAdminToken = process.env.ADMIN_TOKEN
  const backupSloSeedEnabled = process.env.SLO_ADMIN_SEED_ENABLED
  const routePrefix = `test-slo-admin-${Date.now()}`
  const sessionPrefix = `test-slo-admin-session-${Date.now()}`

  beforeEach(() => {
    process.env.ADMIN_TOKEN = 'unit-test-admin-token'
  })

  afterEach(() => {
    if (backupAdminToken === undefined) delete process.env.ADMIN_TOKEN
    else process.env.ADMIN_TOKEN = backupAdminToken

    if (backupSloSeedEnabled === undefined) delete process.env.SLO_ADMIN_SEED_ENABLED
    else process.env.SLO_ADMIN_SEED_ENABLED = backupSloSeedEnabled
  })

  it(
    '未携带管理员令牌时应返回 401',
    async () => {
      const response = await app.handle(
        new Request('http://localhost/api/admin/slo/summary?windowMinutes=60')
      )
      const payload = (await response.json()) as any
      expect(response.status).toBe(401)
      expect(payload.success).toBe(false)
    },
    SLO_ADMIN_API_TEST_TIMEOUT_MS
  )

  it(
    '应返回 SLO 摘要与接口分解数据',
    async () => {
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

      const summaryResp = await app.handle(
        new Request('http://localhost/api/admin/slo/summary?windowMinutes=60', {
          headers: { 'x-admin-token': 'unit-test-admin-token' }
        })
      )
      const summaryData = (await summaryResp.json()) as any

      expect(summaryResp.status).toBe(200)
      expect(summaryData.success).toBe(true)
      expect(summaryData.summary?.window?.minutes).toBe(60)
      expect(summaryData.summary?.counts?.nonAiSamples).toBeGreaterThanOrEqual(1)
      expect(summaryData.summary?.current?.nonAiApiP95Ms).not.toBeNull()
      expect(typeof summaryData.summary?.passFlags?.nonAiApiP95Ms).toBe('boolean')

      const breakdownResp = await app.handle(
        new Request(
          'http://localhost/api/admin/slo/breakdown?windowMinutes=60&category=non_ai&limit=100',
          {
            headers: { 'x-admin-token': 'unit-test-admin-token' }
          }
        )
      )
      const breakdownData = (await breakdownResp.json()) as any

      expect(breakdownResp.status).toBe(200)
      expect(breakdownData.success).toBe(true)
      expect(Array.isArray(breakdownData.breakdown?.items)).toBe(true)

      const routeItem = (breakdownData.breakdown?.items || []).find(
        (item: any) => item.routeKey === routeKey && item.method === 'PUT'
      )
      expect(routeItem).toBeTruthy()
      expect(routeItem.count).toBe(2)
      expect(routeItem.successRate).toBe(0.5)
    },
    SLO_ADMIN_API_TEST_TIMEOUT_MS
  )

  it(
    '应返回失败旅程诊断聚合',
    async () => {
      const sessionA = `${sessionPrefix}/diag-a`
      const sessionB = `${sessionPrefix}/diag-b`
      const sessionC = `${sessionPrefix}/diag-c`
      const uniqueHttpStatus = 592

      SloService.recordJourneyRun({
        flowType: 'first_success_path',
        source: 'frontend',
        sessionId: sessionA,
        stepCount: 5,
        success: false,
        durationMs: 1200,
        meta: {
          failedStage: 'generate',
          errorKind: 'server',
          httpStatus: uniqueHttpStatus
        }
      })
      SloService.recordJourneyRun({
        flowType: 'first_success_path',
        source: 'frontend',
        sessionId: sessionB,
        stepCount: 4,
        success: false,
        durationMs: 900,
        meta: {
          failedStage: 'generate',
          errorKind: 'server',
          httpStatus: uniqueHttpStatus
        }
      })
      SloService.recordJourneyRun({
        flowType: 'first_success_path',
        source: 'frontend',
        sessionId: sessionC,
        stepCount: 3,
        success: false,
        durationMs: 880,
        meta: {
          failedStage: 'workspace',
          errorKind: 'quota',
          httpStatus: 429
        }
      })

      const response = await app.handle(
        new Request('http://localhost/api/admin/slo/journey-failures?windowMinutes=60&limit=10', {
          headers: { 'x-admin-token': 'unit-test-admin-token' }
        })
      )
      const payload = (await response.json()) as any

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
      expect(payload.window?.minutes).toBe(60)
      expect(payload.counts?.totalFailJourneys).toBeGreaterThanOrEqual(3)
      expect(Array.isArray(payload.items)).toBe(true)

      const grouped = (payload.items || []).find(
        (item: any) =>
          item.failedStage === 'generate' &&
          item.errorKind === 'server' &&
          item.httpStatus === uniqueHttpStatus
      )
      expect(grouped).toBeTruthy()
      expect(grouped.count).toBeGreaterThanOrEqual(2)
      expect(grouped.share).toBeGreaterThan(0)
    },
    SLO_ADMIN_API_TEST_TIMEOUT_MS
  )

  it(
    'SLO seed 接口未携带管理员令牌时应返回 401',
    async () => {
      process.env.SLO_ADMIN_SEED_ENABLED = 'true'
      const response = await app.handle(
        new Request('http://localhost/api/admin/slo/seed', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ nonAiSamples: 20, journeySamples: 10, source: 'ci' })
        })
      )
      const payload = (await response.json()) as any

      expect(response.status).toBe(401)
      expect(payload.success).toBe(false)
    },
    SLO_ADMIN_API_TEST_TIMEOUT_MS
  )

  it(
    'SLO seed 接口在开关关闭时应返回 403',
    async () => {
      process.env.SLO_ADMIN_SEED_ENABLED = 'false'
      const response = await app.handle(
        new Request('http://localhost/api/admin/slo/seed', {
          method: 'POST',
          headers: {
            'x-admin-token': 'unit-test-admin-token',
            'content-type': 'application/json'
          },
          body: JSON.stringify({ nonAiSamples: 20, journeySamples: 10, source: 'ci' })
        })
      )
      const payload = (await response.json()) as any

      expect(response.status).toBe(403)
      expect(payload.success).toBe(false)
      expect(payload.error).toContain('disabled')
    },
    SLO_ADMIN_API_TEST_TIMEOUT_MS
  )

  it(
    'SLO seed 接口在开关开启时应写入样本并返回计数',
    async () => {
      process.env.SLO_ADMIN_SEED_ENABLED = 'true'
      const response = await app.handle(
        new Request('http://localhost/api/admin/slo/seed', {
          method: 'POST',
          headers: {
            'x-admin-token': 'unit-test-admin-token',
            'content-type': 'application/json'
          },
          body: JSON.stringify({ nonAiSamples: 22, journeySamples: 11, source: 'manual' })
        })
      )
      const payload = (await response.json()) as any

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
      expect(payload.seed?.source).toBe('manual')
      expect(payload.seed?.applied?.nonAiSamples).toBe(22)
      expect(payload.seed?.applied?.journeySamples).toBe(11)

      const seedId = String(payload.seed?.seedId || '')
      expect(seedId.startsWith('slo-seed-manual-')).toBe(true)

      const db = getLocalDb()
      const requestCount = db
        .prepare(
          `
      SELECT COUNT(1) as count
      FROM request_metrics
      WHERE request_id LIKE ?
    `
        )
        .get(`${seedId}-req-%`) as { count: number }
      const journeyCount = db
        .prepare(
          `
      SELECT COUNT(1) as count
      FROM journey_runs
      WHERE session_id LIKE ?
    `
        )
        .get(`${seedId}-journey-%`) as { count: number }

      expect(requestCount.count).toBe(22)
      expect(journeyCount.count).toBe(11)
    },
    SLO_ADMIN_API_TEST_TIMEOUT_MS
  )
})
