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
          assetReuseSourceId: 'asset_1',
          assetReuseTargetId: 'project_1',
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

    expect(html).toContain('创意闭环引擎')
    expect(html).toContain('统一视频生成工作台')
    expect(html).toContain('v4 Workflow')
    expect(html).toContain('v4 Asset Reuse')
    expect(html).toContain('尚未创建创意 run')
  })
})
