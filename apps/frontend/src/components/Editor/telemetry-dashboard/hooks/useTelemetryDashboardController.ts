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
import type { GovernanceCommentsSectionProps } from '../GovernanceCommentsSection'
import type { GovernanceReviewsSectionProps } from '../GovernanceReviewsSection'
import type { GovernanceTemplateBatchSectionProps } from '../GovernanceTemplateBatchSection'
import type { DbRepairHistorySectionProps } from '../DbRepairHistorySection'
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
type TelemetryProviderRow = Pick<ProviderHealthPanelProps['rows'][number], 'status'>

interface BuildTelemetryOverviewSectionPropsOptions {
  canvasRef: TelemetryOverviewSectionProps['canvasRef']
  fpsSummary: string
  metricsError: string
  hasMetrics: boolean
  metricsOverview: MetricsOverview
}

export interface TelemetryCommandBarModel {
  tone: 'stable' | 'degraded'
  headline: string
  subtitle: string
  stats: {
    incidentCount: number
    providerCount: number
    sloStatusText: 'Ready' | 'Pending'
  }
}

export interface TelemetryOverviewModel {
  sectionProps: TelemetryOverviewSectionProps
  signal: {
    hasMetrics: boolean
    hasMetricsError: boolean
  }
}

export interface TelemetryProviderHealthModel {
  panelProps: ProviderHealthPanelProps
  signal: {
    providerCount: number
    alertCount: number
    hasError: boolean
  }
}

export interface TelemetrySloModel {
  sectionProps: SloSectionProps
  signal: {
    hasSummary: boolean
    hasError: boolean
    decisionStatus: SloSectionProps['sloDecision'] extends { status: infer T } | null ? T | null : null
  }
}

export interface TelemetryDashboardControllerResult {
  commandBarModel: TelemetryCommandBarModel
  overviewModel: TelemetryOverviewModel
  sloModel: TelemetrySloModel
  providerHealthModel: TelemetryProviderHealthModel
  projectGovernancePanelProps: ProjectGovernancePanelProps
  dbOpsPanelProps: DbOpsPanelProps
}

export const resolveTelemetryProviderAlertCount = (rows: TelemetryProviderRow[]) =>
  rows.filter((row) => {
    const normalized = row.status.toLowerCase()
    return (
      !normalized.includes('ok') &&
      !normalized.includes('healthy') &&
      !normalized.includes('pass')
    )
  }).length

export const buildTelemetryCommandBarModel = ({
  metricsError,
  sloError,
  providerRows,
  hasSloSummary
}: {
  metricsError: string
  sloError: string
  providerRows: TelemetryProviderRow[]
  hasSloSummary: boolean
}): TelemetryCommandBarModel => {
  const incidentCount =
    Number(Boolean(metricsError)) +
    Number(Boolean(sloError)) +
    resolveTelemetryProviderAlertCount(providerRows)
  const tone = incidentCount > 0 ? 'degraded' : 'stable'

  return {
    tone,
    headline: tone === 'stable' ? '总控链路稳定' : '总控链路存在异常待复核',
    subtitle:
      tone === 'stable'
        ? '关键指标、Provider 链路与 SLO 判定处于可播出状态。'
        : `当前已捕获 ${incidentCount} 处异常信号，建议先查看告警与 Provider 健康状态。`,
    stats: {
      incidentCount,
      providerCount: providerRows.length,
      sloStatusText: hasSloSummary ? 'Ready' : 'Pending'
    }
  }
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

export const buildTelemetryOverviewModel = (
  options: BuildTelemetryOverviewSectionPropsOptions
): TelemetryOverviewModel => ({
  sectionProps: buildTelemetryOverviewSectionProps(options),
  signal: {
    hasMetrics: options.hasMetrics,
    hasMetricsError: Boolean(options.metricsError)
  }
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

export const buildTelemetrySloModel = (
  sloController: TelemetrySloController
): TelemetrySloModel => ({
  sectionProps: buildTelemetrySloSectionProps(sloController),
  signal: {
    hasSummary: Boolean(sloController.sloSummary),
    hasError: Boolean(sloController.sloError),
    decisionStatus: sloController.sloDecision?.status ?? null
  }
})

export const buildTelemetryProviderHealthPanelProps = (
  providerHealthController: TelemetryProviderHealthController
): ProviderHealthPanelProps => ({
  isLoading: providerHealthController.isProviderHealthLoading,
  rows: providerHealthController.providerHealthRows,
  error: providerHealthController.providerHealthError,
  onRefresh: () => void providerHealthController.fetchProviderHealth()
})

export const buildTelemetryProviderHealthModel = (
  providerHealthController: TelemetryProviderHealthController
): TelemetryProviderHealthModel => ({
  panelProps: buildTelemetryProviderHealthPanelProps(providerHealthController),
  signal: {
    providerCount: providerHealthController.providerHealthRows.length,
    alertCount: resolveTelemetryProviderAlertCount(providerHealthController.providerHealthRows),
    hasError: Boolean(providerHealthController.providerHealthError)
  }
})

export const buildTelemetryProjectGovernancePanelProps = (
  governanceController: TelemetryGovernanceController
): ProjectGovernancePanelProps => ({
  headerProps: {
    governanceProjectId: governanceController.governanceProjectId,
    governanceBusy: governanceController.governanceBusy,
    governanceError: governanceController.governanceError,
    onGovernanceProjectIdChange: governanceController.setGovernanceProjectId
  },
  commentsSectionProps: {
    governanceBusy: governanceController.governanceBusy,
    governanceCommentLimit: governanceController.governanceCommentLimit,
    governanceCommentCursor: governanceController.governanceCommentCursor,
    governanceCommentHasMore: governanceController.governanceCommentHasMore,
    governanceComments: governanceController.governanceComments,
    governanceCommentAnchor: governanceController.governanceCommentAnchor,
    governanceCommentContent: governanceController.governanceCommentContent,
    governanceCommentMentions: governanceController.governanceCommentMentions,
    governanceSelectedCommentId: governanceController.governanceSelectedCommentId,
    onGovernanceCommentLimitChange: governanceController.setGovernanceCommentLimit,
    onLoadGovernanceComments: (append?: boolean) =>
      void governanceController.handleLoadGovernanceComments(Boolean(append)),
    onGovernanceCommentAnchorChange: governanceController.setGovernanceCommentAnchor,
    onGovernanceCommentContentChange: governanceController.setGovernanceCommentContent,
    onGovernanceCommentMentionsChange: governanceController.setGovernanceCommentMentions,
    onCreateGovernanceComment: () => void governanceController.handleCreateGovernanceComment(),
    onGovernanceSelectedCommentIdChange: governanceController.setGovernanceSelectedCommentId,
    onResolveGovernanceComment: () => void governanceController.handleResolveGovernanceComment()
  } satisfies GovernanceCommentsSectionProps,
  reviewsSectionProps: {
    governanceBusy: governanceController.governanceBusy,
    governanceReviewLimit: governanceController.governanceReviewLimit,
    governanceReviews: governanceController.governanceReviews,
    governanceReviewDecision: governanceController.governanceReviewDecision,
    governanceReviewSummary: governanceController.governanceReviewSummary,
    governanceReviewScore: governanceController.governanceReviewScore,
    onLoadGovernanceReviews: () => void governanceController.handleLoadGovernanceReviews(),
    onGovernanceReviewLimitChange: governanceController.setGovernanceReviewLimit,
    onGovernanceReviewDecisionChange: governanceController.setGovernanceReviewDecision,
    onGovernanceReviewSummaryChange: governanceController.setGovernanceReviewSummary,
    onGovernanceReviewScoreChange: governanceController.setGovernanceReviewScore,
    onCreateGovernanceReview: () => void governanceController.handleCreateGovernanceReview()
  } satisfies GovernanceReviewsSectionProps,
  templateBatchSectionProps: {
    governanceBusy: governanceController.governanceBusy,
    governanceTemplates: governanceController.governanceTemplates,
    governanceSelectedTemplateId: governanceController.governanceSelectedTemplateId,
    governanceTemplateOptions: governanceController.governanceTemplateOptions,
    governanceTemplateResult: governanceController.governanceTemplateResult,
    governanceBatchOperations: governanceController.governanceBatchOperations,
    governanceBatchResult: governanceController.governanceBatchResult,
    onLoadGovernanceTemplates: () => void governanceController.handleLoadGovernanceTemplates(),
    onGovernanceSelectedTemplateIdChange: governanceController.setGovernanceSelectedTemplateId,
    onApplyGovernanceTemplate: () => void governanceController.handleApplyGovernanceTemplate(),
    onGovernanceTemplateOptionsChange: governanceController.setGovernanceTemplateOptions,
    onGovernanceBatchOperationsChange: governanceController.setGovernanceBatchOperations,
    onGovernanceBatchUpdateClips: () =>
      void governanceController.handleGovernanceBatchUpdateClips()
  } satisfies GovernanceTemplateBatchSectionProps
})

export const buildTelemetryDbOpsPanelProps = (
  dbOpsController: TelemetryDbOpsController
): DbOpsPanelProps => ({
  headerProps: {
    adminTokenInput: dbOpsController.adminTokenInput,
    isDbBusy: dbOpsController.isDbBusy,
    dbRuntime: dbOpsController.dbRuntime,
    dbHealth: dbOpsController.dbHealth,
    dbError: dbOpsController.dbError,
    onAdminTokenInputChange: dbOpsController.setAdminTokenInput,
    onSaveToken: () => void dbOpsController.handleSaveToken(),
    onFetchDbHealth: () => void dbOpsController.fetchDbHealth('full'),
    onFetchDbRuntime: () => void dbOpsController.fetchDbRuntime(),
    onRepair: (force: boolean) => void dbOpsController.handleRepair(force)
  },
  repairHistorySectionProps: {
    repairRange: dbOpsController.repairRange,
    repairStatusFilter: dbOpsController.repairStatusFilter,
    repairReasonInput: dbOpsController.repairReasonInput,
    isRepairLoading: dbOpsController.isRepairLoading,
    isDbBusy: dbOpsController.isDbBusy,
    dbRepairs: dbOpsController.dbRepairs,
    repairTotal: dbOpsController.repairTotal,
    repairHasMore: dbOpsController.repairHasMore,
    onRepairRangeChange: dbOpsController.setRepairRange,
    onRepairStatusFilterChange: dbOpsController.setRepairStatusFilter,
    onRepairReasonInputChange: dbOpsController.setRepairReasonInput,
    onApplyReasonFilter: () => void dbOpsController.handleApplyReasonFilter(),
    onClearReasonFilter: () => void dbOpsController.handleClearReasonFilter(),
    onLoadMoreRepairs: () => void dbOpsController.fetchRepairHistory(true)
  } satisfies DbRepairHistorySectionProps
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
  const overviewModel = buildTelemetryOverviewModel({
    canvasRef,
    fpsSummary,
    metricsError,
    hasMetrics: Boolean(metrics),
    metricsOverview
  })
  const sloModel = buildTelemetrySloModel({
    sloSummary,
    sloBreakdown,
    sloJourneyFailures,
    sloJourneyFailCount,
    sloError,
    sloDecision,
    refreshSloData,
    resetSloData
  })
  const providerHealthModel = buildTelemetryProviderHealthModel({
    providerHealthRows,
    providerHealthError,
    isProviderHealthLoading,
    fetchProviderHealth,
    resetProviderHealth
  })

  return {
    commandBarModel: buildTelemetryCommandBarModel({
      metricsError,
      sloError: sloModel.sectionProps.sloError,
      providerRows: providerHealthModel.panelProps.rows,
      hasSloSummary: sloModel.signal.hasSummary
    }),
    overviewModel,
    sloModel,
    providerHealthModel,
    projectGovernancePanelProps: buildTelemetryProjectGovernancePanelProps(governanceController),
    dbOpsPanelProps: buildTelemetryDbOpsPanelProps(dbOpsController)
  }
}
