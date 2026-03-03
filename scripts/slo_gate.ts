import fs from 'fs/promises'
import path from 'path'

type GateStatus = 'pass' | 'warn' | 'fail' | 'unavailable'
type GateMode = 'soft' | 'hard'
type SloCategory = 'ai' | 'non_ai' | 'system'
type SloPassFlagKey = 'primaryFlowSuccessRate' | 'nonAiApiP95Ms' | 'firstSuccessAvgSteps'
type SloCurrentKey = 'primaryFlowSuccessRate' | 'nonAiApiP95Ms' | 'firstSuccessAvgSteps'
type GateErrorKind =
  | 'none'
  | 'unreachable'
  | 'auth'
  | 'http'
  | 'sample_insufficient'
  | 'objective_failed'

interface SloSummaryPayload {
  targets: {
    primaryFlowSuccessRate: number
    nonAiApiP95Ms: number
    firstSuccessAvgSteps: number
  }
  current: {
    primaryFlowSuccessRate: number | null
    nonAiApiP95Ms: number | null
    firstSuccessAvgSteps: number | null
  }
  passFlags: Record<SloPassFlagKey, boolean>
  window: {
    minutes: number
    from: string
    to: string
  }
  counts: {
    totalJourneys: number
    successJourneys: number
    nonAiSamples: number
  }
  sourceBreakdown: Record<string, { total: number; success: number }>
  updatedAt: string
}

interface SloBreakdownItem {
  routeKey: string
  method: string
  count: number
  successRate: number
  avgMs: number
  p95Ms: number
  p99Ms: number
  lastSeenAt: string
}

interface JourneyFailureItem {
  failedStage: string
  errorKind: string
  httpStatus: number | null
  count: number
  share: number
  latestAt: string
}

interface JourneyFailuresPayload {
  window: {
    minutes: number
    from: string
    to: string
  }
  counts: {
    totalFailJourneys: number
  }
  items: JourneyFailureItem[]
  updatedAt: string
}

interface SloGateReport {
  schemaVersion: string
  status: GateStatus
  errorKind: GateErrorKind
  generatedAt: string
  mode: GateMode
  enforce: boolean
  apiBase: string
  windowMinutes: number
  category: SloCategory
  limit: number
  minNonAiSamples: number
  minJourneySamples: number
  minFrontendSourceRatio: number
  frontendSourceKey: string
  outputPath: string
  errors: string[]
  diagnostics: Array<{
    level: 'error' | 'warn' | 'info'
    kind: GateErrorKind
    target: 'summary' | 'breakdown' | 'journey_failures' | 'gate'
    message: string
  }>
  failedRules: Array<{ key: string; message: string }>
  sampleChecks: {
    nonAiSamples: {
      current: number
      minimum: number
      pass: boolean
    }
    journeySamples: {
      current: number
      minimum: number
      pass: boolean
    }
    frontendSourceRatio: {
      sourceKey: string
      sourceTotal: number
      totalJourneys: number
      current: number
      minimum: number
      pass: boolean
    }
  }
  recommendations: string[]
  summary: SloSummaryPayload | null
  breakdown: {
    totalRequests: number
    totalRoutes: number
    items: SloBreakdownItem[]
  } | null
  journeyFailures: JourneyFailuresPayload | null
}

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const parseNonNegativeInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

const parseNonNegativeNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseFloat(String(value || ''))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

const parseBoolean = (value: string | undefined) => {
  if (!value) return false
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

const rawArgs = process.argv.slice(2)
const args = new Set(rawArgs)

const parseArgValue = (flag: string) => {
  const eqPrefix = `${flag}=`
  for (let index = 0; index < rawArgs.length; index += 1) {
    const item = String(rawArgs[index] || '')
    if (item === flag) {
      return String(rawArgs[index + 1] || '').trim()
    }
    if (item.startsWith(eqPrefix)) {
      return item.slice(eqPrefix.length).trim()
    }
  }
  return ''
}

const parseMode = (value: string | undefined): GateMode | null => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
  if (normalized === 'hard' || normalized === 'soft') return normalized
  return null
}

const resolveApiBase = () => {
  const raw =
    parseArgValue('--api-base') ||
    process.env.SLO_GATE_API_BASE ||
    process.env.API_BASE_URL ||
    'http://127.0.0.1:33117'
  return raw.trim().replace(/\/+$/, '')
}

const resolveCategory = (): SloCategory => {
  const raw = (parseArgValue('--category') || process.env.SLO_GATE_CATEGORY || 'non_ai')
    .trim()
    .toLowerCase()
  if (raw === 'ai' || raw === 'system') return raw
  return 'non_ai'
}

const resolveOutputPath = () => {
  const raw =
    parseArgValue('--output') || process.env.SLO_GATE_OUTPUT || 'artifacts/slo-report.json'
  return path.resolve(process.cwd(), raw)
}

const resolveFrontendSourceKey = () => {
  const raw =
    parseArgValue('--frontend-source-key') || process.env.SLO_GATE_FRONTEND_SOURCE_KEY || 'frontend'
  return raw.trim() || 'frontend'
}

const resolveMode = (): GateMode => {
  const modeFromArg = parseMode(parseArgValue('--mode'))
  if (modeFromArg) return modeFromArg

  const modeFromEnv = parseMode(process.env.SLO_GATE_MODE)
  if (modeFromEnv) return modeFromEnv

  const legacyHard = args.has('--enforce') || parseBoolean(process.env.SLO_GATE_ENFORCE)
  return legacyHard ? 'hard' : 'soft'
}

const mode = resolveMode()
const enforce = mode === 'hard'
const apiBase = resolveApiBase()
const windowMinutes = parsePositiveInt(
  parseArgValue('--window') || process.env.SLO_GATE_WINDOW_MINUTES,
  1440
)
const category = resolveCategory()
const limit = Math.min(
  100,
  parsePositiveInt(parseArgValue('--limit') || process.env.SLO_GATE_LIMIT, 8)
)
const minNonAiSamples = parseNonNegativeInt(
  parseArgValue('--min-non-ai-samples') || process.env.SLO_GATE_MIN_NON_AI_SAMPLES,
  20
)
const minJourneySamples = parseNonNegativeInt(
  parseArgValue('--min-journey-samples') || process.env.SLO_GATE_MIN_JOURNEY_SAMPLES,
  10
)
const minFrontendSourceRatio = parseNonNegativeNumber(
  parseArgValue('--min-frontend-source-ratio') || process.env.SLO_GATE_MIN_FRONTEND_SOURCE_RATIO,
  0
)
const frontendSourceKey = resolveFrontendSourceKey()
const timeoutMs = parsePositiveInt(process.env.SLO_GATE_TIMEOUT_MS, 10_000)
const adminToken = (process.env.SLO_GATE_ADMIN_TOKEN || process.env.ADMIN_TOKEN || '').trim()
const outputPath = resolveOutputPath()
const schemaVersion =
  (
    parseArgValue('--schema-version') ||
    process.env.SLO_GATE_REPORT_SCHEMA_VERSION ||
    '1.0'
  ).trim() || '1.0'

const classifyRequestError = (
  error: any
): Extract<GateErrorKind, 'unreachable' | 'auth' | 'http'> => {
  const status = Number(error?.httpStatus)
  if (status === 401 || status === 403) return 'auth'

  const message = String(error?.message || error || '').toLowerCase()
  if (message.includes('unauthorized') || message.includes('forbidden')) return 'auth'
  if (
    message.includes('unable to connect') ||
    message.includes('failed to fetch') ||
    message.includes('econnrefused') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('network')
  ) {
    return 'unreachable'
  }
  return 'http'
}

const requestJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, {
    method: 'GET',
    headers: adminToken ? { 'x-admin-token': adminToken } : {},
    signal: AbortSignal.timeout(timeoutMs)
  })
  const payload = (await response.json().catch(() => null)) as any
  if (!response.ok) {
    const message = payload?.error || payload?.message || `HTTP ${response.status}`
    const failure = new Error(String(message))
    ;(failure as any).httpStatus = response.status
    throw failure
  }
  return payload as T
}

const formatRatio = (value: number) => `${(value * 100).toFixed(1)}%`

const buildSampleChecks = (summary: SloSummaryPayload | null) => {
  const nonAiCurrent = Number(summary?.counts?.nonAiSamples || 0)
  const journeyCurrent = Number(summary?.counts?.totalJourneys || 0)
  const sourceTotal = Number(summary?.sourceBreakdown?.[frontendSourceKey]?.total || 0)
  const frontendRatio = journeyCurrent > 0 ? sourceTotal / journeyCurrent : 0
  const frontendPass = minFrontendSourceRatio <= 0 || frontendRatio >= minFrontendSourceRatio
  return {
    nonAiSamples: {
      current: nonAiCurrent,
      minimum: minNonAiSamples,
      pass: nonAiCurrent >= minNonAiSamples
    },
    journeySamples: {
      current: journeyCurrent,
      minimum: minJourneySamples,
      pass: journeyCurrent >= minJourneySamples
    },
    frontendSourceRatio: {
      sourceKey: frontendSourceKey,
      sourceTotal,
      totalJourneys: journeyCurrent,
      current: frontendRatio,
      minimum: minFrontendSourceRatio,
      pass: frontendPass
    }
  }
}

const buildFailedRules = (
  summary: SloSummaryPayload | null,
  sampleChecks: ReturnType<typeof buildSampleChecks>
) => {
  if (!summary) {
    return [{ key: 'summary', message: 'SLO 摘要不可用' }]
  }

  const objectiveRules: Array<{
    flagKey: SloPassFlagKey
    currentKey: SloCurrentKey
    sampleGuard: 'nonAiSamples' | 'journeySamples'
    message: string
  }> = [
    {
      flagKey: 'primaryFlowSuccessRate',
      currentKey: 'primaryFlowSuccessRate',
      sampleGuard: 'journeySamples',
      message: '主链路成功率未达标'
    },
    {
      flagKey: 'nonAiApiP95Ms',
      currentKey: 'nonAiApiP95Ms',
      sampleGuard: 'nonAiSamples',
      message: '非 AI API P95 未达标'
    },
    {
      flagKey: 'firstSuccessAvgSteps',
      currentKey: 'firstSuccessAvgSteps',
      sampleGuard: 'journeySamples',
      message: '首次成功平均步数未达标'
    }
  ]

  const failed: Array<{ key: string; message: string }> = []

  for (const rule of objectiveRules) {
    if (!sampleChecks[rule.sampleGuard].pass) continue
    if (summary.current[rule.currentKey] === null) continue
    if (summary.passFlags[rule.flagKey]) continue
    failed.push({
      key: rule.flagKey,
      message: rule.message
    })
  }

  if (!sampleChecks.nonAiSamples.pass) {
    failed.push({
      key: 'samples.nonAi',
      message: `非 AI 样本不足（${sampleChecks.nonAiSamples.current}/${sampleChecks.nonAiSamples.minimum}）`
    })
  }

  if (!sampleChecks.journeySamples.pass) {
    failed.push({
      key: 'samples.journey',
      message: `旅程样本不足（${sampleChecks.journeySamples.current}/${sampleChecks.journeySamples.minimum}）`
    })
  }

  if (!sampleChecks.frontendSourceRatio.pass) {
    failed.push({
      key: 'samples.frontendSourceRatio',
      message: `来源占比不足（${sampleChecks.frontendSourceRatio.sourceKey}=${formatRatio(sampleChecks.frontendSourceRatio.current)}，阈值>=${formatRatio(sampleChecks.frontendSourceRatio.minimum)}，样本=${sampleChecks.frontendSourceRatio.sourceTotal}/${sampleChecks.frontendSourceRatio.totalJourneys}）`
    })
  }

  return failed
}

const buildRecommendations = (params: {
  errors: string[]
  fetchErrorKinds: Array<Extract<GateErrorKind, 'unreachable' | 'auth' | 'http'>>
  failedRules: Array<{ key: string; message: string }>
  sampleChecks: ReturnType<typeof buildSampleChecks>
  summary: SloSummaryPayload | null
  journeyFailures: JourneyFailuresPayload | null
}) => {
  const rec = new Set<string>()

  if (params.errors.length) {
    if (params.fetchErrorKinds.includes('auth')) {
      rec.add('SLO 鉴权失败：检查 ADMIN_TOKEN 与 SLO_GATE_ADMIN_TOKEN 是否正确且与服务端一致。')
    }
    if (params.fetchErrorKinds.includes('unreachable')) {
      rec.add('SLO API 不可达：确认后端已启动，并检查 SLO_GATE_API_BASE/API_BASE_URL 地址。')
    }
    if (params.fetchErrorKinds.includes('http')) {
      rec.add(
        'SLO API 返回异常状态：检查 /api/admin/slo/summary 与 /api/admin/slo/breakdown 响应。'
      )
    }
  }

  if (!params.sampleChecks.nonAiSamples.pass) {
    rec.add('增加非 AI 请求样本，或下调 SLO_GATE_MIN_NON_AI_SAMPLES 阈值。')
  }

  if (!params.sampleChecks.journeySamples.pass) {
    rec.add('补充 first_success_path 旅程上报，或下调 SLO_GATE_MIN_JOURNEY_SAMPLES 阈值。')
  }

  if (!params.sampleChecks.frontendSourceRatio.pass) {
    rec.add(
      `提高来源 ${params.sampleChecks.frontendSourceRatio.sourceKey} 的样本占比，或下调 SLO_GATE_MIN_FRONTEND_SOURCE_RATIO 阈值。`
    )
    if (params.sampleChecks.frontendSourceRatio.sourceTotal === 0) {
      rec.add(
        `来源 ${params.sampleChecks.frontendSourceRatio.sourceKey} 当前无样本，请检查 summary.sourceBreakdown 是否包含该来源键。`
      )
    }
  }

  if (
    params.summary?.current?.primaryFlowSuccessRate === null &&
    params.sampleChecks.journeySamples.minimum === 0
  ) {
    rec.add('当前无旅程样本，建议设置 SLO_GATE_MIN_JOURNEY_SAMPLES 并接入持续旅程埋点。')
  }

  if (
    params.summary?.current?.nonAiApiP95Ms === null &&
    params.sampleChecks.nonAiSamples.minimum === 0
  ) {
    rec.add('当前无非 AI 请求样本，建议设置 SLO_GATE_MIN_NON_AI_SAMPLES 并补充稳定请求流量。')
  }

  if ((params.journeyFailures?.items || []).length > 0) {
    const topFailures = params
      .journeyFailures!.items.slice(0, 3)
      .map(
        (item) => `${item.failedStage}/${item.errorKind}/${item.httpStatus ?? 'null'}:${item.count}`
      )
      .join(' | ')
    rec.add(`失败旅程 Top 模式：${topFailures}，建议优先修复首位失败模式。`)
  }

  if (!params.failedRules.length && !params.errors.length) {
    rec.add('SLO 门禁通过，建议定期提升样本阈值并持续观察趋势。')
  }

  return Array.from(rec)
}

const resolveErrorKind = (params: {
  fetchErrorKinds: Array<Extract<GateErrorKind, 'unreachable' | 'auth' | 'http'>>
  failedRules: Array<{ key: string; message: string }>
}) => {
  if (params.fetchErrorKinds.includes('auth')) return 'auth' as const
  if (params.fetchErrorKinds.includes('unreachable')) return 'unreachable' as const
  if (params.fetchErrorKinds.includes('http')) return 'http' as const
  if (params.failedRules.some((item) => item.key.startsWith('samples.')))
    return 'sample_insufficient' as const
  if (params.failedRules.length > 0) return 'objective_failed' as const
  return 'none' as const
}

const resolveDecisionSourceLabel = (errorKind: GateErrorKind) => {
  if (errorKind === 'sample_insufficient') return '样本不足'
  if (errorKind === 'objective_failed') return '目标未达标'
  if (errorKind === 'none') return '已达标'
  return `接口异常(${errorKind})`
}

const run = async () => {
  const errors: string[] = []
  const diagnostics: SloGateReport['diagnostics'] = []
  const fetchErrorKinds: Array<Extract<GateErrorKind, 'unreachable' | 'auth' | 'http'>> = []
  let summary: SloSummaryPayload | null = null
  let breakdown: SloGateReport['breakdown'] = null
  let journeyFailures: JourneyFailuresPayload | null = null

  try {
    const summaryPayload = await requestJson<{ success?: boolean; summary?: SloSummaryPayload }>(
      `${apiBase}/api/admin/slo/summary?windowMinutes=${windowMinutes}`
    )
    summary = summaryPayload.summary || null
  } catch (error: any) {
    const kind = classifyRequestError(error)
    const message = error?.message || String(error)
    fetchErrorKinds.push(kind)
    errors.push(`summary: ${message}`)
    diagnostics.push({
      level: 'error',
      kind,
      target: 'summary',
      message
    })
  }

  try {
    const journeyPayload = await requestJson<{
      success?: boolean
      window?: JourneyFailuresPayload['window']
      counts?: JourneyFailuresPayload['counts']
      items?: JourneyFailureItem[]
      updatedAt?: string
    }>(`${apiBase}/api/admin/slo/journey-failures?windowMinutes=${windowMinutes}&limit=${limit}`)
    journeyFailures = {
      window: journeyPayload.window || {
        minutes: windowMinutes,
        from: '',
        to: ''
      },
      counts: {
        totalFailJourneys: Number(journeyPayload.counts?.totalFailJourneys || 0)
      },
      items: Array.isArray(journeyPayload.items) ? journeyPayload.items : [],
      updatedAt: String(journeyPayload.updatedAt || new Date().toISOString())
    }
  } catch (error: any) {
    const kind = classifyRequestError(error)
    const message = error?.message || String(error)
    diagnostics.push({
      level: 'warn',
      kind,
      target: 'journey_failures',
      message
    })
  }

  try {
    const breakdownPayload = await requestJson<{
      success?: boolean
      breakdown?: { totalRequests?: number; totalRoutes?: number; items?: SloBreakdownItem[] }
    }>(
      `${apiBase}/api/admin/slo/breakdown?windowMinutes=${windowMinutes}&category=${category}&limit=${limit}`
    )

    const raw = breakdownPayload.breakdown
    if (raw) {
      breakdown = {
        totalRequests: Number(raw.totalRequests || 0),
        totalRoutes: Number(raw.totalRoutes || 0),
        items: Array.isArray(raw.items) ? raw.items : []
      }
    }
  } catch (error: any) {
    const kind = classifyRequestError(error)
    const message = error?.message || String(error)
    fetchErrorKinds.push(kind)
    errors.push(`breakdown: ${message}`)
    diagnostics.push({
      level: 'error',
      kind,
      target: 'breakdown',
      message
    })
  }

  const sampleChecks = buildSampleChecks(summary)
  const failedRules = buildFailedRules(summary, sampleChecks)
  failedRules.forEach((item) => {
    diagnostics.push({
      level: 'warn',
      kind: item.key.startsWith('samples.') ? 'sample_insufficient' : 'objective_failed',
      target: 'gate',
      message: `${item.key}: ${item.message}`
    })
  })
  const recommendations = buildRecommendations({
    errors,
    fetchErrorKinds,
    failedRules,
    sampleChecks,
    summary,
    journeyFailures
  })
  const hasUnavailableSummary = errors.length > 0 && !summary
  const status: GateStatus = hasUnavailableSummary
    ? mode === 'hard'
      ? 'fail'
      : 'unavailable'
    : failedRules.length > 0
      ? mode === 'hard'
        ? 'fail'
        : 'warn'
      : 'pass'
  const errorKind = resolveErrorKind({ fetchErrorKinds, failedRules })

  if (!diagnostics.length) {
    diagnostics.push({
      level: 'info',
      kind: 'none',
      target: 'gate',
      message: 'SLO 门禁通过'
    })
  }

  const report: SloGateReport = {
    schemaVersion,
    status,
    errorKind,
    generatedAt: new Date().toISOString(),
    mode,
    enforce,
    apiBase,
    windowMinutes,
    category,
    limit,
    minNonAiSamples,
    minJourneySamples,
    minFrontendSourceRatio,
    frontendSourceKey,
    outputPath,
    errors,
    diagnostics,
    failedRules,
    sampleChecks,
    recommendations,
    summary,
    breakdown,
    journeyFailures
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  console.log(`[slo-gate] status=${report.status} mode=${mode}`)
  console.log(
    `[slo-gate] samples: journey=${sampleChecks.journeySamples.current}/${sampleChecks.journeySamples.minimum}, non_ai=${sampleChecks.nonAiSamples.current}/${sampleChecks.nonAiSamples.minimum}, source(${sampleChecks.frontendSourceRatio.sourceKey})=${sampleChecks.frontendSourceRatio.sourceTotal}/${sampleChecks.frontendSourceRatio.totalJourneys}(${formatRatio(sampleChecks.frontendSourceRatio.current)})>=${formatRatio(sampleChecks.frontendSourceRatio.minimum)}`
  )
  console.log(`[slo-gate] decision-source=${resolveDecisionSourceLabel(errorKind)}`)
  console.log(`[slo-gate] report=${outputPath}`)
  if (errors.length) {
    errors.forEach((item) => console.warn(`[slo-gate] warning: ${item}`))
  }
  if (failedRules.length) {
    failedRules.forEach((item) => console.warn(`[slo-gate] unmet: ${item.key} -> ${item.message}`))
  }

  if (report.recommendations.length) {
    report.recommendations.forEach((item) => console.log(`[slo-gate] recommendation: ${item}`))
  }

  if (report.status === 'fail') {
    process.exit(1)
  }
}

run().catch((error: any) => {
  console.error(`[slo-gate] failed: ${error?.message || String(error)}`)
  process.exit(1)
})
