import React from 'react'
import type {
  V4AssetReuseRecord,
  CreativeRun,
  V4AssetReuseResult,
  V4BatchJob,
  V4Workflow,
  V4WorkflowRun,
  GeminiQuickCheckState,
  VideoGenerationJob,
  VideoGenerationJobStatus,
  VideoGenerationMode,
  VideoInputSourceType
} from '../types'
import BatchJobSection from './creative/BatchJobSection'
import AssetReuseSection from './creative/AssetReuseSection'
import CreativeInputSection from './creative/CreativeInputSection'
import CreativeRunDetailsSection from './creative/CreativeRunDetailsSection'
import CreativeVersionChainSection from './creative/CreativeVersionChainSection'
import VideoGenerationWorkbench from './creative/VideoGenerationWorkbench'
import WorkflowSection from './creative/WorkflowSection'

export interface CreativeModePanelProps {
  creativeScript: string
  creativeStyle: string
  commitScore: number
  isCreativeBusy: boolean
  creativeRun: CreativeRun | null
  creativeRunFeedback: string
  sceneFeedbackMap: Record<string, string>
  creativeVersions: CreativeRun[]
  geminiQuickCheck: GeminiQuickCheckState
  videoGenerationMode: VideoGenerationMode
  videoGenerationModelId: string
  videoGenerationPrompt: string
  videoGenerationNegativePrompt: string
  videoGenerationInputSourceType: VideoInputSourceType
  videoGenerationImageInput: string
  videoGenerationReferenceImagesInput: string
  videoGenerationVideoInput: string
  videoGenerationFirstFrameInput: string
  videoGenerationLastFrameInput: string
  videoGenerationListLimit: string
  videoGenerationStatusFilter: 'all' | VideoGenerationJobStatus
  videoGenerationJobs: VideoGenerationJob[]
  videoGenerationCursor: string
  videoGenerationHasMore: boolean
  videoGenerationSelectedJobId: string
  videoGenerationPollingEnabled: boolean
  videoGenerationLastAutoSyncAt: string
  isVideoGenerationAutoSyncTicking: boolean
  isVideoGenerationBusy: boolean
  workflows: V4Workflow[]
  selectedWorkflowId: string
  workflowName: string
  workflowDescription: string
  workflowRunPayload: string
  workflowRunResult: V4WorkflowRun | null
  workflowRuns: V4WorkflowRun[]
  workflowRunsLimit: string
  workflowRunsHasMore: boolean
  batchJobType: string
  batchJobPayload: string
  batchJobId: string
  batchJobStatus: V4BatchJob | null
  assetReuseSourceId: string
  assetReuseTargetId: string
  assetReuseNote: string
  assetReuseResult: V4AssetReuseResult | null
  assetReuseHistoryAssetId: string
  assetReuseHistorySourceProjectId: string
  assetReuseHistoryTargetProjectId: string
  assetReuseHistoryLimit: string
  assetReuseHistoryOffset: string
  assetReuseHistoryRecords: V4AssetReuseRecord[]
  isV4Busy: boolean
  onCreativeScriptChange: (value: string) => void
  onCreativeStyleChange: (value: string) => void
  onCommitScoreChange: (value: number) => void
  onCreateCreativeRun: () => void
  onApplyCreativeFeedback: () => void
  onCommitCreativeRun: () => void
  onRefreshCreativeVersions: () => void
  onRunGeminiQuickCheck: () => void
  onOpenChannelPanel: () => void
  onVideoGenerationModeChange: (value: VideoGenerationMode) => void
  onVideoGenerationModelIdChange: (value: string) => void
  onVideoGenerationPromptChange: (value: string) => void
  onVideoGenerationNegativePromptChange: (value: string) => void
  onVideoGenerationInputSourceTypeChange: (value: VideoInputSourceType) => void
  onVideoGenerationImageInputChange: (value: string) => void
  onVideoGenerationReferenceImagesInputChange: (value: string) => void
  onVideoGenerationVideoInputChange: (value: string) => void
  onVideoGenerationFirstFrameInputChange: (value: string) => void
  onVideoGenerationLastFrameInputChange: (value: string) => void
  onVideoGenerationListLimitChange: (value: string) => void
  onVideoGenerationStatusFilterChange: (value: 'all' | VideoGenerationJobStatus) => void
  onVideoGenerationSelectedJobIdChange: (value: string) => void
  onVideoGenerationPollingEnabledChange: (value: boolean) => void
  onCreateVideoGenerationTask: () => void
  onRefreshVideoGenerationJobs: () => void
  onLoadMoreVideoGenerationJobs: () => void
  onQueryVideoGenerationJobDetail: () => void
  onSyncVideoGenerationJob: (jobId: string) => void
  onRetryVideoGenerationJob: (jobId: string) => void
  onCancelVideoGenerationJob: (jobId: string) => void
  onRefreshVideoGenerationJobDetail: (jobId: string) => void
  onCreativeRunFeedbackChange: (value: string) => void
  onSceneFeedbackChange: (sceneId: string, value: string) => void
  onSwitchCreativeRunVersion: (run: CreativeRun) => void
  onRefreshWorkflows: () => void
  onSelectedWorkflowIdChange: (value: string) => void
  onWorkflowNameChange: (value: string) => void
  onWorkflowDescriptionChange: (value: string) => void
  onWorkflowRunPayloadChange: (value: string) => void
  onCreateWorkflow: () => void
  onRunWorkflow: () => void
  onWorkflowRunsLimitChange: (value: string) => void
  onQueryWorkflowRuns: () => void
  onLoadMoreWorkflowRuns: () => void
  onBatchJobTypeChange: (value: string) => void
  onBatchJobPayloadChange: (value: string) => void
  onBatchJobIdChange: (value: string) => void
  onCreateBatchJob: () => void
  onQueryBatchJob: () => void
  onAssetReuseSourceIdChange: (value: string) => void
  onAssetReuseTargetIdChange: (value: string) => void
  onAssetReuseNoteChange: (value: string) => void
  onCallAssetReuse: () => void
  onAssetReuseHistoryAssetIdChange: (value: string) => void
  onAssetReuseHistorySourceProjectIdChange: (value: string) => void
  onAssetReuseHistoryTargetProjectIdChange: (value: string) => void
  onAssetReuseHistoryLimitChange: (value: string) => void
  onAssetReuseHistoryOffsetChange: (value: string) => void
  onQueryAssetReuseHistory: () => void
}

const CreativeModePanel: React.FC<CreativeModePanelProps> = ({
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
  workflows,
  selectedWorkflowId,
  workflowName,
  workflowDescription,
  workflowRunPayload,
  workflowRunResult,
  workflowRuns,
  workflowRunsLimit,
  workflowRunsHasMore,
  batchJobType,
  batchJobPayload,
  batchJobId,
  batchJobStatus,
  assetReuseSourceId,
  assetReuseTargetId,
  assetReuseNote,
  assetReuseResult,
  assetReuseHistoryAssetId,
  assetReuseHistorySourceProjectId,
  assetReuseHistoryTargetProjectId,
  assetReuseHistoryLimit,
  assetReuseHistoryOffset,
  assetReuseHistoryRecords,
  isV4Busy,
  onCreativeScriptChange,
  onCreativeStyleChange,
  onCommitScoreChange,
  onCreateCreativeRun,
  onApplyCreativeFeedback,
  onCommitCreativeRun,
  onRefreshCreativeVersions,
  onRunGeminiQuickCheck,
  onOpenChannelPanel,
  onVideoGenerationModeChange,
  onVideoGenerationModelIdChange,
  onVideoGenerationPromptChange,
  onVideoGenerationNegativePromptChange,
  onVideoGenerationInputSourceTypeChange,
  onVideoGenerationImageInputChange,
  onVideoGenerationReferenceImagesInputChange,
  onVideoGenerationVideoInputChange,
  onVideoGenerationFirstFrameInputChange,
  onVideoGenerationLastFrameInputChange,
  onVideoGenerationListLimitChange,
  onVideoGenerationStatusFilterChange,
  onVideoGenerationSelectedJobIdChange,
  onVideoGenerationPollingEnabledChange,
  onCreateVideoGenerationTask,
  onRefreshVideoGenerationJobs,
  onLoadMoreVideoGenerationJobs,
  onQueryVideoGenerationJobDetail,
  onSyncVideoGenerationJob,
  onRetryVideoGenerationJob,
  onCancelVideoGenerationJob,
  onRefreshVideoGenerationJobDetail,
  onCreativeRunFeedbackChange,
  onSceneFeedbackChange,
  onSwitchCreativeRunVersion,
  onRefreshWorkflows,
  onSelectedWorkflowIdChange,
  onWorkflowNameChange,
  onWorkflowDescriptionChange,
  onWorkflowRunPayloadChange,
  onCreateWorkflow,
  onRunWorkflow,
  onWorkflowRunsLimitChange,
  onQueryWorkflowRuns,
  onLoadMoreWorkflowRuns,
  onBatchJobTypeChange,
  onBatchJobPayloadChange,
  onBatchJobIdChange,
  onCreateBatchJob,
  onQueryBatchJob,
  onAssetReuseSourceIdChange,
  onAssetReuseTargetIdChange,
  onAssetReuseNoteChange,
  onCallAssetReuse,
  onAssetReuseHistoryAssetIdChange,
  onAssetReuseHistorySourceProjectIdChange,
  onAssetReuseHistoryTargetProjectIdChange,
  onAssetReuseHistoryLimitChange,
  onAssetReuseHistoryOffsetChange,
  onQueryAssetReuseHistory
}) => {
  return (
    <div className="creative-shell creative-broadcast-shell" data-testid="area-creative-shell">
      <section className="creative-hero-stage" data-testid="area-creative-hero-stage">
        <div className="creative-hero-main">
          <VideoGenerationWorkbench
            geminiQuickCheck={geminiQuickCheck}
            videoGenerationMode={videoGenerationMode}
            videoGenerationModelId={videoGenerationModelId}
            videoGenerationPrompt={videoGenerationPrompt}
            videoGenerationNegativePrompt={videoGenerationNegativePrompt}
            videoGenerationInputSourceType={videoGenerationInputSourceType}
            videoGenerationImageInput={videoGenerationImageInput}
            videoGenerationReferenceImagesInput={videoGenerationReferenceImagesInput}
            videoGenerationVideoInput={videoGenerationVideoInput}
            videoGenerationFirstFrameInput={videoGenerationFirstFrameInput}
            videoGenerationLastFrameInput={videoGenerationLastFrameInput}
            videoGenerationListLimit={videoGenerationListLimit}
            videoGenerationStatusFilter={videoGenerationStatusFilter}
            videoGenerationJobs={videoGenerationJobs}
            videoGenerationCursor={videoGenerationCursor}
            videoGenerationHasMore={videoGenerationHasMore}
            videoGenerationSelectedJobId={videoGenerationSelectedJobId}
            videoGenerationPollingEnabled={videoGenerationPollingEnabled}
            videoGenerationLastAutoSyncAt={videoGenerationLastAutoSyncAt}
            isVideoGenerationAutoSyncTicking={isVideoGenerationAutoSyncTicking}
            isVideoGenerationBusy={isVideoGenerationBusy}
            onRunGeminiQuickCheck={onRunGeminiQuickCheck}
            onOpenChannelPanel={onOpenChannelPanel}
            onVideoGenerationModeChange={onVideoGenerationModeChange}
            onVideoGenerationModelIdChange={onVideoGenerationModelIdChange}
            onVideoGenerationPromptChange={onVideoGenerationPromptChange}
            onVideoGenerationNegativePromptChange={onVideoGenerationNegativePromptChange}
            onVideoGenerationInputSourceTypeChange={onVideoGenerationInputSourceTypeChange}
            onVideoGenerationImageInputChange={onVideoGenerationImageInputChange}
            onVideoGenerationReferenceImagesInputChange={onVideoGenerationReferenceImagesInputChange}
            onVideoGenerationVideoInputChange={onVideoGenerationVideoInputChange}
            onVideoGenerationFirstFrameInputChange={onVideoGenerationFirstFrameInputChange}
            onVideoGenerationLastFrameInputChange={onVideoGenerationLastFrameInputChange}
            onVideoGenerationListLimitChange={onVideoGenerationListLimitChange}
            onVideoGenerationStatusFilterChange={onVideoGenerationStatusFilterChange}
            onVideoGenerationSelectedJobIdChange={onVideoGenerationSelectedJobIdChange}
            onVideoGenerationPollingEnabledChange={onVideoGenerationPollingEnabledChange}
            onCreateVideoGenerationTask={onCreateVideoGenerationTask}
            onRefreshVideoGenerationJobs={onRefreshVideoGenerationJobs}
            onLoadMoreVideoGenerationJobs={onLoadMoreVideoGenerationJobs}
            onQueryVideoGenerationJobDetail={onQueryVideoGenerationJobDetail}
            onSyncVideoGenerationJob={onSyncVideoGenerationJob}
            onRetryVideoGenerationJob={onRetryVideoGenerationJob}
            onCancelVideoGenerationJob={onCancelVideoGenerationJob}
            onRefreshVideoGenerationJobDetail={onRefreshVideoGenerationJobDetail}
          />
        </div>

        <div className="creative-hero-side">
          <div className="creative-side-stack creative-side-stack--compose">
            <CreativeInputSection
              creativeScript={creativeScript}
              creativeStyle={creativeStyle}
              commitScore={commitScore}
              isCreativeBusy={isCreativeBusy}
              hasCreativeRun={Boolean(creativeRun?.id)}
              onCreativeScriptChange={onCreativeScriptChange}
              onCreativeStyleChange={onCreativeStyleChange}
              onCommitScoreChange={onCommitScoreChange}
              onCreateCreativeRun={onCreateCreativeRun}
              onApplyCreativeFeedback={onApplyCreativeFeedback}
              onCommitCreativeRun={onCommitCreativeRun}
              onRefreshCreativeVersions={onRefreshCreativeVersions}
            />
          </div>

          <div className="creative-side-stack creative-side-stack--feedback">
            <CreativeRunDetailsSection
              creativeRun={creativeRun}
              creativeRunFeedback={creativeRunFeedback}
              sceneFeedbackMap={sceneFeedbackMap}
              onCreativeRunFeedbackChange={onCreativeRunFeedbackChange}
              onSceneFeedbackChange={onSceneFeedbackChange}
            />
          </div>
        </div>
      </section>

      <section className="creative-support-grid">
        <div className="creative-support-card creative-support-card--versions">
          <CreativeVersionChainSection
            creativeRun={creativeRun}
            creativeVersions={creativeVersions}
            onSwitchCreativeRunVersion={onSwitchCreativeRunVersion}
          />
        </div>

        <div className="creative-support-card creative-support-card--workflow">
          <WorkflowSection
            workflows={workflows}
            selectedWorkflowId={selectedWorkflowId}
            workflowName={workflowName}
            workflowDescription={workflowDescription}
            workflowRunPayload={workflowRunPayload}
            workflowRunResult={workflowRunResult}
            workflowRuns={workflowRuns}
            workflowRunsLimit={workflowRunsLimit}
            workflowRunsHasMore={workflowRunsHasMore}
            isV4Busy={isV4Busy}
            onRefreshWorkflows={onRefreshWorkflows}
            onSelectedWorkflowIdChange={onSelectedWorkflowIdChange}
            onWorkflowNameChange={onWorkflowNameChange}
            onWorkflowDescriptionChange={onWorkflowDescriptionChange}
            onWorkflowRunPayloadChange={onWorkflowRunPayloadChange}
            onCreateWorkflow={onCreateWorkflow}
            onRunWorkflow={onRunWorkflow}
            onWorkflowRunsLimitChange={onWorkflowRunsLimitChange}
            onQueryWorkflowRuns={onQueryWorkflowRuns}
            onLoadMoreWorkflowRuns={onLoadMoreWorkflowRuns}
          />
        </div>
      </section>

      <section className="creative-ops-rail">
        <div className="creative-ops-card creative-ops-card--batch">
          <BatchJobSection
            batchJobType={batchJobType}
            batchJobPayload={batchJobPayload}
            batchJobId={batchJobId}
            batchJobStatus={batchJobStatus}
            isV4Busy={isV4Busy}
            onBatchJobTypeChange={onBatchJobTypeChange}
            onBatchJobPayloadChange={onBatchJobPayloadChange}
            onBatchJobIdChange={onBatchJobIdChange}
            onCreateBatchJob={onCreateBatchJob}
            onQueryBatchJob={onQueryBatchJob}
          />
        </div>

        <div className="creative-ops-card creative-ops-card--archive">
          <AssetReuseSection
            assetReuseSourceId={assetReuseSourceId}
            assetReuseTargetId={assetReuseTargetId}
            assetReuseNote={assetReuseNote}
            assetReuseResult={assetReuseResult}
            assetReuseHistoryAssetId={assetReuseHistoryAssetId}
            assetReuseHistorySourceProjectId={assetReuseHistorySourceProjectId}
            assetReuseHistoryTargetProjectId={assetReuseHistoryTargetProjectId}
            assetReuseHistoryLimit={assetReuseHistoryLimit}
            assetReuseHistoryOffset={assetReuseHistoryOffset}
            assetReuseHistoryRecords={assetReuseHistoryRecords}
            isV4Busy={isV4Busy}
            onAssetReuseSourceIdChange={onAssetReuseSourceIdChange}
            onAssetReuseTargetIdChange={onAssetReuseTargetIdChange}
            onAssetReuseNoteChange={onAssetReuseNoteChange}
            onCallAssetReuse={onCallAssetReuse}
            onAssetReuseHistoryAssetIdChange={onAssetReuseHistoryAssetIdChange}
            onAssetReuseHistorySourceProjectIdChange={onAssetReuseHistorySourceProjectIdChange}
            onAssetReuseHistoryTargetProjectIdChange={onAssetReuseHistoryTargetProjectIdChange}
            onAssetReuseHistoryLimitChange={onAssetReuseHistoryLimitChange}
            onAssetReuseHistoryOffsetChange={onAssetReuseHistoryOffsetChange}
            onQueryAssetReuseHistory={onQueryAssetReuseHistory}
          />
        </div>
      </section>
    </div>
  )
}

export default CreativeModePanel
