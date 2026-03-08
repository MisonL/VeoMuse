import type { MarketplaceModel, RoutingDecision, RoutingPolicy } from '@veomuse/shared'
import { getLocalDb } from '../LocalDatabaseService'
import {
  calcCostScore,
  calcQualityScore,
  calcSpeedScore,
  estimateDurationFromPrompt,
  normalizeWeights,
  nowIso,
  resolveBudgetAlertRatio,
  type EvaluatePolicyResult,
  type ScoredCandidate,
  type ScoreBreakdownRow,
  type SimulatePayload
} from '../modelMarketplaceShared'

interface DecisionDeps {
  listMarketplace: (options?: { refreshMetrics?: boolean }) => MarketplaceModel[]
  getPolicy: (policyId: string, organizationId: string) => RoutingPolicy | null
  listPolicies: (organizationId: string) => RoutingPolicy[]
  recordPolicyAlertEvent: (
    organizationId: string,
    policyId: string,
    prompt: string,
    decision: RoutingDecision
  ) => void
  defaultFallbackPolicy: RoutingPolicy
}

const evaluateWithPolicy = (
  payload: SimulatePayload,
  policy: RoutingPolicy,
  deps: DecisionDeps,
  options: { refreshMetrics?: boolean } = {}
): EvaluatePolicyResult => {
  const prompt = payload.prompt || ''
  const priority = payload.priority || policy.priority
  const durationSec = estimateDurationFromPrompt(prompt)
  const budgetUsd =
    typeof payload.budgetUsd === 'number'
      ? Math.max(0, payload.budgetUsd)
      : Math.max(0, policy.maxBudgetUsd)
  const weights = normalizeWeights(priority, policy.weights)
  const marketplace = deps
    .listMarketplace({ refreshMetrics: options.refreshMetrics })
    .filter((item) => item.profile.enabled)
    .filter(
      (item) => policy.allowedModels.length === 0 || policy.allowedModels.includes(item.profile.id)
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

const isOverBudget = (decision: RoutingDecision, budgetUsd: number) =>
  budgetUsd > 0 && decision.estimatedCostUsd > budgetUsd

const buildBudgetGuard = (
  decision: RoutingDecision,
  budgetUsd: number,
  autoDegraded: boolean
): RoutingDecision['budgetGuard'] | undefined => {
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

const recordExecution = (
  organizationId: string,
  policyId: string,
  prompt: string,
  decision: RoutingDecision
) => {
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

const resolveEffectivePolicy = (
  payload: SimulatePayload,
  specificPolicyId: string | undefined,
  organizationId: string,
  deps: DecisionDeps
) => {
  const policy = specificPolicyId
    ? deps.getPolicy(specificPolicyId, organizationId)
    : deps.listPolicies(organizationId).find((item) => item.enabled) || null

  if (policy) return policy

  const now = nowIso()
  return {
    ...deps.defaultFallbackPolicy,
    priority: payload.priority || deps.defaultFallbackPolicy.priority,
    weights: normalizeWeights(payload.priority || deps.defaultFallbackPolicy.priority, {}),
    createdAt: now,
    updatedAt: now
  }
}

const computeDecision = (
  payload: SimulatePayload,
  deps: DecisionDeps,
  specificPolicyId?: string,
  organizationId: string = 'org_default',
  options: { refreshMetrics?: boolean } = {}
): RoutingDecision => {
  const effectivePolicy = resolveEffectivePolicy(payload, specificPolicyId, organizationId, deps)

  let evaluated = evaluateWithPolicy(payload, effectivePolicy, deps, options)
  let decision = evaluated.decision
  let fallbackUsed = false

  const shouldTryFallback =
    evaluated.hasBudgetMiss ||
    isOverBudget(evaluated.decision, evaluated.budgetUsd) ||
    evaluated.decision.candidates.length === 0

  if (
    shouldTryFallback &&
    effectivePolicy.fallbackPolicyId &&
    effectivePolicy.fallbackPolicyId !== effectivePolicy.id
  ) {
    const fallbackPolicy = deps.getPolicy(effectivePolicy.fallbackPolicyId, organizationId)
    if (fallbackPolicy && fallbackPolicy.enabled) {
      const fallbackResult = evaluateWithPolicy(payload, fallbackPolicy, deps, options)
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
  if (isOverBudget(decision, evaluated.budgetUsd) && evaluated.scoredCandidates.length > 0) {
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

  const budgetGuard = buildBudgetGuard(decision, evaluated.budgetUsd, autoDegraded)

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

  return finalDecision
}

export const simulateDecisionBatch = (
  organizationId: string,
  policyId: string,
  scenarios: Array<{
    prompt: string
    budgetUsd?: number
    priority?: 'quality' | 'speed' | 'cost'
  }>,
  deps: DecisionDeps
) => {
  const policy = deps.getPolicy(policyId, organizationId)
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
    const decision = computeDecision(scenario, deps, policyId, organizationId, {
      refreshMetrics: false
    })
    const status = decision.budgetGuard?.status || 'ok'
    if (status === 'warning' || status === 'critical' || status === 'degraded' || status === 'ok') {
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

export const simulateDecision = (
  payload: SimulatePayload,
  deps: DecisionDeps,
  specificPolicyId?: string,
  organizationId: string = 'org_default'
): RoutingDecision =>
  computeDecision(payload, deps, specificPolicyId, organizationId, {
    refreshMetrics: false
  })

export const executeDecision = (
  payload: SimulatePayload,
  deps: DecisionDeps,
  specificPolicyId?: string,
  organizationId: string = 'org_default'
): RoutingDecision => {
  const finalDecision = computeDecision(payload, deps, specificPolicyId, organizationId, {
    refreshMetrics: true
  })
  const finalPolicyId = finalDecision.policyId || deps.defaultFallbackPolicy.id
  const prompt = payload.prompt || ''
  recordExecution(organizationId, finalPolicyId, prompt, finalDecision)
  deps.recordPolicyAlertEvent(organizationId, finalPolicyId, prompt, finalDecision)
  return finalDecision
}
