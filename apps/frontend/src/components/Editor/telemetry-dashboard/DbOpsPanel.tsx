import React from 'react'
import type { DbHealthSummary, DbRepairRecord, DbRuntimeConfig } from './types'
import { DbHealthSummaryCard, DbRepairHistoryList, DbRuntimeSummaryCard } from './DbSummaryCards'

export interface DbOpsPanelProps {
  adminTokenInput: string
  isDbBusy: boolean
  dbRuntime: DbRuntimeConfig | null
  repairRange: '24h' | '7d' | '30d' | 'all'
  repairStatusFilter: 'all' | 'ok' | 'repaired' | 'failed'
  repairReasonInput: string
  isRepairLoading: boolean
  dbHealth: DbHealthSummary | null
  dbError: string
  dbRepairs: DbRepairRecord[]
  repairTotal: number | null
  repairHasMore: boolean
  onAdminTokenInputChange: (value: string) => void
  onSaveToken: () => void
  onFetchDbHealth: () => void
  onFetchDbRuntime: () => void
  onRepair: (force: boolean) => void
  onRepairRangeChange: (value: '24h' | '7d' | '30d' | 'all') => void
  onRepairStatusFilterChange: (value: 'all' | 'ok' | 'repaired' | 'failed') => void
  onRepairReasonInputChange: (value: string) => void
  onApplyReasonFilter: () => void
  onClearReasonFilter: () => void
  onLoadMoreRepairs: () => void
}

const DbOpsPanel: React.FC<DbOpsPanelProps> = ({
  adminTokenInput,
  isDbBusy,
  dbRuntime,
  repairRange,
  repairStatusFilter,
  repairReasonInput,
  isRepairLoading,
  dbHealth,
  dbError,
  dbRepairs,
  repairTotal,
  repairHasMore,
  onAdminTokenInputChange,
  onSaveToken,
  onFetchDbHealth,
  onFetchDbRuntime,
  onRepair,
  onRepairRangeChange,
  onRepairStatusFilterChange,
  onRepairReasonInputChange,
  onApplyReasonFilter,
  onClearReasonFilter,
  onLoadMoreRepairs
}) => {
  return (
    <section className="db-ops-panel">
      <h3 className="telemetry-section-title">数据库自愈中心</h3>
      <form
        className="db-token-row"
        onSubmit={(event) => {
          event.preventDefault()
          onSaveToken()
        }}
      >
        <input
          type="text"
          name="username"
          autoComplete="username"
          tabIndex={-1}
          aria-hidden="true"
          hidden
        />
        <input
          type="password"
          id="db-admin-token"
          name="dbAdminToken"
          aria-label="管理员令牌（x-admin-token）"
          autoComplete="new-password"
          value={adminTokenInput}
          onChange={(event) => onAdminTokenInputChange(event.target.value)}
          placeholder="输入管理员令牌（x-admin-token）"
        />
        <button type="submit">保存令牌</button>
      </form>

      <div className="db-actions-row">
        <button disabled={isDbBusy} onClick={onFetchDbHealth}>
          健康检查
        </button>
        <button disabled={isDbBusy} onClick={onFetchDbRuntime}>
          运行配置
        </button>
        <button disabled={isDbBusy} onClick={() => onRepair(false)}>
          温和修复
        </button>
        <button disabled={isDbBusy} className="danger" onClick={() => onRepair(true)}>
          强制修复
        </button>
      </div>

      <DbRuntimeSummaryCard runtime={dbRuntime} />

      <div className="db-filter-grid">
        <label className="db-filter-field">
          <span>历史范围</span>
          <select
            id="db-repair-range"
            name="dbRepairRange"
            value={repairRange}
            onChange={(event) =>
              onRepairRangeChange(event.target.value as '24h' | '7d' | '30d' | 'all')
            }
          >
            <option value="24h">最近 24 小时</option>
            <option value="7d">最近 7 天</option>
            <option value="30d">最近 30 天</option>
            <option value="all">全部</option>
          </select>
        </label>
        <label className="db-filter-field">
          <span>状态</span>
          <select
            id="db-repair-status"
            name="dbRepairStatus"
            value={repairStatusFilter}
            onChange={(event) =>
              onRepairStatusFilterChange(event.target.value as 'all' | 'ok' | 'repaired' | 'failed')
            }
          >
            <option value="all">全部</option>
            <option value="ok">ok</option>
            <option value="repaired">repaired</option>
            <option value="failed">failed</option>
          </select>
        </label>
      </div>

      <div className="db-search-row">
        <input
          type="text"
          id="db-repair-reason"
          name="dbRepairReason"
          aria-label="修复原因关键词筛选"
          value={repairReasonInput}
          onChange={(event) => onRepairReasonInputChange(event.target.value)}
          placeholder="按修复原因关键词筛选"
        />
        <button disabled={isRepairLoading} onClick={onApplyReasonFilter}>
          应用筛选
        </button>
        <button disabled={isRepairLoading} onClick={onClearReasonFilter}>
          清空
        </button>
      </div>

      <DbHealthSummaryCard health={dbHealth} />

      {dbError ? <div className="db-error">{dbError}</div> : null}

      <div className="db-repair-summary">
        <span>
          已显示 {dbRepairs.length}
          {repairTotal === null ? '' : ` / ${repairTotal}`} 条
        </span>
        <span>{isRepairLoading ? '加载中...' : repairHasMore ? '可继续加载' : '已到末尾'}</span>
      </div>

      <DbRepairHistoryList repairs={dbRepairs} />

      {repairHasMore ? (
        <button
          className="db-load-more"
          disabled={isRepairLoading || isDbBusy}
          onClick={onLoadMoreRepairs}
        >
          {isRepairLoading ? '加载中...' : '加载更多'}
        </button>
      ) : null}
    </section>
  )
}

export default DbOpsPanel
