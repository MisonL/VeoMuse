import React from 'react'
import { useAdminMetricsPolling, useAdminMetricsStore } from '../../store/adminMetricsStore'
import {
  formatApiAverageMs,
  formatApiSuccessRate,
  resolveMetricsOverview
} from './telemetryDashboard.logic'
import TelemetryOverviewSection from './telemetry-dashboard/TelemetryOverviewSection'
import ProviderHealthPanel from './telemetry-dashboard/ProviderHealthPanel'
import DbOpsPanel from './telemetry-dashboard/DbOpsPanel'
import ProjectGovernancePanel from './telemetry-dashboard/ProjectGovernancePanel'
import SloSection from './telemetry-dashboard/SloSection'
import { useTelemetryDashboardPolling } from './telemetry-dashboard/hooks/useTelemetryDashboardPolling'
import { useTelemetryDbOpsController } from './telemetry-dashboard/hooks/useTelemetryDbOpsController'
import { useTelemetryFpsMonitor } from './telemetry-dashboard/hooks/useTelemetryFpsMonitor'
import { useTelemetryGovernanceController } from './telemetry-dashboard/hooks/useTelemetryGovernanceController'
import { useTelemetryProviderHealthController } from './telemetry-dashboard/hooks/useTelemetryProviderHealthController'
import { useTelemetrySloController } from './telemetry-dashboard/hooks/useTelemetrySloController'
import './TelemetryDashboard.css'

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

      <SloSection
        sloSummary={sloSummary}
        sloBreakdown={sloBreakdown}
        sloJourneyFailures={sloJourneyFailures}
        sloJourneyFailCount={sloJourneyFailCount}
        sloError={sloError}
        sloDecision={sloDecision}
      />

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
