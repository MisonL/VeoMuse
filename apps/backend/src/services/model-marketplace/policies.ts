import type { RoutingPolicy } from '@veomuse/shared'
import { getLocalDb } from '../LocalDatabaseService'
import {
  DEFAULT_WEIGHTS,
  executionFromRow,
  normalizeWeights,
  nowIso,
  policyFromRow,
  type DbRecord,
  type PolicyExecutionQuery,
  type PolicyMutationPayload
} from '../modelMarketplaceShared'

export const DEFAULT_FALLBACK_POLICY: RoutingPolicy = {
  id: 'default-auto',
  name: '默认智能路由',
  description: '内存回退策略',
  priority: 'quality',
  maxBudgetUsd: 0,
  enabled: true,
  allowedModels: [],
  weights: normalizeWeights('quality', {}),
  fallbackPolicyId: null,
  createdAt: '',
  updatedAt: ''
}

export const ensureDefaultAutoPolicy = () => {
  getLocalDb()
    .prepare(
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
    )
    .run(
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
}

export const normalizeFallbackPolicyId = (value: unknown) => {
  if (value === undefined) return undefined
  if (value === null) return null
  const normalized = String(value).trim()
  return normalized.length > 0 ? normalized : null
}

export const listPolicies = (organizationId: string = 'org_default'): RoutingPolicy[] => {
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

export const getPolicy = (
  policyId: string,
  organizationId: string = 'org_default'
): RoutingPolicy | null => {
  const row = getLocalDb()
    .prepare(`SELECT * FROM routing_policies WHERE id = ? AND organization_id = ?`)
    .get(policyId, organizationId) as DbRecord | null
  return row ? policyFromRow(row) : null
}

export const assertFallbackPolicyValid = (
  organizationId: string,
  policyId: string,
  fallbackPolicyId: string | null
) => {
  if (!fallbackPolicyId) return
  if (fallbackPolicyId === policyId) {
    throw new Error('fallbackPolicyId cannot reference itself')
  }

  const fallbackPolicy = getPolicy(fallbackPolicyId, organizationId)
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

export const createPolicy = (organizationId: string, payload: PolicyMutationPayload) => {
  const id = `policy_${crypto.randomUUID()}`
  const now = nowIso()
  const priority = payload.priority || 'quality'
  const fallbackPolicyId = normalizeFallbackPolicyId(payload.fallbackPolicyId) ?? null
  assertFallbackPolicyValid(organizationId, id, fallbackPolicyId)
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

export const updatePolicy = (
  organizationId: string,
  policyId: string,
  patch: PolicyMutationPayload
) => {
  const current = getPolicy(policyId, organizationId)
  if (!current) return null
  const priority = patch.priority || current.priority
  const fallbackPolicyId =
    patch.fallbackPolicyId === undefined
      ? current.fallbackPolicyId
      : (normalizeFallbackPolicyId(patch.fallbackPolicyId) ?? null)
  assertFallbackPolicyValid(organizationId, policyId, fallbackPolicyId)
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

export const listPolicyExecutions = (
  organizationId: string,
  policyId: string,
  query: PolicyExecutionQuery = {}
) => {
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
