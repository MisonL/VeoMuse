import React from 'react'
import {
  formatLocalDateTime,
  formatLocalTime,
  formatRatioPercent,
  getAckLabel,
  isAlertAckDisabled
} from '../collabModePanel.logic'
import type {
  V4ErrorBudget,
  V4ReliabilityAlert,
  V4ReliabilityAlertLevel,
  V4RollbackDrillResult
} from '../../types'

const FALLBACK_TEXT = '-'

const clampPercent = (value: number | null | undefined) => {
  if (!Number.isFinite(value as number)) return 0
  return Math.max(0, Math.min(100, Math.round(Number(value) * 100)))
}

const resolveOpsTone = (status: string | null | undefined) => {
  if (status === 'healthy' || status === 'completed' || status === 'acknowledged') return 'success'
  if (status === 'warning' || status === 'running') return 'warning'
  if (status === 'critical' || status === 'failed' || status === 'open') return 'critical'
  return 'neutral'
}

export interface OpsToolsSectionProps {
  adminToken: string
  reliabilityAlertLevel: 'all' | V4ReliabilityAlertLevel
  reliabilityAlertStatus: 'all' | V4ReliabilityAlert['status']
  reliabilityAlertLimit: string
  reliabilityAlerts: V4ReliabilityAlert[]
  errorBudget: V4ErrorBudget | null
  errorBudgetScope: string
  errorBudgetTargetSlo: string
  errorBudgetWindowDays: string
  errorBudgetWarningThresholdRatio: string
  errorBudgetAlertThresholdRatio: string
  errorBudgetFreezeDeployOnBreach: boolean
  rollbackPolicyId: string
  rollbackEnvironment: string
  rollbackTriggerType: string
  rollbackSummary: string
  rollbackPlan: string
  rollbackResult: string
  rollbackDrillId: string
  rollbackDrillResult: V4RollbackDrillResult | null
  isOpsBusy: boolean
  onAdminTokenChange: (value: string) => void
  onReliabilityAlertLevelChange: (value: 'all' | V4ReliabilityAlertLevel) => void
  onReliabilityAlertStatusChange: (value: 'all' | V4ReliabilityAlert['status']) => void
  onReliabilityAlertLimitChange: (value: string) => void
  onLoadReliabilityAlerts: () => void
  onAcknowledgeReliabilityAlert: (alertId: string) => void
  onLoadErrorBudget: () => void
  onErrorBudgetScopeChange: (value: string) => void
  onErrorBudgetTargetSloChange: (value: string) => void
  onErrorBudgetWindowDaysChange: (value: string) => void
  onErrorBudgetWarningThresholdRatioChange: (value: string) => void
  onErrorBudgetAlertThresholdRatioChange: (value: string) => void
  onErrorBudgetFreezeDeployOnBreachChange: (value: boolean) => void
  onRollbackPolicyIdChange: (value: string) => void
  onRollbackEnvironmentChange: (value: string) => void
  onRollbackTriggerTypeChange: (value: string) => void
  onRollbackSummaryChange: (value: string) => void
  onRollbackPlanChange: (value: string) => void
  onRollbackResultChange: (value: string) => void
  onUpdateErrorBudget: () => void
  onTriggerRollbackDrill: () => void
  onRollbackDrillIdChange: (value: string) => void
  onQueryRollbackDrill: () => void
}

const OpsToolsSection: React.FC<OpsToolsSectionProps> = ({
  adminToken,
  reliabilityAlertLevel,
  reliabilityAlertStatus,
  reliabilityAlertLimit,
  reliabilityAlerts,
  errorBudget,
  errorBudgetScope,
  errorBudgetTargetSlo,
  errorBudgetWindowDays,
  errorBudgetWarningThresholdRatio,
  errorBudgetAlertThresholdRatio,
  errorBudgetFreezeDeployOnBreach,
  rollbackPolicyId,
  rollbackEnvironment,
  rollbackTriggerType,
  rollbackSummary,
  rollbackPlan,
  rollbackResult,
  rollbackDrillId,
  rollbackDrillResult,
  isOpsBusy,
  onAdminTokenChange,
  onReliabilityAlertLevelChange,
  onReliabilityAlertStatusChange,
  onReliabilityAlertLimitChange,
  onLoadReliabilityAlerts,
  onAcknowledgeReliabilityAlert,
  onLoadErrorBudget,
  onErrorBudgetScopeChange,
  onErrorBudgetTargetSloChange,
  onErrorBudgetWindowDaysChange,
  onErrorBudgetWarningThresholdRatioChange,
  onErrorBudgetAlertThresholdRatioChange,
  onErrorBudgetFreezeDeployOnBreachChange,
  onRollbackPolicyIdChange,
  onRollbackEnvironmentChange,
  onRollbackTriggerTypeChange,
  onRollbackSummaryChange,
  onRollbackPlanChange,
  onRollbackResultChange,
  onUpdateErrorBudget,
  onTriggerRollbackDrill,
  onRollbackDrillIdChange,
  onQueryRollbackDrill
}) => {
  const hasAdminToken = adminToken.trim().length > 0
  const openReliabilityAlerts = reliabilityAlerts.filter((item) => item.status === 'open')
  const acknowledgedReliabilityAlerts = reliabilityAlerts.filter(
    (item) => item.status === 'acknowledged'
  )
  const criticalReliabilityAlerts = openReliabilityAlerts.filter(
    (item) => item.level === 'critical'
  )
  const budgetRemainingPercent = clampPercent(errorBudget?.evaluation.budgetRemainingRatio)
  const budgetStatus = errorBudget?.evaluation.status || FALLBACK_TEXT
  const rollbackStatus = rollbackDrillResult?.status || FALLBACK_TEXT
  const watchboardMessage = !hasAdminToken
    ? '未填写管理员令牌，值班动作仍会展示但关键运维操作不可执行。'
    : criticalReliabilityAlerts.length > 0
      ? `存在 ${criticalReliabilityAlerts.length} 条 critical 告警，请优先处理 ACK、错误预算和回滚演练。`
      : errorBudget?.evaluation.status === 'critical'
        ? '错误预算已进入 critical 区间，建议冻结发布并执行演练复核。'
        : '当前运维态势稳定，可继续使用值班层观察告警与预算变化。'

  return (
    <section className="collab-card">
      <h4>运维工具</h4>
      <div className="lab-metric-grid ops-summary-grid" data-testid="ops-watchboard">
        <div className="lab-metric-card lab-metric-card--critical">
          <span>开放告警</span>
          <strong>{openReliabilityAlerts.length}</strong>
          <small>critical {criticalReliabilityAlerts.length} 条</small>
        </div>
        <div className="lab-metric-card lab-metric-card--success">
          <span>已 ACK</span>
          <strong>{acknowledgedReliabilityAlerts.length}</strong>
          <small>管理员令牌：{hasAdminToken ? '已保存' : '缺失'}</small>
        </div>
        <div
          className={`lab-metric-card lab-metric-card--${resolveOpsTone(errorBudget?.evaluation.status)}`}
        >
          <span>错误预算</span>
          <strong>{formatRatioPercent(errorBudget?.evaluation.budgetRemainingRatio)}</strong>
          <small>状态：{budgetStatus}</small>
        </div>
        <div
          className={`lab-metric-card lab-metric-card--${resolveOpsTone(rollbackDrillResult?.status)}`}
        >
          <span>回滚演练</span>
          <strong>{rollbackStatus}</strong>
          <small>{formatLocalDateTime(rollbackDrillResult?.completedAt)}</small>
        </div>
      </div>
      <div className="collab-watch-spotlight">
        <div className="collab-watch-spotlight-copy">
          <span className="collab-advanced-group-kicker">on-call layer</span>
          <strong>{watchboardMessage}</strong>
          <span>告警、错误预算和演练结果会在这一层聚合，适合作为发布前最后一道值班视图。</span>
        </div>
        <div className="collab-watch-inline">
          <div>
            <b>告警筛选</b>
            <span>
              {reliabilityAlertLevel}/{reliabilityAlertStatus}
            </span>
          </div>
          <div>
            <b>预算余量</b>
            <span>{formatRatioPercent(errorBudget?.evaluation.budgetRemainingRatio)}</span>
          </div>
          <div>
            <b>演练状态</b>
            <span>{rollbackStatus}</span>
          </div>
        </div>
      </div>
      <div className="lab-inline-fields">
        <label className="lab-field">
          <span>管理员令牌</span>
          <input
            name="v4AdminToken"
            value={adminToken}
            onChange={(event) => onAdminTokenChange(event.target.value)}
            placeholder="用于 x-admin-token 请求头，可持久化"
          />
        </label>
      </div>
      {!hasAdminToken ? (
        <div className="api-empty">未填写管理员令牌，运维动作按钮已禁用。</div>
      ) : null}
      <div className="lab-inline-fields">
        <label className="lab-field">
          <span>告警级别</span>
          <select
            name="v4AlertLevel"
            value={reliabilityAlertLevel}
            onChange={(event) =>
              onReliabilityAlertLevelChange(event.target.value as 'all' | V4ReliabilityAlertLevel)
            }
          >
            <option value="all">全部</option>
            <option value="info">info</option>
            <option value="warning">warning</option>
            <option value="critical">critical</option>
          </select>
        </label>
        <label className="lab-field">
          <span>告警状态</span>
          <select
            name="v4AlertStatus"
            value={reliabilityAlertStatus}
            onChange={(event) =>
              onReliabilityAlertStatusChange(
                event.target.value as 'all' | V4ReliabilityAlert['status']
              )
            }
          >
            <option value="all">全部</option>
            <option value="open">open</option>
            <option value="acknowledged">acknowledged</option>
          </select>
        </label>
        <label className="lab-field">
          <span>查询数量</span>
          <input
            type="number"
            min={1}
            name="v4AlertLimit"
            value={reliabilityAlertLimit}
            onChange={(event) => onReliabilityAlertLimitChange(event.target.value)}
            placeholder="20"
          />
        </label>
        <button
          className="inline-fill-btn"
          disabled={!hasAdminToken || isOpsBusy}
          onClick={onLoadReliabilityAlerts}
        >
          查询告警
        </button>
      </div>
      <div className="collab-meta">
        <span>告警列表</span>
      </div>
      <div className="collab-list">
        {reliabilityAlerts.map((item) => (
          <div key={item.id} className="collab-list-item collab-list-item--rich">
            <div className="collab-list-item-head">
              <strong>{item.title}</strong>
              <span className={`lab-status-badge lab-status-badge--${resolveOpsTone(item.status)}`}>
                {item.level} · {item.status}
              </span>
            </div>
            <div className="collab-list-item-copy">
              {(item as V4ReliabilityAlert & { description?: string }).message ||
                (item as V4ReliabilityAlert & { description?: string }).description ||
                FALLBACK_TEXT}
            </div>
            <div className="collab-list-meta">
              <span>触发：{formatLocalDateTime(item.triggeredAt)}</span>
              <span>ACK：{formatLocalDateTime(item.acknowledgedAt)}</span>
            </div>
            <div className="lab-inline-actions">
              <button
                disabled={!hasAdminToken || isAlertAckDisabled(isOpsBusy, item.status)}
                onClick={() => onAcknowledgeReliabilityAlert(item.id)}
              >
                {getAckLabel(item.status)}
              </button>
            </div>
          </div>
        ))}
        {reliabilityAlerts.length === 0 ? <div className="api-empty">暂无可靠性告警</div> : null}
      </div>
      <div className="lab-inline-actions">
        <button disabled={!hasAdminToken || isOpsBusy} onClick={onLoadErrorBudget}>
          读取错误预算
        </button>
        <button disabled={!hasAdminToken || isOpsBusy} onClick={onUpdateErrorBudget}>
          更新错误预算策略
        </button>
        <button disabled={!hasAdminToken || isOpsBusy} onClick={onTriggerRollbackDrill}>
          触发回滚演练
        </button>
      </div>
      <div className="lab-inline-fields">
        <label className="lab-field">
          <span>作用域</span>
          <input
            name="v4ErrorBudgetScope"
            value={errorBudgetScope}
            onChange={(event) => onErrorBudgetScopeChange(event.target.value)}
            placeholder="global"
          />
        </label>
        <label className="lab-field">
          <span>targetSlo</span>
          <input
            type="number"
            min={0.5}
            max={0.99999}
            step={0.00001}
            name="v4ErrorBudgetTargetSlo"
            value={errorBudgetTargetSlo}
            onChange={(event) => onErrorBudgetTargetSloChange(event.target.value)}
            placeholder="0.99"
          />
        </label>
        <label className="lab-field">
          <span>windowDays</span>
          <input
            type="number"
            min={1}
            name="v4ErrorBudgetWindowDays"
            value={errorBudgetWindowDays}
            onChange={(event) => onErrorBudgetWindowDaysChange(event.target.value)}
            placeholder="30"
          />
        </label>
      </div>
      <div className="lab-inline-fields">
        <label className="lab-field">
          <span>warningRatio</span>
          <input
            type="number"
            min={0}
            max={1}
            step={0.01}
            name="v4ErrorBudgetWarningThresholdRatio"
            value={errorBudgetWarningThresholdRatio}
            onChange={(event) => onErrorBudgetWarningThresholdRatioChange(event.target.value)}
            placeholder="0.7"
          />
        </label>
        <label className="lab-field">
          <span>alertRatio</span>
          <input
            type="number"
            min={0}
            max={1}
            step={0.01}
            name="v4ErrorBudgetAlertThresholdRatio"
            value={errorBudgetAlertThresholdRatio}
            onChange={(event) => onErrorBudgetAlertThresholdRatioChange(event.target.value)}
            placeholder="0.9"
          />
        </label>
        <label className="lab-field">
          <span>超限冻结发布</span>
          <input
            type="checkbox"
            name="v4ErrorBudgetFreezeDeployOnBreach"
            checked={errorBudgetFreezeDeployOnBreach}
            onChange={(event) => onErrorBudgetFreezeDeployOnBreachChange(event.target.checked)}
          />
        </label>
      </div>
      <div className="ops-budget-card">
        <div className="ops-budget-card-head">
          <strong>错误预算可视化</strong>
          <span>{budgetRemainingPercent}%</span>
        </div>
        <div className="lab-mini-progress" aria-hidden="true">
          <span style={{ width: `${budgetRemainingPercent}%` }} />
        </div>
        <div className="collab-meta">
          <span>预算余量：{errorBudget?.evaluation.budgetRemaining ?? FALLBACK_TEXT}</span>
          <span>预算比例：{formatRatioPercent(errorBudget?.evaluation.budgetRemainingRatio)}</span>
          <span>BurnRate：{errorBudget?.evaluation.burnRate ?? FALLBACK_TEXT}</span>
          <span>状态：{budgetStatus}</span>
          <span>演练：{rollbackStatus}</span>
        </div>
      </div>
      <div className="lab-inline-fields">
        <label className="lab-field">
          <span>policyId</span>
          <input
            name="v4RollbackPolicyId"
            value={rollbackPolicyId}
            onChange={(event) => onRollbackPolicyIdChange(event.target.value)}
            placeholder="可选"
          />
        </label>
        <label className="lab-field">
          <span>environment</span>
          <input
            name="v4RollbackEnvironment"
            value={rollbackEnvironment}
            onChange={(event) => onRollbackEnvironmentChange(event.target.value)}
            placeholder="staging"
          />
        </label>
        <label className="lab-field">
          <span>triggerType</span>
          <input
            name="v4RollbackTriggerType"
            value={rollbackTriggerType}
            onChange={(event) => onRollbackTriggerTypeChange(event.target.value)}
            placeholder="manual"
          />
        </label>
      </div>
      <label className="lab-field">
        <span>summary</span>
        <input
          name="v4RollbackSummary"
          value={rollbackSummary}
          onChange={(event) => onRollbackSummaryChange(event.target.value)}
          placeholder="触发回滚演练说明"
        />
      </label>
      <div className="lab-inline-fields">
        <label className="lab-field">
          <span>plan(JSON)</span>
          <textarea
            name="v4RollbackPlan"
            value={rollbackPlan}
            onChange={(event) => onRollbackPlanChange(event.target.value)}
            placeholder='{"steps":[]}'
          />
        </label>
        <label className="lab-field">
          <span>result(JSON)</span>
          <textarea
            name="v4RollbackResult"
            value={rollbackResult}
            onChange={(event) => onRollbackResultChange(event.target.value)}
            placeholder="{}"
          />
        </label>
      </div>
      <div className="lab-inline-fields">
        <label className="lab-field">
          <span>演练 ID</span>
          <input
            name="v4RollbackDrillId"
            value={rollbackDrillId}
            onChange={(event) => onRollbackDrillIdChange(event.target.value)}
            placeholder="留空则使用最近一次记录"
          />
        </label>
        <button
          className="inline-fill-btn"
          disabled={!hasAdminToken || isOpsBusy}
          onClick={onQueryRollbackDrill}
        >
          查询演练结果
        </button>
      </div>
      <div className="collab-list">
        {rollbackDrillResult ? (
          <div className="collab-list-item collab-list-item--rich">
            <div className="collab-list-item-head">
              <strong>{rollbackDrillResult.id}</strong>
              <span
                className={`lab-status-badge lab-status-badge--${resolveOpsTone(rollbackDrillResult.status)}`}
              >
                {rollbackDrillResult.status}
              </span>
            </div>
            <div className="collab-list-meta">
              <span>环境：{rollbackDrillResult.environment}</span>
              <span>触发：{rollbackDrillResult.triggerType}</span>
              <span>完成：{formatLocalTime(rollbackDrillResult.completedAt)}</span>
            </div>
            <div className="collab-list-item-copy">
              {rollbackDrillResult.summary || FALLBACK_TEXT}
            </div>
          </div>
        ) : (
          <div className="api-empty">暂无回滚演练结果</div>
        )}
      </div>
    </section>
  )
}

export default OpsToolsSection
