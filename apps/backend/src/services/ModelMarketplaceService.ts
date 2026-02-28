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

const profileFromRow = (row: any): ModelProfile => ({
  id: row.id,
  name: row.name,
  provider: row.provider,
  capabilities: JSON.parse(row.capabilities_json || '[]'),
  costPerSecond: row.cost_per_second,
  maxDurationSec: row.max_duration_sec,
  supports4k: Boolean(row.supports_4k),
  supportsAudio: Boolean(row.supports_audio),
  supportsStylization: Boolean(row.supports_stylization),
  region: row.region,
  enabled: Boolean(row.enabled),
  updatedAt: row.updated_at
})

const metricsFromRow = (row: any, modelId: string): ModelRuntimeMetrics => ({
  modelId,
  windowMinutes: row?.window_minutes ?? 1440,
  totalRequests: row?.total_requests ?? 0,
  successRate: row?.success_rate ?? 1,
  p95LatencyMs: row?.p95_latency_ms ?? 0,
  avgCostUsd: row?.avg_cost_usd ?? 0,
  updatedAt: row?.updated_at ?? nowIso()
})

const normalizeWeights = (priority: ModelRoutingPriority, raw?: Partial<RoutingWeightConfig> | null): RoutingWeightConfig => {
  const merged: RoutingWeightConfig = {
    ...DEFAULT_WEIGHTS[priority],
    ...(raw || {})
  }
  const values = [merged.quality, merged.speed, merged.cost, merged.reliability]
  const valid = values.every(v => Number.isFinite(v) && v >= 0)
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

const policyFromRow = (row: any): RoutingPolicy => {
  const priority: ModelRoutingPriority = row.priority === 'speed' || row.priority === 'cost' ? row.priority : 'quality'
  const rawWeights = (() => {
    try {
      return JSON.parse(row.weights_json || '{}')
    } catch {
      return {}
    }
  })()
  const allowed = (() => {
    try {
      const value = JSON.parse(row.allowed_models_json || '[]')
      return Array.isArray(value) ? value.map(String) : []
    } catch {
      return []
    }
  })()
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priority,
    maxBudgetUsd: Number(row.max_budget_usd || 0),
    enabled: Boolean(row.enabled ?? 1),
    allowedModels: allowed,
    weights: normalizeWeights(priority, rawWeights),
    fallbackPolicyId: row.fallback_policy_id ? String(row.fallback_policy_id) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

const executionFromRow = (row: any): RoutingExecution => ({
  id: row.id,
  policyId: row.policy_id,
  prompt: row.prompt,
  priority: row.priority,
  recommendedModelId: row.recommended_model_id,
  estimatedCostUsd: Number(row.estimated_cost_usd || 0),
  estimatedLatencyMs: Number(row.estimated_latency_ms || 0),
  confidence: Number(row.confidence || 0),
  reason: row.reason,
  fallbackUsed: Boolean(row.fallback_used),
  candidates: (() => {
    try {
      const value = JSON.parse(row.candidates_json || '[]')
      return Array.isArray(value) ? value : []
    } catch {
      return []
    }
  })(),
  scoreBreakdown: (() => {
    try {
      const value = JSON.parse(row.score_breakdown_json || '[]')
      return Array.isArray(value) ? value : []
    } catch {
      return []
    }
  })(),
  createdAt: row.created_at
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
  const score = (
    (profile.supports4k ? 0.25 : 0) +
    (profile.supportsAudio ? 0.12 : 0) +
    (tags.includes('cinematic') ? 0.2 : 0) +
    (tags.includes('realistic') ? 0.18 : 0) +
    (tags.includes('effects') ? 0.08 : 0) +
    (tags.includes('world-consistency') ? 0.1 : 0)
  )
  return Number(Math.min(1, Math.max(0, score)).toFixed(4))
}

const calcSpeedScore = (latencyMs: number) => Number(Math.max(0, 1 - latencyMs / 4000).toFixed(4))

const calcCostScore = (estimatedCostUsd: number) => Number(Math.max(0, 1 - estimatedCostUsd / 2).toFixed(4))

export class ModelMarketplaceService {
  private static initialized = false

  private static normalizeFallbackPolicyId(value: unknown) {
    if (value === undefined) return undefined
    if (value === null) return null
    const normalized = String(value).trim()
    return normalized.length > 0 ? normalized : null
  }

  private static assertFallbackPolicyValid(policyId: string, fallbackPolicyId: string | null) {
    if (!fallbackPolicyId) return
    if (fallbackPolicyId === policyId) {
      throw new Error('fallbackPolicyId cannot reference itself')
    }

    const fallbackPolicy = this.getPolicy(fallbackPolicyId)
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
        .prepare(`SELECT fallback_policy_id FROM routing_policies WHERE id = ? LIMIT 1`)
        .get(cursor) as { fallback_policy_id?: string | null } | null
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

    db.prepare(`
      INSERT INTO routing_policies (
        id, name, description, priority, max_budget_usd, enabled, allowed_models_json, weights_json, fallback_policy_id, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        priority = excluded.priority,
        enabled = excluded.enabled,
        max_budget_usd = excluded.max_budget_usd,
        allowed_models_json = excluded.allowed_models_json,
        weights_json = excluded.weights_json,
        fallback_policy_id = excluded.fallback_policy_id,
        updated_at = excluded.updated_at
    `).run(
      'default-auto',
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
        metric => metric.service === `MODEL-${profile.id}` && new Date(metric.timestamp).getTime() >= fromTs
      )
      const totalRequests = modelMetrics.length
      const successCount = modelMetrics.filter(metric => metric.success).length
      const successRate = totalRequests ? Number((successCount / totalRequests).toFixed(4)) : 1
      const p95LatencyMs = calcP95(modelMetrics.map(metric => metric.durationMs))
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
    const rows = getLocalDb().prepare(`SELECT * FROM model_profiles ORDER BY id ASC`).all()
    return rows.map(profileFromRow)
  }

  static getProfile(modelId: string): ModelProfile | null {
    this.ensureInitialized()
    const row = getLocalDb().prepare(`SELECT * FROM model_profiles WHERE id = ?`).get(modelId)
    return row ? profileFromRow(row) : null
  }

  static listMarketplace(): MarketplaceModel[] {
    this.collectAndPersistMetrics()
    const profiles = this.getAllProfiles()
    const getMetric = getLocalDb().prepare(`SELECT * FROM model_runtime_metrics WHERE model_id = ?`)
    return profiles.map((profile) => ({
      profile,
      metrics: metricsFromRow(getMetric.get(profile.id), profile.id)
    }))
  }

  static listPolicies(): RoutingPolicy[] {
    this.ensureInitialized()
    const rows = getLocalDb()
      .prepare(`SELECT * FROM routing_policies ORDER BY updated_at DESC, created_at DESC`)
      .all()
    return rows.map(policyFromRow)
  }

  static getPolicy(policyId: string): RoutingPolicy | null {
    this.ensureInitialized()
    const row = getLocalDb().prepare(`SELECT * FROM routing_policies WHERE id = ?`).get(policyId)
    return row ? policyFromRow(row) : null
  }

  static createPolicy(payload: PolicyMutationPayload) {
    this.ensureInitialized()
    const id = `policy_${crypto.randomUUID()}`
    const now = nowIso()
    const priority = payload.priority || 'quality'
    const fallbackPolicyId = this.normalizeFallbackPolicyId(payload.fallbackPolicyId) ?? null
    this.assertFallbackPolicyValid(id, fallbackPolicyId)
    const policy: RoutingPolicy = {
      id,
      name: payload.name?.trim() || '未命名策略',
      description: payload.description?.trim() || '自定义路由策略',
      priority,
      maxBudgetUsd: Number.isFinite(payload.maxBudgetUsd) ? Math.max(0, Number(payload.maxBudgetUsd)) : 0,
      enabled: payload.enabled !== false,
      allowedModels: Array.isArray(payload.allowedModels) ? payload.allowedModels.map(String) : [],
      weights: normalizeWeights(priority, payload.weights || {}),
      fallbackPolicyId,
      createdAt: now,
      updatedAt: now
    }

    getLocalDb().prepare(`
      INSERT INTO routing_policies (
        id, name, description, priority, max_budget_usd, enabled, allowed_models_json, weights_json, fallback_policy_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      policy.id,
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

  static updatePolicy(policyId: string, patch: PolicyMutationPayload) {
    const current = this.getPolicy(policyId)
    if (!current) return null
    const priority = patch.priority || current.priority
    const fallbackPolicyId = patch.fallbackPolicyId === undefined
      ? current.fallbackPolicyId
      : this.normalizeFallbackPolicyId(patch.fallbackPolicyId) ?? null
    this.assertFallbackPolicyValid(policyId, fallbackPolicyId)
    const next: RoutingPolicy = {
      ...current,
      name: patch.name?.trim() || current.name,
      description: patch.description?.trim() || current.description,
      priority,
      maxBudgetUsd: patch.maxBudgetUsd === undefined ? current.maxBudgetUsd : Math.max(0, Number(patch.maxBudgetUsd)),
      enabled: patch.enabled === undefined ? current.enabled : Boolean(patch.enabled),
      allowedModels: Array.isArray(patch.allowedModels) ? patch.allowedModels.map(String) : current.allowedModels,
      weights: normalizeWeights(priority, patch.weights ? { ...current.weights, ...patch.weights } : current.weights),
      fallbackPolicyId,
      updatedAt: nowIso()
    }

    getLocalDb().prepare(`
      UPDATE routing_policies
      SET name = ?, description = ?, priority = ?, max_budget_usd = ?, enabled = ?, allowed_models_json = ?, weights_json = ?, fallback_policy_id = ?, updated_at = ?
      WHERE id = ?
    `).run(
      next.name,
      next.description,
      next.priority,
      next.maxBudgetUsd,
      next.enabled ? 1 : 0,
      JSON.stringify(next.allowedModels),
      JSON.stringify(next.weights),
      next.fallbackPolicyId,
      next.updatedAt,
      next.id
    )

    return next
  }

  static listPolicyExecutions(policyId: string, query: PolicyExecutionQuery = {}) {
    this.ensureInitialized()
    const safeLimit = Number.isFinite(query.limit) && (query.limit || 0) > 0
      ? Math.min(100, Math.floor(query.limit as number))
      : 20
    const safeOffset = Number.isFinite(query.offset) && (query.offset || 0) > 0
      ? Math.max(0, Math.floor(query.offset as number))
      : 0

    const totalRow = getLocalDb()
      .prepare(`SELECT COUNT(1) AS total FROM routing_executions WHERE policy_id = ?`)
      .get(policyId) as { total?: number } | null
    const total = Number(totalRow?.total || 0)

    const rows = getLocalDb()
      .prepare(`
        SELECT * FROM routing_executions
        WHERE policy_id = ?
        ORDER BY created_at DESC
        LIMIT ${safeLimit}
        OFFSET ${safeOffset}
      `)
      .all(policyId)

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

  private static evaluateWithPolicy(
    payload: SimulatePayload,
    policy: RoutingPolicy
  ): {
    decision: RoutingDecision
    scoreBreakdown: Array<{
      modelId: string
      quality: number
      speed: number
      cost: number
      reliability: number
      finalScore: number
    }>
    hasBudgetMiss: boolean
  } {
    const prompt = payload.prompt || ''
    const priority = payload.priority || policy.priority
    const durationSec = estimateDurationFromPrompt(prompt)
    const budgetUsd = typeof payload.budgetUsd === 'number'
      ? Math.max(0, payload.budgetUsd)
      : Math.max(0, policy.maxBudgetUsd)
    const weights = normalizeWeights(priority, policy.weights)
    const marketplace = this
      .listMarketplace()
      .filter(item => item.profile.enabled)
      .filter(item => policy.allowedModels.length === 0 || policy.allowedModels.includes(item.profile.id))

    const scoreBreakdown = marketplace.map((item) => {
      const estimatedCostUsd = Number((item.profile.costPerSecond * Math.min(durationSec, item.profile.maxDurationSec)).toFixed(4))
      const estimatedLatencyMs = item.metrics.p95LatencyMs || 1200
      const quality = calcQualityScore(item.profile)
      const speed = calcSpeedScore(estimatedLatencyMs)
      const cost = calcCostScore(estimatedCostUsd)
      const reliability = Number((item.metrics.successRate || 0.9).toFixed(4))
      const finalScore = Number((
        quality * weights.quality +
        speed * weights.speed +
        cost * weights.cost +
        reliability * weights.reliability
      ).toFixed(4))

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

    const scoredCandidates = scoreBreakdown
      .map(item => ({
        modelId: item.modelId,
        score: item.finalScore,
        estimatedCostUsd: item.estimatedCostUsd,
        estimatedLatencyMs: item.estimatedLatencyMs
      }))
      .sort((a, b) => b.score - a.score)

    const underBudget = budgetUsd > 0
      ? scoredCandidates.filter(item => item.estimatedCostUsd <= budgetUsd)
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
        } as RoutingDecision,
        scoreBreakdown: [] as Array<{
          modelId: string
          quality: number
          speed: number
          cost: number
          reliability: number
          finalScore: number
        }>,
        hasBudgetMiss: budgetUsd > 0
      }
    }

    const reason = underBudget.length
      ? `命中策略 ${policy.name}，按${priority}权重评分最优`
      : `策略 ${policy.name} 下预算不足，退化为全候选评分`

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
        scoreBreakdown: scoreBreakdown.map(item => ({
          modelId: item.modelId,
          quality: item.quality,
          speed: item.speed,
          cost: item.cost,
          reliability: item.reliability,
          finalScore: item.finalScore
        })),
        candidates: selectedPool.slice(0, 5)
      } as RoutingDecision,
      scoreBreakdown: scoreBreakdown.map(item => ({
        modelId: item.modelId,
        quality: item.quality,
        speed: item.speed,
        cost: item.cost,
        reliability: item.reliability,
        finalScore: item.finalScore
      })),
      hasBudgetMiss: Boolean(budgetUsd > 0 && underBudget.length === 0 && scoredCandidates.length > 0)
    }
  }

  private static recordExecution(policyId: string, prompt: string, decision: RoutingDecision) {
    getLocalDb().prepare(`
      INSERT INTO routing_executions (
        id, policy_id, prompt, priority, recommended_model_id, estimated_cost_usd, estimated_latency_ms,
        confidence, reason, candidates_json, score_breakdown_json, fallback_used, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `exec_${crypto.randomUUID()}`,
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

  static simulateDecision(payload: SimulatePayload, specificPolicyId?: string): RoutingDecision {
    this.ensureInitialized()
    const policy = specificPolicyId
      ? this.getPolicy(specificPolicyId)
      : this.listPolicies().find(item => item.enabled) || null

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

    let { decision } = this.evaluateWithPolicy(payload, effectivePolicy)
    let fallbackUsed = false

    if (
      effectivePolicy.fallbackPolicyId &&
      effectivePolicy.fallbackPolicyId !== effectivePolicy.id &&
      decision.candidates.length === 0
    ) {
      const fallbackPolicy = this.getPolicy(effectivePolicy.fallbackPolicyId)
      if (fallbackPolicy && fallbackPolicy.enabled) {
        const fallbackResult = this.evaluateWithPolicy(payload, fallbackPolicy)
        if (fallbackResult.decision.candidates.length > 0) {
          decision = {
            ...fallbackResult.decision,
            reason: `${decision.reason}；已回退到策略 ${fallbackPolicy.name}`,
            fallbackUsed: true
          }
          fallbackUsed = true
        }
      }
    }

    const finalDecision: RoutingDecision = {
      ...decision,
      policyId: decision.policyId || effectivePolicy.id,
      fallbackUsed: fallbackUsed || decision.fallbackUsed
    }

    this.recordExecution(effectivePolicy.id, payload.prompt || '', finalDecision)
    return finalDecision
  }

  static resetAfterDatabaseRecovery() {
    this.initialized = false
    this.ensureInitialized()
  }
}
