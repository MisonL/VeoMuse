import { useAdminMetricsPolling, useAdminMetricsStore } from '../../../../store/adminMetricsStore'
import {
  formatApiAverageMs,
  formatApiSuccessRate,
  resolveMetricsOverview
} from '../../telemetryDashboard.logic'
import type { DbOpsPanelProps } from '../DbOpsPanel'
import type { ProjectGovernancePanelProps } from '../ProjectGovernancePanel'
import type { ProviderHealthPanelProps } from '../ProviderHealthPanel'
import type { SloSectionProps } from '../SloSection'
import type { TelemetryOverviewSectionProps } from '../TelemetryOverviewSection'
import { useTelemetryDashboardPolling } from './useTelemetryDashboardPolling'
import { useTelemetryDbOpsController } from './useTelemetryDbOpsController'
import { useTelemetryFpsMonitor } from './useTelemetryFpsMonitor'
import { useTelemetryGovernanceController } from './useTelemetryGovernanceController'
import { useTelemetryProviderHealthController } from './useTelemetryProviderHealthController'
import { useTelemetrySloController } from './useTelemetrySloController'

type MetricsOverview = ReturnType<typeof resolveMetricsOverview>
type TelemetryProviderHealthController = ReturnType<typeof useTelemetryProviderHealthController>
type TelemetrySloController = ReturnType<typeof useTelemetrySloController>
type TelemetryGovernanceController = ReturnType<typeof useTelemetryGovernanceController>
type TelemetryDbOpsController = ReturnType<typeof useTelemetryDbOpsController>

interface BuildTelemetryOverviewSectionPropsOptions {
  canvasRef: TelemetryOverviewSectionProps['canvasRef']
  fpsSummary: string
  metricsError: string
  hasMetrics: boolean
  metricsOverview: MetricsOverview
}

export interface TelemetryDashboardControllerResult {
  overviewSectionProps: TelemetryOverviewSectionProps
  sloSectionProps: SloSectionProps
  providerHealthPanelProps: ProviderHealthPanelProps
  projectGovernancePanelProps: ProjectGovernancePanelProps
  dbOpsPanelProps: DbOpsPanelProps
}

export const buildTelemetryOverviewSectionProps = ({
  canvasRef,
  fpsSummary,
  metricsError,
  hasMetrics,
  metricsOverview
}: BuildTelemetryOverviewSectionPropsOptions): TelemetryOverviewSectionProps => ({
  canvasRef,
  fpsSummary,
  metricsError,
  showOverview: hasMetrics,
  memoryUsageText: metricsOverview.memoryUsageText,
  systemLoadText: metricsOverview.systemLoadText,
  apiRows: metricsOverview.apiEntries.map(([name, stats]) => ({
    name,
    successText: formatApiSuccessRate(stats),
    avgText: formatApiAverageMs(stats)
  }))
})

export const buildTelemetrySloSectionProps = (
  sloController: TelemetrySloController
): SloSectionProps => ({
  sloSummary: sloController.sloSummary,
  sloBreakdown: sloController.sloBreakdown,
  sloJourneyFailures: sloController.sloJourneyFailures,
  sloJourneyFailCount: sloController.sloJourneyFailCount,
  sloError: sloController.sloError,
  sloDecision: sloController.sloDecision
})

export const buildTelemetryProviderHealthPanelProps = (
  providerHealthController: TelemetryProviderHealthController
): ProviderHealthPanelProps => ({
  isLoading: providerHealthController.isProviderHealthLoading,
  rows: providerHealthController.providerHealthRows,
  error: providerHealthController.providerHealthError,
  onRefresh: () => void providerHealthController.fetchProviderHealth()
})

export const buildTelemetryProjectGovernancePanelProps = (
  governanceController: TelemetryGovernanceController
): ProjectGovernancePanelProps => ({
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
})

export const buildTelemetryDbOpsPanelProps = (
  dbOpsController: TelemetryDbOpsController
): DbOpsPanelProps => ({
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
})

export const useTelemetryDashboardController = (): TelemetryDashboardControllerResult => {
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

  return {
    overviewSectionProps: buildTelemetryOverviewSectionProps({
      canvasRef,
      fpsSummary,
      metricsError,
      hasMetrics: Boolean(metrics),
      metricsOverview
    }),
    sloSectionProps: buildTelemetrySloSectionProps({
      sloSummary,
      sloBreakdown,
      sloJourneyFailures,
      sloJourneyFailCount,
      sloError,
      sloDecision,
      refreshSloData,
      resetSloData
    }),
    providerHealthPanelProps: buildTelemetryProviderHealthPanelProps({
      providerHealthRows,
      providerHealthError,
      isProviderHealthLoading,
      fetchProviderHealth,
      resetProviderHealth
    }),
    projectGovernancePanelProps: buildTelemetryProjectGovernancePanelProps(governanceController),
    dbOpsPanelProps: buildTelemetryDbOpsPanelProps(dbOpsController)
  }
}
