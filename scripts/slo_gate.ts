import fs from 'fs/promises'
import path from 'path'

type GateStatus = 'pass' | 'warn' | 'fail' | 'unavailable'
type GateMode = 'soft' | 'hard'
type SloCategory = 'ai' | 'non_ai' | 'system'
type SloPassFlagKey = 'primaryFlowSuccessRate' | 'nonAiApiP95Ms' | 'firstSuccessAvgSteps'
type SloCurrentKey = 'primaryFlowSuccessRate' | 'nonAiApiP95Ms' | 'firstSuccessAvgSteps'

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

interface SloGateReport {
  schemaVersion: string
  status: GateStatus
  generatedAt: string
  mode: GateMode
  enforce: boolean
  apiBase: string
  windowMinutes: number
  category: SloCategory
  limit: number
  minNonAiSamples: number
  minJourneySamples: number
  outputPath: string
  errors: string[]
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
  }
  recommendations: string[]
  summary: SloSummaryPayload | null
  breakdown: {
    totalRequests: number
    totalRoutes: number
    items: SloBreakdownItem[]
  } | null
}

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const parseNonNegativeInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(String(value || ''), 10)
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
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'hard' || normalized === 'soft') return normalized
  return null
}

const resolveApiBase = () => {
  const raw = parseArgValue('--api-base') || process.env.API_BASE_URL || 'http://127.0.0.1:18081'
  return raw.trim().replace(/\/+$/, '')
}

const resolveCategory = (): SloCategory => {
  const raw = (parseArgValue('--category') || process.env.SLO_GATE_CATEGORY || 'non_ai').trim().toLowerCase()
  if (raw === 'ai' || raw === 'system') return raw
  return 'non_ai'
}

const resolveOutputPath = () => {
  const raw = parseArgValue('--output') || process.env.SLO_GATE_OUTPUT || 'artifacts/slo-report.json'
  return path.resolve(process.cwd(), raw)
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
const windowMinutes = parsePositiveInt(parseArgValue('--window') || process.env.SLO_GATE_WINDOW_MINUTES, 1440)
const category = resolveCategory()
const limit = Math.min(100, parsePositiveInt(parseArgValue('--limit') || process.env.SLO_GATE_LIMIT, 8))
const minNonAiSamples = parseNonNegativeInt(
  parseArgValue('--min-non-ai-samples') || process.env.SLO_GATE_MIN_NON_AI_SAMPLES,
  0
)
const minJourneySamples = parseNonNegativeInt(
  parseArgValue('--min-journey-samples') || process.env.SLO_GATE_MIN_JOURNEY_SAMPLES,
  0
)
const timeoutMs = parsePositiveInt(process.env.SLO_GATE_TIMEOUT_MS, 10_000)
const adminToken = (process.env.SLO_GATE_ADMIN_TOKEN || process.env.ADMIN_TOKEN || '').trim()
const outputPath = resolveOutputPath()
const schemaVersion = (
  parseArgValue('--schema-version')
  || process.env.SLO_GATE_REPORT_SCHEMA_VERSION
  || '1.0'
).trim() || '1.0'

const requestJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, {
    method: 'GET',
    headers: adminToken ? { 'x-admin-token': adminToken } : {},
    signal: AbortSignal.timeout(timeoutMs)
  })
  const payload = await response.json().catch(() => null) as any
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || `HTTP ${response.status}`)
  }
  return payload as T
}

const buildSampleChecks = (summary: SloSummaryPayload | null) => {
  const nonAiCurrent = Number(summary?.counts?.nonAiSamples || 0)
  const journeyCurrent = Number(summary?.counts?.totalJourneys || 0)
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

  return failed
}

const buildRecommendations = (params: {
  errors: string[]
  failedRules: Array<{ key: string; message: string }>
  sampleChecks: ReturnType<typeof buildSampleChecks>
  summary: SloSummaryPayload | null
}) => {
  const rec = new Set<string>()

  if (params.errors.length) {
    rec.add('确认 SLO API 可访问，并检查 ADMIN_TOKEN/SLO_GATE_ADMIN_TOKEN 是否匹配。')
  }

  if (!params.sampleChecks.nonAiSamples.pass) {
    rec.add('增加非 AI 请求样本，或下调 SLO_GATE_MIN_NON_AI_SAMPLES 阈值。')
  }

  if (!params.sampleChecks.journeySamples.pass) {
    rec.add('补充 first_success_path 旅程上报，或下调 SLO_GATE_MIN_JOURNEY_SAMPLES 阈值。')
  }

  if (params.summary?.current?.primaryFlowSuccessRate === null && params.sampleChecks.journeySamples.minimum === 0) {
    rec.add('当前无旅程样本，建议设置 SLO_GATE_MIN_JOURNEY_SAMPLES 并接入持续旅程埋点。')
  }

  if (params.summary?.current?.nonAiApiP95Ms === null && params.sampleChecks.nonAiSamples.minimum === 0) {
    rec.add('当前无非 AI 请求样本，建议设置 SLO_GATE_MIN_NON_AI_SAMPLES 并补充稳定请求流量。')
  }

  if (!params.failedRules.length && !params.errors.length) {
    rec.add('SLO 门禁通过，建议定期提升样本阈值并持续观察趋势。')
  }

  return Array.from(rec)
}

const run = async () => {
  const errors: string[] = []
  let summary: SloSummaryPayload | null = null
  let breakdown: SloGateReport['breakdown'] = null

  try {
    const summaryPayload = await requestJson<{ success?: boolean; summary?: SloSummaryPayload }>(
      `${apiBase}/api/admin/slo/summary?windowMinutes=${windowMinutes}`
    )
    summary = summaryPayload.summary || null
  } catch (error: any) {
    errors.push(`summary: ${error?.message || String(error)}`)
  }

  try {
    const breakdownPayload = await requestJson<{
      success?: boolean
      breakdown?: { totalRequests?: number; totalRoutes?: number; items?: SloBreakdownItem[] }
    }>(`${apiBase}/api/admin/slo/breakdown?windowMinutes=${windowMinutes}&category=${category}&limit=${limit}`)

    const raw = breakdownPayload.breakdown
    if (raw) {
      breakdown = {
        totalRequests: Number(raw.totalRequests || 0),
        totalRoutes: Number(raw.totalRoutes || 0),
        items: Array.isArray(raw.items) ? raw.items : []
      }
    }
  } catch (error: any) {
    errors.push(`breakdown: ${error?.message || String(error)}`)
  }

  const sampleChecks = buildSampleChecks(summary)
  const failedRules = buildFailedRules(summary, sampleChecks)
  const recommendations = buildRecommendations({
    errors,
    failedRules,
    sampleChecks,
    summary
  })
  const hasUnreachable = errors.length > 0 && !summary
  const status: GateStatus = hasUnreachable
    ? (mode === 'hard' ? 'fail' : 'unavailable')
    : failedRules.length > 0
      ? (mode === 'hard' ? 'fail' : 'warn')
      : 'pass'

  const report: SloGateReport = {
    schemaVersion,
    status,
    generatedAt: new Date().toISOString(),
    mode,
    enforce,
    apiBase,
    windowMinutes,
    category,
    limit,
    minNonAiSamples,
    minJourneySamples,
    outputPath,
    errors,
    failedRules,
    sampleChecks,
    recommendations,
    summary,
    breakdown
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  console.log(`[slo-gate] status=${report.status} mode=${mode}`)
  console.log(`[slo-gate] report=${outputPath}`)
  if (errors.length) {
    errors.forEach(item => console.warn(`[slo-gate] warning: ${item}`))
  }
  if (failedRules.length) {
    failedRules.forEach(item => console.warn(`[slo-gate] unmet: ${item.key} -> ${item.message}`))
  }

  if (report.recommendations.length) {
    report.recommendations.forEach(item => console.log(`[slo-gate] recommendation: ${item}`))
  }

  if (report.status === 'fail') {
    process.exit(1)
  }
}

run().catch((error: any) => {
  console.error(`[slo-gate] failed: ${error?.message || String(error)}`)
  process.exit(1)
})
