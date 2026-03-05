import { getLocalDb } from './LocalDatabaseService'

export type SloMetricCategory = 'ai' | 'non_ai' | 'system'

export interface RequestMetricInput {
  requestId?: string
  routeKey: string
  method: string
  category: SloMetricCategory
  statusCode: number
  durationMs: number
  success: boolean
  timestamp?: string
}

export interface JourneyRunInput {
  flowType: 'first_success_path'
  source: 'frontend' | 'e2e'
  userId?: string
  organizationId?: string | null
  workspaceId?: string | null
  sessionId?: string | null
  idempotencyKey?: string | null
  stepCount: number
  success: boolean
  durationMs?: number
  meta?: Record<string, unknown>
  timestamp?: string
}

export interface SloSeedInput {
  nonAiSamples?: number
  journeySamples?: number
  source?: 'ci' | 'manual'
}

interface JourneyFailureDiagnosticRow {
  meta_json: string
  created_at: string
}

interface SloTargets {
  primaryFlowSuccessRate: number
  nonAiApiP95Ms: number
  firstSuccessAvgSteps: number
}

const DAY_MS = 86_400_000

const toIso = (ms: number) => new Date(ms).toISOString()

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const parsePositiveFloat = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseFloat(String(value || ''))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const percentile = (samples: number[], p: number) => {
  if (!samples.length) return null
  const sorted = [...samples].sort((a, b) => a - b)
  const index = Math.max(0, Math.ceil(sorted.length * p) - 1)
  const value = sorted[index] ?? sorted[sorted.length - 1] ?? 0
  return Number(value.toFixed(2))
}

const average = (samples: number[]) => {
  if (!samples.length) return null
  const value = samples.reduce((sum, item) => sum + item, 0) / samples.length
  return Number(value.toFixed(2))
}

const toSafeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const resolveErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return ''
}

const parseMetaJson = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const toJourneyRecord = (row: {
  flow_type: JourneyRunInput['flowType']
  source: JourneyRunInput['source']
  user_id: string | null
  organization_id: string | null
  workspace_id: string | null
  session_id: string | null
  idempotency_key: string | null
  step_count: number
  success: number
  duration_ms: number
  meta_json: string
}) => {
  return {
    flowType: row.flow_type,
    source: row.source,
    userId: row.user_id,
    organizationId: row.organization_id,
    workspaceId: row.workspace_id,
    sessionId: row.session_id,
    idempotencyKey: row.idempotency_key,
    stepCount: Math.max(0, toSafeNumber(row.step_count, 0)),
    success: Number(row.success) > 0,
    durationMs: Math.max(0, toSafeNumber(row.duration_ms, 0)),
    meta: parseMetaJson(row.meta_json)
  }
}

const resolveTargets = (): SloTargets => ({
  primaryFlowSuccessRate: parsePositiveFloat(process.env.SLO_TARGET_PRIMARY_SUCCESS_RATE, 0.995),
  nonAiApiP95Ms: parsePositiveInt(process.env.SLO_TARGET_NON_AI_P95_MS, 400),
  firstSuccessAvgSteps: parsePositiveFloat(process.env.SLO_TARGET_FIRST_SUCCESS_MAX_STEPS, 8)
})

const resolveRetentionDays = () => ({
  requestMetricDays: parsePositiveInt(process.env.SLO_REQUEST_RETENTION_DAYS, 14),
  journeyRunDays: parsePositiveInt(process.env.SLO_JOURNEY_RETENTION_DAYS, 30)
})

const resolveSampleCaps = () => ({
  summaryNonAiSamples: parsePositiveInt(process.env.SLO_SUMMARY_NON_AI_SAMPLE_CAP, 6000),
  summaryJourneySamples: parsePositiveInt(process.env.SLO_SUMMARY_JOURNEY_SAMPLE_CAP, 6000),
  breakdownSamples: parsePositiveInt(process.env.SLO_BREAKDOWN_SAMPLE_CAP, 12_000),
  diagnosticSamples: parsePositiveInt(process.env.SLO_DIAGNOSTIC_SAMPLE_CAP, 4000)
})

export class SloService {
  static recordRequestMetric(input: RequestMetricInput) {
    const createdAt = input.timestamp || new Date().toISOString()
    const safeDuration = Math.max(0, toSafeNumber(input.durationMs))
    const safeStatusCode = Math.max(0, Math.floor(toSafeNumber(input.statusCode, 500)))
    const method = (input.method || 'GET').toUpperCase().slice(0, 16)
    const routeKey = (input.routeKey || '/unknown').trim() || '/unknown'

    getLocalDb()
      .prepare(
        `
      INSERT INTO request_metrics (
        id, request_id, route_key, method, category, status_code, success, duration_ms, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        `slo_req_${crypto.randomUUID()}`,
        (input.requestId || '').trim() || `req_${crypto.randomUUID()}`,
        routeKey,
        method,
        input.category,
        safeStatusCode,
        input.success ? 1 : 0,
        safeDuration,
        createdAt
      )
  }

  static recordJourneyRun(input: JourneyRunInput) {
    const createdAt = input.timestamp || new Date().toISOString()
    const stepCount = Math.max(0, Math.min(200, Math.floor(toSafeNumber(input.stepCount, 0))))
    const durationMs = Math.max(0, toSafeNumber(input.durationMs, 0))
    const idempotencyKey = (input.idempotencyKey || '').trim() || null
    const payload = {
      flowType: input.flowType,
      source: input.source,
      userId: (input.userId || '').trim() || null,
      organizationId: (input.organizationId || '').trim() || null,
      workspaceId: (input.workspaceId || '').trim() || null,
      sessionId: (input.sessionId || '').trim() || null,
      idempotencyKey,
      stepCount,
      success: Boolean(input.success),
      durationMs,
      meta: input.meta && typeof input.meta === 'object' ? input.meta : {}
    }

    const findExistingByIdempotency = () => {
      if (!payload.organizationId || !payload.sessionId || !payload.idempotencyKey) return null
      return getLocalDb()
        .prepare(
          `
        SELECT flow_type, source, user_id, organization_id, workspace_id, session_id, idempotency_key,
               step_count, success, duration_ms, meta_json
        FROM journey_runs
        WHERE organization_id = ? AND flow_type = ? AND session_id = ? AND idempotency_key = ?
        ORDER BY created_at DESC
        LIMIT 1
      `
        )
        .get(
          payload.organizationId,
          payload.flowType,
          payload.sessionId,
          payload.idempotencyKey
        ) as {
        flow_type: JourneyRunInput['flowType']
        source: JourneyRunInput['source']
        user_id: string | null
        organization_id: string | null
        workspace_id: string | null
        session_id: string | null
        idempotency_key: string | null
        step_count: number
        success: number
        duration_ms: number
        meta_json: string
      } | null
    }

    const existing = findExistingByIdempotency()
    if (existing) {
      return {
        ...toJourneyRecord(existing),
        deduplicated: true
      }
    }

    try {
      getLocalDb()
        .prepare(
          `
        INSERT INTO journey_runs (
          id, flow_type, source, user_id, organization_id, workspace_id, session_id, idempotency_key,
          step_count, success, duration_ms, meta_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          `slo_journey_${crypto.randomUUID()}`,
          payload.flowType,
          payload.source,
          payload.userId,
          payload.organizationId,
          payload.workspaceId,
          payload.sessionId,
          payload.idempotencyKey,
          payload.stepCount,
          payload.success ? 1 : 0,
          payload.durationMs,
          JSON.stringify(payload.meta),
          createdAt
        )
    } catch (error: unknown) {
      const message = resolveErrorMessage(error)
      const maybeConstraintError = message.toLowerCase().includes('constraint')
      if (maybeConstraintError) {
        const duplicated = findExistingByIdempotency()
        if (duplicated) {
          return {
            ...toJourneyRecord(duplicated),
            deduplicated: true
          }
        }
      }
      throw error
    }

    return {
      ...payload,
      deduplicated: false
    }
  }

  static seedSyntheticSamples(input?: SloSeedInput) {
    const requestedNonAi = Math.floor(toSafeNumber(input?.nonAiSamples, 20))
    const requestedJourney = Math.floor(toSafeNumber(input?.journeySamples, 10))
    const nonAiSamples = Math.max(1, Math.min(500, requestedNonAi))
    const journeySamples = Math.max(1, Math.min(200, requestedJourney))
    const source = input?.source === 'manual' ? 'manual' : 'ci'
    const seedId = `slo-seed-${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const nowMs = Date.now()

    const nonAiRouteTemplates = [
      '/api/workspaces/:id/projects',
      '/api/storage/upload-token',
      '/api/models/policy/simulate',
      '/api/workspaces/:id/presence',
      '/api/organizations/:id/quota'
    ]

    for (let index = 0; index < nonAiSamples; index += 1) {
      const durationBase = 160 + (index % 7) * 28
      const tailBoost = index >= nonAiSamples - 2 ? 40 : 0
      const durationMs = Math.min(390, durationBase + tailBoost)
      const success = index % 12 !== 11
      const statusCode = success ? 200 : 503
      const routeKey =
        nonAiRouteTemplates[index % nonAiRouteTemplates.length] || '/api/workspaces/:id/projects'
      SloService.recordRequestMetric({
        requestId: `${seedId}-req-${index}`,
        routeKey,
        method: index % 2 === 0 ? 'GET' : 'POST',
        category: 'non_ai',
        statusCode,
        durationMs,
        success,
        timestamp: toIso(nowMs - (nonAiSamples - index) * 1_200)
      })
    }

    for (let index = 0; index < journeySamples; index += 1) {
      const stepCount = 4 + (index % 4)
      const durationMs = 1_600 + (index % 5) * 220
      SloService.recordJourneyRun({
        flowType: 'first_success_path',
        source: source === 'manual' ? 'frontend' : 'e2e',
        sessionId: `${seedId}-journey-${index}`,
        idempotencyKey: `${seedId}-journey-${index}`,
        stepCount,
        success: true,
        durationMs,
        meta: {
          seed: true,
          seedId,
          source
        },
        timestamp: toIso(nowMs - (journeySamples - index) * 1_800)
      })
    }

    return {
      seedId,
      source,
      requested: {
        nonAiSamples: requestedNonAi,
        journeySamples: requestedJourney
      },
      applied: {
        nonAiSamples,
        journeySamples
      },
      generatedAt: new Date(nowMs).toISOString()
    }
  }

  static cleanupExpiredData(nowMs = Date.now()) {
    const retention = resolveRetentionDays()
    const requestCutoff = toIso(nowMs - retention.requestMetricDays * DAY_MS)
    const journeyCutoff = toIso(nowMs - retention.journeyRunDays * DAY_MS)
    const db = getLocalDb()
    const requestResult = db
      .prepare(`DELETE FROM request_metrics WHERE created_at < ?`)
      .run(requestCutoff)
    const journeyResult = db
      .prepare(`DELETE FROM journey_runs WHERE created_at < ?`)
      .run(journeyCutoff)

    return {
      removedRequestMetrics: requestResult.changes || 0,
      removedJourneyRuns: journeyResult.changes || 0,
      requestCutoff,
      journeyCutoff,
      timestamp: new Date(nowMs).toISOString()
    }
  }

  static getSloSummary(windowMinutes = 1440) {
    const safeWindowMinutes = Math.max(
      5,
      Math.min(10_080, Math.floor(toSafeNumber(windowMinutes, 1440)))
    )
    const nowMs = Date.now()
    const from = toIso(nowMs - safeWindowMinutes * 60_000)
    const to = toIso(nowMs)
    const db = getLocalDb()
    const targets = resolveTargets()
    const sampleCaps = resolveSampleCaps()

    const nonAiRows = db
      .prepare(
        `
      SELECT duration_ms
      FROM request_metrics
      WHERE category = 'non_ai' AND created_at >= ?
      ORDER BY created_at DESC
      LIMIT ?
    `
      )
      .all(from, sampleCaps.summaryNonAiSamples) as Array<{ duration_ms: number }>
    const nonAiDurations = nonAiRows.map((row) => Math.max(0, toSafeNumber(row.duration_ms, 0)))
    const nonAiP95Ms = percentile(nonAiDurations, 0.95)

    const journeyRows = db
      .prepare(
        `
      SELECT success, step_count, source
      FROM journey_runs
      WHERE flow_type = 'first_success_path' AND created_at >= ?
      ORDER BY created_at DESC
      LIMIT ?
    `
      )
      .all(from, sampleCaps.summaryJourneySamples) as Array<{
      success: number
      step_count: number
      source: string
    }>

    const totalJourneys = journeyRows.length
    const successJourneys = journeyRows.filter((row) => Number(row.success) > 0)
    const successRate =
      totalJourneys > 0 ? Number((successJourneys.length / totalJourneys).toFixed(4)) : null
    const avgSuccessSteps = average(
      successJourneys.map((row) => Math.max(0, toSafeNumber(row.step_count, 0)))
    )

    const sourceBreakdown = journeyRows.reduce<Record<string, { total: number; success: number }>>(
      (acc, row) => {
        const key = (row.source || 'unknown').trim() || 'unknown'
        if (!acc[key]) acc[key] = { total: 0, success: 0 }
        acc[key].total += 1
        if (Number(row.success) > 0) acc[key].success += 1
        return acc
      },
      {}
    )

    const passFlags = {
      primaryFlowSuccessRate: successRate !== null && successRate >= targets.primaryFlowSuccessRate,
      nonAiApiP95Ms: nonAiP95Ms !== null && nonAiP95Ms <= targets.nonAiApiP95Ms,
      firstSuccessAvgSteps:
        avgSuccessSteps !== null && avgSuccessSteps <= targets.firstSuccessAvgSteps
    }

    return {
      targets,
      current: {
        primaryFlowSuccessRate: successRate,
        nonAiApiP95Ms: nonAiP95Ms,
        firstSuccessAvgSteps: avgSuccessSteps
      },
      passFlags,
      window: {
        minutes: safeWindowMinutes,
        from,
        to
      },
      counts: {
        totalJourneys,
        successJourneys: successJourneys.length,
        nonAiSamples: nonAiDurations.length,
        sampledJourneyCap: sampleCaps.summaryJourneySamples,
        sampledNonAiCap: sampleCaps.summaryNonAiSamples
      },
      sourceBreakdown,
      updatedAt: new Date().toISOString()
    }
  }

  static getSloBreakdown(windowMinutes = 1440, category: SloMetricCategory = 'non_ai', limit = 80) {
    const safeWindowMinutes = Math.max(
      5,
      Math.min(10_080, Math.floor(toSafeNumber(windowMinutes, 1440)))
    )
    const safeLimit = Math.max(1, Math.min(200, Math.floor(toSafeNumber(limit, 80))))
    const from = toIso(Date.now() - safeWindowMinutes * 60_000)
    const to = toIso(Date.now())
    const db = getLocalDb()
    const sampleCap = Math.max(safeLimit, resolveSampleCaps().breakdownSamples)

    const rows = db
      .prepare(
        `
      SELECT route_key, method, status_code, success, duration_ms, created_at
      FROM request_metrics
      WHERE category = ? AND created_at >= ?
      ORDER BY created_at DESC
      LIMIT ?
    `
      )
      .all(category, from, sampleCap) as Array<{
      route_key: string
      method: string
      status_code: number
      success: number
      duration_ms: number
      created_at: string
    }>

    const grouped = new Map<
      string,
      {
        routeKey: string
        method: string
        count: number
        successCount: number
        durations: number[]
        lastSeenAt: string
      }
    >()

    for (const row of rows) {
      const method = (row.method || 'GET').toUpperCase()
      const routeKey = row.route_key || '/unknown'
      const key = `${method} ${routeKey}`
      const duration = Math.max(0, toSafeNumber(row.duration_ms, 0))
      const current = grouped.get(key) || {
        routeKey,
        method,
        count: 0,
        successCount: 0,
        durations: [],
        lastSeenAt: row.created_at || ''
      }
      current.count += 1
      if (Number(row.success) > 0) current.successCount += 1
      current.durations.push(duration)
      if (row.created_at && row.created_at > current.lastSeenAt) current.lastSeenAt = row.created_at
      grouped.set(key, current)
    }

    const items = Array.from(grouped.values())
      .map((row) => {
        const successRate = row.count > 0 ? Number((row.successCount / row.count).toFixed(4)) : 0
        return {
          routeKey: row.routeKey,
          method: row.method,
          count: row.count,
          successRate,
          avgMs: average(row.durations) || 0,
          p95Ms: percentile(row.durations, 0.95) || 0,
          p99Ms: percentile(row.durations, 0.99) || 0,
          lastSeenAt: row.lastSeenAt
        }
      })
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count
        return b.p95Ms - a.p95Ms
      })
      .slice(0, safeLimit)

    return {
      category,
      window: {
        minutes: safeWindowMinutes,
        from,
        to
      },
      totalRequests: rows.length,
      sampledRequestCap: sampleCap,
      totalRoutes: grouped.size,
      items,
      updatedAt: new Date().toISOString()
    }
  }

  static getJourneyFailureDiagnostics(windowMinutes = 1440, limit = 10) {
    const safeWindowMinutes = Math.max(
      5,
      Math.min(10_080, Math.floor(toSafeNumber(windowMinutes, 1440)))
    )
    const safeLimit = Math.max(1, Math.min(200, Math.floor(toSafeNumber(limit, 10))))
    const from = toIso(Date.now() - safeWindowMinutes * 60_000)
    const to = toIso(Date.now())
    const sampleCap = Math.max(safeLimit, resolveSampleCaps().diagnosticSamples)

    const rows = getLocalDb()
      .prepare(
        `
      SELECT meta_json, created_at
      FROM journey_runs
      WHERE flow_type = 'first_success_path' AND success = 0 AND created_at >= ?
      ORDER BY created_at DESC
      LIMIT ?
    `
      )
      .all(from, sampleCap) as JourneyFailureDiagnosticRow[]

    const grouped = new Map<
      string,
      {
        failedStage: string
        errorKind: string
        httpStatus: number | null
        count: number
        latestAt: string
      }
    >()

    const normalizeStage = (value: unknown) => {
      const stage = String(value || '')
        .trim()
        .toLowerCase()
      if (
        stage === 'register' ||
        stage === 'organization' ||
        stage === 'workspace' ||
        stage === 'generate' ||
        stage === 'export'
      ) {
        return stage
      }
      return 'unknown'
    }
    const normalizeErrorKind = (value: unknown) => {
      const kind = String(value || '')
        .trim()
        .toLowerCase()
      if (
        kind === 'network' ||
        kind === 'timeout' ||
        kind === 'auth' ||
        kind === 'permission' ||
        kind === 'quota' ||
        kind === 'server' ||
        kind === 'unknown'
      ) {
        return kind
      }
      return 'unknown'
    }
    const normalizeHttpStatus = (value: unknown) => {
      const parsed = Number(value)
      if (!Number.isFinite(parsed)) return null
      const status = Math.floor(parsed)
      if (status < 100 || status > 599) return null
      return status
    }

    for (const row of rows) {
      const meta = parseMetaJson(row.meta_json) as Record<string, unknown>
      const failedStage = normalizeStage(meta.failedStage)
      const errorKind = normalizeErrorKind(meta.errorKind)
      const httpStatus = normalizeHttpStatus(meta.httpStatus)
      const key = `${failedStage}|${errorKind}|${httpStatus === null ? 'null' : httpStatus}`
      const current = grouped.get(key) || {
        failedStage,
        errorKind,
        httpStatus,
        count: 0,
        latestAt: row.created_at || ''
      }
      current.count += 1
      if (row.created_at && row.created_at > current.latestAt) {
        current.latestAt = row.created_at
      }
      grouped.set(key, current)
    }

    const totalFailJourneys = rows.length
    const items = Array.from(grouped.values())
      .map((row) => ({
        failedStage: row.failedStage,
        errorKind: row.errorKind,
        httpStatus: row.httpStatus,
        count: row.count,
        share: totalFailJourneys > 0 ? Number((row.count / totalFailJourneys).toFixed(4)) : 0,
        latestAt: row.latestAt
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count
        return String(b.latestAt).localeCompare(String(a.latestAt))
      })
      .slice(0, safeLimit)

    return {
      window: {
        minutes: safeWindowMinutes,
        from,
        to
      },
      counts: {
        totalFailJourneys,
        sampledFailureCap: sampleCap
      },
      items,
      updatedAt: new Date().toISOString()
    }
  }
}
