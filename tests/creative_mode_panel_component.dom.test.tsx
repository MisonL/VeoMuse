import './helpers/dom-test-setup'
import React from 'react'
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import CreativeModePanel, {
  type CreativeModePanelProps
} from '../apps/frontend/src/components/Editor/comparison-lab/modes/CreativeModePanel'

const noop = () => {}

const createProps = (overrides: Partial<CreativeModePanelProps> = {}) =>
  ({
    creativeScript: '夜景追车镜头，8 秒',
    creativeStyle: 'cinematic',
    commitScore: 0.8,
    isCreativeBusy: false,
    creativeRun: null,
    creativeRunFeedback: '',
    sceneFeedbackMap: {},
    creativeVersions: [],
    geminiQuickCheck: {
      status: 'unknown',
      title: 'Gemini 可用性未知',
      description: '先点击“Gemini 快速自检”刷新 /api/capabilities。'
    },
    videoGenerationMode: 'text_to_video',
    videoGenerationModelId: 'veo-3.1',
    videoGenerationPrompt: '',
    videoGenerationNegativePrompt: '',
    videoGenerationInputSourceType: 'url',
    videoGenerationImageInput: '',
    videoGenerationReferenceImagesInput: '',
    videoGenerationVideoInput: '',
    videoGenerationFirstFrameInput: '',
    videoGenerationLastFrameInput: '',
    videoGenerationListLimit: '20',
    videoGenerationStatusFilter: 'all',
    videoGenerationJobs: [],
    videoGenerationCursor: '',
    videoGenerationHasMore: false,
    videoGenerationSelectedJobId: '',
    videoGenerationPollingEnabled: true,
    videoGenerationLastAutoSyncAt: '',
    isVideoGenerationAutoSyncTicking: false,
    isVideoGenerationBusy: false,
    workflows: [],
    selectedWorkflowId: '',
    workflowName: '',
    workflowDescription: '',
    workflowRunPayload: '{}',
    workflowRunResult: null,
    workflowRuns: [],
    workflowRunsLimit: '20',
    workflowRunsHasMore: false,
    batchJobType: 'render',
    batchJobPayload: '{}',
    batchJobId: '',
    batchJobStatus: {
      id: '',
      type: 'render',
      status: 'idle',
      totalItems: 0,
      completedItems: 0,
      failedItems: 0,
      items: []
    },
    assetReuseSourceId: '',
    assetReuseTargetId: '',
    assetReuseNote: '',
    assetReuseResult: null,
    assetReuseHistoryAssetId: '',
    assetReuseHistorySourceProjectId: '',
    assetReuseHistoryTargetProjectId: '',
    assetReuseHistoryLimit: '20',
    assetReuseHistoryOffset: '0',
    assetReuseHistoryRecords: [],
    isV4Busy: false,
    onCreativeScriptChange: noop,
    onCreativeStyleChange: noop,
    onCommitScoreChange: noop,
    onCreateCreativeRun: noop,
    onApplyCreativeFeedback: noop,
    onCommitCreativeRun: noop,
    onRefreshCreativeVersions: noop,
    onRunGeminiQuickCheck: noop,
    onOpenChannelPanel: noop,
    onVideoGenerationModeChange: noop,
    onVideoGenerationModelIdChange: noop,
    onVideoGenerationPromptChange: noop,
    onVideoGenerationNegativePromptChange: noop,
    onVideoGenerationInputSourceTypeChange: noop,
    onVideoGenerationImageInputChange: noop,
    onVideoGenerationReferenceImagesInputChange: noop,
    onVideoGenerationVideoInputChange: noop,
    onVideoGenerationFirstFrameInputChange: noop,
    onVideoGenerationLastFrameInputChange: noop,
    onVideoGenerationListLimitChange: noop,
    onVideoGenerationStatusFilterChange: noop,
    onVideoGenerationSelectedJobIdChange: noop,
    onVideoGenerationPollingEnabledChange: noop,
    onCreateVideoGenerationTask: noop,
    onRefreshVideoGenerationJobs: noop,
    onLoadMoreVideoGenerationJobs: noop,
    onQueryVideoGenerationJobDetail: noop,
    onSyncVideoGenerationJob: noop,
    onRetryVideoGenerationJob: noop,
    onCancelVideoGenerationJob: noop,
    onRefreshVideoGenerationJobDetail: noop,
    onCreativeRunFeedbackChange: noop,
    onSceneFeedbackChange: noop,
    onSwitchCreativeRunVersion: noop,
    onRefreshWorkflows: noop,
    onSelectedWorkflowIdChange: noop,
    onWorkflowNameChange: noop,
    onWorkflowDescriptionChange: noop,
    onWorkflowRunPayloadChange: noop,
    onCreateWorkflow: noop,
    onRunWorkflow: noop,
    onWorkflowRunsLimitChange: noop,
    onQueryWorkflowRuns: noop,
    onLoadMoreWorkflowRuns: noop,
    onBatchJobTypeChange: noop,
    onBatchJobPayloadChange: noop,
    onBatchJobIdChange: noop,
    onCreateBatchJob: noop,
    onQueryBatchJob: noop,
    onAssetReuseSourceIdChange: noop,
    onAssetReuseTargetIdChange: noop,
    onAssetReuseNoteChange: noop,
    onCallAssetReuse: noop,
    onAssetReuseHistoryAssetIdChange: noop,
    onAssetReuseHistorySourceProjectIdChange: noop,
    onAssetReuseHistoryTargetProjectIdChange: noop,
    onAssetReuseHistoryLimitChange: noop,
    onAssetReuseHistoryOffsetChange: noop,
    onQueryAssetReuseHistory: noop,
    ...overrides
  }) as CreativeModePanelProps

describe('CreativeModePanel DOM / SSR 护栏', () => {
  afterEach(() => {
    cleanup()
  })

  it('空态应渲染关键卡片与默认提示', () => {
    const view = render(<CreativeModePanel {...createProps()} />)

    expect(view.getByTestId('area-creative-shell')).toBeInTheDocument()
    expect(view.getByTestId('area-creative-hero-stage')).toBeInTheDocument()
    expect(view.getByTestId('area-video-generation-hero')).toBeInTheDocument()
    expect(view.getByTestId('video-generation-overview')).toBeInTheDocument()
    expect(view.getByTestId('video-generation-focus-panel')).toBeInTheDocument()
    expect(view.getByTestId('workflow-summary-grid')).toBeInTheDocument()
    expect(view.getByTestId('batch-job-summary-grid')).toBeInTheDocument()
    expect(view.getByTestId('asset-reuse-summary-grid')).toBeInTheDocument()
    expect(view.getByText('创意闭环引擎')).toBeInTheDocument()
    expect(view.getByText('统一视频生成工作台')).toBeInTheDocument()
    expect(view.getByText('v4 Workflow')).toBeInTheDocument()
    expect(view.getByText('v4 Batch Job')).toBeInTheDocument()
    expect(view.getByText('v4 Asset Reuse')).toBeInTheDocument()
    expect(view.getByText('尚未创建创意 run')).toBeInTheDocument()
    expect(view.getByText('暂无版本链记录')).toBeInTheDocument()
    expect(view.getByText('暂无 Workflow Runs 记录')).toBeInTheDocument()
    expect(view.getByText('暂无 Batch Job Items')).toBeInTheDocument()
    expect(view.getByText('暂无资产复用历史')).toBeInTheDocument()
  })

  it('应渲染关键表单并触发关键动作回调', async () => {
    const onRunGeminiQuickCheck = mock(() => {})
    const onCreateVideoGenerationTask = mock(() => {})
    const onCreateWorkflow = mock(() => {})
    const onCallAssetReuse = mock(() => {})

    const view = render(
      <CreativeModePanel
        {...createProps({
          videoGenerationJobs: [
            {
              id: 'job_1',
              organizationId: 'org_1',
              workspaceId: 'ws_1',
              modelId: 'veo-3.1',
              generationMode: 'text_to_video',
              request: { prompt: 'city chase at night' },
              status: 'succeeded',
              providerStatus: 'done',
              operationName: 'op_1',
              result: {},
              errorMessage: null,
              outputUrl: 'https://example.com/output.mp4',
              startedAt: new Date().toISOString(),
              finishedAt: new Date().toISOString(),
              durationMs: 8200,
              retryCount: 0,
              cancelRequestedAt: null,
              lastSyncedAt: new Date().toISOString(),
              createdBy: 'owner_1',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ],
          videoGenerationSelectedJobId: 'job_1',
          workflows: [
            {
              id: 'wf_1',
              organizationId: 'org_1',
              name: '城市夜景编排',
              description: '多镜头联动',
              definition: {},
              createdBy: 'owner_1',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ],
          selectedWorkflowId: 'wf_1',
          workflowRuns: [
            {
              id: 'run_1',
              workflowId: 'wf_1',
              organizationId: 'org_1',
              triggerType: 'manual',
              status: 'completed',
              input: {},
              output: { assetId: 'asset_1' },
              errorMessage: null,
              startedAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              createdBy: 'owner_1',
              createdAt: new Date().toISOString()
            }
          ],
          batchJobStatus: {
            id: 'batch_1',
            organizationId: 'org_1',
            workflowRunId: 'run_1',
            jobType: 'render',
            status: 'completed',
            totalItems: 2,
            completedItems: 2,
            failedItems: 0,
            payload: {},
            createdBy: 'owner_1',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            items: [
              {
                id: 'item_1',
                jobId: 'batch_1',
                organizationId: 'org_1',
                itemKey: 'clip-a',
                status: 'completed',
                input: {},
                output: { frameCount: 10 },
                errorMessage: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
            ]
          },
          assetReuseSourceId: 'asset_1',
          assetReuseTargetId: 'project_1',
          assetReuseHistoryRecords: [
            {
              id: 'reuse_1',
              organizationId: 'org_1',
              assetId: 'asset_1',
              sourceProjectId: 'project_src',
              targetProjectId: 'project_1',
              reusedBy: 'owner_1',
              context: { reason: 'style-consistency' },
              createdAt: new Date().toISOString()
            }
          ],
          onRunGeminiQuickCheck,
          onCreateVideoGenerationTask,
          onCreateWorkflow,
          onCallAssetReuse
        })}
      />
    )

    const creativeScriptInput = view.container.querySelector(
      'textarea[name="creativeScript"]'
    ) as HTMLTextAreaElement
    const commitScoreInput = view.container.querySelector(
      'input[name="commitScore"]'
    ) as HTMLInputElement
    const promptInput = view.container.querySelector(
      'textarea[name="videoGenerationPrompt"]'
    ) as HTMLTextAreaElement

    expect(creativeScriptInput).toBeInTheDocument()
    expect(creativeScriptInput.value).toContain('夜景追车镜头')
    expect(commitScoreInput).toBeInTheDocument()
    expect(commitScoreInput.value).toBe('0.8')
    expect(promptInput).toBeInTheDocument()
    expect(promptInput.value).toBe('')
    expect(view.getAllByText('job_1').length).toBeGreaterThan(0)
    expect(view.getByText('城市夜景编排')).toBeInTheDocument()
    expect(view.getByText('clip-a')).toBeInTheDocument()
    expect(view.getAllByText(/reuse_1/).length).toBeGreaterThan(0)
    expect(view.getAllByText('打开输出').length).toBeGreaterThan(0)

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Gemini 快速自检' }))
      fireEvent.click(view.getByRole('button', { name: '提交任务' }))
      fireEvent.click(view.getByRole('button', { name: '创建 Workflow' }))
      fireEvent.click(view.getByRole('button', { name: '调用 Asset Reuse' }))
    })

    expect(onRunGeminiQuickCheck).toHaveBeenCalledTimes(1)
    expect(onCreateVideoGenerationTask).toHaveBeenCalledTimes(1)
    expect(onCreateWorkflow).toHaveBeenCalledTimes(1)
    expect(onCallAssetReuse).toHaveBeenCalledTimes(1)
  })

  it('SSR 应输出创意模式核心区块', () => {
    const html = renderToString(<CreativeModePanel {...createProps()} />)

    expect(html).toContain('area-creative-hero-stage')
    expect(html).toContain('创意闭环引擎')
    expect(html).toContain('统一视频生成工作台')
    expect(html).toContain('v4 Workflow')
    expect(html).toContain('v4 Asset Reuse')
    expect(html).toContain('尚未创建创意 run')
  })
})
