import React from 'react'
import type { PolicyPriority, RoutingDecision, RoutingExecution, RoutingPolicy, ModelOption, PolicyWeightState } from '../types'
import { POLICY_BUDGET_GUARD_LABELS } from '../constants'

interface MarketplaceModePanelProps {
  selectedPolicyId: string
  policies: RoutingPolicy[]
  selectedPolicy: RoutingPolicy | null
  availableModels: ModelOption[]
  marketplace: any[]
  policyCreateName: string
  policyCreatePriority: PolicyPriority
  policyCreateBudget: number
  policyAllowedModels: string[]
  policyWeights: PolicyWeightState
  policyPrompt: string
  policyBudget: number
  policyPriority: PolicyPriority
  policyDecision: RoutingDecision | null
  policyExecutions: RoutingExecution[]
  policyExecHasMore: boolean
  isPolicyLoading: boolean
  isPolicySimulating: boolean
  policyExecLoading: boolean
  onSelectedPolicyChange: (value: string) => void
  onPolicyCreateNameChange: (value: string) => void
  onPolicyCreatePriorityChange: (value: PolicyPriority) => void
  onPolicyCreateBudgetChange: (value: number) => void
  onPolicyWeightChange: (key: keyof PolicyWeightState, value: number) => void
  onToggleAllowedModel: (modelId: string) => void
  onCreatePolicy: () => void
  onLoadPolicies: (notify: boolean) => void
  onUpdateSelectedPolicy: () => void
  onPolicyPromptChange: (value: string) => void
  onPolicyBudgetChange: (value: number) => void
  onPolicyPriorityChange: (value: PolicyPriority) => void
  onSimulatePolicy: () => void
  onLoadPolicyExecutions: (reset: boolean) => void
}

const MarketplaceModePanel: React.FC<MarketplaceModePanelProps> = ({
  selectedPolicyId,
  policies,
  selectedPolicy,
  availableModels,
  marketplace,
  policyCreateName,
  policyCreatePriority,
  policyCreateBudget,
  policyAllowedModels,
  policyWeights,
  policyPrompt,
  policyBudget,
  policyPriority,
  policyDecision,
  policyExecutions,
  policyExecHasMore,
  isPolicyLoading,
  isPolicySimulating,
  policyExecLoading,
  onSelectedPolicyChange,
  onPolicyCreateNameChange,
  onPolicyCreatePriorityChange,
  onPolicyCreateBudgetChange,
  onPolicyWeightChange,
  onToggleAllowedModel,
  onCreatePolicy,
  onLoadPolicies,
  onUpdateSelectedPolicy,
  onPolicyPromptChange,
  onPolicyBudgetChange,
  onPolicyPriorityChange,
  onSimulatePolicy,
  onLoadPolicyExecutions
}) => {
  return (
    <div className="marketplace-shell">
      <div className="marketplace-policy">
        <h4>策略治理中心</h4>
        <label className="lab-field">
          <span>策略</span>
          <select name="selectedPolicyId" value={selectedPolicyId} onChange={(event) => onSelectedPolicyChange(event.target.value)}>
            <option value="">未选择（使用默认策略）</option>
            {policies.map(item => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.priority} · ${item.maxBudgetUsd}
              </option>
            ))}
          </select>
        </label>

        <div className="policy-create-grid">
          <label className="lab-field">
            <span>新策略名称</span>
            <input
              type="text"
              name="policyCreateName"
              value={policyCreateName}
              onChange={(event) => onPolicyCreateNameChange(event.target.value)}
            />
          </label>
          <label className="lab-field">
            <span>优先级</span>
            <select name="policyCreatePriority" value={policyCreatePriority} onChange={(event) => onPolicyCreatePriorityChange(event.target.value as PolicyPriority)}>
              <option value="quality">质量</option>
              <option value="speed">速度</option>
              <option value="cost">成本</option>
            </select>
          </label>
          <label className="lab-field">
            <span>预算上限（USD）</span>
            <input
              type="number"
              name="policyCreateBudget"
              min={0}
              step={0.1}
              value={policyCreateBudget}
              onChange={(event) => onPolicyCreateBudgetChange(Number(event.target.value || 0))}
            />
          </label>
          <div className="policy-weight-grid">
            {(['quality', 'speed', 'cost', 'reliability'] as const).map(key => (
              <label key={key} className="lab-field">
                <span>{key}</span>
                <input
                  type="number"
                  name={`policyWeight-${key}`}
                  min={0}
                  max={1}
                  step={0.05}
                  value={policyWeights[key]}
                  onChange={(event) => {
                    const next = Math.max(0, Math.min(1, Number(event.target.value || 0)))
                    onPolicyWeightChange(key, next)
                  }}
                />
              </label>
            ))}
          </div>
          <div className="policy-model-list">
            {availableModels.map(model => (
              <label key={model.id} className="policy-model-chip">
                <input
                  type="checkbox"
                  name={`policyAllowed-${model.id}`}
                  checked={policyAllowedModels.includes(model.id)}
                  onChange={() => onToggleAllowedModel(model.id)}
                />
                <span>{model.name}</span>
              </label>
            ))}
          </div>
          <div className="lab-inline-actions">
            <button disabled={isPolicyLoading} onClick={onCreatePolicy}>创建策略</button>
            <button disabled={isPolicyLoading} onClick={() => onLoadPolicies(true)}>
              {isPolicyLoading ? '刷新中...' : '刷新策略'}
            </button>
            <button disabled={!selectedPolicy || isPolicyLoading} onClick={onUpdateSelectedPolicy}>
              {selectedPolicy?.enabled ? '停用策略' : '启用策略'}
            </button>
          </div>
        </div>

        <h4>路由模拟</h4>
        <textarea
          name="policyPrompt"
          value={policyPrompt}
          onChange={(e) => onPolicyPromptChange(e.target.value)}
          placeholder="输入生成意图，例如：写实风格的都市夜景追车镜头，8秒"
        />
        <div className="policy-controls">
          <label>
            预算 $
            <input name="policyBudget" type="number" min={0} step={0.1} value={policyBudget} onChange={(e) => onPolicyBudgetChange(Number(e.target.value || 0))} />
          </label>
          <label>
            优先级
            <select name="policyPriority" value={policyPriority} onChange={(e) => onPolicyPriorityChange(e.target.value as PolicyPriority)}>
              <option value="quality">质量</option>
              <option value="speed">速度</option>
              <option value="cost">成本</option>
            </select>
          </label>
          <button disabled={isPolicySimulating} onClick={onSimulatePolicy}>
            {isPolicySimulating ? '模拟中...' : '模拟路由'}
          </button>
        </div>
        {policyDecision ? (
          <div className="policy-result">
            <div>推荐模型：<b>{policyDecision.recommendedModelId}</b></div>
            <div>预计成本：${policyDecision.estimatedCostUsd}</div>
            <div>预计时延：{policyDecision.estimatedLatencyMs}ms</div>
            <div>原因：{policyDecision.reason}</div>
            {policyDecision.budgetGuard ? (
              <div className={`policy-budget-guard ${policyDecision.budgetGuard.status}`}>
                <div className="policy-budget-head">
                  <strong>{POLICY_BUDGET_GUARD_LABELS[policyDecision.budgetGuard.status]}</strong>
                  <span>
                    预算 ${policyDecision.budgetGuard.budgetUsd.toFixed(4)} ·
                    阈值 {(policyDecision.budgetGuard.alertThresholdRatio * 100).toFixed(0)}%
                  </span>
                </div>
                <div>{policyDecision.budgetGuard.message}</div>
              </div>
            ) : null}
            {Array.isArray(policyDecision.scoreBreakdown) && policyDecision.scoreBreakdown.length > 0 ? (
              <div className="policy-breakdown">
                {policyDecision.scoreBreakdown.map(item => (
                  <div key={item.modelId}>
                    {item.modelId}: Q{item.quality.toFixed(2)} / S{item.speed.toFixed(2)} / C{item.cost.toFixed(2)} / R{item.reliability.toFixed(2)} {'=>'} <b>{item.finalScore.toFixed(2)}</b>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="market-right-stack">
        <div className="market-grid">
          {marketplace.map((item: any) => (
            <div key={item.profile.id} className="market-card">
              <div className="market-head">
                <strong>{item.profile.name}</strong>
                <span>{item.profile.provider}</span>
              </div>
              <div className="market-tags">
                {item.profile.capabilities.map((tag: string) => <span key={tag}>{tag}</span>)}
              </div>
              <div className="market-metrics">
                <div>成功率：{Math.round((item.metrics.successRate || 0) * 100)}%</div>
                <div>P95：{item.metrics.p95LatencyMs}ms</div>
                <div>均价：${item.profile.costPerSecond}/s</div>
              </div>
            </div>
          ))}
        </div>

        <div className="execution-panel">
          <div className="execution-head">
            <h4>策略执行记录</h4>
            <button disabled={!selectedPolicyId || policyExecLoading} onClick={() => onLoadPolicyExecutions(true)}>
              刷新
            </button>
          </div>
          <div className="execution-list">
            {policyExecutions.map(row => (
              <div key={row.id} className="execution-item">
                <div className="execution-title">{row.recommendedModelId} · {row.priority}</div>
                <div className="execution-meta">
                  <span>${row.estimatedCostUsd}</span>
                  <span>{row.estimatedLatencyMs}ms</span>
                  <span>{new Date(row.createdAt).toLocaleString()}</span>
                </div>
                <div className="execution-reason">{row.reason}</div>
              </div>
            ))}
            {policyExecutions.length === 0 ? <div className="api-empty">暂无策略执行记录</div> : null}
          </div>
          {policyExecHasMore ? (
            <button
              className="execution-load-more"
              disabled={policyExecLoading}
              onClick={() => onLoadPolicyExecutions(false)}
            >
              {policyExecLoading ? '加载中...' : '加载更多'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default MarketplaceModePanel
