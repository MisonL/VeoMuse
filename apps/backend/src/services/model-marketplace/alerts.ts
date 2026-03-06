import { getLocalDb } from '../LocalDatabaseService'
import {
  DEFAULT_CRITICAL_THRESHOLD_RATIO,
  DEFAULT_POLICY_ALERT_CHANNELS,
  DEFAULT_WARNING_THRESHOLD_RATIO,
  alertConfigFromRow,
  alertEventFromRow,
  normalizeAlertChannels,
  normalizeAlertThresholds,
  nowIso,
  type DbRecord,
  type PolicyAlertConfig,
  type PolicyAlertConfigPatch
} from '../modelMarketplaceShared'
import type { RoutingDecision, RoutingPolicy } from '@veomuse/shared'

const buildDefaultPolicyAlertConfig = (
  organizationId: string,
  policyId: string
): PolicyAlertConfig => {
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

export const getPolicyAlertConfig = (organizationId: string, policyId: string) => {
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
  if (!row) return buildDefaultPolicyAlertConfig(organizationId, policyId)
  return alertConfigFromRow(row, organizationId, policyId)
}

export const updatePolicyAlertConfig = (
  organizationId: string,
  policyId: string,
  patch: PolicyAlertConfigPatch,
  getPolicy: (policyId: string, organizationId: string) => RoutingPolicy | null
) => {
  const policy = getPolicy(policyId, organizationId)
  if (!policy) return null

  const current = getPolicyAlertConfig(organizationId, policyId)
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

export const listPolicyAlerts = (organizationId: string, policyId: string, limit?: number) => {
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

export const recordPolicyAlertEvent = (
  organizationId: string,
  policyId: string,
  prompt: string,
  decision: RoutingDecision
) => {
  const budgetGuard = decision.budgetGuard
  if (!budgetGuard || budgetGuard.status === 'ok') return

  const alertConfig = getPolicyAlertConfig(organizationId, policyId)
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
