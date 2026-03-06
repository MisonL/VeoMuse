import React from 'react'
import type { DbRepairRecord } from './types'
import { DbRepairHistoryList } from './DbSummaryCards'

export interface DbRepairHistorySectionProps {
  repairRange: '24h' | '7d' | '30d' | 'all'
  repairStatusFilter: 'all' | 'ok' | 'repaired' | 'failed'
  repairReasonInput: string
  isRepairLoading: boolean
  isDbBusy: boolean
  dbRepairs: DbRepairRecord[]
  repairTotal: number | null
  repairHasMore: boolean
  onRepairRangeChange: (value: '24h' | '7d' | '30d' | 'all') => void
  onRepairStatusFilterChange: (value: 'all' | 'ok' | 'repaired' | 'failed') => void
  onRepairReasonInputChange: (value: string) => void
  onApplyReasonFilter: () => void
  onClearReasonFilter: () => void
  onLoadMoreRepairs: () => void
}

const DbRepairHistorySection: React.FC<DbRepairHistorySectionProps> = ({
  repairRange,
  repairStatusFilter,
  repairReasonInput,
  isRepairLoading,
  isDbBusy,
  dbRepairs,
  repairTotal,
  repairHasMore,
  onRepairRangeChange,
  onRepairStatusFilterChange,
  onRepairReasonInputChange,
  onApplyReasonFilter,
  onClearReasonFilter,
  onLoadMoreRepairs
}) => {
  return (
    <>
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
    </>
  )
}

export default DbRepairHistorySection
