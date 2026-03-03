import { normalizeProjectGovernanceLimit } from './comparison-lab/types'
import type { ProjectGovernanceComment } from './comparison-lab/types'

export type RepairRange = '24h' | '7d' | '30d' | 'all'
export type RepairStatusFilter = 'all' | 'ok' | 'repaired' | 'failed'
type SloPassFlagKey = 'primaryFlowSuccessRate' | 'nonAiApiP95Ms' | 'firstSuccessAvgSteps'
export type SloDecisionStatus = 'sample_insufficient' | 'target_missed' | 'pass'

export interface SloSummary {
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

export interface SloBreakdownItem {
  routeKey: string
  method: string
  count: number
  successRate: number
  avgMs: number
  p95Ms: number
  p99Ms: number
  lastSeenAt: string
}

export interface SloJourneyFailureItem {
  failedStage: string
  errorKind: string
  httpStatus: number | null
  count: number
  share: number
  latestAt: string
}

export interface ProviderHealthItem {
  providerId: string
  label: string
  category: 'model' | 'service'
  configured: boolean
  status: 'ok' | 'degraded' | 'not_implemented'
  baseUrl: string | null
  checkedAt: string
  latencyMs: number | null
  statusCode: number | null
  traceId: string | null
  errorCode: string | null
  error: string | null
}

export interface ClipBatchOperation {
  clipId: string
  patch: Record<string, unknown>
}

export const SLO_MIN_NON_AI_SAMPLES = 20
export const SLO_MIN_JOURNEY_SAMPLES = 10

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

const toFiniteNumber = (value: unknown): number | null => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

const toNumberOrDefault = (value: unknown, fallback: number) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

const normalizeSuccessRate = (value: unknown) => {
  const numeric = toFiniteNumber(value)
  if (numeric === null) return null
  if (numeric < 0) return 0
  if (numeric > 1) return 1
  return numeric
}

const normalizeIsoString = (value: unknown) => (typeof value === 'string' ? value : '')

const normalizeRangeFromMs = (range: RepairRange, nowMs: number) => {
  if (range === '24h') return nowMs - 24 * 60 * 60 * 1000
  if (range === '7d') return nowMs - 7 * 24 * 60 * 60 * 1000
  if (range === '30d') return nowMs - 30 * 24 * 60 * 60 * 1000
  return null
}

export const parseMentions = (raw: string) =>
  Array.from(
    new Set(
      raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )

export const parseJsonObject = (raw: string, fieldName: string) => {
  const text = raw.trim()
  if (!text) return {} as Record<string, unknown>
  try {
    const parsed = JSON.parse(text) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${fieldName} 必须是 JSON 对象`)
    }
    return parsed as Record<string, unknown>
  } catch (error: any) {
    throw new Error(error?.message || `${fieldName} JSON 解析失败`)
  }
}

export const parseJsonArray = (raw: string, fieldName: string) => {
  const text = raw.trim()
  if (!text) return [] as unknown[]
  try {
    const parsed = JSON.parse(text) as unknown
    if (!Array.isArray(parsed)) {
      throw new Error(`${fieldName} 必须是 JSON 数组`)
    }
    return parsed
  } catch (error: any) {
    throw new Error(error?.message || `${fieldName} JSON 解析失败`)
  }
}

export const normalizeClipBatchOperations = (rows: unknown[]) =>
  rows
    .map((item) => {
      const row = asRecord(item)
      if (!row) return null
      const clipId = typeof row.clipId === 'string' ? row.clipId.trim() : ''
      const patch = asRecord(row.patch)
      if (!clipId || !patch) return null
      return { clipId, patch }
    })
    .filter((item): item is ClipBatchOperation => Boolean(item))

export const buildRepairQueryParams = (input: {
  offset: number
  range: RepairRange
  status: RepairStatusFilter
  reason: string
  pageSize?: number
  nowMs?: number
}) => {
  const pageSize = Math.max(1, Math.trunc(input.pageSize ?? 20))
  const nowMs = Number.isFinite(input.nowMs) ? Number(input.nowMs) : Date.now()
  const fromMs = normalizeRangeFromMs(input.range, nowMs)
  const query = new URLSearchParams({
    limit: String(pageSize),
    offset: String(Math.max(0, Math.trunc(input.offset)))
  })
  if (fromMs !== null) query.set('from', new Date(fromMs).toISOString())
  if (input.status !== 'all') query.set('status', input.status)
  if (input.reason.trim()) query.set('reason', input.reason.trim())
  return query
}

export const normalizeRepairHistoryPage = <TRow = any>(input: {
  payload: unknown
  prevRows: TRow[]
  append: boolean
  pageSize: number
}) => {
  const payloadRecord = asRecord(input.payload) || {}
  const repairsRaw = Array.isArray(payloadRecord.repairs) ? (payloadRecord.repairs as TRow[]) : []
  const rows = input.append ? [...input.prevRows, ...repairsRaw] : repairsRaw
  const page = asRecord(payloadRecord.page) || {}
  const totalCandidate = toFiniteNumber(page.total)
  const total = totalCandidate ?? (input.append ? null : rows.length)
  const hasMore =
    typeof page.hasMore === 'boolean' ? page.hasMore : repairsRaw.length === input.pageSize
  return { rows, total, hasMore }
}

export const buildGovernanceCommentListArgs = (input: {
  append: boolean
  cursor: string
  limitInput: string
  defaultLimit?: number
}) => {
  const limit = normalizeProjectGovernanceLimit(input.limitInput, input.defaultLimit ?? 20)
  const cursor = input.append ? input.cursor.trim() : ''
  const shouldStop = input.append && !cursor
  return { limit, cursor: cursor || undefined, shouldStop }
}

export const mergeUniqueComments = (
  prev: ProjectGovernanceComment[],
  incoming: ProjectGovernanceComment[],
  append: boolean
) => {
  if (!append) return incoming
  const deduped = [...prev]
  const seen = new Set(prev.map((item) => item.id))
  incoming.forEach((item) => {
    if (seen.has(item.id)) return
    seen.add(item.id)
    deduped.push(item)
  })
  return deduped
}

export const resolveSelectedCommentId = (
  currentId: string,
  comments: ProjectGovernanceComment[]
) => {
  if (currentId && comments.some((item) => item.id === currentId)) return currentId
  return comments[0]?.id || ''
}

export const computePollBackoff = (input: {
  healthOk: boolean
  runtimeOk: boolean
  sloOk: boolean
  failureStreak: number
  maxStreak?: number
  baseDelayMs?: number
  maxDelayMs?: number
}) => {
  const hasFailure = !input.healthOk || !input.runtimeOk || !input.sloOk
  const maxStreak = Math.max(0, Math.trunc(input.maxStreak ?? 5))
  const baseDelayMs = Math.max(1, Math.trunc(input.baseDelayMs ?? 5000))
  const maxDelayMs = Math.max(baseDelayMs, Math.trunc(input.maxDelayMs ?? 60000))
  const nextFailureStreak = hasFailure
    ? Math.min(maxStreak, Math.max(0, Math.trunc(input.failureStreak)) + 1)
    : 0
  const nextDelayMs = Math.min(maxDelayMs, baseDelayMs * 2 ** nextFailureStreak)
  return { nextFailureStreak, nextDelayMs }
}

export const normalizeJourneyFailCount = (value: unknown) => {
  const numeric = toFiniteNumber(value)
  if (numeric === null || numeric < 0) return 0
  return Math.trunc(numeric)
}

export const parseGovernanceReviewScore = (raw: string) => {
  const text = raw.trim()
  if (!text) return { score: undefined as number | undefined, error: null as string | null }
  if (!/^-?\d+(\.\d+)?$/.test(text)) {
    return { score: undefined as number | undefined, error: '评分必须为数字' }
  }
  const score = Number(text)
  if (!Number.isFinite(score)) {
    return { score: undefined as number | undefined, error: '评分必须为数字' }
  }
  return { score, error: null as string | null }
}

export const formatApiSuccessRate = (stats: unknown) => {
  const row = asRecord(stats)
  const count = row ? toFiniteNumber(row.count) : null
  const success = row ? toFiniteNumber(row.success) : null
  if (count === null || count <= 0 || success === null) return '--'
  return `${Math.round((success / count) * 100)}%`
}

export const formatApiAverageMs = (stats: unknown) => {
  const row = asRecord(stats)
  const count = row ? toFiniteNumber(row.count) : null
  const totalMs = row ? toFiniteNumber(row.totalMs) : null
  if (count === null || count <= 0 || totalMs === null) return '--'
  return `${Math.round(totalMs / count)}ms`
}

export const resolveMetricsOverview = (metrics: unknown) => {
  const root = asRecord(metrics) || {}
  const system = asRecord(root.system) || {}
  const memory = asRecord(system.memory) || {}
  const usage = toFiniteNumber(memory.usage)
  const loadRaw = Array.isArray(system.load) ? system.load : []
  const load = toFiniteNumber(loadRaw[0])
  const apiSource = asRecord(root.api) || {}
  return {
    memoryUsageText: usage === null ? '--' : `${(usage * 100).toFixed(1)}%`,
    systemLoadText: load === null ? '--' : load.toFixed(2),
    apiEntries: Object.entries(apiSource)
  }
}

export const normalizeSloSummary = (summary: unknown): SloSummary | null => {
  const root = asRecord(summary)
  if (!root) return null
  const targetsRaw = asRecord(root.targets)
  const currentRaw = asRecord(root.current)
  const passFlagsRaw = asRecord(root.passFlags)
  const countsRaw = asRecord(root.counts)
  if (!targetsRaw || !currentRaw || !passFlagsRaw || !countsRaw) return null

  return {
    targets: {
      primaryFlowSuccessRate: normalizeSuccessRate(targetsRaw.primaryFlowSuccessRate) ?? 0,
      nonAiApiP95Ms: toNumberOrDefault(targetsRaw.nonAiApiP95Ms, 0),
      firstSuccessAvgSteps: toNumberOrDefault(targetsRaw.firstSuccessAvgSteps, 0)
    },
    current: {
      primaryFlowSuccessRate: normalizeSuccessRate(currentRaw.primaryFlowSuccessRate),
      nonAiApiP95Ms: toFiniteNumber(currentRaw.nonAiApiP95Ms),
      firstSuccessAvgSteps: toFiniteNumber(currentRaw.firstSuccessAvgSteps)
    },
    passFlags: {
      primaryFlowSuccessRate: Boolean(passFlagsRaw.primaryFlowSuccessRate),
      nonAiApiP95Ms: Boolean(passFlagsRaw.nonAiApiP95Ms),
      firstSuccessAvgSteps: Boolean(passFlagsRaw.firstSuccessAvgSteps)
    },
    window: {
      minutes: Math.max(0, Math.trunc(toNumberOrDefault(asRecord(root.window)?.minutes, 0))),
      from: normalizeIsoString(asRecord(root.window)?.from),
      to: normalizeIsoString(asRecord(root.window)?.to)
    },
    counts: {
      totalJourneys: Math.max(0, Math.trunc(toNumberOrDefault(countsRaw.totalJourneys, 0))),
      successJourneys: Math.max(0, Math.trunc(toNumberOrDefault(countsRaw.successJourneys, 0))),
      nonAiSamples: Math.max(0, Math.trunc(toNumberOrDefault(countsRaw.nonAiSamples, 0)))
    },
    sourceBreakdown: asRecord(root.sourceBreakdown) as Record<
      string,
      { total: number; success: number }
    >,
    updatedAt: normalizeIsoString(root.updatedAt)
  }
}

export const mapSloDecisionStatusToText = (status: SloDecisionStatus) => {
  if (status === 'sample_insufficient') return '样本不足'
  if (status === 'target_missed') return '目标未达标'
  return '已达标'
}

export const resolveSloDecision = (summary: SloSummary) => {
  const nonAiSamples = Number(summary.counts.nonAiSamples || 0)
  const journeySamples = Number(summary.counts.totalJourneys || 0)
  const sampleSufficient =
    nonAiSamples >= SLO_MIN_NON_AI_SAMPLES && journeySamples >= SLO_MIN_JOURNEY_SAMPLES
  const targetsPass =
    summary.passFlags.primaryFlowSuccessRate &&
    summary.passFlags.nonAiApiP95Ms &&
    summary.passFlags.firstSuccessAvgSteps

  const status: SloDecisionStatus = !sampleSufficient
    ? 'sample_insufficient'
    : targetsPass
      ? 'pass'
      : 'target_missed'

  return {
    nonAiSamples,
    journeySamples,
    status,
    reasonText: mapSloDecisionStatusToText(status)
  }
}
