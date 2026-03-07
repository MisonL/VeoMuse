import React from 'react'
import {
  SLO_MIN_JOURNEY_SAMPLES,
  SLO_MIN_NON_AI_SAMPLES,
  type SloBreakdownItem,
  type SloDecisionStatus,
  type SloJourneyFailureItem,
  type SloSummary
} from '../telemetryDashboard.logic'
import { SloBreakdownList, SloFailureList } from './SloDataLists'

const SLO_JOURNEY_FAILURE_LIMIT = 10

export interface SloSectionProps {
  sloSummary: SloSummary | null
  sloBreakdown: SloBreakdownItem[]
  sloJourneyFailures: SloJourneyFailureItem[]
  sloJourneyFailCount: number
  sloError: string
  sloDecision: {
    nonAiSamples: number
    journeySamples: number
    status: SloDecisionStatus
    reasonText: string
  } | null
}

const formatPercent = (value: number | null, fractionDigits = 1) => {
  if (value === null || !Number.isFinite(value)) return '--'
  return `${(value * 100).toFixed(fractionDigits)}%`
}

const formatMs = (value: number | null, fractionDigits = 0) => {
  if (value === null || !Number.isFinite(value)) return '--'
  return `${value.toFixed(fractionDigits)}ms`
}

const formatSteps = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '--'
  return `${value.toFixed(2)} 步`
}

const SloSection: React.FC<SloSectionProps> = ({
  sloSummary,
  sloBreakdown,
  sloJourneyFailures,
  sloJourneyFailCount,
  sloError,
  sloDecision
}) => {
  return (
    <section className="slo-panel">
      <h3 className="telemetry-section-title">北极星 SLO（24h）</h3>
      {sloSummary ? (
        <>
          <div className="slo-grid">
            <div
              className={`slo-card ${sloSummary.passFlags.primaryFlowSuccessRate ? 'pass' : 'fail'}`}
            >
              <span className="slo-name">主链路成功率</span>
              <strong>{formatPercent(sloSummary.current.primaryFlowSuccessRate, 2)}</strong>
              <span className="slo-target">
                目标 ≥ {formatPercent(sloSummary.targets.primaryFlowSuccessRate, 2)}
              </span>
            </div>
            <div className={`slo-card ${sloSummary.passFlags.nonAiApiP95Ms ? 'pass' : 'fail'}`}>
              <span className="slo-name">非 AI API P95</span>
              <strong>{formatMs(sloSummary.current.nonAiApiP95Ms, 0)}</strong>
              <span className="slo-target">
                目标 ≤ {formatMs(sloSummary.targets.nonAiApiP95Ms, 0)}
              </span>
            </div>
            <div
              className={`slo-card ${sloSummary.passFlags.firstSuccessAvgSteps ? 'pass' : 'fail'}`}
            >
              <span className="slo-name">首次成功平均步数</span>
              <strong>{formatSteps(sloSummary.current.firstSuccessAvgSteps)}</strong>
              <span className="slo-target">
                目标 ≤ {sloSummary.targets.firstSuccessAvgSteps.toFixed(2)} 步
              </span>
            </div>
          </div>
          <div className="slo-summary-row">
            <span>
              样本：旅程 {sloSummary.counts.totalJourneys}（成功 {sloSummary.counts.successJourneys}
              ）
            </span>
            <span>非 AI 请求样本 {sloSummary.counts.nonAiSamples}</span>
          </div>
          {sloDecision ? (
            <div className="slo-threshold-row">
              <span>
                样本阈值：旅程 {sloDecision.journeySamples}/{SLO_MIN_JOURNEY_SAMPLES}，非 AI{' '}
                {sloDecision.nonAiSamples}/{SLO_MIN_NON_AI_SAMPLES}
              </span>
              <span className={`slo-decision-pill ${sloDecision.status}`}>
                判定来源：{sloDecision.reasonText}
              </span>
            </div>
          ) : null}
          <SloBreakdownList
            items={sloBreakdown}
            formatPercent={formatPercent}
            formatMs={formatMs}
          />
          <SloFailureList
            items={sloJourneyFailures}
            totalCount={sloJourneyFailCount}
            limit={SLO_JOURNEY_FAILURE_LIMIT}
            formatPercent={formatPercent}
          />
        </>
      ) : (
        <div className="api-empty">暂无 SLO 数据，请先保存管理员令牌</div>
      )}
      {sloError ? <div className="db-error">{sloError}</div> : null}
    </section>
  )
}

export default SloSection
