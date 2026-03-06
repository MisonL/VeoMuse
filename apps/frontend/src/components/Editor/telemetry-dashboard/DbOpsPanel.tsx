import React from 'react'
import type { DbHealthSummary, DbRepairRecord, DbRuntimeConfig } from './types'
import { DbHealthSummaryCard, DbRuntimeSummaryCard } from './DbSummaryCards'
import DbRepairHistorySection from './DbRepairHistorySection'

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

      <DbHealthSummaryCard health={dbHealth} />

      {dbError ? <div className="db-error">{dbError}</div> : null}
      <DbRepairHistorySection
        repairRange={repairRange}
        repairStatusFilter={repairStatusFilter}
        repairReasonInput={repairReasonInput}
        isRepairLoading={isRepairLoading}
        isDbBusy={isDbBusy}
        dbRepairs={dbRepairs}
        repairTotal={repairTotal}
        repairHasMore={repairHasMore}
        onRepairRangeChange={onRepairRangeChange}
        onRepairStatusFilterChange={onRepairStatusFilterChange}
        onRepairReasonInputChange={onRepairReasonInputChange}
        onApplyReasonFilter={onApplyReasonFilter}
        onClearReasonFilter={onClearReasonFilter}
        onLoadMoreRepairs={onLoadMoreRepairs}
      />
    </section>
  )
}

export default DbOpsPanel
