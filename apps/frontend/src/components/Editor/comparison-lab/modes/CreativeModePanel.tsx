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
    <div className="creative-shell" data-testid="area-creative-shell">
      <section className="creative-card">
        <h4>创意闭环引擎</h4>
        <label className="lab-field">
          <span>脚本</span>
          <textarea
            name="creativeScript"
            value={creativeScript}
            onChange={(event) => onCreativeScriptChange(event.target.value)}
            placeholder="输入剧情脚本，系统将自动拆解分镜并支持版本闭环反馈"
          />
        </label>
        <div className="lab-inline-fields">
          <label className="lab-field">
            <span>风格</span>
            <select
              name="creativeStyle"
              value={creativeStyle}
              onChange={(event) => onCreativeStyleChange(event.target.value)}
            >
              <option value="cinematic">cinematic</option>
              <option value="realistic">realistic</option>
              <option value="anime">anime</option>
              <option value="commercial">commercial</option>
            </select>
          </label>
          <label className="lab-field">
            <span>质量分</span>
            <input
              type="number"
              name="commitScore"
              min={0}
              max={1}
              step={0.05}
              value={commitScore}
              onChange={(event) =>
                onCommitScoreChange(Math.max(0, Math.min(1, Number(event.target.value || 0))))
              }
            />
          </label>
        </div>
        <div className="lab-inline-actions">
          <button disabled={isCreativeBusy} onClick={onCreateCreativeRun}>
            {isCreativeBusy ? '处理中...' : '创建 Run'}
          </button>
          <button disabled={!creativeRun?.id || isCreativeBusy} onClick={onApplyCreativeFeedback}>
            应用反馈
          </button>
          <button disabled={!creativeRun?.id || isCreativeBusy} onClick={onCommitCreativeRun}>
            提交完成
          </button>
          <button disabled={!creativeRun?.id || isCreativeBusy} onClick={onRefreshCreativeVersions}>
            刷新版本链
          </button>
        </div>
      </section>

      <section className="creative-card">
        <h4>运行详情</h4>
        {creativeRun ? (
          <>
            <div className="creative-summary">
              <div>ID: {creativeRun.id}</div>
              <div>状态: {creativeRun.status}</div>
              <div>版本: v{creativeRun.version || 1}</div>
              <div>父版本: {creativeRun.parentRunId || '-'}</div>
            </div>
            <label className="lab-field">
              <span>整片反馈</span>
              <textarea
                name="creativeRunFeedback"
                value={creativeRunFeedback}
                onChange={(event) => onCreativeRunFeedbackChange(event.target.value)}
                placeholder="例如：节奏更紧凑，镜头 2 需要更强反差"
              />
            </label>
            <div className="creative-scene-list">
              {creativeRun.scenes.map((scene) => (
                <div key={scene.id} className="creative-scene-item">
                  <div className="scene-headline">
                    <strong>
                      {scene.order + 1}. {scene.title}
                    </strong>
                    <span>
                      rev {scene.revision || 1} · {scene.status}
                    </span>
                  </div>
                  <div className="scene-meta-line">
                    <span>{scene.duration}s</span>
                    <span>{scene.lastFeedback || '暂无反馈'}</span>
                  </div>
                  <input
                    type="text"
                    name={`sceneFeedback-${scene.id}`}
                    value={sceneFeedbackMap[scene.id] || ''}
                    onChange={(event) => onSceneFeedbackChange(scene.id, event.target.value)}
                    placeholder="该分镜反馈"
                  />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="api-empty">尚未创建创意 run</div>
        )}
      </section>

      <section className="creative-card">
        <h4>版本链</h4>
        <div className="creative-version-list">
          {creativeVersions.map((version) => (
            <button
              key={version.id}
              className={`creative-version-item ${creativeRun?.id === version.id ? 'active' : ''}`}
              onClick={() => onSwitchCreativeRunVersion(version)}
            >
              <span>
                v{version.version || 1} · {version.status}
              </span>
              <span>{new Date(version.updatedAt).toLocaleString()}</span>
            </button>
          ))}
          {creativeVersions.length === 0 ? <div className="api-empty">暂无版本链记录</div> : null}
        </div>
      </section>

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
  )
}

export default CreativeModePanel
