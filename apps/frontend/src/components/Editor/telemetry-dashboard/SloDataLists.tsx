import React from 'react'
import type { SloBreakdownItem, SloJourneyFailureItem } from '../telemetryDashboard.logic'

interface SloBreakdownListProps {
  items: SloBreakdownItem[]
  formatPercent: (value: number | null, fractionDigits?: number) => string
  formatMs: (value: number | null, fractionDigits?: number) => string
}

interface SloFailureListProps {
  items: SloJourneyFailureItem[]
  totalCount: number
  limit: number
  formatPercent: (value: number | null, fractionDigits?: number) => string
}

export const SloBreakdownList: React.FC<SloBreakdownListProps> = ({
  items,
  formatPercent,
  formatMs
}) => (
  <div className="slo-breakdown-list">
    {items.length > 0 ? (
      items.map((item) => (
        <div key={`${item.method}-${item.routeKey}`} className="slo-breakdown-item">
          <span className="route">
            {item.method} {item.routeKey}
          </span>
          <span>count {item.count}</span>
          <span>成功率 {formatPercent(item.successRate, 1)}</span>
          <span>P95 {formatMs(item.p95Ms, 0)}</span>
        </div>
      ))
    ) : (
      <div className="api-empty">暂无 SLO 接口明细</div>
    )}
  </div>
)

export const SloFailureList: React.FC<SloFailureListProps> = ({
  items,
  totalCount,
  limit,
  formatPercent
}) => (
  <>
    <div className="slo-failure-header">
      <span>失败旅程总数 {totalCount}</span>
      <span>Top {limit}</span>
    </div>
    <div className="slo-failure-list">
      {items.length > 0 ? (
        items.map((item, index) => (
          <div
            key={`${item.failedStage}-${item.errorKind}-${item.httpStatus ?? 'null'}-${index}`}
            className="slo-failure-item"
          >
            <span className="failure-route">
              {item.failedStage}/{item.errorKind}/{item.httpStatus ?? 'null'}
            </span>
            <span>count {item.count}</span>
            <span>占比 {formatPercent(item.share, 1)}</span>
            <span>{item.latestAt ? new Date(item.latestAt).toLocaleString() : '-'}</span>
          </div>
        ))
      ) : (
        <div className="api-empty">暂无失败旅程诊断</div>
      )}
    </div>
  </>
)
