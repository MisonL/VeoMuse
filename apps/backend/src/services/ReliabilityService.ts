import type {
  ErrorBudgetEvaluation,
  ReliabilityAlert,
  ReliabilityAlertLevel,
  ReliabilityPolicy,
  RollbackDrill
} from '@veomuse/shared'
import { getLocalDb } from './LocalDatabaseService'

const DEFAULT_POLICY_ID = 'rel_policy_default'

const now = () => new Date().toISOString()

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const toSafeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const parseRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'string' || !value) return {}
  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, unknown>
  } catch {
    return {}
  }
}

type DbRecord = Record<string, unknown>

const toPolicy = (row: DbRecord): ReliabilityPolicy => ({
  id: String(row.id),
  scope: String(row.scope || 'global'),
  targetSlo: clamp(toSafeNumber(row.target_slo, 0.99), 0.5, 0.99999),
  windowDays: Math.max(1, Math.floor(toSafeNumber(row.window_days, 30))),
  warningThresholdRatio: clamp(toSafeNumber(row.warning_threshold_ratio, 0.7), 0, 1),
  alertThresholdRatio: clamp(toSafeNumber(row.alert_threshold_ratio, 0.9), 0, 1),
  freezeDeployOnBreach: Number(row.freeze_deploy_on_breach) > 0,
  updatedBy: String(row.updated_by || 'system'),
  meta: parseRecord(row.meta_json),
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at)
})

const toDrill = (row: DbRecord): RollbackDrill => ({
  id: String(row.id),
  policyId: row.policy_id ? String(row.policy_id) : null,
  environment: String(row.environment || 'production'),
  status:
    row.status === 'failed'
      ? 'failed'
      : row.status === 'completed'
        ? 'completed'
        : row.status === 'running'
          ? 'running'
          : 'scheduled',
  triggerType: String(row.trigger_type || 'manual'),
  initiatedBy: String(row.initiated_by || 'system'),
  summary: String(row.summary || ''),
  plan: parseRecord(row.plan_json),
  result: parseRecord(row.result_json),
  startedAt: row.started_at ? String(row.started_at) : null,
  completedAt: row.completed_at ? String(row.completed_at) : null,
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at)
})

const toAlert = (row: DbRecord): ReliabilityAlert => ({
  id: String(row.id),
  policyId: row.policy_id ? String(row.policy_id) : null,
  level: row.level === 'critical' ? 'critical' : row.level === 'info' ? 'info' : 'warning',
  source: String(row.source || 'error_budget'),
  title: String(row.title || ''),
  message: String(row.message || ''),
  status: row.status === 'acknowledged' ? 'acknowledged' : 'open',
  payload: parseRecord(row.payload_json),
  triggeredAt: String(row.triggered_at || row.created_at || now()),
  acknowledgedAt: row.acknowledged_at ? String(row.acknowledged_at) : null,
  createdAt: String(row.created_at || now())
})

export interface ErrorBudgetPolicyUpdateInput {
  policyId?: string
  scope?: string
  targetSlo?: number
  windowDays?: number
  warningThresholdRatio?: number
  alertThresholdRatio?: number
  freezeDeployOnBreach?: boolean
  updatedBy: string
  meta?: Record<string, unknown>
}

export interface RollbackDrillCreateInput {
  policyId?: string | null
  environment?: string
  status?: RollbackDrill['status']
  triggerType?: string
  initiatedBy: string
  summary?: string
  plan?: Record<string, unknown>
  result?: Record<string, unknown>
  startedAt?: string | null
  completedAt?: string | null
}

export interface ReliabilityAlertCreateInput {
  policyId?: string | null
  level: ReliabilityAlertLevel
  source?: string
  title: string
  message: string
  status?: ReliabilityAlert['status']
  payload?: Record<string, unknown>
  triggeredAt?: string
}

export interface ReliabilityAlertQuery {
  level?: ReliabilityAlertLevel
  status?: ReliabilityAlert['status']
  limit?: number
}

export class ReliabilityService {
  private static ensureDefaultPolicy() {
    const timestamp = now()
    getLocalDb()
      .prepare(
        `
      INSERT OR IGNORE INTO reliability_policies (
        id, scope, target_slo, window_days, warning_threshold_ratio, alert_threshold_ratio,
        freeze_deploy_on_breach, updated_by, meta_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(DEFAULT_POLICY_ID, 'global', 0.99, 30, 0.7, 0.9, 0, 'system', '{}', timestamp, timestamp)
  }

  static getErrorBudgetPolicy(policyId: string = DEFAULT_POLICY_ID): ReliabilityPolicy {
    this.ensureDefaultPolicy()
    const normalizedPolicyId = policyId.trim() || DEFAULT_POLICY_ID
    const row = getLocalDb()
      .prepare(`SELECT * FROM reliability_policies WHERE id = ? LIMIT 1`)
      .get(normalizedPolicyId) as DbRecord | null
    if (row) return toPolicy(row)
    const fallback = getLocalDb()
      .prepare(`SELECT * FROM reliability_policies ORDER BY updated_at DESC LIMIT 1`)
      .get() as DbRecord | null
    if (fallback) return toPolicy(fallback)
    throw new Error('错误预算策略不存在')
  }

  static upsertErrorBudgetPolicy(input: ErrorBudgetPolicyUpdateInput): ReliabilityPolicy {
    this.ensureDefaultPolicy()
    const policyId = (input.policyId || DEFAULT_POLICY_ID).trim() || DEFAULT_POLICY_ID
    const existing = getLocalDb()
      .prepare(`SELECT * FROM reliability_policies WHERE id = ? LIMIT 1`)
      .get(policyId) as DbRecord | null
    const existingPolicy = existing
      ? toPolicy(existing)
      : this.getErrorBudgetPolicy(DEFAULT_POLICY_ID)
    const timestamp = now()
    const createdAt = existing ? existingPolicy.createdAt : timestamp

    const nextPolicy: ReliabilityPolicy = {
      id: policyId,
      scope: (input.scope || existingPolicy.scope || 'global').trim() || 'global',
      targetSlo: clamp(toSafeNumber(input.targetSlo, existingPolicy.targetSlo), 0.5, 0.99999),
      windowDays: Math.max(
        1,
        Math.floor(toSafeNumber(input.windowDays, existingPolicy.windowDays))
      ),
      warningThresholdRatio: clamp(
        toSafeNumber(input.warningThresholdRatio, existingPolicy.warningThresholdRatio),
        0,
        1
      ),
      alertThresholdRatio: clamp(
        toSafeNumber(input.alertThresholdRatio, existingPolicy.alertThresholdRatio),
        0,
        1
      ),
      freezeDeployOnBreach:
        input.freezeDeployOnBreach === undefined
          ? existingPolicy.freezeDeployOnBreach
          : Boolean(input.freezeDeployOnBreach),
      updatedBy: input.updatedBy.trim() || 'system',
      meta:
        input.meta && typeof input.meta === 'object' && !Array.isArray(input.meta)
          ? input.meta
          : existingPolicy.meta,
      createdAt: existingPolicy.createdAt,
      updatedAt: timestamp
    }

    if (nextPolicy.warningThresholdRatio > nextPolicy.alertThresholdRatio) {
      nextPolicy.warningThresholdRatio = nextPolicy.alertThresholdRatio
    }

    getLocalDb()
      .prepare(
        `
      INSERT INTO reliability_policies (
        id, scope, target_slo, window_days, warning_threshold_ratio, alert_threshold_ratio,
        freeze_deploy_on_breach, updated_by, meta_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        scope = excluded.scope,
        target_slo = excluded.target_slo,
        window_days = excluded.window_days,
        warning_threshold_ratio = excluded.warning_threshold_ratio,
        alert_threshold_ratio = excluded.alert_threshold_ratio,
        freeze_deploy_on_breach = excluded.freeze_deploy_on_breach,
        updated_by = excluded.updated_by,
        meta_json = excluded.meta_json,
        updated_at = excluded.updated_at
    `
      )
      .run(
        nextPolicy.id,
        nextPolicy.scope,
        nextPolicy.targetSlo,
        nextPolicy.windowDays,
        nextPolicy.warningThresholdRatio,
        nextPolicy.alertThresholdRatio,
        nextPolicy.freezeDeployOnBreach ? 1 : 0,
        nextPolicy.updatedBy,
        JSON.stringify(nextPolicy.meta || {}),
        createdAt,
        timestamp
      )

    return this.getErrorBudgetPolicy(policyId)
  }

  static evaluateErrorBudget(policyId: string = DEFAULT_POLICY_ID): ErrorBudgetEvaluation {
    const policy = this.getErrorBudgetPolicy(policyId)
    const windowEnd = now()
    const windowStart = new Date(Date.now() - policy.windowDays * 24 * 60 * 60 * 1000).toISOString()

    const stats = getLocalDb()
      .prepare(
        `
      SELECT
        COUNT(1) AS total,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failed
      FROM request_metrics
      WHERE created_at >= ?
    `
      )
      .get(windowStart) as {
      total?: number
      failed?: number
    }

    const totalRequests = Math.max(0, Math.floor(toSafeNumber(stats?.total, 0)))
    const failedRequests = Math.max(0, Math.floor(toSafeNumber(stats?.failed, 0)))
    const successfulRequests = Math.max(0, totalRequests - failedRequests)
    const observedAvailability =
      totalRequests > 0 ? Number((successfulRequests / totalRequests).toFixed(6)) : 1

    const allowedFailures =
      totalRequests > 0 ? Math.max(1, Math.floor(totalRequests * (1 - policy.targetSlo))) : 0

    const budgetUsed =
      allowedFailures > 0 ? failedRequests / allowedFailures : failedRequests > 0 ? 1 : 0
    const budgetRemaining = allowedFailures > 0 ? Math.max(0, allowedFailures - failedRequests) : 0
    const budgetRemainingRatio =
      allowedFailures > 0 ? Number((budgetRemaining / allowedFailures).toFixed(6)) : 1

    const status =
      budgetUsed >= policy.alertThresholdRatio
        ? 'critical'
        : budgetUsed >= policy.warningThresholdRatio
          ? 'warning'
          : 'healthy'

    return {
      policy,
      windowStart,
      windowEnd,
      totalRequests,
      failedRequests,
      observedAvailability,
      allowedFailures,
      budgetRemaining,
      budgetRemainingRatio,
      burnRate: Number(budgetUsed.toFixed(6)),
      status
    }
  }

  static createRollbackDrill(input: RollbackDrillCreateInput): RollbackDrill {
    const drillId = `drill_${crypto.randomUUID()}`
    const timestamp = now()
    const initiatedBy = input.initiatedBy.trim()
    if (!initiatedBy) {
      throw new Error('initiatedBy 不能为空')
    }

    const status: RollbackDrill['status'] =
      input.status === 'failed'
        ? 'failed'
        : input.status === 'completed'
          ? 'completed'
          : input.status === 'running'
            ? 'running'
            : 'scheduled'

    getLocalDb()
      .prepare(
        `
      INSERT INTO rollback_drills (
        id, policy_id, environment, status, trigger_type, initiated_by,
        summary, plan_json, result_json, started_at, completed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        drillId,
        input.policyId ? input.policyId.trim() || null : null,
        (input.environment || 'production').trim() || 'production',
        status,
        (input.triggerType || 'manual').trim() || 'manual',
        initiatedBy,
        String(input.summary || ''),
        JSON.stringify(input.plan || {}),
        JSON.stringify(input.result || {}),
        input.startedAt || null,
        input.completedAt || null,
        timestamp,
        timestamp
      )

    if (status === 'failed') {
      this.createAlert({
        policyId: input.policyId || null,
        level: 'critical',
        source: 'rollback_drill',
        title: '回滚演练失败',
        message: `回滚演练 ${drillId} 失败，请尽快处理`,
        payload: {
          drillId,
          environment: input.environment || 'production',
          initiatedBy
        }
      })
    }

    const drill = this.getRollbackDrill(drillId)
    if (!drill) throw new Error('回滚演练创建失败')
    return drill
  }

  static getRollbackDrill(drillId: string): RollbackDrill | null {
    const normalizedDrillId = drillId.trim()
    if (!normalizedDrillId) return null
    const row = getLocalDb()
      .prepare(`SELECT * FROM rollback_drills WHERE id = ? LIMIT 1`)
      .get(normalizedDrillId) as DbRecord | null
    return row ? toDrill(row) : null
  }

  static createAlert(input: ReliabilityAlertCreateInput): ReliabilityAlert {
    const alertId = `rel_alert_${crypto.randomUUID()}`
    const timestamp = now()
    const level: ReliabilityAlertLevel =
      input.level === 'critical' ? 'critical' : input.level === 'info' ? 'info' : 'warning'
    const status: ReliabilityAlert['status'] =
      input.status === 'acknowledged' ? 'acknowledged' : 'open'

    getLocalDb()
      .prepare(
        `
      INSERT INTO reliability_alerts (
        id, policy_id, level, source, title, message, status,
        payload_json, triggered_at, acknowledged_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        alertId,
        input.policyId ? input.policyId.trim() || null : null,
        level,
        (input.source || 'error_budget').trim() || 'error_budget',
        input.title.trim(),
        input.message.trim(),
        status,
        JSON.stringify(input.payload || {}),
        input.triggeredAt || timestamp,
        status === 'acknowledged' ? timestamp : null,
        timestamp
      )

    const row = getLocalDb()
      .prepare(`SELECT * FROM reliability_alerts WHERE id = ? LIMIT 1`)
      .get(alertId) as DbRecord | null
    if (!row) throw new Error('告警创建失败')
    return toAlert(row)
  }

  static acknowledgeAlert(
    alertId: string,
    acknowledgedBy: string,
    note?: string
  ): ReliabilityAlert | null {
    const normalizedAlertId = alertId.trim()
    if (!normalizedAlertId) return null

    const row = getLocalDb()
      .prepare(
        `
      SELECT * FROM reliability_alerts
      WHERE id = ?
      LIMIT 1
    `
      )
      .get(normalizedAlertId) as {
      payload_json?: string | null
    } | null

    if (!row) return null

    const acknowledgedAt = now()
    const ackBy = acknowledgedBy.trim() || 'admin'
    const ackNote = String(note || '').trim()
    const currentPayload = parseRecord(row.payload_json)
    const nextPayload: Record<string, unknown> = {
      ...currentPayload,
      ack: {
        by: ackBy,
        at: acknowledgedAt,
        ...(ackNote ? { note: ackNote } : {})
      }
    }

    getLocalDb()
      .prepare(
        `
      UPDATE reliability_alerts
      SET status = ?, acknowledged_at = ?, payload_json = ?
      WHERE id = ?
    `
      )
      .run('acknowledged', acknowledgedAt, JSON.stringify(nextPayload), normalizedAlertId)

    const updated = getLocalDb()
      .prepare(
        `
      SELECT * FROM reliability_alerts
      WHERE id = ?
      LIMIT 1
    `
      )
      .get(normalizedAlertId) as DbRecord | null
    return updated ? toAlert(updated) : null
  }

  static listAlerts(query: ReliabilityAlertQuery = {}): ReliabilityAlert[] {
    const whereParts: string[] = []
    const params: string[] = []

    if (query.level) {
      whereParts.push('level = ?')
      params.push(query.level)
    }

    if (query.status) {
      whereParts.push('status = ?')
      params.push(query.status)
    }

    const safeLimit =
      Number.isFinite(query.limit) && (query.limit || 0) > 0
        ? Math.min(200, Math.floor(query.limit as number))
        : 50

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : ''

    const rows = getLocalDb()
      .prepare(
        `
      SELECT * FROM reliability_alerts
      ${whereClause}
      ORDER BY triggered_at DESC
      LIMIT ${safeLimit}
    `
      )
      .all(...params) as DbRecord[]
    return rows.map(toAlert)
  }
}
