import React from 'react'
import { useAdminMetricsPolling, useAdminMetricsStore } from '../../store/adminMetricsStore'
import {
  SLO_MIN_JOURNEY_SAMPLES,
  SLO_MIN_NON_AI_SAMPLES,
  formatApiAverageMs,
  formatApiSuccessRate,
  resolveMetricsOverview
} from './telemetryDashboard.logic'
import TelemetryOverviewSection from './telemetry-dashboard/TelemetryOverviewSection'
import ProviderHealthPanel from './telemetry-dashboard/ProviderHealthPanel'
import DbOpsPanel from './telemetry-dashboard/DbOpsPanel'
import ProjectGovernancePanel from './telemetry-dashboard/ProjectGovernancePanel'
import { SloBreakdownList, SloFailureList } from './telemetry-dashboard/SloDataLists'
import { useTelemetryDashboardPolling } from './telemetry-dashboard/hooks/useTelemetryDashboardPolling'
import { useTelemetryDbOpsController } from './telemetry-dashboard/hooks/useTelemetryDbOpsController'
import { useTelemetryFpsMonitor } from './telemetry-dashboard/hooks/useTelemetryFpsMonitor'
import { useTelemetryGovernanceController } from './telemetry-dashboard/hooks/useTelemetryGovernanceController'
import { useTelemetryProviderHealthController } from './telemetry-dashboard/hooks/useTelemetryProviderHealthController'
import { useTelemetrySloController } from './telemetry-dashboard/hooks/useTelemetrySloController'
import './TelemetryDashboard.css'

const SLO_JOURNEY_FAILURE_LIMIT = 10

const TelemetryDashboard: React.FC = () => {
  useAdminMetricsPolling()
  const metrics = useAdminMetricsStore((state) => state.metrics)
  const metricsError = useAdminMetricsStore((state) => state.error)
  const refreshMetricsNow = useAdminMetricsStore((state) => state.refreshNow)
  const { canvasRef, fpsSummary } = useTelemetryFpsMonitor()
  const {
    providerHealthRows,
    providerHealthError,
    isProviderHealthLoading,
    fetchProviderHealth,
    resetProviderHealth
  } = useTelemetryProviderHealthController()
  const {
    sloSummary,
    sloBreakdown,
    sloJourneyFailures,
    sloJourneyFailCount,
    sloError,
    sloDecision,
    refreshSloData,
    resetSloData
  } = useTelemetrySloController()
  const {
    governanceProjectId,
    governanceBusy,
    governanceCommentLimit,
    governanceCommentCursor,
    governanceCommentHasMore,
    governanceComments,
    governanceCommentAnchor,
    governanceCommentContent,
    governanceCommentMentions,
    governanceSelectedCommentId,
    governanceReviewLimit,
    governanceReviews,
    governanceReviewDecision,
    governanceReviewSummary,
    governanceReviewScore,
    governanceTemplates,
    governanceSelectedTemplateId,
    governanceTemplateOptions,
    governanceTemplateResult,
    governanceBatchOperations,
    governanceBatchResult,
    governanceError,
    setGovernanceProjectId,
    setGovernanceCommentLimit,
    setGovernanceCommentAnchor,
    setGovernanceCommentContent,
    setGovernanceCommentMentions,
    setGovernanceSelectedCommentId,
    setGovernanceReviewLimit,
    setGovernanceReviewDecision,
    setGovernanceReviewSummary,
    setGovernanceReviewScore,
    setGovernanceSelectedTemplateId,
    setGovernanceTemplateOptions,
    setGovernanceBatchOperations,
    handleLoadGovernanceComments,
    handleCreateGovernanceComment,
    handleResolveGovernanceComment,
    handleLoadGovernanceReviews,
    handleCreateGovernanceReview,
    handleLoadGovernanceTemplates,
    handleApplyGovernanceTemplate,
    handleGovernanceBatchUpdateClips
  } = useTelemetryGovernanceController()
  const {
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
    hasAdminToken,
    setAdminTokenInput,
    setRepairRange,
    setRepairStatusFilter,
    setRepairReasonInput,
    fetchDbHealth,
    fetchDbRuntime,
    fetchRepairHistory,
    handleSaveToken,
    handleRepair,
    handleApplyReasonFilter,
    handleClearReasonFilter
  } = useTelemetryDbOpsController({
    refreshMetricsNow,
    refreshProviderHealth: fetchProviderHealth,
    refreshSloData,
    resetProviderHealth,
    resetSloData
  })

  useTelemetryDashboardPolling({
    hasAdminToken,
    fetchDbHealth,
    fetchDbRuntime,
    refreshProviderHealth: fetchProviderHealth,
    refreshSloData
  })

  const metricsOverview = resolveMetricsOverview(metrics)
  const apiRows = metricsOverview.apiEntries.map(([name, stats]) => ({
    name,
    successText: formatApiSuccessRate(stats),
    avgText: formatApiAverageMs(stats)
  }))

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

  return (
    <div className="telemetry-dashboard">
      <TelemetryOverviewSection
        canvasRef={canvasRef}
        fpsSummary={fpsSummary}
        metricsError={metricsError}
        showOverview={Boolean(metrics)}
        memoryUsageText={metricsOverview.memoryUsageText}
        systemLoadText={metricsOverview.systemLoadText}
        apiRows={apiRows}
      />

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
                样本：旅程 {sloSummary.counts.totalJourneys}（成功{' '}
                {sloSummary.counts.successJourneys}）
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

      <ProviderHealthPanel
        isLoading={isProviderHealthLoading}
        rows={providerHealthRows}
        error={providerHealthError}
        onRefresh={() => void fetchProviderHealth()}
      />

      <ProjectGovernancePanel
        governanceProjectId={governanceProjectId}
        governanceBusy={governanceBusy}
        governanceCommentLimit={governanceCommentLimit}
        governanceCommentCursor={governanceCommentCursor}
        governanceCommentHasMore={governanceCommentHasMore}
        governanceComments={governanceComments}
        governanceCommentAnchor={governanceCommentAnchor}
        governanceCommentContent={governanceCommentContent}
        governanceCommentMentions={governanceCommentMentions}
        governanceSelectedCommentId={governanceSelectedCommentId}
        governanceReviewLimit={governanceReviewLimit}
        governanceReviews={governanceReviews}
        governanceReviewDecision={governanceReviewDecision}
        governanceReviewSummary={governanceReviewSummary}
        governanceReviewScore={governanceReviewScore}
        governanceTemplates={governanceTemplates}
        governanceSelectedTemplateId={governanceSelectedTemplateId}
        governanceTemplateOptions={governanceTemplateOptions}
        governanceTemplateResult={governanceTemplateResult}
        governanceBatchOperations={governanceBatchOperations}
        governanceBatchResult={governanceBatchResult}
        governanceError={governanceError}
        onGovernanceProjectIdChange={setGovernanceProjectId}
        onGovernanceCommentLimitChange={setGovernanceCommentLimit}
        onLoadGovernanceComments={(append) => void handleLoadGovernanceComments(append)}
        onGovernanceCommentAnchorChange={setGovernanceCommentAnchor}
        onGovernanceCommentContentChange={setGovernanceCommentContent}
        onGovernanceCommentMentionsChange={setGovernanceCommentMentions}
        onCreateGovernanceComment={() => void handleCreateGovernanceComment()}
        onGovernanceSelectedCommentIdChange={setGovernanceSelectedCommentId}
        onResolveGovernanceComment={() => void handleResolveGovernanceComment()}
        onLoadGovernanceReviews={() => void handleLoadGovernanceReviews()}
        onGovernanceReviewLimitChange={setGovernanceReviewLimit}
        onGovernanceReviewDecisionChange={setGovernanceReviewDecision}
        onGovernanceReviewSummaryChange={setGovernanceReviewSummary}
        onGovernanceReviewScoreChange={setGovernanceReviewScore}
        onCreateGovernanceReview={() => void handleCreateGovernanceReview()}
        onLoadGovernanceTemplates={() => void handleLoadGovernanceTemplates()}
        onGovernanceSelectedTemplateIdChange={setGovernanceSelectedTemplateId}
        onApplyGovernanceTemplate={() => void handleApplyGovernanceTemplate()}
        onGovernanceTemplateOptionsChange={setGovernanceTemplateOptions}
        onGovernanceBatchOperationsChange={setGovernanceBatchOperations}
        onGovernanceBatchUpdateClips={() => void handleGovernanceBatchUpdateClips()}
      />

      <DbOpsPanel
        adminTokenInput={adminTokenInput}
        isDbBusy={isDbBusy}
        dbRuntime={dbRuntime}
        repairRange={repairRange}
        repairStatusFilter={repairStatusFilter}
        repairReasonInput={repairReasonInput}
        isRepairLoading={isRepairLoading}
        dbHealth={dbHealth}
        dbError={dbError}
        dbRepairs={dbRepairs}
        repairTotal={repairTotal}
        repairHasMore={repairHasMore}
        onAdminTokenInputChange={setAdminTokenInput}
        onSaveToken={() => void handleSaveToken()}
        onFetchDbHealth={() => void fetchDbHealth('full')}
        onFetchDbRuntime={() => void fetchDbRuntime()}
        onRepair={(force) => void handleRepair(force)}
        onRepairRangeChange={setRepairRange}
        onRepairStatusFilterChange={setRepairStatusFilter}
        onRepairReasonInputChange={setRepairReasonInput}
        onApplyReasonFilter={() => void handleApplyReasonFilter()}
        onClearReasonFilter={() => void handleClearReasonFilter()}
        onLoadMoreRepairs={() => void fetchRepairHistory(true)}
      />
    </div>
  )
}

export default TelemetryDashboard
