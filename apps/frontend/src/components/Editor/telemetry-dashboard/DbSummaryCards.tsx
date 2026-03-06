import React from 'react'
import type { DbHealthSummary, DbRepairRecord, DbRuntimeConfig } from './types'

interface DbRuntimeSummaryCardProps {
  runtime: DbRuntimeConfig | null
}

interface DbHealthSummaryCardProps {
  health: DbHealthSummary | null
}

interface DbRepairHistoryListProps {
  repairs: DbRepairRecord[]
}

export const DbRuntimeSummaryCard: React.FC<DbRuntimeSummaryCardProps> = ({ runtime }) => {
  if (!runtime) return null
  return (
    <div className="db-runtime-card">
      <div>
        自动修复：<b>{runtime.autoRepairEnabled ? '开启' : '关闭'}</b>
      </div>
      <div>
        运行巡检：
        {runtime.runtimeHealthcheckEnabled
          ? `${Math.round((runtime.runtimeHealthcheckIntervalMs || 0) / 1000)}s / 次`
          : '关闭'}
      </div>
      <div className="db-runtime-path">数据库路径：{runtime.dbPath}</div>
    </div>
  )
}

export const DbHealthSummaryCard: React.FC<DbHealthSummaryCardProps> = ({ health }) => {
  if (!health) return null
  return (
    <div className={`db-health-card ${health.status || ''}`.trim()}>
      <div>
        状态：<b>{health.status}</b>
      </div>
      <div>检查模式：{health.mode}</div>
      <div>
        时间：
        {typeof health.checkedAt === 'string' && health.checkedAt
          ? new Date(health.checkedAt).toLocaleString()
          : '-'}
      </div>
      <div className="db-health-msg">{(health.messages || []).slice(0, 2).join(' | ') || '无'}</div>
    </div>
  )
}

export const DbRepairHistoryList: React.FC<DbRepairHistoryListProps> = ({ repairs }) => (
  <div className="db-repair-list">
    {repairs.map((item, index) => (
      <div key={`${item.timestamp || 'repair'}-${index}`} className="db-repair-item">
        <div className="db-repair-head">
          <span className={`status ${item.status}`}>{item.status}</span>
          <span>{item.reason || 'unknown'}</span>
          <span>{item.timestamp ? new Date(item.timestamp).toLocaleString() : '-'}</span>
        </div>
        <div className="db-repair-meta">
          <span>回收行数：{item.salvage?.copiedRows ?? 0}</span>
          <span>动作：{Array.isArray(item.actions) ? item.actions.length : 0}</span>
        </div>
      </div>
    ))}
    {repairs.length === 0 ? <div className="api-empty">暂无修复记录</div> : null}
  </div>
)
