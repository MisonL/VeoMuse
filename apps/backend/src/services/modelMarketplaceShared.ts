import type {
  ModelProfile,
  ModelRoutingPriority,
  ModelRuntimeMetrics,
  RoutingDecision,
  RoutingExecution,
  RoutingPolicy,
  RoutingWeightConfig
} from '@veomuse/shared'

export interface SimulatePayload {
  prompt: string
  budgetUsd?: number
  priority?: ModelRoutingPriority
}

export interface PolicyMutationPayload {
  name?: string
  description?: string
  priority?: ModelRoutingPriority
  maxBudgetUsd?: number
  enabled?: boolean
  allowedModels?: string[]
  weights?: Partial<RoutingWeightConfig>
  fallbackPolicyId?: string | null
}

export interface PolicyExecutionQuery {
  limit?: number
  offset?: number
}

export interface ScoreBreakdownRow {
  modelId: string
  quality: number
  speed: number
  cost: number
  reliability: number
  finalScore: number
}

export interface ScoredCandidate {
  modelId: string
  score: number
  estimatedCostUsd: number
  estimatedLatencyMs: number
}

export interface EvaluatePolicyResult {
  decision: RoutingDecision
  scoreBreakdown: ScoreBreakdownRow[]
  scoredCandidates: ScoredCandidate[]
  hasBudgetMiss: boolean
  budgetUsd: number
}

export interface PolicyAlertConfig {
  policyId: string
  organizationId: string
  enabled: boolean
  channels: string[]
  warningThresholdRatio: number
  criticalThresholdRatio: number
  createdAt: string
  updatedAt: string
}

export interface PolicyAlertConfigPatch {
  enabled?: boolean
  channels?: string[]
  warningThresholdRatio?: number
  criticalThresholdRatio?: number
}

export interface PolicyAlertEvent {
  id: string
  policyId: string
  organizationId: string
  status: 'warning' | 'critical' | 'degraded'
  message: string
  prompt: string
  recommendedModelId: string
  estimatedCostUsd: number
  budgetUsd: number
  meta: Record<string, unknown>
  createdAt: string
}

export const nowIso = () => new Date().toISOString()

export const DEFAULT_WEIGHTS: Record<ModelRoutingPriority, RoutingWeightConfig> = {
  quality: { quality: 0.52, speed: 0.13, cost: 0.1, reliability: 0.25 },
  speed: { quality: 0.14, speed: 0.55, cost: 0.1, reliability: 0.21 },
  cost: { quality: 0.12, speed: 0.14, cost: 0.55, reliability: 0.19 }
}

export const DEFAULT_PROFILES: ModelProfile[] = [
  {
    id: 'veo-3.1',
    name: 'Google Gemini Veo 3.1',
    provider: 'google',
    capabilities: ['cinematic', 'storytelling', 'dialogue', 'realistic'],
    costPerSecond: 0.11,
    maxDurationSec: 120,
    supports4k: true,
    supportsAudio: true,
    supportsStylization: true,
    region: 'global',
    enabled: true,
    updatedAt: nowIso()
  },
  {
    id: 'kling-v1',
    name: 'Kuaishou Kling V1',
    provider: 'kling',
    capabilities: ['fast-motion', 'anime', 'stylized'],
    costPerSecond: 0.09,
    maxDurationSec: 60,
    supports4k: false,
    supportsAudio: true,
    supportsStylization: true,
    region: 'apac',
    enabled: true,
    updatedAt: nowIso()
  },
  {
    id: 'sora-preview',
    name: 'OpenAI Sora Preview',
    provider: 'openai',
    capabilities: ['cinematic', 'physics', 'world-consistency', 'realistic'],
    costPerSecond: 0.13,
    maxDurationSec: 90,
    supports4k: true,
    supportsAudio: true,
    supportsStylization: true,
    region: 'us',
    enabled: true,
    updatedAt: nowIso()
  },
  {
    id: 'luma-dream',
    name: 'Luma Dream Machine',
    provider: 'luma',
    capabilities: ['fast-iterate', 'camera-move', 'stylized'],
    costPerSecond: 0.08,
    maxDurationSec: 30,
    supports4k: false,
    supportsAudio: false,
    supportsStylization: true,
    region: 'global',
    enabled: true,
    updatedAt: nowIso()
  },
  {
    id: 'runway-gen3',
    name: 'Runway Gen-3 Alpha',
    provider: 'runway',
    capabilities: ['commercial', 'product-shot', 'camera-control', 'realistic'],
    costPerSecond: 0.1,
    maxDurationSec: 40,
    supports4k: true,
    supportsAudio: false,
    supportsStylization: true,
    region: 'us',
    enabled: true,
    updatedAt: nowIso()
  },
  {
    id: 'pika-1.5',
    name: 'Pika Art 1.5',
    provider: 'pika',
    capabilities: ['effects', 'stylized', 'social-short'],
    costPerSecond: 0.07,
    maxDurationSec: 20,
    supports4k: false,
    supportsAudio: false,
    supportsStylization: true,
    region: 'global',
    enabled: true,
    updatedAt: nowIso()
  }
]

export type DbRecord = Record<string, unknown>

export const profileFromRow = (row: DbRecord): ModelProfile => ({
  id: String(row.id || ''),
  name: String(row.name || ''),
  provider: String(row.provider || ''),
  capabilities: (() => {
    try {
      const value = JSON.parse(String(row.capabilities_json || '[]'))
      return Array.isArray(value) ? value.map(String) : []
    } catch {
      return []
    }
  })(),
  costPerSecond: Number(row.cost_per_second || 0),
  maxDurationSec: Number(row.max_duration_sec || 0),
  supports4k: Boolean(row.supports_4k),
  supportsAudio: Boolean(row.supports_audio),
  supportsStylization: Boolean(row.supports_stylization),
  region: String(row.region || 'global'),
  enabled: Boolean(row.enabled),
  updatedAt: String(row.updated_at || nowIso())
})

export const metricsFromRow = (
  row: DbRecord | null | undefined,
  modelId: string
): ModelRuntimeMetrics => ({
  modelId,
  windowMinutes: Number(row?.window_minutes ?? 1440),
  totalRequests: Number(row?.total_requests ?? 0),
  successRate: Number(row?.success_rate ?? 1),
  p95LatencyMs: Number(row?.p95_latency_ms ?? 0),
  avgCostUsd: Number(row?.avg_cost_usd ?? 0),
  updatedAt: String(row?.updated_at ?? nowIso())
})

export const normalizeWeights = (
  priority: ModelRoutingPriority,
  raw?: Partial<RoutingWeightConfig> | null
): RoutingWeightConfig => {
  const merged: RoutingWeightConfig = {
    ...DEFAULT_WEIGHTS[priority],
    ...(raw || {})
  }
  const values = [merged.quality, merged.speed, merged.cost, merged.reliability]
  const valid = values.every((value) => Number.isFinite(value) && value >= 0)
  if (!valid) return { ...DEFAULT_WEIGHTS[priority] }
  const total = values.reduce((accumulator, value) => accumulator + value, 0)
  if (total <= 0) return { ...DEFAULT_WEIGHTS[priority] }
  return {
    quality: Number((merged.quality / total).toFixed(4)),
    speed: Number((merged.speed / total).toFixed(4)),
    cost: Number((merged.cost / total).toFixed(4)),
    reliability: Number((merged.reliability / total).toFixed(4))
  }
}

export const policyFromRow = (row: DbRecord): RoutingPolicy => {
  const priority: ModelRoutingPriority =
    row.priority === 'speed' || row.priority === 'cost'
      ? (row.priority as ModelRoutingPriority)
      : 'quality'
  const rawWeights = (() => {
    try {
      return JSON.parse(String(row.weights_json || '{}'))
    } catch {
      return {}
    }
  })()
  const allowed = (() => {
    try {
      const value = JSON.parse(String(row.allowed_models_json || '[]'))
      return Array.isArray(value) ? value.map(String) : []
    } catch {
      return []
    }
  })()
  return {
    id: String(row.id || ''),
    name: String(row.name || ''),
    description: String(row.description || ''),
    priority,
    maxBudgetUsd: Number(row.max_budget_usd || 0),
    enabled: Boolean(row.enabled ?? 1),
    allowedModels: allowed,
    weights: normalizeWeights(priority, rawWeights),
    fallbackPolicyId: row.fallback_policy_id ? String(row.fallback_policy_id) : null,
    createdAt: String(row.created_at || nowIso()),
    updatedAt: String(row.updated_at || nowIso())
  }
}

export const executionFromRow = (row: DbRecord): RoutingExecution => ({
  id: String(row.id || ''),
  policyId: String(row.policy_id || ''),
  prompt: String(row.prompt || ''),
  priority:
    row.priority === 'speed' || row.priority === 'cost'
      ? (row.priority as ModelRoutingPriority)
      : 'quality',
  recommendedModelId: String(row.recommended_model_id || ''),
  estimatedCostUsd: Number(row.estimated_cost_usd || 0),
  estimatedLatencyMs: Number(row.estimated_latency_ms || 0),
  confidence: Number(row.confidence || 0),
  reason: String(row.reason || ''),
  fallbackUsed: Boolean(row.fallback_used),
  candidates: (() => {
    try {
      const value = JSON.parse(String(row.candidates_json || '[]'))
      return Array.isArray(value) ? value : []
    } catch {
      return []
    }
  })(),
  scoreBreakdown: (() => {
    try {
      const value = JSON.parse(String(row.score_breakdown_json || '[]'))
      return Array.isArray(value) ? value : []
    } catch {
      return []
    }
  })(),
  createdAt: String(row.created_at || nowIso())
})

export const calcP95 = (samples: number[]) => {
  if (!samples.length) return 0
  const sorted = [...samples].sort((left, right) => left - right)
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1)
  return sorted[index] || sorted[sorted.length - 1] || 0
}

export const estimateDurationFromPrompt = (prompt: string) => {
  const value = prompt.toLowerCase()
  const minuteMatch = value.match(/(\d+(?:\.\d+)?)\s*(min|minute|分钟|m)/)
  if (minuteMatch?.[1]) return Math.max(4, Math.round(Number(minuteMatch[1]) * 60))
  const secondMatch = value.match(/(\d+(?:\.\d+)?)\s*(s|sec|second|秒)/)
  if (secondMatch?.[1]) return Math.max(4, Math.round(Number(secondMatch[1])))
  return 8
}

export const calcQualityScore = (profile: ModelProfile) => {
  const tags = profile.capabilities
  const score =
    (profile.supports4k ? 0.25 : 0) +
    (profile.supportsAudio ? 0.12 : 0) +
    (tags.includes('cinematic') ? 0.2 : 0) +
    (tags.includes('realistic') ? 0.18 : 0) +
    (tags.includes('effects') ? 0.08 : 0) +
    (tags.includes('world-consistency') ? 0.1 : 0)
  return Number(Math.min(1, Math.max(0, score)).toFixed(4))
}

export const calcSpeedScore = (latencyMs: number) =>
  Number(Math.max(0, 1 - latencyMs / 4000).toFixed(4))

export const calcCostScore = (estimatedCostUsd: number) =>
  Number(Math.max(0, 1 - estimatedCostUsd / 2).toFixed(4))

export const resolveBudgetAlertRatio = () => {
  const value = Number.parseFloat(String(process.env.MODEL_POLICY_BUDGET_ALERT_RATIO || ''))
  if (!Number.isFinite(value)) return 0.8
  return Math.min(0.99, Math.max(0.5, value))
}

export const DEFAULT_POLICY_ALERT_CHANNELS = ['dashboard']
export const DEFAULT_WARNING_THRESHOLD_RATIO = 0.8
export const DEFAULT_CRITICAL_THRESHOLD_RATIO = 1

export const normalizeAlertRatio = (value: unknown, fallback: number) => {
  const ratio = Number(value)
  if (!Number.isFinite(ratio)) return fallback
  return Number(Math.min(1, Math.max(0, ratio)).toFixed(4))
}

export const normalizeAlertThresholds = (warningInput: unknown, criticalInput: unknown) => {
  const warning = normalizeAlertRatio(warningInput, DEFAULT_WARNING_THRESHOLD_RATIO)
  const criticalRaw = normalizeAlertRatio(criticalInput, DEFAULT_CRITICAL_THRESHOLD_RATIO)
  const critical = Number(Math.max(warning, criticalRaw).toFixed(4))
  return { warning, critical }
}

export const normalizeAlertChannels = (channels: unknown) => {
  if (!Array.isArray(channels)) return [...DEFAULT_POLICY_ALERT_CHANNELS]
  const normalized = channels.map((item) => String(item || '').trim()).filter(Boolean)
  if (!normalized.length) return [...DEFAULT_POLICY_ALERT_CHANNELS]
  return Array.from(new Set(normalized))
}

export const alertConfigFromRow = (
  row: DbRecord | null | undefined,
  organizationId: string,
  policyId: string
): PolicyAlertConfig => {
  const channels = (() => {
    try {
      const parsed = JSON.parse(String(row?.channels_json || '[]'))
      return normalizeAlertChannels(parsed)
    } catch {
      return [...DEFAULT_POLICY_ALERT_CHANNELS]
    }
  })()

  const { warning, critical } = normalizeAlertThresholds(
    row?.warning_threshold_ratio,
    row?.critical_threshold_ratio
  )

  const createdAt = row?.created_at ? String(row.created_at) : nowIso()
  const updatedAt = row?.updated_at ? String(row.updated_at) : createdAt

  return {
    policyId,
    organizationId,
    enabled: Boolean(row?.enabled ?? 1),
    channels,
    warningThresholdRatio: warning,
    criticalThresholdRatio: critical,
    createdAt,
    updatedAt
  }
}

export const alertEventFromRow = (row: DbRecord): PolicyAlertEvent => {
  const status: PolicyAlertEvent['status'] =
    row.status === 'critical' ? 'critical' : row.status === 'degraded' ? 'degraded' : 'warning'
  return {
    id: String(row.id || ''),
    policyId: String(row.policy_id || ''),
    organizationId: String(row.organization_id || 'org_default'),
    status,
    message: String(row.message || ''),
    prompt: String(row.prompt || ''),
    recommendedModelId: String(row.recommended_model_id || ''),
    estimatedCostUsd: Number(row.estimated_cost_usd || 0),
    budgetUsd: Number(row.budget_usd || 0),
    meta: (() => {
      try {
        const parsed = JSON.parse(String(row.meta_json || '{}'))
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>
        }
      } catch {
        // ignore invalid meta payload
      }
      return {}
    })(),
    createdAt: String(row.created_at || nowIso())
  }
}
