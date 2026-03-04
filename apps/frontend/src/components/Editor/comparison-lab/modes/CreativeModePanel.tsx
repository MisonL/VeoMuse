import React, { useMemo, useState } from 'react'
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
import {
  VIDEO_GENERATION_MODES,
  isVideoGenerationActiveStatus,
  resolveVideoGenerationRequiredInputs,
  resolveVideoGenerationStatusText,
  sortVideoGenerationJobsForWorkbench
} from '../types'

interface CreativeModePanelProps {
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
  const [showAllTerminalVideoJobs, setShowAllTerminalVideoJobs] = useState(false)
  const requiredVideoInputs = resolveVideoGenerationRequiredInputs(videoGenerationMode)
  const sortedVideoGenerationJobs = useMemo(
    () => sortVideoGenerationJobsForWorkbench(videoGenerationJobs),
    [videoGenerationJobs]
  )
  const activeVideoGenerationJobs = sortedVideoGenerationJobs.filter((job) =>
    isVideoGenerationActiveStatus(job.status)
  )
  const terminalVideoGenerationJobs = sortedVideoGenerationJobs.filter(
    (job) => !isVideoGenerationActiveStatus(job.status)
  )
  const visibleTerminalVideoGenerationJobs = showAllTerminalVideoJobs
    ? terminalVideoGenerationJobs
    : terminalVideoGenerationJobs.slice(0, 6)
  const hiddenTerminalJobCount = Math.max(
    0,
    terminalVideoGenerationJobs.length - visibleTerminalVideoGenerationJobs.length
  )
  const renderedVideoGenerationJobs = [
    ...activeVideoGenerationJobs,
    ...visibleTerminalVideoGenerationJobs
  ]
  const latestAutoSyncText = videoGenerationLastAutoSyncAt
    ? new Date(videoGenerationLastAutoSyncAt).toLocaleString()
    : '-'

  return (
    <div className="creative-shell">
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

      <section className="creative-card video-generation-card">
        <h4>统一视频生成工作台</h4>
        <div
          className={`video-generation-quick-check video-generation-quick-check--${geminiQuickCheck.status}`}
        >
          <div className="video-generation-quick-check-title">{geminiQuickCheck.title}</div>
          <div className="video-generation-quick-check-desc">{geminiQuickCheck.description}</div>
          <div className="lab-inline-actions">
            <button disabled={isVideoGenerationBusy} onClick={onRunGeminiQuickCheck}>
              Gemini 快速自检
            </button>
            <button onClick={onOpenChannelPanel}>打开渠道面板</button>
          </div>
        </div>
        <div className="lab-inline-fields">
          <label className="lab-field">
            <span>生成模式</span>
            <select
              name="videoGenerationMode"
              value={videoGenerationMode}
              onChange={(event) =>
                onVideoGenerationModeChange(event.target.value as VideoGenerationMode)
              }
            >
              {VIDEO_GENERATION_MODES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="lab-field">
            <span>模型</span>
            <input
              name="videoGenerationModelId"
              value={videoGenerationModelId}
              onChange={(event) => onVideoGenerationModelIdChange(event.target.value)}
              placeholder="veo-3.1"
            />
          </label>
          <label className="lab-field">
            <span>输入源类型</span>
            <select
              name="videoGenerationInputSourceType"
              value={videoGenerationInputSourceType}
              onChange={(event) =>
                onVideoGenerationInputSourceTypeChange(event.target.value as VideoInputSourceType)
              }
            >
              <option value="url">url</option>
              <option value="objectKey">objectKey</option>
            </select>
          </label>
        </div>
        <label className="lab-field">
          <span>Prompt</span>
          <textarea
            name="videoGenerationPrompt"
            value={videoGenerationPrompt}
            onChange={(event) => onVideoGenerationPromptChange(event.target.value)}
            placeholder="描述目标视频内容、镜头语言与时长诉求"
          />
        </label>
        <label className="lab-field">
          <span>Negative Prompt</span>
          <input
            name="videoGenerationNegativePrompt"
            value={videoGenerationNegativePrompt}
            onChange={(event) => onVideoGenerationNegativePromptChange(event.target.value)}
            placeholder="可选，例如：blur, overexposure"
          />
        </label>
        <div className="video-generation-required">
          必填输入：{requiredVideoInputs.length > 0 ? requiredVideoInputs.join(' + ') : '无'}
        </div>
        <div className="lab-inline-fields">
          <label className="lab-field">
            <span>图像输入</span>
            <input
              name="videoGenerationImageInput"
              value={videoGenerationImageInput}
              onChange={(event) => onVideoGenerationImageInputChange(event.target.value)}
              placeholder="图生视频主图"
            />
          </label>
          <label className="lab-field">
            <span>参考图列表</span>
            <textarea
              name="videoGenerationReferenceImagesInput"
              value={videoGenerationReferenceImagesInput}
              onChange={(event) => onVideoGenerationReferenceImagesInputChange(event.target.value)}
              placeholder="多张参考图，逗号或换行分隔"
            />
          </label>
        </div>
        <div className="lab-inline-fields">
          <label className="lab-field">
            <span>视频输入</span>
            <input
              name="videoGenerationVideoInput"
              value={videoGenerationVideoInput}
              onChange={(event) => onVideoGenerationVideoInputChange(event.target.value)}
              placeholder="视频扩展模式输入"
            />
          </label>
          <label className="lab-field">
            <span>首帧输入</span>
            <input
              name="videoGenerationFirstFrameInput"
              value={videoGenerationFirstFrameInput}
              onChange={(event) => onVideoGenerationFirstFrameInputChange(event.target.value)}
              placeholder="首末帧过渡首帧"
            />
          </label>
          <label className="lab-field">
            <span>末帧输入</span>
            <input
              name="videoGenerationLastFrameInput"
              value={videoGenerationLastFrameInput}
              onChange={(event) => onVideoGenerationLastFrameInputChange(event.target.value)}
              placeholder="首末帧过渡末帧"
            />
          </label>
        </div>
        <div className="lab-inline-actions">
          <button disabled={isVideoGenerationBusy} onClick={onCreateVideoGenerationTask}>
            {isVideoGenerationBusy ? '处理中...' : '提交任务'}
          </button>
        </div>
        <div className="lab-inline-fields">
          <label className="lab-field">
            <span>列表数量</span>
            <input
              type="number"
              min={1}
              name="videoGenerationListLimit"
              value={videoGenerationListLimit}
              onChange={(event) => onVideoGenerationListLimitChange(event.target.value)}
              placeholder="20"
            />
          </label>
          <label className="lab-field">
            <span>状态筛选</span>
            <select
              name="videoGenerationStatusFilter"
              value={videoGenerationStatusFilter}
              onChange={(event) =>
                onVideoGenerationStatusFilterChange(
                  event.target.value as 'all' | VideoGenerationJobStatus
                )
              }
            >
              <option value="all">all</option>
              <option value="queued">queued</option>
              <option value="submitted">submitted</option>
              <option value="processing">processing</option>
              <option value="succeeded">succeeded</option>
              <option value="cancel_requested">cancel_requested</option>
              <option value="canceled">canceled</option>
              <option value="failed">failed</option>
            </select>
          </label>
          <label className="lab-field">
            <span>选中任务 ID</span>
            <input
              name="videoGenerationSelectedJobId"
              value={videoGenerationSelectedJobId}
              onChange={(event) => onVideoGenerationSelectedJobIdChange(event.target.value)}
              placeholder="job_xxx"
            />
          </label>
        </div>
        <div className="lab-inline-actions">
          <button disabled={isVideoGenerationBusy} onClick={onRefreshVideoGenerationJobs}>
            刷新列表
          </button>
          <button
            disabled={isVideoGenerationBusy || !videoGenerationHasMore}
            onClick={onLoadMoreVideoGenerationJobs}
          >
            加载更多
          </button>
          <button
            disabled={isVideoGenerationBusy || !videoGenerationSelectedJobId.trim()}
            onClick={onQueryVideoGenerationJobDetail}
          >
            查询详情
          </button>
          <button
            className={`video-generation-polling-toggle ${
              videoGenerationPollingEnabled ? 'active' : ''
            }`}
            onClick={() => onVideoGenerationPollingEnabledChange(!videoGenerationPollingEnabled)}
          >
            自动轮询：{videoGenerationPollingEnabled ? '开' : '关'}
          </button>
        </div>
        <div className="video-generation-polling-hint">
          后端自动同步终态已启用，前端自动轮询仅刷新展示。最近轮询：{latestAutoSyncText}
          {isVideoGenerationAutoSyncTicking ? '（刷新中）' : ''}
        </div>
        <div className="video-generation-pagination">
          Cursor: {videoGenerationCursor || '-'} · hasMore:{' '}
          {videoGenerationHasMore ? 'true' : 'false'}
        </div>
        <div className="video-generation-list-head">
          <span>活跃任务：{activeVideoGenerationJobs.length}</span>
          <span>终态任务：{terminalVideoGenerationJobs.length}</span>
          <button
            type="button"
            className="video-generation-terminal-toggle"
            onClick={() => setShowAllTerminalVideoJobs((prev) => !prev)}
            disabled={terminalVideoGenerationJobs.length === 0}
          >
            {showAllTerminalVideoJobs ? '折叠终态任务' : '展开终态任务'}
          </button>
        </div>
        <div className="video-generation-job-list">
          {renderedVideoGenerationJobs.map((job) => {
            const requestPromptValue = job.request?.['prompt']
            const requestTextValue = job.request?.['text']
            const requestPrompt =
              typeof requestPromptValue === 'string'
                ? requestPromptValue
                : typeof requestTextValue === 'string'
                  ? requestTextValue
                  : ''
            const isSelected = videoGenerationSelectedJobId === job.id
            const isCancelled = job.status === 'canceled' || job.status === 'cancel_requested'
            return (
              <div
                key={job.id}
                className={`video-generation-job-item ${isSelected ? 'selected' : ''} ${
                  isCancelled ? 'cancelled' : ''
                }`}
              >
                <button
                  className="video-generation-job-select"
                  onClick={() => onVideoGenerationSelectedJobIdChange(job.id)}
                >
                  <span>{job.id}</span>
                  <span>
                    {job.generationMode} · {job.modelId}
                  </span>
                </button>
                <div className="video-generation-job-meta">
                  <span>状态：{resolveVideoGenerationStatusText(job.status)}</span>
                  <span>渠道：{job.providerStatus}</span>
                  <span>{new Date(job.updatedAt).toLocaleString()}</span>
                </div>
                <div className="video-generation-job-meta">
                  <span>Prompt：{requestPrompt || '-'}</span>
                  <span>错误：{job.errorMessage || '-'}</span>
                </div>
                <div className="video-generation-job-meta">
                  <span>输出：{job.outputUrl || '-'}</span>
                  <span>重试次数：{job.retryCount ?? 0}</span>
                  <span>最近同步：{job.lastSyncedAt ? new Date(job.lastSyncedAt).toLocaleString() : '-'}</span>
                </div>
                <div className="video-generation-job-actions">
                  <button
                    disabled={
                      isVideoGenerationBusy ||
                      !(
                        job.status === 'submitted' ||
                        job.status === 'processing' ||
                        job.status === 'queued' ||
                        job.status === 'cancel_requested'
                      )
                    }
                    onClick={() => onSyncVideoGenerationJob(job.id)}
                  >
                    同步
                  </button>
                  <button
                    disabled={
                      isVideoGenerationBusy ||
                      !(
                        job.status === 'failed' ||
                        job.status === 'succeeded' ||
                        job.status === 'canceled'
                      )
                    }
                    onClick={() => onRetryVideoGenerationJob(job.id)}
                  >
                    重试
                  </button>
                  <button
                    disabled={
                      isVideoGenerationBusy ||
                      isCancelled ||
                      job.status === 'failed' ||
                      job.status === 'succeeded'
                    }
                    onClick={() => onCancelVideoGenerationJob(job.id)}
                  >
                    取消
                  </button>
                  <button
                    disabled={isVideoGenerationBusy}
                    onClick={() => onRefreshVideoGenerationJobDetail(job.id)}
                  >
                    刷新详情
                  </button>
                </div>
              </div>
            )
          })}
          {renderedVideoGenerationJobs.length === 0 ? (
            <div className="api-empty">暂无视频任务</div>
          ) : null}
          {hiddenTerminalJobCount > 0 ? (
            <div className="video-generation-terminal-collapsed">
              还有 {hiddenTerminalJobCount} 条终态任务已折叠，点击“展开终态任务”查看。
            </div>
          ) : null}
        </div>
      </section>

      <section className="creative-card">
        <h4>v4 Workflow</h4>
        <div className="lab-inline-actions">
          <button disabled={isV4Busy} onClick={onRefreshWorkflows}>
            刷新列表
          </button>
        </div>
        <div className="lab-inline-fields">
          <label className="lab-field">
            <span>工作流名称</span>
            <input
              name="v4WorkflowName"
              value={workflowName}
              onChange={(event) => onWorkflowNameChange(event.target.value)}
            />
          </label>
          <label className="lab-field">
            <span>描述</span>
            <input
              name="v4WorkflowDescription"
              value={workflowDescription}
              onChange={(event) => onWorkflowDescriptionChange(event.target.value)}
            />
          </label>
        </div>
        <div className="lab-inline-actions">
          <button disabled={isV4Busy} onClick={onCreateWorkflow}>
            创建 Workflow
          </button>
        </div>
        <label className="lab-field">
          <span>选择 Workflow</span>
          <select
            name="v4SelectedWorkflowId"
            value={selectedWorkflowId}
            onChange={(event) => onSelectedWorkflowIdChange(event.target.value)}
          >
            <option value="">请选择</option>
            {workflows.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {new Date(item.updatedAt).toLocaleString()}
              </option>
            ))}
          </select>
        </label>
        <label className="lab-field">
          <span>Run Payload(JSON)</span>
          <textarea
            name="v4WorkflowRunPayload"
            value={workflowRunPayload}
            onChange={(event) => onWorkflowRunPayloadChange(event.target.value)}
            placeholder='{"prompt":"8s cinematic city chase"}'
          />
        </label>
        <div className="lab-inline-actions">
          <button disabled={!selectedWorkflowId || isV4Busy} onClick={onRunWorkflow}>
            运行 Workflow
          </button>
        </div>
        <div className="lab-inline-fields">
          <label className="lab-field">
            <span>Runs 查询数量</span>
            <input
              type="number"
              min={1}
              name="v4WorkflowRunsLimit"
              value={workflowRunsLimit}
              onChange={(event) => onWorkflowRunsLimitChange(event.target.value)}
              placeholder="20"
            />
          </label>
          <button disabled={!selectedWorkflowId || isV4Busy} onClick={onQueryWorkflowRuns}>
            查询 Runs
          </button>
          <button
            disabled={!selectedWorkflowId || !workflowRunsHasMore || isV4Busy}
            onClick={onLoadMoreWorkflowRuns}
          >
            加载更多 Runs
          </button>
        </div>
        <div className="creative-summary">
          <div>Run ID: {workflowRunResult?.id || '-'}</div>
          <div>状态: {workflowRunResult?.status || '-'}</div>
          <div>触发: {workflowRunResult?.triggerType || '-'}</div>
        </div>
        <div className="creative-scene-list">
          {workflowRuns.map((item) => (
            <div key={item.id} className="creative-scene-item">
              <div className="scene-headline">
                <strong>{item.id}</strong>
                <span>{item.status}</span>
              </div>
              <div className="scene-meta-line">
                <span>触发方式：{item.triggerType || '-'}</span>
                <span>{new Date(item.createdAt).toLocaleString()}</span>
              </div>
            </div>
          ))}
          {workflowRuns.length === 0 ? (
            <div className="api-empty">暂无 Workflow Runs 记录</div>
          ) : null}
        </div>
      </section>

      <section className="creative-card">
        <h4>v4 Batch Job</h4>
        <div className="lab-inline-fields">
          <label className="lab-field">
            <span>Job 类型</span>
            <input
              name="v4BatchJobType"
              value={batchJobType}
              onChange={(event) => onBatchJobTypeChange(event.target.value)}
              placeholder="render.batch"
            />
          </label>
          <label className="lab-field">
            <span>Job ID</span>
            <input
              name="v4BatchJobId"
              value={batchJobId}
              onChange={(event) => onBatchJobIdChange(event.target.value)}
              placeholder="创建后自动回填"
            />
          </label>
        </div>
        <label className="lab-field">
          <span>Job Payload(JSON)</span>
          <textarea
            name="v4BatchJobPayload"
            value={batchJobPayload}
            onChange={(event) => onBatchJobPayloadChange(event.target.value)}
            placeholder='{"items":["clip-a","clip-b"]}'
          />
        </label>
        <div className="lab-inline-actions">
          <button disabled={isV4Busy} onClick={onCreateBatchJob}>
            创建 Batch Job
          </button>
          <button disabled={!batchJobId.trim() || isV4Busy} onClick={onQueryBatchJob}>
            查询状态
          </button>
        </div>
        <div className="creative-summary">
          <div>状态: {batchJobStatus?.status || '-'}</div>
          <div>
            项数:{' '}
            {batchJobStatus ? `${batchJobStatus.completedItems}/${batchJobStatus.totalItems}` : '-'}
          </div>
          <div>失败: {batchJobStatus?.failedItems ?? '-'}</div>
        </div>
        <div className="creative-scene-list">
          {(batchJobStatus?.items || []).map((item) => (
            <div key={item.id} className="creative-scene-item">
              <div className="scene-headline">
                <strong>{item.itemKey}</strong>
                <span>{item.status}</span>
              </div>
              <div className="scene-meta-line">
                <span>错误：{item.errorMessage || '-'}</span>
              </div>
            </div>
          ))}
          {batchJobStatus && (batchJobStatus.items || []).length === 0 ? (
            <div className="api-empty">暂无 Batch Job Items</div>
          ) : null}
        </div>
      </section>

      <section className="creative-card">
        <h4>v4 Asset Reuse</h4>
        <div className="lab-inline-fields">
          <label className="lab-field">
            <span>来源 Asset</span>
            <input
              name="v4AssetReuseSourceId"
              value={assetReuseSourceId}
              onChange={(event) => onAssetReuseSourceIdChange(event.target.value)}
              placeholder="asset_xxx"
            />
          </label>
          <label className="lab-field">
            <span>目标项目 ID</span>
            <input
              name="v4AssetReuseTargetId"
              value={assetReuseTargetId}
              onChange={(event) => onAssetReuseTargetIdChange(event.target.value)}
              placeholder="project_xxx"
            />
          </label>
        </div>
        <label className="lab-field">
          <span>说明</span>
          <input
            name="v4AssetReuseNote"
            value={assetReuseNote}
            onChange={(event) => onAssetReuseNoteChange(event.target.value)}
            placeholder="reuse for style consistency"
          />
        </label>
        <div className="lab-inline-actions">
          <button
            disabled={!assetReuseSourceId.trim() || !assetReuseTargetId.trim() || isV4Busy}
            onClick={onCallAssetReuse}
          >
            调用 Asset Reuse
          </button>
        </div>
        <div className="creative-summary">
          <div>记录: {assetReuseResult?.id || '-'}</div>
          <div>Asset: {assetReuseResult?.assetId || '-'}</div>
          <div>目标项目: {assetReuseResult?.targetProjectId || '-'}</div>
        </div>
      </section>

      <section className="creative-card">
        <h4>v4 资产复用历史</h4>
        <div className="lab-inline-fields">
          <label className="lab-field">
            <span>资产 ID</span>
            <input
              name="v4AssetReuseHistoryAssetId"
              value={assetReuseHistoryAssetId}
              onChange={(event) => onAssetReuseHistoryAssetIdChange(event.target.value)}
              placeholder="为空则查询全部"
            />
          </label>
          <label className="lab-field">
            <span>来源项目 ID</span>
            <input
              name="v4AssetReuseHistorySourceProjectId"
              value={assetReuseHistorySourceProjectId}
              onChange={(event) => onAssetReuseHistorySourceProjectIdChange(event.target.value)}
              placeholder="可选"
            />
          </label>
          <label className="lab-field">
            <span>目标项目 ID</span>
            <input
              name="v4AssetReuseHistoryTargetProjectId"
              value={assetReuseHistoryTargetProjectId}
              onChange={(event) => onAssetReuseHistoryTargetProjectIdChange(event.target.value)}
              placeholder="可选"
            />
          </label>
        </div>
        <div className="lab-inline-fields">
          <label className="lab-field">
            <span>查询数量</span>
            <input
              type="number"
              min={1}
              name="v4AssetReuseHistoryLimit"
              value={assetReuseHistoryLimit}
              onChange={(event) => onAssetReuseHistoryLimitChange(event.target.value)}
              placeholder="20"
            />
          </label>
          <label className="lab-field">
            <span>偏移量</span>
            <input
              type="number"
              min={0}
              name="v4AssetReuseHistoryOffset"
              value={assetReuseHistoryOffset}
              onChange={(event) => onAssetReuseHistoryOffsetChange(event.target.value)}
              placeholder="0"
            />
          </label>
        </div>
        <div className="lab-inline-actions">
          <button disabled={isV4Busy} onClick={onQueryAssetReuseHistory}>
            查询历史
          </button>
        </div>
        <div className="creative-scene-list">
          {assetReuseHistoryRecords.map((item) => (
            <div key={item.id} className="creative-scene-item">
              <div className="scene-headline">
                <strong>{item.assetId}</strong>
                <span>{new Date(item.createdAt).toLocaleString()}</span>
              </div>
              <div className="scene-meta-line">
                <span>来源项目：{item.sourceProjectId || '-'}</span>
                <span>目标项目：{item.targetProjectId || '-'}</span>
              </div>
              <div className="scene-meta-line">
                <span>复用人：{item.reusedBy || '-'}</span>
                <span>记录 ID：{item.id}</span>
              </div>
            </div>
          ))}
          {assetReuseHistoryRecords.length === 0 ? (
            <div className="api-empty">暂无资产复用历史</div>
          ) : null}
        </div>
      </section>
    </div>
  )
}

export default CreativeModePanel
