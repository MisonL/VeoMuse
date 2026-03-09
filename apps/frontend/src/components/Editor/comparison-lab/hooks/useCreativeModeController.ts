import { useCallback, useEffect, useMemo } from 'react'
import { parseJsonObjectInput as parseJsonObjectInputHelper } from '../helpers'
import { resolveGeminiQuickCheck } from '../types'
import type { AuthProfile, CapabilityPayload, LabMode, RoutingDecision } from '../types'
import { useCreativeRunManager } from './useCreativeRunManager'
import { useV4CreativeOps } from './useV4CreativeOps'
import { useVideoGenerationManager } from './useVideoGenerationManager'
import type { CreativeModePanelProps } from '../modes/CreativeModePanel'

type ShowToast = (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void

interface UseCreativeModeControllerOptions {
  selectedPolicyId: string
  policyDecision: RoutingDecision | null
  simulatePolicy: (overridePrompt?: string) => Promise<RoutingDecision | null>
  showToast: ShowToast
  capabilities: CapabilityPayload | null
  labMode: LabMode
  authProfile: AuthProfile | null
  isCapabilitiesLoading: boolean
  workspaceId: string
  loadCapabilities: () => Promise<void>
  projectId: string
  memberName: string
  workspaceOwner: string
  openChannelPanel: () => void
}

export const useCreativeModeController = ({
  selectedPolicyId,
  policyDecision,
  simulatePolicy,
  showToast,
  capabilities,
  labMode,
  authProfile,
  isCapabilitiesLoading,
  workspaceId,
  loadCapabilities,
  projectId,
  memberName,
  workspaceOwner,
  openChannelPanel
}: UseCreativeModeControllerOptions): CreativeModePanelProps => {
  const geminiQuickCheck = useMemo(() => resolveGeminiQuickCheck(capabilities), [capabilities])
  const currentActorName = memberName.trim() || workspaceOwner.trim() || '空间管理员'

  const parseJsonObjectInput = useCallback(
    (raw: string, fieldName: string): Record<string, unknown> | null =>
      parseJsonObjectInputHelper(raw, fieldName, (message) => showToast(message, 'warning')),
    [showToast]
  )

  const {
    creativeScript,
    creativeStyle,
    creativeRun,
    creativeVersions,
    creativeRunFeedback,
    sceneFeedbackMap,
    commitScore,
    isCreativeBusy,
    setCreativeScript,
    setCreativeStyle,
    setCreativeRun,
    setCreativeRunFeedback,
    setCommitScore,
    refreshCreativeVersions,
    createCreativeRun,
    applyCreativeFeedback,
    commitCreativeRun,
    updateSceneFeedback
  } = useCreativeRunManager({
    selectedPolicyId,
    policyDecision,
    simulatePolicy,
    showToast
  })

  const {
    v4Workflows,
    v4SelectedWorkflowId,
    v4WorkflowName,
    v4WorkflowDescription,
    v4WorkflowRunPayload,
    v4WorkflowRunResult,
    v4WorkflowRuns,
    v4WorkflowRunsLimit,
    v4WorkflowRunsHasMore,
    v4BatchJobType,
    v4BatchJobPayload,
    v4BatchJobId,
    v4BatchJobStatus,
    v4AssetReuseSourceId,
    v4AssetReuseTargetId,
    v4AssetReuseNote,
    v4AssetReuseResult,
    v4AssetReuseHistoryAssetId,
    v4AssetReuseHistorySourceProjectId,
    v4AssetReuseHistoryTargetProjectId,
    v4AssetReuseHistoryLimit,
    v4AssetReuseHistoryOffset,
    v4AssetReuseHistoryRecords,
    isV4CreativeBusy,
    setV4SelectedWorkflowId,
    setV4WorkflowName,
    setV4WorkflowDescription,
    setV4WorkflowRunPayload,
    setV4WorkflowRuns,
    setV4WorkflowRunsCursor,
    setV4WorkflowRunsHasMore,
    setV4WorkflowRunsLimit,
    setV4BatchJobType,
    setV4BatchJobPayload,
    setV4BatchJobId,
    setV4AssetReuseSourceId,
    setV4AssetReuseTargetId,
    setV4AssetReuseNote,
    setV4AssetReuseHistoryAssetId,
    setV4AssetReuseHistorySourceProjectId,
    setV4AssetReuseHistoryTargetProjectId,
    setV4AssetReuseHistoryLimit,
    setV4AssetReuseHistoryOffset,
    refreshV4Workflows,
    createV4Workflow,
    runV4Workflow,
    queryV4WorkflowRuns,
    createV4BatchJob,
    queryV4BatchJob,
    callV4AssetReuse,
    queryV4AssetReuseHistory
  } = useV4CreativeOps({
    projectId,
    currentActorName,
    parseJsonObjectInput,
    showToast
  })

  useEffect(() => {
    setV4WorkflowRuns([])
    setV4WorkflowRunsCursor('')
    setV4WorkflowRunsHasMore(false)
  }, [v4SelectedWorkflowId, setV4WorkflowRuns, setV4WorkflowRunsCursor, setV4WorkflowRunsHasMore])

  const {
    videoGenerationMode,
    setVideoGenerationMode,
    videoGenerationModelId,
    setVideoGenerationModelId,
    videoGenerationPrompt,
    setVideoGenerationPrompt,
    videoGenerationNegativePrompt,
    setVideoGenerationNegativePrompt,
    videoGenerationInputSourceType,
    setVideoGenerationInputSourceType,
    videoGenerationImageInput,
    setVideoGenerationImageInput,
    videoGenerationReferenceImagesInput,
    setVideoGenerationReferenceImagesInput,
    videoGenerationVideoInput,
    setVideoGenerationVideoInput,
    videoGenerationFirstFrameInput,
    setVideoGenerationFirstFrameInput,
    videoGenerationLastFrameInput,
    setVideoGenerationLastFrameInput,
    videoGenerationListLimit,
    setVideoGenerationListLimit,
    videoGenerationStatusFilter,
    setVideoGenerationStatusFilter,
    videoGenerationJobs,
    videoGenerationCursor,
    videoGenerationHasMore,
    videoGenerationSelectedJobId,
    setVideoGenerationSelectedJobId,
    videoGenerationPollingEnabled,
    setVideoGenerationPollingEnabled,
    videoGenerationLastAutoSyncAt,
    isVideoGenerationAutoSyncTicking,
    isVideoGenerationBusy,
    createVideoGenerationTask,
    loadVideoGenerationJobs,
    queryVideoGenerationJobDetail,
    syncVideoGenerationJob,
    retryVideoGenerationJob,
    cancelVideoGenerationJob,
    refreshVideoGenerationJobDetail
  } = useVideoGenerationManager({
    labMode,
    authProfile,
    capabilities,
    isCapabilitiesLoading,
    workspaceId,
    loadCapabilities,
    showToast
  })

  return {
    creativeScript,
    creativeStyle,
    commitScore,
    isCreativeBusy,
    creativeRun,
    creativeRunFeedback,
    sceneFeedbackMap,
    creativeVersions,
    geminiQuickCheck,
    videoGenerationMode,
    videoGenerationModelId,
    videoGenerationPrompt,
    videoGenerationNegativePrompt,
    videoGenerationInputSourceType,
    videoGenerationImageInput,
    videoGenerationReferenceImagesInput,
    videoGenerationVideoInput,
    videoGenerationFirstFrameInput,
    videoGenerationLastFrameInput,
    videoGenerationListLimit,
    videoGenerationStatusFilter,
    videoGenerationJobs,
    videoGenerationCursor,
    videoGenerationHasMore,
    videoGenerationSelectedJobId,
    videoGenerationPollingEnabled,
    videoGenerationLastAutoSyncAt,
    isVideoGenerationAutoSyncTicking,
    isVideoGenerationBusy,
    workflows: v4Workflows,
    selectedWorkflowId: v4SelectedWorkflowId,
    workflowName: v4WorkflowName,
    workflowDescription: v4WorkflowDescription,
    workflowRunPayload: v4WorkflowRunPayload,
    workflowRunResult: v4WorkflowRunResult,
    workflowRuns: v4WorkflowRuns,
    workflowRunsLimit: v4WorkflowRunsLimit,
    workflowRunsHasMore: v4WorkflowRunsHasMore,
    batchJobType: v4BatchJobType,
    batchJobPayload: v4BatchJobPayload,
    batchJobId: v4BatchJobId,
    batchJobStatus: v4BatchJobStatus,
    assetReuseSourceId: v4AssetReuseSourceId,
    assetReuseTargetId: v4AssetReuseTargetId,
    assetReuseNote: v4AssetReuseNote,
    assetReuseResult: v4AssetReuseResult,
    assetReuseHistoryAssetId: v4AssetReuseHistoryAssetId,
    assetReuseHistorySourceProjectId: v4AssetReuseHistorySourceProjectId,
    assetReuseHistoryTargetProjectId: v4AssetReuseHistoryTargetProjectId,
    assetReuseHistoryLimit: v4AssetReuseHistoryLimit,
    assetReuseHistoryOffset: v4AssetReuseHistoryOffset,
    assetReuseHistoryRecords: v4AssetReuseHistoryRecords,
    isV4Busy: isV4CreativeBusy,
    onCreativeScriptChange: setCreativeScript,
    onCreativeStyleChange: setCreativeStyle,
    onCommitScoreChange: setCommitScore,
    onCreateCreativeRun: () => void createCreativeRun(),
    onApplyCreativeFeedback: () => void applyCreativeFeedback(),
    onCommitCreativeRun: () => void commitCreativeRun(),
    onRefreshCreativeVersions: () => void refreshCreativeVersions(),
    onRunGeminiQuickCheck: () => void loadCapabilities(),
    onOpenChannelPanel: openChannelPanel,
    onVideoGenerationModeChange: setVideoGenerationMode,
    onVideoGenerationModelIdChange: setVideoGenerationModelId,
    onVideoGenerationPromptChange: setVideoGenerationPrompt,
    onVideoGenerationNegativePromptChange: setVideoGenerationNegativePrompt,
    onVideoGenerationInputSourceTypeChange: setVideoGenerationInputSourceType,
    onVideoGenerationImageInputChange: setVideoGenerationImageInput,
    onVideoGenerationReferenceImagesInputChange: setVideoGenerationReferenceImagesInput,
    onVideoGenerationVideoInputChange: setVideoGenerationVideoInput,
    onVideoGenerationFirstFrameInputChange: setVideoGenerationFirstFrameInput,
    onVideoGenerationLastFrameInputChange: setVideoGenerationLastFrameInput,
    onVideoGenerationListLimitChange: setVideoGenerationListLimit,
    onVideoGenerationStatusFilterChange: setVideoGenerationStatusFilter,
    onVideoGenerationSelectedJobIdChange: setVideoGenerationSelectedJobId,
    onVideoGenerationPollingEnabledChange: setVideoGenerationPollingEnabled,
    onCreateVideoGenerationTask: () => void createVideoGenerationTask(),
    onRefreshVideoGenerationJobs: () => void loadVideoGenerationJobs(false),
    onLoadMoreVideoGenerationJobs: () => void loadVideoGenerationJobs(true),
    onQueryVideoGenerationJobDetail: () => void queryVideoGenerationJobDetail(),
    onSyncVideoGenerationJob: (jobId) => void syncVideoGenerationJob(jobId),
    onRetryVideoGenerationJob: (jobId) => void retryVideoGenerationJob(jobId),
    onCancelVideoGenerationJob: (jobId) => void cancelVideoGenerationJob(jobId),
    onRefreshVideoGenerationJobDetail: (jobId) => void refreshVideoGenerationJobDetail(jobId),
    onCreativeRunFeedbackChange: setCreativeRunFeedback,
    onSceneFeedbackChange: updateSceneFeedback,
    onSwitchCreativeRunVersion: setCreativeRun,
    onRefreshWorkflows: () => void refreshV4Workflows(),
    onSelectedWorkflowIdChange: setV4SelectedWorkflowId,
    onWorkflowNameChange: setV4WorkflowName,
    onWorkflowDescriptionChange: setV4WorkflowDescription,
    onWorkflowRunPayloadChange: setV4WorkflowRunPayload,
    onCreateWorkflow: () => void createV4Workflow(),
    onRunWorkflow: () => void runV4Workflow(),
    onWorkflowRunsLimitChange: setV4WorkflowRunsLimit,
    onQueryWorkflowRuns: () => void queryV4WorkflowRuns(false),
    onLoadMoreWorkflowRuns: () => void queryV4WorkflowRuns(true),
    onBatchJobTypeChange: setV4BatchJobType,
    onBatchJobPayloadChange: setV4BatchJobPayload,
    onBatchJobIdChange: setV4BatchJobId,
    onCreateBatchJob: () => void createV4BatchJob(),
    onQueryBatchJob: () => void queryV4BatchJob(),
    onAssetReuseSourceIdChange: setV4AssetReuseSourceId,
    onAssetReuseTargetIdChange: setV4AssetReuseTargetId,
    onAssetReuseNoteChange: setV4AssetReuseNote,
    onCallAssetReuse: () => void callV4AssetReuse(),
    onAssetReuseHistoryAssetIdChange: setV4AssetReuseHistoryAssetId,
    onAssetReuseHistorySourceProjectIdChange: setV4AssetReuseHistorySourceProjectId,
    onAssetReuseHistoryTargetProjectIdChange: setV4AssetReuseHistoryTargetProjectId,
    onAssetReuseHistoryLimitChange: setV4AssetReuseHistoryLimit,
    onAssetReuseHistoryOffsetChange: setV4AssetReuseHistoryOffset,
    onQueryAssetReuseHistory: () => void queryV4AssetReuseHistory()
  }
}
