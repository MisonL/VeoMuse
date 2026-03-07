import React from 'react'
import type { ProviderHealthItem } from '../telemetryDashboard.logic'

export interface ProviderHealthPanelProps {
  isLoading: boolean
  rows: ProviderHealthItem[]
  error: string
  onRefresh: () => void
}

const ProviderHealthPanel: React.FC<ProviderHealthPanelProps> = ({
  isLoading,
  rows,
  error,
  onRefresh
}) => (
  <section className="provider-health-panel">
    <h3 className="telemetry-section-title">Provider 健康检查</h3>
    <div className="governance-action-row">
      <button disabled={isLoading} onClick={onRefresh}>
        {isLoading ? '检查中...' : '刷新 Provider 状态'}
      </button>
      <span>{rows.length > 0 ? `已检查 ${rows.length} 个` : '暂无数据'}</span>
    </div>
    {error ? <div className="db-error">{error}</div> : null}
    <div className="governance-list">
      {rows.slice(0, 20).map((item) => (
        <div key={item.providerId} className="governance-item">
          <span>
            {item.providerId} / {item.category}
          </span>
          <span>{item.status}</span>
          <span>{item.latencyMs ?? '-'}ms</span>
        </div>
      ))}
      {rows.length === 0 ? <div className="api-empty">暂无 Provider 健康记录</div> : null}
    </div>
  </section>
)

export default ProviderHealthPanel
