import { useAdminMetricsPolling, useAdminMetricsStore } from '../../../../store/adminMetricsStore'
import {
  formatApiAverageMs,
  formatApiSuccessRate,
  resolveMetricsOverview
} from '../../telemetryDashboard.logic'
import { useTelemetryDashboardPolling } from './useTelemetryDashboardPolling'
import { useTelemetryDbOpsController } from './useTelemetryDbOpsController'
import { useTelemetryFpsMonitor } from './useTelemetryFpsMonitor'
import { useTelemetryGovernanceController } from './useTelemetryGovernanceController'
import { useTelemetryProviderHealthController } from './useTelemetryProviderHealthController'
import { useTelemetrySloController } from './useTelemetrySloController'

export const useTelemetryDashboardController = () => {
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
  const governanceController = useTelemetryGovernanceController()
  const dbOpsController = useTelemetryDbOpsController({
    refreshMetricsNow,
    refreshProviderHealth: fetchProviderHealth,
    refreshSloData,
    resetProviderHealth,
    resetSloData
  })

  useTelemetryDashboardPolling({
    hasAdminToken: dbOpsController.hasAdminToken,
    fetchDbHealth: dbOpsController.fetchDbHealth,
    fetchDbRuntime: dbOpsController.fetchDbRuntime,
    refreshProviderHealth: fetchProviderHealth,
    refreshSloData
  })

  const metricsOverview = resolveMetricsOverview(metrics)
  const apiRows = metricsOverview.apiEntries.map(([name, stats]) => ({
    name,
    successText: formatApiSuccessRate(stats),
    avgText: formatApiAverageMs(stats)
  }))

  return {
    overviewSectionProps: {
      canvasRef,
      fpsSummary,
      metricsError,
      showOverview: Boolean(metrics),
      memoryUsageText: metricsOverview.memoryUsageText,
      systemLoadText: metricsOverview.systemLoadText,
      apiRows
    },
    sloSectionProps: {
      sloSummary,
      sloBreakdown,
      sloJourneyFailures,
      sloJourneyFailCount,
      sloError,
      sloDecision
    },
    providerHealthPanelProps: {
      isLoading: isProviderHealthLoading,
      rows: providerHealthRows,
      error: providerHealthError,
      onRefresh: () => void fetchProviderHealth()
    },
    projectGovernancePanelProps: {
      governanceProjectId: governanceController.governanceProjectId,
      governanceBusy: governanceController.governanceBusy,
      governanceCommentLimit: governanceController.governanceCommentLimit,
      governanceCommentCursor: governanceController.governanceCommentCursor,
      governanceCommentHasMore: governanceController.governanceCommentHasMore,
      governanceComments: governanceController.governanceComments,
      governanceCommentAnchor: governanceController.governanceCommentAnchor,
      governanceCommentContent: governanceController.governanceCommentContent,
      governanceCommentMentions: governanceController.governanceCommentMentions,
      governanceSelectedCommentId: governanceController.governanceSelectedCommentId,
      governanceReviewLimit: governanceController.governanceReviewLimit,
      governanceReviews: governanceController.governanceReviews,
      governanceReviewDecision: governanceController.governanceReviewDecision,
      governanceReviewSummary: governanceController.governanceReviewSummary,
      governanceReviewScore: governanceController.governanceReviewScore,
      governanceTemplates: governanceController.governanceTemplates,
      governanceSelectedTemplateId: governanceController.governanceSelectedTemplateId,
      governanceTemplateOptions: governanceController.governanceTemplateOptions,
      governanceTemplateResult: governanceController.governanceTemplateResult,
      governanceBatchOperations: governanceController.governanceBatchOperations,
      governanceBatchResult: governanceController.governanceBatchResult,
      governanceError: governanceController.governanceError,
      onGovernanceProjectIdChange: governanceController.setGovernanceProjectId,
      onGovernanceCommentLimitChange: governanceController.setGovernanceCommentLimit,
      onLoadGovernanceComments: (append?: boolean) =>
        void governanceController.handleLoadGovernanceComments(Boolean(append)),
      onGovernanceCommentAnchorChange: governanceController.setGovernanceCommentAnchor,
      onGovernanceCommentContentChange: governanceController.setGovernanceCommentContent,
      onGovernanceCommentMentionsChange: governanceController.setGovernanceCommentMentions,
      onCreateGovernanceComment: () => void governanceController.handleCreateGovernanceComment(),
      onGovernanceSelectedCommentIdChange: governanceController.setGovernanceSelectedCommentId,
      onResolveGovernanceComment: () => void governanceController.handleResolveGovernanceComment(),
      onLoadGovernanceReviews: () => void governanceController.handleLoadGovernanceReviews(),
      onGovernanceReviewLimitChange: governanceController.setGovernanceReviewLimit,
      onGovernanceReviewDecisionChange: governanceController.setGovernanceReviewDecision,
      onGovernanceReviewSummaryChange: governanceController.setGovernanceReviewSummary,
      onGovernanceReviewScoreChange: governanceController.setGovernanceReviewScore,
      onCreateGovernanceReview: () => void governanceController.handleCreateGovernanceReview(),
      onLoadGovernanceTemplates: () => void governanceController.handleLoadGovernanceTemplates(),
      onGovernanceSelectedTemplateIdChange: governanceController.setGovernanceSelectedTemplateId,
      onApplyGovernanceTemplate: () => void governanceController.handleApplyGovernanceTemplate(),
      onGovernanceTemplateOptionsChange: governanceController.setGovernanceTemplateOptions,
      onGovernanceBatchOperationsChange: governanceController.setGovernanceBatchOperations,
      onGovernanceBatchUpdateClips: () =>
        void governanceController.handleGovernanceBatchUpdateClips()
    },
    dbOpsPanelProps: {
      adminTokenInput: dbOpsController.adminTokenInput,
      isDbBusy: dbOpsController.isDbBusy,
      dbRuntime: dbOpsController.dbRuntime,
      repairRange: dbOpsController.repairRange,
      repairStatusFilter: dbOpsController.repairStatusFilter,
      repairReasonInput: dbOpsController.repairReasonInput,
      isRepairLoading: dbOpsController.isRepairLoading,
      dbHealth: dbOpsController.dbHealth,
      dbError: dbOpsController.dbError,
      dbRepairs: dbOpsController.dbRepairs,
      repairTotal: dbOpsController.repairTotal,
      repairHasMore: dbOpsController.repairHasMore,
      onAdminTokenInputChange: dbOpsController.setAdminTokenInput,
      onSaveToken: () => void dbOpsController.handleSaveToken(),
      onFetchDbHealth: () => void dbOpsController.fetchDbHealth('full'),
      onFetchDbRuntime: () => void dbOpsController.fetchDbRuntime(),
      onRepair: (force: boolean) => void dbOpsController.handleRepair(force),
      onRepairRangeChange: dbOpsController.setRepairRange,
      onRepairStatusFilterChange: dbOpsController.setRepairStatusFilter,
      onRepairReasonInputChange: dbOpsController.setRepairReasonInput,
      onApplyReasonFilter: () => void dbOpsController.handleApplyReasonFilter(),
      onClearReasonFilter: () => void dbOpsController.handleClearReasonFilter(),
      onLoadMoreRepairs: () => void dbOpsController.fetchRepairHistory(true)
    }
  }
}
