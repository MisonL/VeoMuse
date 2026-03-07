import type React from 'react'
import { describe, expect, it, mock } from 'bun:test'
import { buildTelemetryCommandBarModel } from '../apps/frontend/src/components/Editor/TelemetryDashboard'
import { resolveMetricsOverview } from '../apps/frontend/src/components/Editor/telemetryDashboard.logic'
import {
  buildTelemetryDbOpsPanelProps,
  buildTelemetryOverviewSectionProps,
  buildTelemetryProjectGovernancePanelProps,
  buildTelemetryProviderHealthPanelProps
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

  it('概览与 Provider builder 应格式化监控视图数据', () => {
    const overviewSectionProps = buildTelemetryOverviewSectionProps({
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
    const providerHealthPanelProps = buildTelemetryProviderHealthPanelProps({
      providerHealthRows: [
        { providerId: 'openai', category: 'llm', status: 'ok', latencyMs: 128 },
        { providerId: 'veo', category: 'video', status: 'degraded', latencyMs: 820 }
      ],
      providerHealthError: '',
      isProviderHealthLoading: false,
      fetchProviderHealth: mock(() => Promise.resolve(true)),
      resetProviderHealth: mock(() => {})
    })

    expect(overviewSectionProps.showOverview).toBe(true)
    expect(overviewSectionProps.memoryUsageText).toBe('42.0%')
    expect(overviewSectionProps.systemLoadText).toBe('0.76')
    expect(overviewSectionProps.apiRows).toEqual([
      {
        name: 'render',
        successText: '90%',
        avgText: '45ms'
      }
    ])
    expect(providerHealthPanelProps.rows).toHaveLength(2)
    expect(providerHealthPanelProps.rows[1]?.status).toBe('degraded')
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

    governancePanelProps.onLoadGovernanceComments(true)
    governancePanelProps.onCreateGovernanceComment()
    governancePanelProps.onGovernanceBatchUpdateClips()
    dbOpsPanelProps.onFetchDbHealth()
    dbOpsPanelProps.onLoadMoreRepairs()

    expect(handleLoadGovernanceComments).toHaveBeenCalledWith(true)
    expect(handleCreateGovernanceComment).toHaveBeenCalledTimes(1)
    expect(handleGovernanceBatchUpdateClips).toHaveBeenCalledTimes(1)
    expect(fetchDbHealth).toHaveBeenCalledWith('full')
    expect(fetchRepairHistory).toHaveBeenCalledWith(true)
  })
})
