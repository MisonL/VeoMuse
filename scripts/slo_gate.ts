import fs from 'fs/promises'
import path from 'path'

type GateStatus = 'pass' | 'warn' | 'fail' | 'unavailable'
type SloCategory = 'ai' | 'non_ai' | 'system'
type SloPassFlagKey = 'primaryFlowSuccessRate' | 'nonAiApiP95Ms' | 'firstSuccessAvgSteps'

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
  status: GateStatus
  generatedAt: string
  enforce: boolean
  apiBase: string
  windowMinutes: number
  category: SloCategory
  limit: number
  outputPath: string
  errors: string[]
  failedRules: Array<{ key: string; message: string }>
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

const parseBoolean = (value: string | undefined) => {
  if (!value) return false
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

const args = new Set(process.argv.slice(2))

const parseArgValue = (flag: string) => {
  const raw = process.argv.slice(2)
  const index = raw.findIndex(item => item === flag)
  if (index < 0) return ''
  return String(raw[index + 1] || '').trim()
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

const enforce = args.has('--enforce') || parseBoolean(process.env.SLO_GATE_ENFORCE)
const apiBase = resolveApiBase()
const windowMinutes = parsePositiveInt(parseArgValue('--window') || process.env.SLO_GATE_WINDOW_MINUTES, 1440)
const category = resolveCategory()
const limit = Math.min(100, parsePositiveInt(parseArgValue('--limit') || process.env.SLO_GATE_LIMIT, 8))
const timeoutMs = parsePositiveInt(process.env.SLO_GATE_TIMEOUT_MS, 10_000)
const adminToken = (process.env.SLO_GATE_ADMIN_TOKEN || process.env.ADMIN_TOKEN || '').trim()
const outputPath = resolveOutputPath()

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

const buildFailedRules = (summary: SloSummaryPayload | null) => {
  if (!summary) {
    return [{ key: 'summary', message: 'SLO 摘要不可用' }]
  }

  const messages: Record<SloPassFlagKey, string> = {
    primaryFlowSuccessRate: '主链路成功率未达标',
    nonAiApiP95Ms: '非 AI API P95 未达标',
    firstSuccessAvgSteps: '首次成功平均步数未达标'
  }

  const failed = Object.entries(summary.passFlags)
    .filter(([, pass]) => !pass)
    .map(([key]) => ({
      key,
      message: messages[key as SloPassFlagKey] || `${key} 未达标`
    }))

  return failed
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

  const failedRules = buildFailedRules(summary)
  const hasUnreachable = errors.length > 0 && !summary
  const status: GateStatus = hasUnreachable
    ? (enforce ? 'fail' : 'unavailable')
    : failedRules.length > 0
      ? (enforce ? 'fail' : 'warn')
      : 'pass'

  const report: SloGateReport = {
    status,
    generatedAt: new Date().toISOString(),
    enforce,
    apiBase,
    windowMinutes,
    category,
    limit,
    outputPath,
    errors,
    failedRules,
    summary,
    breakdown
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  console.log(`[slo-gate] status=${report.status} enforce=${enforce ? 'true' : 'false'}`)
  console.log(`[slo-gate] report=${outputPath}`)
  if (errors.length) {
    errors.forEach(item => console.warn(`[slo-gate] warning: ${item}`))
  }
  if (failedRules.length) {
    failedRules.forEach(item => console.warn(`[slo-gate] unmet: ${item.key} -> ${item.message}`))
  }

  if (status === 'fail') {
    process.exit(1)
  }
}

run().catch((error: any) => {
  console.error(`[slo-gate] failed: ${error?.message || String(error)}`)
  process.exit(1)
})
