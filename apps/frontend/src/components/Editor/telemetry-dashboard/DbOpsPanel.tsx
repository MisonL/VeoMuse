import React from 'react'
import type { DbHealthSummary, DbRuntimeConfig } from './types'
import { DbHealthSummaryCard, DbRuntimeSummaryCard } from './DbSummaryCards'
import DbRepairHistorySection, { type DbRepairHistorySectionProps } from './DbRepairHistorySection'

export interface DbOpsPanelHeaderProps {
  adminTokenInput: string
  isDbBusy: boolean
  dbRuntime: DbRuntimeConfig | null
  dbHealth: DbHealthSummary | null
  dbError: string
  onAdminTokenInputChange: (value: string) => void
  onSaveToken: () => void
  onFetchDbHealth: () => void
  onFetchDbRuntime: () => void
  onRepair: (force: boolean) => void
}

export interface DbOpsPanelProps {
  headerProps: DbOpsPanelHeaderProps
  repairHistorySectionProps: DbRepairHistorySectionProps
}

const DbOpsPanel: React.FC<DbOpsPanelProps> = ({ headerProps, repairHistorySectionProps }) => {
  return (
    <section className="db-ops-panel">
      <h3 className="telemetry-section-title">数据库自愈中心</h3>
      <form
        className="db-token-row"
        onSubmit={(event) => {
          event.preventDefault()
          headerProps.onSaveToken()
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
          value={headerProps.adminTokenInput}
          onChange={(event) => headerProps.onAdminTokenInputChange(event.target.value)}
          placeholder="输入管理员令牌（x-admin-token）"
        />
        <button type="submit">保存令牌</button>
      </form>

      <div className="db-actions-row">
        <button disabled={headerProps.isDbBusy} onClick={headerProps.onFetchDbHealth}>
          健康检查
        </button>
        <button disabled={headerProps.isDbBusy} onClick={headerProps.onFetchDbRuntime}>
          运行配置
        </button>
        <button disabled={headerProps.isDbBusy} onClick={() => headerProps.onRepair(false)}>
          温和修复
        </button>
        <button
          disabled={headerProps.isDbBusy}
          className="danger"
          onClick={() => headerProps.onRepair(true)}
        >
          强制修复
        </button>
      </div>

      <DbRuntimeSummaryCard runtime={headerProps.dbRuntime} />

      <DbHealthSummaryCard health={headerProps.dbHealth} />

      {headerProps.dbError ? <div className="db-error">{headerProps.dbError}</div> : null}
      <DbRepairHistorySection {...repairHistorySectionProps} />
    </section>
  )
}

export default DbOpsPanel
