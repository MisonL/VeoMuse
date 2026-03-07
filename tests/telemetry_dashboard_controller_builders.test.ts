import type React from 'react'
import { describe, expect, it, mock } from 'bun:test'
import { resolveMetricsOverview } from '../apps/frontend/src/components/Editor/telemetryDashboard.logic'
import {
  buildTelemetryCommandBarModel,
  buildTelemetryDbOpsPanelProps,
  buildTelemetryOverviewModel,
  buildTelemetryProjectGovernancePanelProps,
  buildTelemetryProviderHealthModel,
  buildTelemetrySloModel,
  resolveTelemetryProviderAlertCount
} from '../apps/frontend/src/components/Editor/telemetry-dashboard/hooks/useTelemetryDashboardController'

describe('TelemetryDashboard controller builders', () => {
  it('命令条 builder 应根据异常信号生成 stable/degraded 模型', () => {
    expect(
      buildTelemetryCommandBarModel({
        metricsError: '',
        sloError: '',
        providerRows: [{ status: 'ok' }, { status: 'healthy' }, { status: 'pass' }],
        hasSloSummary: true
      })
    ).toEqual({
      tone: 'stable',
      headline: '总控链路稳定',
      subtitle: '关键指标、Provider 链路与 SLO 判定处于可播出状态。',
      stats: {
        incidentCount: 0,
        providerCount: 3,
        sloStatusText: 'Ready'
      }
    })

    expect(
      buildTelemetryCommandBarModel({
        metricsError: 'metrics down',
        sloError: '',
        providerRows: [{ status: 'degraded' }, { status: 'not_implemented' }],
        hasSloSummary: false
      })
    ).toEqual({
      tone: 'degraded',
      headline: '总控链路存在异常待复核',
      subtitle: '当前已捕获 3 处异常信号，建议先查看告警与 Provider 健康状态。',
      stats: {
        incidentCount: 3,
        providerCount: 2,
        sloStatusText: 'Pending'
      }
    })
  })

  it('概览、Provider 与 SLO model 应输出 section props 与 signal', () => {
    const overviewModel = buildTelemetryOverviewModel({
      canvasRef: { current: null } as React.RefObject<HTMLCanvasElement | null>,
      fpsSummary: '稳定',
      metricsError: '',
      hasMetrics: true,
      metricsOverview: resolveMetricsOverview({
        system: {
          memory: { usage: 0.42 },
          load: [0.76]
        },
        api: {
          render: { count: 10, success: 9, totalMs: 450 }
        }
      })
    })
    const providerHealthModel = buildTelemetryProviderHealthModel({
      providerHealthRows: [
        { providerId: 'openai', category: 'llm', status: 'ok', latencyMs: 128 },
        { providerId: 'veo', category: 'video', status: 'degraded', latencyMs: 820 }
      ],
      providerHealthError: '',
      isProviderHealthLoading: false,
      fetchProviderHealth: mock(() => Promise.resolve(true)),
      resetProviderHealth: mock(() => {})
    })
    const sloModel = buildTelemetrySloModel({
      sloSummary: null,
      sloBreakdown: [],
      sloJourneyFailures: [],
      sloJourneyFailCount: 0,
      sloError: 'slo unavailable',
      sloDecision: null,
      refreshSloData: mock(() => Promise.resolve(false)),
      resetSloData: mock(() => {})
    })

    expect(overviewModel.sectionProps.showOverview).toBe(true)
    expect(overviewModel.sectionProps.memoryUsageText).toBe('42.0%')
    expect(overviewModel.sectionProps.systemLoadText).toBe('0.76')
    expect(overviewModel.sectionProps.apiRows).toEqual([
      {
        name: 'render',
        successText: '90%',
        avgText: '45ms'
      }
    ])
    expect(overviewModel.signal).toEqual({
      hasMetrics: true,
      hasMetricsError: false
    })
    expect(providerHealthModel.panelProps.rows).toHaveLength(2)
    expect(providerHealthModel.panelProps.rows[1]?.status).toBe('degraded')
    expect(providerHealthModel.signal).toEqual({
      providerCount: 2,
      alertCount: 1,
      hasError: false
    })
    expect(sloModel.sectionProps.sloError).toBe('slo unavailable')
    expect(sloModel.signal).toEqual({
      hasSummary: false,
      hasError: true,
      decisionStatus: null
    })
  })

  it('Provider alert 计数应稳定忽略 ok/healthy/pass', () => {
    expect(
      resolveTelemetryProviderAlertCount([
        { status: 'ok' },
        { status: 'healthy' },
        { status: 'pass' },
        { status: 'degraded' },
        { status: 'not_implemented' }
      ])
    ).toBe(2)
  })

  it('治理与数据库 builder 应保持 wrapper 接线语义', () => {
    const handleLoadGovernanceComments = mock((_append = false) => Promise.resolve())
    const handleCreateGovernanceComment = mock(() => Promise.resolve())
    const handleGovernanceBatchUpdateClips = mock(() => Promise.resolve())
    const fetchDbHealth = mock((_mode: 'quick' | 'full' = 'quick') => Promise.resolve(true))
    const fetchRepairHistory = mock((_append: boolean) => Promise.resolve())

    const governancePanelProps = buildTelemetryProjectGovernancePanelProps({
      governanceProjectId: 'prj_1',
      governanceBusy: false,
      governanceCommentLimit: '20',
      governanceCommentCursor: '',
      governanceCommentHasMore: true,
      governanceComments: [],
      governanceCommentAnchor: '',
      governanceCommentContent: '',
      governanceCommentMentions: '',
      governanceSelectedCommentId: '',
      governanceReviewLimit: '20',
      governanceReviews: [],
      governanceReviewDecision: 'approved',
      governanceReviewSummary: '',
      governanceReviewScore: '',
      governanceTemplates: [],
      governanceSelectedTemplateId: '',
      governanceTemplateOptions: '{}',
      governanceTemplateResult: null,
      governanceBatchOperations: '[]',
      governanceBatchResult: null,
      governanceError: '',
      setGovernanceProjectId: mock(() => {}),
      setGovernanceCommentLimit: mock(() => {}),
      handleLoadGovernanceComments,
      setGovernanceCommentAnchor: mock(() => {}),
      setGovernanceCommentContent: mock(() => {}),
      setGovernanceCommentMentions: mock(() => {}),
      handleCreateGovernanceComment,
      setGovernanceSelectedCommentId: mock(() => {}),
      handleResolveGovernanceComment: mock(() => Promise.resolve()),
      handleLoadGovernanceReviews: mock(() => Promise.resolve()),
      setGovernanceReviewLimit: mock(() => {}),
      setGovernanceReviewDecision: mock(() => {}),
      setGovernanceReviewSummary: mock(() => {}),
      setGovernanceReviewScore: mock(() => {}),
      handleCreateGovernanceReview: mock(() => Promise.resolve()),
      handleLoadGovernanceTemplates: mock(() => Promise.resolve()),
      setGovernanceSelectedTemplateId: mock(() => {}),
      handleApplyGovernanceTemplate: mock(() => Promise.resolve()),
      setGovernanceTemplateOptions: mock(() => {}),
      setGovernanceBatchOperations: mock(() => {}),
      handleGovernanceBatchUpdateClips
    } as Parameters<typeof buildTelemetryProjectGovernancePanelProps>[0])
    const dbOpsPanelProps = buildTelemetryDbOpsPanelProps({
      adminTokenInput: 'token',
      isDbBusy: false,
      dbRuntime: null,
      repairRange: '24h',
      repairStatusFilter: 'all',
      repairReasonInput: '',
      isRepairLoading: false,
      dbHealth: null,
      dbError: '',
      dbRepairs: [],
      repairTotal: 0,
      repairHasMore: true,
      hasAdminToken: true,
      setAdminTokenInput: mock(() => {}),
      setRepairRange: mock(() => {}),
      setRepairStatusFilter: mock(() => {}),
      setRepairReasonInput: mock(() => {}),
      fetchDbHealth,
      fetchDbRuntime: mock(() => Promise.resolve(true)),
      fetchRepairHistory,
      handleSaveToken: mock(() => Promise.resolve()),
      handleRepair: mock((_force: boolean) => Promise.resolve()),
      handleApplyReasonFilter: mock(() => {}),
      handleClearReasonFilter: mock(() => {})
    } as Parameters<typeof buildTelemetryDbOpsPanelProps>[0])

    governancePanelProps.commentsSectionProps.onLoadGovernanceComments(true)
    governancePanelProps.commentsSectionProps.onCreateGovernanceComment()
    governancePanelProps.templateBatchSectionProps.onGovernanceBatchUpdateClips()
    dbOpsPanelProps.headerProps.onFetchDbHealth()
    dbOpsPanelProps.repairHistorySectionProps.onLoadMoreRepairs()

    expect(handleLoadGovernanceComments).toHaveBeenCalledWith(true)
    expect(handleCreateGovernanceComment).toHaveBeenCalledTimes(1)
    expect(handleGovernanceBatchUpdateClips).toHaveBeenCalledTimes(1)
    expect(fetchDbHealth).toHaveBeenCalledWith('full')
    expect(fetchRepairHistory).toHaveBeenCalledWith(true)
    expect(governancePanelProps.headerProps.governanceProjectId).toBe('prj_1')
    expect(dbOpsPanelProps.headerProps.adminTokenInput).toBe('token')
  })
})
