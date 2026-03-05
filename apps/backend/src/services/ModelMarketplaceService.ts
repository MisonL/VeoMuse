import type {
  MarketplaceModel,
  ModelProfile,
  ModelRoutingPriority,
  ModelRuntimeMetrics,
  RoutingDecision,
  RoutingExecution,
  RoutingPolicy,
  RoutingWeightConfig
} from '@veomuse/shared'
import { getLocalDb } from './LocalDatabaseService'
import { TelemetryService } from './TelemetryService'

interface SimulatePayload {
  prompt: string
  budgetUsd?: number
  priority?: ModelRoutingPriority
}

interface PolicyMutationPayload {
  name?: string
  description?: string
  priority?: ModelRoutingPriority
  maxBudgetUsd?: number
  enabled?: boolean
  allowedModels?: string[]
  weights?: Partial<RoutingWeightConfig>
  fallbackPolicyId?: string | null
}

interface PolicyExecutionQuery {
  limit?: number
  offset?: number
}

interface ScoreBreakdownRow {
  modelId: string
  quality: number
  speed: number
  cost: number
  reliability: number
  finalScore: number
}

interface ScoredCandidate {
  modelId: string
  score: number
  estimatedCostUsd: number
  estimatedLatencyMs: number
}

interface EvaluatePolicyResult {
  decision: RoutingDecision
  scoreBreakdown: ScoreBreakdownRow[]
  scoredCandidates: ScoredCandidate[]
  hasBudgetMiss: boolean
  budgetUsd: number
}

interface PolicyAlertConfig {
  policyId: string
  organizationId: string
  enabled: boolean
  channels: string[]
  warningThresholdRatio: number
  criticalThresholdRatio: number
  createdAt: string
  updatedAt: string
}

interface PolicyAlertConfigPatch {
  enabled?: boolean
  channels?: string[]
  warningThresholdRatio?: number
  criticalThresholdRatio?: number
}

interface PolicyAlertEvent {
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

const nowIso = () => new Date().toISOString()

const DEFAULT_WEIGHTS: Record<ModelRoutingPriority, RoutingWeightConfig> = {
  quality: { quality: 0.52, speed: 0.13, cost: 0.1, reliability: 0.25 },
  speed: { quality: 0.14, speed: 0.55, cost: 0.1, reliability: 0.21 },
  cost: { quality: 0.12, speed: 0.14, cost: 0.55, reliability: 0.19 }
}

const DEFAULT_PROFILES: ModelProfile[] = [
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

type DbRecord = Record<string, unknown>

const profileFromRow = (row: DbRecord): ModelProfile => ({
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

const metricsFromRow = (row: DbRecord | null | undefined, modelId: string): ModelRuntimeMetrics => ({
  modelId,
  windowMinutes: Number(row?.window_minutes ?? 1440),
  totalRequests: Number(row?.total_requests ?? 0),
  successRate: Number(row?.success_rate ?? 1),
  p95LatencyMs: Number(row?.p95_latency_ms ?? 0),
  avgCostUsd: Number(row?.avg_cost_usd ?? 0),
  updatedAt: String(row?.updated_at ?? nowIso())
})

const normalizeWeights = (
  priority: ModelRoutingPriority,
  raw?: Partial<RoutingWeightConfig> | null
): RoutingWeightConfig => {
  const merged: RoutingWeightConfig = {
    ...DEFAULT_WEIGHTS[priority],
    ...(raw || {})
  }
  const values = [merged.quality, merged.speed, merged.cost, merged.reliability]
  const valid = values.every((v) => Number.isFinite(v) && v >= 0)
  if (!valid) return { ...DEFAULT_WEIGHTS[priority] }
  const total = values.reduce((acc, value) => acc + value, 0)
  if (total <= 0) return { ...DEFAULT_WEIGHTS[priority] }
  return {
    quality: Number((merged.quality / total).toFixed(4)),
    speed: Number((merged.speed / total).toFixed(4)),
    cost: Number((merged.cost / total).toFixed(4)),
    reliability: Number((merged.reliability / total).toFixed(4))
  }
}

const policyFromRow = (row: DbRecord): RoutingPolicy => {
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

const executionFromRow = (row: DbRecord): RoutingExecution => ({
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

const calcP95 = (samples: number[]) => {
  if (!samples.length) return 0
  const sorted = [...samples].sort((a, b) => a - b)
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1)
  return sorted[index] || sorted[sorted.length - 1] || 0
}

const estimateDurationFromPrompt = (prompt: string) => {
  const value = prompt.toLowerCase()
  const minuteMatch = value.match(/(\d+(?:\.\d+)?)\s*(min|minute|分钟|m)/)
  if (minuteMatch?.[1]) return Math.max(4, Math.round(Number(minuteMatch[1]) * 60))
  const secondMatch = value.match(/(\d+(?:\.\d+)?)\s*(s|sec|second|秒)/)
  if (secondMatch?.[1]) return Math.max(4, Math.round(Number(secondMatch[1])))
  return 8
}

const calcQualityScore = (profile: ModelProfile) => {
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

const calcSpeedScore = (latencyMs: number) => Number(Math.max(0, 1 - latencyMs / 4000).toFixed(4))

const calcCostScore = (estimatedCostUsd: number) =>
  Number(Math.max(0, 1 - estimatedCostUsd / 2).toFixed(4))

const resolveBudgetAlertRatio = () => {
  const value = Number.parseFloat(String(process.env.MODEL_POLICY_BUDGET_ALERT_RATIO || ''))
  if (!Number.isFinite(value)) return 0.8
  return Math.min(0.99, Math.max(0.5, value))
}

const DEFAULT_POLICY_ALERT_CHANNELS = ['dashboard']
const DEFAULT_WARNING_THRESHOLD_RATIO = 0.8
const DEFAULT_CRITICAL_THRESHOLD_RATIO = 1

const normalizeAlertRatio = (value: unknown, fallback: number) => {
  const ratio = Number(value)
  if (!Number.isFinite(ratio)) return fallback
  return Number(Math.min(1, Math.max(0, ratio)).toFixed(4))
}

const normalizeAlertThresholds = (warningInput: unknown, criticalInput: unknown) => {
  const warning = normalizeAlertRatio(warningInput, DEFAULT_WARNING_THRESHOLD_RATIO)
  const criticalRaw = normalizeAlertRatio(criticalInput, DEFAULT_CRITICAL_THRESHOLD_RATIO)
  const critical = Number(Math.max(warning, criticalRaw).toFixed(4))
  return { warning, critical }
}

const normalizeAlertChannels = (channels: unknown) => {
  if (!Array.isArray(channels)) return [...DEFAULT_POLICY_ALERT_CHANNELS]
  const normalized = channels.map((item) => String(item || '').trim()).filter(Boolean)
  if (!normalized.length) return [...DEFAULT_POLICY_ALERT_CHANNELS]
  return Array.from(new Set(normalized))
}

const alertConfigFromRow = (
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

const alertEventFromRow = (row: DbRecord): PolicyAlertEvent => {
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

export class ModelMarketplaceService {
  private static initialized = false

  private static normalizeFallbackPolicyId(value: unknown) {
    if (value === undefined) return undefined
    if (value === null) return null
    const normalized = String(value).trim()
    return normalized.length > 0 ? normalized : null
  }

  private static assertFallbackPolicyValid(
    organizationId: string,
    policyId: string,
    fallbackPolicyId: string | null
  ) {
    if (!fallbackPolicyId) return
    if (fallbackPolicyId === policyId) {
      throw new Error('fallbackPolicyId cannot reference itself')
    }

    const fallbackPolicy = this.getPolicy(fallbackPolicyId, organizationId)
    if (!fallbackPolicy) {
      throw new Error('fallbackPolicyId does not exist')
    }

    let cursor: string | null = fallbackPolicy.fallbackPolicyId || null
    let guard = 0
    while (cursor) {
      guard += 1
      if (cursor === policyId) {
        throw new Error('fallbackPolicyId introduces a cyclic chain')
      }
      if (guard > 128) {
        throw new Error('fallbackPolicyId chain is too deep')
      }
      const row = getLocalDb()
        .prepare(
          `
          SELECT fallback_policy_id
          FROM routing_policies
          WHERE id = ? AND organization_id = ?
          LIMIT 1
        `
        )
        .get(cursor, organizationId) as { fallback_policy_id?: string | null } | null
      cursor = row?.fallback_policy_id ? String(row.fallback_policy_id) : null
    }
  }

  static ensureInitialized() {
    if (this.initialized) return

    const db = getLocalDb()
    const upsertProfile = db.prepare(`
      INSERT INTO model_profiles (
        id, name, provider, capabilities_json, cost_per_second, max_duration_sec,
        supports_4k, supports_audio, supports_stylization, region, enabled, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        provider = excluded.provider,
        capabilities_json = excluded.capabilities_json,
        cost_per_second = excluded.cost_per_second,
        max_duration_sec = excluded.max_duration_sec,
        supports_4k = excluded.supports_4k,
        supports_audio = excluded.supports_audio,
        supports_stylization = excluded.supports_stylization,
        region = excluded.region,
        enabled = excluded.enabled,
        updated_at = excluded.updated_at
    `)

    DEFAULT_PROFILES.forEach((profile) => {
      upsertProfile.run(
        profile.id,
        profile.name,
        profile.provider,
        JSON.stringify(profile.capabilities),
        profile.costPerSecond,
        profile.maxDurationSec,
        profile.supports4k ? 1 : 0,
        profile.supportsAudio ? 1 : 0,
        profile.supportsStylization ? 1 : 0,
        profile.region,
        profile.enabled ? 1 : 0,
        profile.updatedAt
      )
    })

    db.prepare(
      `
      INSERT INTO routing_policies (
        id, organization_id, name, description, priority, max_budget_usd, enabled, allowed_models_json, weights_json, fallback_policy_id, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        organization_id = excluded.organization_id,
        name = excluded.name,
        description = excluded.description,
        priority = excluded.priority,
        enabled = excluded.enabled,
        max_budget_usd = excluded.max_budget_usd,
        allowed_models_json = excluded.allowed_models_json,
        weights_json = excluded.weights_json,
        fallback_policy_id = excluded.fallback_policy_id,
        updated_at = excluded.updated_at
    `
    ).run(
      'default-auto',
      'org_default',
      '默认智能路由',
      '按成功率/时延/成本自动平衡',
      'quality',
      1.5,
      1,
      '[]',
      JSON.stringify(DEFAULT_WEIGHTS.quality),
      null,
      nowIso(),
      nowIso()
    )

    this.initialized = true
    this.collectAndPersistMetrics()
  }

  static collectAndPersistMetrics(windowMinutes: number = 1440) {
    if (!this.initialized) this.ensureInitialized()
    const db = getLocalDb()
    const profiles = this.getAllProfiles()
    const telemetry = TelemetryService.getInstance().getRawMetrics()
    const fromTs = Date.now() - windowMinutes * 60 * 1000

    const upsertMetric = db.prepare(`
      INSERT INTO model_runtime_metrics (
        model_id, window_minutes, total_requests, success_rate, p95_latency_ms, avg_cost_usd, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(model_id) DO UPDATE SET
        window_minutes = excluded.window_minutes,
        total_requests = excluded.total_requests,
        success_rate = excluded.success_rate,
        p95_latency_ms = excluded.p95_latency_ms,
        avg_cost_usd = excluded.avg_cost_usd,
        updated_at = excluded.updated_at
    `)

    profiles.forEach((profile) => {
      const modelMetrics = telemetry.filter(
        (metric) =>
          metric.service === `MODEL-${profile.id}` && new Date(metric.timestamp).getTime() >= fromTs
      )
      const totalRequests = modelMetrics.length
      const successCount = modelMetrics.filter((metric) => metric.success).length
      const successRate = totalRequests ? Number((successCount / totalRequests).toFixed(4)) : 1
      const p95LatencyMs = calcP95(modelMetrics.map((metric) => metric.durationMs))
      const avgCostUsd = totalRequests ? Number((profile.costPerSecond * 8).toFixed(4)) : 0

      upsertMetric.run(
        profile.id,
        windowMinutes,
        totalRequests,
        successRate,
        p95LatencyMs,
        avgCostUsd,
        nowIso()
      )
    })
  }

  static getAllProfiles(): ModelProfile[] {
    this.ensureInitialized()
    const rows = getLocalDb()
      .prepare(`SELECT * FROM model_profiles ORDER BY id ASC`)
      .all() as DbRecord[]
    return rows.map(profileFromRow)
  }

  static getProfile(modelId: string): ModelProfile | null {
    this.ensureInitialized()
    const row = getLocalDb()
      .prepare(`SELECT * FROM model_profiles WHERE id = ?`)
      .get(modelId) as DbRecord | null
    return row ? profileFromRow(row) : null
  }

  static listMarketplace(): MarketplaceModel[] {
    this.collectAndPersistMetrics()
    const profiles = this.getAllProfiles()
    const getMetric = getLocalDb().prepare(`SELECT * FROM model_runtime_metrics WHERE model_id = ?`)
    return profiles.map((profile) => ({
      profile,
      metrics: metricsFromRow(getMetric.get(profile.id) as DbRecord | null, profile.id)
    }))
  }

  static listPolicies(organizationId: string = 'org_default'): RoutingPolicy[] {
    this.ensureInitialized()
    const rows = getLocalDb()
      .prepare(
        `
        SELECT * FROM routing_policies
        WHERE organization_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `
      )
      .all(organizationId) as DbRecord[]
    return rows.map(policyFromRow)
  }

  static getPolicy(policyId: string, organizationId: string = 'org_default'): RoutingPolicy | null {
    this.ensureInitialized()
    const row = getLocalDb()
      .prepare(`SELECT * FROM routing_policies WHERE id = ? AND organization_id = ?`)
      .get(policyId, organizationId) as DbRecord | null
    return row ? policyFromRow(row) : null
  }

  static createPolicy(organizationId: string, payload: PolicyMutationPayload) {
    this.ensureInitialized()
    const id = `policy_${crypto.randomUUID()}`
    const now = nowIso()
    const priority = payload.priority || 'quality'
    const fallbackPolicyId = this.normalizeFallbackPolicyId(payload.fallbackPolicyId) ?? null
    this.assertFallbackPolicyValid(organizationId, id, fallbackPolicyId)
    const maxBudget = payload.maxBudgetUsd === undefined ? 0 : Number(payload.maxBudgetUsd)
    if (!Number.isFinite(maxBudget)) {
      throw new Error('maxBudgetUsd must be a finite number')
    }
    const policy: RoutingPolicy = {
      id,
      name: payload.name?.trim() || '未命名策略',
      description: payload.description?.trim() || '自定义路由策略',
      priority,
      maxBudgetUsd: Math.max(0, maxBudget),
      enabled: payload.enabled !== false,
      allowedModels: Array.isArray(payload.allowedModels) ? payload.allowedModels.map(String) : [],
      weights: normalizeWeights(priority, payload.weights || {}),
      fallbackPolicyId,
      createdAt: now,
      updatedAt: now
    }

    getLocalDb()
      .prepare(
        `
      INSERT INTO routing_policies (
        id, organization_id, name, description, priority, max_budget_usd, enabled, allowed_models_json, weights_json, fallback_policy_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        policy.id,
        organizationId,
        policy.name,
        policy.description,
        policy.priority,
        policy.maxBudgetUsd,
        policy.enabled ? 1 : 0,
        JSON.stringify(policy.allowedModels),
        JSON.stringify(policy.weights),
        policy.fallbackPolicyId,
        policy.createdAt,
        policy.updatedAt
      )

    return policy
  }

  static updatePolicy(organizationId: string, policyId: string, patch: PolicyMutationPayload) {
    const current = this.getPolicy(policyId, organizationId)
    if (!current) return null
    const priority = patch.priority || current.priority
    const fallbackPolicyId =
      patch.fallbackPolicyId === undefined
        ? current.fallbackPolicyId
        : (this.normalizeFallbackPolicyId(patch.fallbackPolicyId) ?? null)
    this.assertFallbackPolicyValid(organizationId, policyId, fallbackPolicyId)
    if (patch.maxBudgetUsd !== undefined && !Number.isFinite(Number(patch.maxBudgetUsd))) {
      throw new Error('maxBudgetUsd must be a finite number')
    }
    const next: RoutingPolicy = {
      ...current,
      name: patch.name?.trim() || current.name,
      description: patch.description?.trim() || current.description,
      priority,
      maxBudgetUsd:
        patch.maxBudgetUsd === undefined
          ? current.maxBudgetUsd
          : Math.max(0, Number(patch.maxBudgetUsd)),
      enabled: patch.enabled === undefined ? current.enabled : Boolean(patch.enabled),
      allowedModels: Array.isArray(patch.allowedModels)
        ? patch.allowedModels.map(String)
        : current.allowedModels,
      weights: normalizeWeights(
        priority,
        patch.weights ? { ...current.weights, ...patch.weights } : current.weights
      ),
      fallbackPolicyId,
      updatedAt: nowIso()
    }

    getLocalDb()
      .prepare(
        `
      UPDATE routing_policies
      SET name = ?, description = ?, priority = ?, max_budget_usd = ?, enabled = ?, allowed_models_json = ?, weights_json = ?, fallback_policy_id = ?, updated_at = ?
      WHERE id = ? AND organization_id = ?
    `
      )
      .run(
        next.name,
        next.description,
        next.priority,
        next.maxBudgetUsd,
        next.enabled ? 1 : 0,
        JSON.stringify(next.allowedModels),
        JSON.stringify(next.weights),
        next.fallbackPolicyId,
        next.updatedAt,
        next.id,
        organizationId
      )

    return next
  }

  static listPolicyExecutions(
    organizationId: string,
    policyId: string,
    query: PolicyExecutionQuery = {}
  ) {
    this.ensureInitialized()
    const safeLimit =
      Number.isFinite(query.limit) && (query.limit || 0) > 0
        ? Math.min(100, Math.floor(query.limit as number))
        : 20
    const safeOffset =
      Number.isFinite(query.offset) && (query.offset || 0) > 0
        ? Math.max(0, Math.floor(query.offset as number))
        : 0

    const totalRow = getLocalDb()
      .prepare(
        `
        SELECT COUNT(1) AS total
        FROM routing_executions
        WHERE policy_id = ? AND organization_id = ?
      `
      )
      .get(policyId, organizationId) as { total?: number } | null
    const total = Number(totalRow?.total || 0)

    const rows = getLocalDb()
      .prepare(
        `
        SELECT * FROM routing_executions
        WHERE policy_id = ? AND organization_id = ?
        ORDER BY created_at DESC
        LIMIT ${safeLimit}
        OFFSET ${safeOffset}
      `
      )
      .all(policyId, organizationId) as DbRecord[]

    return {
      executions: rows.map(executionFromRow),
      page: {
        total,
        hasMore: safeOffset + rows.length < total,
        limit: safeLimit,
        offset: safeOffset
      }
    }
  }

  private static buildDefaultPolicyAlertConfig(
    organizationId: string,
    policyId: string
  ): PolicyAlertConfig {
    const now = nowIso()
    const { warning, critical } = normalizeAlertThresholds(
      DEFAULT_WARNING_THRESHOLD_RATIO,
      DEFAULT_CRITICAL_THRESHOLD_RATIO
    )
    return {
      policyId,
      organizationId,
      enabled: true,
      channels: [...DEFAULT_POLICY_ALERT_CHANNELS],
      warningThresholdRatio: warning,
      criticalThresholdRatio: critical,
      createdAt: now,
      updatedAt: now
    }
  }

  static getPolicyAlertConfig(organizationId: string, policyId: string) {
    this.ensureInitialized()
    const row = getLocalDb()
      .prepare(
        `
        SELECT *
        FROM policy_alert_configs
        WHERE policy_id = ? AND organization_id = ?
        LIMIT 1
      `
      )
      .get(policyId, organizationId) as DbRecord | null
    if (!row) return this.buildDefaultPolicyAlertConfig(organizationId, policyId)
    return alertConfigFromRow(row, organizationId, policyId)
  }

  static updatePolicyAlertConfig(
    organizationId: string,
    policyId: string,
    patch: PolicyAlertConfigPatch
  ) {
    this.ensureInitialized()
    const policy = this.getPolicy(policyId, organizationId)
    if (!policy) return null

    const current = this.getPolicyAlertConfig(organizationId, policyId)
    const channels =
      patch.channels === undefined ? current.channels : normalizeAlertChannels(patch.channels)
    const { warning, critical } = normalizeAlertThresholds(
      patch.warningThresholdRatio === undefined
        ? current.warningThresholdRatio
        : patch.warningThresholdRatio,
      patch.criticalThresholdRatio === undefined
        ? current.criticalThresholdRatio
        : patch.criticalThresholdRatio
    )
    const now = nowIso()
    const next: PolicyAlertConfig = {
      policyId,
      organizationId,
      enabled: patch.enabled === undefined ? current.enabled : Boolean(patch.enabled),
      channels,
      warningThresholdRatio: warning,
      criticalThresholdRatio: critical,
      createdAt: current.createdAt || now,
      updatedAt: now
    }

    getLocalDb()
      .prepare(
        `
      INSERT INTO policy_alert_configs (
        policy_id, organization_id, enabled, channels_json, warning_threshold_ratio, critical_threshold_ratio, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(policy_id) DO UPDATE SET
        organization_id = excluded.organization_id,
        enabled = excluded.enabled,
        channels_json = excluded.channels_json,
        warning_threshold_ratio = excluded.warning_threshold_ratio,
        critical_threshold_ratio = excluded.critical_threshold_ratio,
        updated_at = excluded.updated_at
    `
      )
      .run(
        policyId,
        organizationId,
        next.enabled ? 1 : 0,
        JSON.stringify(next.channels),
        next.warningThresholdRatio,
        next.criticalThresholdRatio,
        next.createdAt,
        next.updatedAt
      )

    return next
  }

  static listPolicyAlerts(organizationId: string, policyId: string, limit?: number) {
    this.ensureInitialized()
    const safeLimit =
      Number.isFinite(limit) && (limit || 0) > 0 ? Math.min(200, Math.floor(limit as number)) : 20
    const rows = getLocalDb()
      .prepare(
        `
        SELECT *
        FROM policy_alert_events
        WHERE policy_id = ? AND organization_id = ?
        ORDER BY created_at DESC
        LIMIT ${safeLimit}
      `
      )
      .all(policyId, organizationId) as DbRecord[]
    return rows.map(alertEventFromRow)
  }

  static simulateDecisionBatch(
    organizationId: string,
    policyId: string,
    scenarios: Array<{
      prompt: string
      budgetUsd?: number
      priority?: 'quality' | 'speed' | 'cost'
    }>
  ) {
    this.ensureInitialized()
    const policy = this.getPolicy(policyId, organizationId)
    if (!policy) {
      throw new Error('Routing policy not found')
    }

    const normalizedScenarios = Array.isArray(scenarios)
      ? scenarios.map((item) => ({
          prompt: String(item?.prompt || ''),
          budgetUsd: Number.isFinite(item?.budgetUsd) ? Number(item?.budgetUsd) : undefined,
          priority: item?.priority
        }))
      : []

    const summary = {
      ok: 0,
      warning: 0,
      critical: 0,
      degraded: 0
    }

    const results = normalizedScenarios.map((scenario) => {
      const decision = this.simulateDecision(scenario, policyId, organizationId)
      const status = decision.budgetGuard?.status || 'ok'
      if (
        status === 'warning' ||
        status === 'critical' ||
        status === 'degraded' ||
        status === 'ok'
      ) {
        summary[status] += 1
      }
      return {
        scenario,
        decision
      }
    })

    return {
      policyId,
      total: results.length,
      results,
      summary
    }
  }

  private static evaluateWithPolicy(
    payload: SimulatePayload,
    policy: RoutingPolicy
  ): EvaluatePolicyResult {
    const prompt = payload.prompt || ''
    const priority = payload.priority || policy.priority
    const durationSec = estimateDurationFromPrompt(prompt)
    const budgetUsd =
      typeof payload.budgetUsd === 'number'
        ? Math.max(0, payload.budgetUsd)
        : Math.max(0, policy.maxBudgetUsd)
    const weights = normalizeWeights(priority, policy.weights)
    const marketplace = this.listMarketplace()
      .filter((item) => item.profile.enabled)
      .filter(
        (item) =>
          policy.allowedModels.length === 0 || policy.allowedModels.includes(item.profile.id)
      )

    const scoreBreakdown = marketplace.map((item) => {
      const estimatedCostUsd = Number(
        (item.profile.costPerSecond * Math.min(durationSec, item.profile.maxDurationSec)).toFixed(4)
      )
      const estimatedLatencyMs = item.metrics.p95LatencyMs || 1200
      const quality = calcQualityScore(item.profile)
      const speed = calcSpeedScore(estimatedLatencyMs)
      const cost = calcCostScore(estimatedCostUsd)
      const reliability = Number((item.metrics.successRate ?? 0.9).toFixed(4))
      const finalScore = Number(
        (
          quality * weights.quality +
          speed * weights.speed +
          cost * weights.cost +
          reliability * weights.reliability
        ).toFixed(4)
      )

      return {
        modelId: item.profile.id,
        estimatedCostUsd,
        estimatedLatencyMs,
        quality,
        speed,
        cost,
        reliability,
        finalScore
      }
    })

    const scoredCandidates: ScoredCandidate[] = scoreBreakdown
      .map((item) => ({
        modelId: item.modelId,
        score: item.finalScore,
        estimatedCostUsd: item.estimatedCostUsd,
        estimatedLatencyMs: item.estimatedLatencyMs
      }))
      .sort((a, b) => b.score - a.score)

    const underBudget =
      budgetUsd > 0
        ? scoredCandidates.filter((item) => item.estimatedCostUsd <= budgetUsd)
        : scoredCandidates

    const selectedPool = underBudget.length ? underBudget : scoredCandidates
    const top = selectedPool[0]

    if (!top) {
      return {
        decision: {
          recommendedModelId: 'veo-3.1',
          estimatedCostUsd: 0,
          estimatedLatencyMs: 0,
          confidence: 0.3,
          reason: '当前无可用模型，已回退默认路由',
          priority,
          policyId: policy.id,
          fallbackUsed: false,
          scoreBreakdown: [],
          candidates: []
        },
        scoreBreakdown: [],
        scoredCandidates: [],
        hasBudgetMiss: budgetUsd > 0,
        budgetUsd
      }
    }

    const reason = underBudget.length
      ? `命中策略 ${policy.name}，按${priority}权重评分最优`
      : `策略 ${policy.name} 下预算不足，退化为全候选评分`

    const normalizedScoreBreakdown: ScoreBreakdownRow[] = scoreBreakdown.map((item) => ({
      modelId: item.modelId,
      quality: item.quality,
      speed: item.speed,
      cost: item.cost,
      reliability: item.reliability,
      finalScore: item.finalScore
    }))

    return {
      decision: {
        recommendedModelId: top.modelId,
        estimatedCostUsd: top.estimatedCostUsd,
        estimatedLatencyMs: top.estimatedLatencyMs,
        confidence: Number(Math.min(0.98, Math.max(0.35, top.score)).toFixed(2)),
        reason,
        priority,
        policyId: policy.id,
        fallbackUsed: false,
        scoreBreakdown: normalizedScoreBreakdown,
        candidates: selectedPool.slice(0, 5)
      },
      scoreBreakdown: normalizedScoreBreakdown,
      scoredCandidates,
      hasBudgetMiss: Boolean(
        budgetUsd > 0 && underBudget.length === 0 && scoredCandidates.length > 0
      ),
      budgetUsd
    }
  }

  private static isOverBudget(decision: RoutingDecision, budgetUsd: number) {
    return budgetUsd > 0 && decision.estimatedCostUsd > budgetUsd
  }

  private static buildBudgetGuard(
    decision: RoutingDecision,
    budgetUsd: number,
    autoDegraded: boolean
  ): RoutingDecision['budgetGuard'] | undefined {
    if (!(budgetUsd > 0)) return undefined
    const alertThresholdRatio = resolveBudgetAlertRatio()
    const usageRatio = budgetUsd > 0 ? decision.estimatedCostUsd / budgetUsd : 0

    if (autoDegraded) {
      return {
        budgetUsd,
        alertThresholdRatio,
        status: 'degraded',
        message: `预算保护已触发自动降级，当前估算成本 $${decision.estimatedCostUsd.toFixed(4)}（预算 $${budgetUsd.toFixed(4)}）`,
        autoDegraded: true
      }
    }

    if (usageRatio >= 1) {
      return {
        budgetUsd,
        alertThresholdRatio,
        status: 'critical',
        message: `预算超限告警：估算成本 $${decision.estimatedCostUsd.toFixed(4)} 已超过预算 $${budgetUsd.toFixed(4)}`,
        autoDegraded: false
      }
    }

    if (usageRatio >= alertThresholdRatio) {
      return {
        budgetUsd,
        alertThresholdRatio,
        status: 'warning',
        message: `预算阈值告警：当前成本占用 ${(usageRatio * 100).toFixed(1)}%（阈值 ${(alertThresholdRatio * 100).toFixed(0)}%）`,
        autoDegraded: false
      }
    }

    return {
      budgetUsd,
      alertThresholdRatio,
      status: 'ok',
      message: '预算占用处于安全区间',
      autoDegraded: false
    }
  }

  private static recordExecution(
    organizationId: string,
    policyId: string,
    prompt: string,
    decision: RoutingDecision
  ) {
    getLocalDb()
      .prepare(
        `
      INSERT INTO routing_executions (
        id, organization_id, policy_id, prompt, priority, recommended_model_id, estimated_cost_usd, estimated_latency_ms,
        confidence, reason, candidates_json, score_breakdown_json, fallback_used, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        `exec_${crypto.randomUUID()}`,
        organizationId,
        policyId,
        prompt,
        decision.priority,
        decision.recommendedModelId,
        decision.estimatedCostUsd,
        decision.estimatedLatencyMs,
        decision.confidence,
        decision.reason,
        JSON.stringify(decision.candidates || []),
        JSON.stringify(decision.scoreBreakdown || []),
        decision.fallbackUsed ? 1 : 0,
        nowIso()
      )
  }

  private static recordPolicyAlertEvent(
    organizationId: string,
    policyId: string,
    prompt: string,
    decision: RoutingDecision
  ) {
    const budgetGuard = decision.budgetGuard
    if (!budgetGuard || budgetGuard.status === 'ok') return

    const alertConfig = this.getPolicyAlertConfig(organizationId, policyId)
    if (!alertConfig.enabled) return

    const usageRatio =
      budgetGuard.budgetUsd > 0
        ? Number((decision.estimatedCostUsd / budgetGuard.budgetUsd).toFixed(4))
        : 0

    getLocalDb()
      .prepare(
        `
      INSERT INTO policy_alert_events (
        id, organization_id, policy_id, status, message, prompt, recommended_model_id,
        estimated_cost_usd, budget_usd, meta_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        `pae_${crypto.randomUUID()}`,
        organizationId,
        policyId,
        budgetGuard.status,
        budgetGuard.message || decision.reason,
        prompt,
        decision.recommendedModelId,
        decision.estimatedCostUsd,
        budgetGuard.budgetUsd,
        JSON.stringify({
          channels: alertConfig.channels,
          warningThresholdRatio: alertConfig.warningThresholdRatio,
          criticalThresholdRatio: alertConfig.criticalThresholdRatio,
          alertThresholdRatio: budgetGuard.alertThresholdRatio,
          usageRatio,
          autoDegraded: Boolean(budgetGuard.autoDegraded),
          fallbackUsed: Boolean(decision.fallbackUsed)
        }),
        nowIso()
      )
  }

  static simulateDecision(
    payload: SimulatePayload,
    specificPolicyId?: string,
    organizationId: string = 'org_default'
  ): RoutingDecision {
    this.ensureInitialized()
    const policy = specificPolicyId
      ? this.getPolicy(specificPolicyId, organizationId)
      : this.listPolicies(organizationId).find((item) => item.enabled) || null

    const effectivePolicy = policy || {
      id: 'default-auto',
      name: '默认智能路由',
      description: '内存回退策略',
      priority: payload.priority || 'quality',
      maxBudgetUsd: 0,
      enabled: true,
      allowedModels: [],
      weights: normalizeWeights(payload.priority || 'quality', {}),
      fallbackPolicyId: null,
      createdAt: nowIso(),
      updatedAt: nowIso()
    }

    let evaluated = this.evaluateWithPolicy(payload, effectivePolicy)
    let decision = evaluated.decision
    let fallbackUsed = false

    const shouldTryFallback =
      evaluated.hasBudgetMiss ||
      this.isOverBudget(evaluated.decision, evaluated.budgetUsd) ||
      evaluated.decision.candidates.length === 0

    if (
      shouldTryFallback &&
      effectivePolicy.fallbackPolicyId &&
      effectivePolicy.fallbackPolicyId !== effectivePolicy.id
    ) {
      const fallbackPolicy = this.getPolicy(effectivePolicy.fallbackPolicyId, organizationId)
      if (fallbackPolicy && fallbackPolicy.enabled) {
        const fallbackResult = this.evaluateWithPolicy(payload, fallbackPolicy)
        const fallbackBetterCost =
          fallbackResult.decision.estimatedCostUsd <= decision.estimatedCostUsd
        const fallbackBackInBudget =
          evaluated.budgetUsd > 0 && fallbackResult.decision.estimatedCostUsd <= evaluated.budgetUsd
        const fallbackHasCandidate = fallbackResult.decision.candidates.length > 0
        if (
          fallbackHasCandidate &&
          (fallbackBetterCost || fallbackBackInBudget || decision.candidates.length === 0)
        ) {
          evaluated = fallbackResult
          decision = {
            ...fallbackResult.decision,
            reason: `${fallbackResult.decision.reason}；预算保护回退到策略 ${fallbackPolicy.name}`,
            fallbackUsed: true,
            policyId: fallbackResult.decision.policyId || fallbackPolicy.id
          }
          fallbackUsed = true
        }
      }
    }

    let autoDegraded = false
    if (this.isOverBudget(decision, evaluated.budgetUsd) && evaluated.scoredCandidates.length > 0) {
      const cheapest = [...evaluated.scoredCandidates].sort(
        (a, b) => a.estimatedCostUsd - b.estimatedCostUsd || b.score - a.score
      )[0]
      if (cheapest && cheapest.modelId !== decision.recommendedModelId) {
        decision = {
          ...decision,
          recommendedModelId: cheapest.modelId,
          estimatedCostUsd: cheapest.estimatedCostUsd,
          estimatedLatencyMs: cheapest.estimatedLatencyMs,
          confidence: Number(Math.max(0.35, decision.confidence - 0.12).toFixed(2)),
          reason: `${decision.reason}；触发预算保护自动降级至最低成本模型 ${cheapest.modelId}`
        }
        autoDegraded = true
      }
    }

    const budgetGuard = this.buildBudgetGuard(decision, evaluated.budgetUsd, autoDegraded)

    const finalDecision: RoutingDecision = {
      ...decision,
      policyId: decision.policyId || effectivePolicy.id,
      fallbackUsed: fallbackUsed || decision.fallbackUsed,
      budgetGuard
    }

    if (
      budgetGuard &&
      budgetGuard.status !== 'ok' &&
      !finalDecision.reason.includes(budgetGuard.message)
    ) {
      finalDecision.reason = `${finalDecision.reason}；${budgetGuard.message}`
    }

    const finalPolicyId = finalDecision.policyId || effectivePolicy.id
    const prompt = payload.prompt || ''
    this.recordExecution(organizationId, finalPolicyId, prompt, finalDecision)
    this.recordPolicyAlertEvent(organizationId, finalPolicyId, prompt, finalDecision)
    return finalDecision
  }

  static resetAfterDatabaseRecovery() {
    this.initialized = false
    this.ensureInitialized()
  }
}
