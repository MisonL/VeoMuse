import React, { useMemo, useState } from 'react'
import type {
  GeminiQuickCheckState,
  VideoGenerationJob,
  VideoGenerationJobStatus,
  VideoGenerationMode,
  VideoInputSourceType
} from '../../types'
import {
  VIDEO_GENERATION_MODES,
  isVideoGenerationActiveStatus,
  resolveVideoGenerationRequiredInputs,
  resolveVideoGenerationStatusText,
  sortVideoGenerationJobsForWorkbench
} from '../../types'
import {
  normalizeVideoGenerationDisplayText,
  resolveVideoGenerationPollingState,
  resolveVideoGenerationStatusBadgeModifier
} from '../creativeModePanel.logic'

const FALLBACK_TEXT = '-'

const formatLocalDateTime = (value: string | null | undefined) => {
  const text = String(value || '').trim()
  if (!text) return FALLBACK_TEXT
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? FALLBACK_TEXT : date.toLocaleString()
}

const formatDurationMs = (value: number | null | undefined) => {
  if (!Number.isFinite(value as number)) return FALLBACK_TEXT
  const durationMs = Number(value)
  if (durationMs >= 60_000) {
    return `${(durationMs / 60_000).toFixed(durationMs >= 600_000 ? 0 : 1)} 分钟`
  }
  if (durationMs >= 1_000) {
    return `${(durationMs / 1_000).toFixed(durationMs >= 10_000 ? 0 : 1)} 秒`
  }
  return `${durationMs} ms`
}

const resolveVideoGenerationProgress = (status: VideoGenerationJobStatus) => {
  switch (status) {
    case 'queued':
      return 16
    case 'submitted':
      return 38
    case 'processing':
      return 72
    case 'cancel_requested':
      return 84
    case 'succeeded':
    case 'failed':
    case 'canceled':
      return 100
    default:
      return 0
  }
}

export interface VideoGenerationWorkbenchProps {
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
}

const VideoGenerationWorkbench: React.FC<VideoGenerationWorkbenchProps> = ({
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
  onRefreshVideoGenerationJobDetail
}) => {
  const [showAllTerminalVideoJobs, setShowAllTerminalVideoJobs] = useState(false)
  const [showVideoGenerationAdvancedInputs, setShowVideoGenerationAdvancedInputs] = useState(false)
  const [showVideoGenerationInspector, setShowVideoGenerationInspector] = useState(false)
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
  const pollingState = resolveVideoGenerationPollingState({
    pollingEnabled: videoGenerationPollingEnabled,
    ticking: isVideoGenerationAutoSyncTicking
  })
  const selectedVideoGenerationJobId = videoGenerationSelectedJobId.trim()
  const hasSelectedVideoGenerationJob = selectedVideoGenerationJobId.length > 0
  const selectedVideoGenerationJob =
    sortedVideoGenerationJobs.find((job) => job.id === selectedVideoGenerationJobId) || null
  const focusVideoGenerationJob =
    selectedVideoGenerationJob ||
    activeVideoGenerationJobs[0] ||
    sortedVideoGenerationJobs[0] ||
    null
  const succeededVideoGenerationJobs = terminalVideoGenerationJobs.filter(
    (job) => job.status === 'succeeded'
  )
  const failedVideoGenerationJobs = terminalVideoGenerationJobs.filter(
    (job) => job.status === 'failed'
  )
  const canceledVideoGenerationJobs = terminalVideoGenerationJobs.filter(
    (job) => job.status === 'canceled'
  )
  const averageSucceededDurationMs = succeededVideoGenerationJobs.reduce((sum, job) => {
    return sum + (Number.isFinite(job.durationMs as number) ? Number(job.durationMs) : 0)
  }, 0)
  const averageSucceededDurationText =
    succeededVideoGenerationJobs.length > 0
      ? formatDurationMs(averageSucceededDurationMs / succeededVideoGenerationJobs.length)
      : FALLBACK_TEXT
  const latestSucceededJob = succeededVideoGenerationJobs[0] || null
  const focusPromptValue = focusVideoGenerationJob?.request?.['prompt']
  const focusTextValue = focusVideoGenerationJob?.request?.['text']
  const focusPrompt = normalizeVideoGenerationDisplayText(
    typeof focusPromptValue === 'string'
      ? focusPromptValue
      : typeof focusTextValue === 'string'
        ? focusTextValue
        : ''
  )
  const focusErrorText = normalizeVideoGenerationDisplayText(focusVideoGenerationJob?.errorMessage)
  const focusOutputText = normalizeVideoGenerationDisplayText(focusVideoGenerationJob?.outputUrl)
  const focusProgressValue = focusVideoGenerationJob
    ? resolveVideoGenerationProgress(focusVideoGenerationJob.status)
    : 0
  const focusProviderStatus = focusVideoGenerationJob?.providerStatus || FALLBACK_TEXT
  const isVideoGenerationAdvancedInputsOpen =
    showVideoGenerationAdvancedInputs || requiredVideoInputs.length > 0

  return (
    <section
      className="creative-card video-generation-card"
      data-testid="area-video-generation-hero"
    >
      <div className="video-generation-hero-head">
        <div className="video-generation-section-head">
          <div className="creative-section-copy">
            <span className="creative-section-kicker">generation engine</span>
            <h4>统一视频生成工作台</h4>
          </div>
          <div className="creative-section-chip">主引擎</div>
        </div>
        <div className="video-generation-head-actions">
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
            className={`video-generation-polling-toggle ${
              videoGenerationPollingEnabled ? 'active' : ''
            }`}
            onClick={() => onVideoGenerationPollingEnabledChange(!videoGenerationPollingEnabled)}
          >
            自动轮询：{videoGenerationPollingEnabled ? '开' : '关'}
          </button>
        </div>
      </div>

      <div className="video-generation-status-ribbon">
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
        <div
          className="video-generation-polling-hint video-generation-polling-hint--hero"
          data-testid="video-generation-polling-hint"
        >
          <span className={`video-generation-polling-state ${pollingState.tone}`}>
            {pollingState.text}
          </span>
          <span className="video-generation-polling-desc">
            后端自动同步终态已启用，前端自动轮询仅刷新展示。
          </span>
          <span className="video-generation-polling-time">最近轮询：{latestAutoSyncText}</span>
        </div>
      </div>

      <div
        className="lab-metric-grid video-generation-overview-grid"
        data-testid="video-generation-overview"
      >
        <div className="lab-metric-card lab-metric-card--accent">
          <span>活跃任务</span>
          <strong>{activeVideoGenerationJobs.length}</strong>
          <small>
            总任务 {sortedVideoGenerationJobs.length}，当前筛选 {videoGenerationStatusFilter}
          </small>
        </div>
        <div className="lab-metric-card lab-metric-card--success">
          <span>成功交付</span>
          <strong>{succeededVideoGenerationJobs.length}</strong>
          <small>最近成功：{formatLocalDateTime(latestSucceededJob?.finishedAt)}</small>
        </div>
        <div className="lab-metric-card lab-metric-card--warning">
          <span>异常回收</span>
          <strong>{failedVideoGenerationJobs.length + canceledVideoGenerationJobs.length}</strong>
          <small>
            失败 {failedVideoGenerationJobs.length} · 取消 {canceledVideoGenerationJobs.length}
          </small>
        </div>
        <div className="lab-metric-card lab-metric-card--neutral">
          <span>平均耗时</span>
          <strong>{averageSucceededDurationText}</strong>
          <small>仅统计成功完成的任务</small>
        </div>
      </div>

      <div className="video-generation-command-bar">
        <div className="video-generation-prompt-stage">
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
          <details
            className="video-generation-collapsible"
            open={isVideoGenerationAdvancedInputsOpen}
            onToggle={(event) => setShowVideoGenerationAdvancedInputs(event.currentTarget.open)}
          >
            <summary>
              <span>高级输入（图像 / 视频 / 首末帧）</span>
              <span>{isVideoGenerationAdvancedInputsOpen ? '收起' : '展开'}</span>
            </summary>
            <div className="video-generation-collapsible-body">
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
                    onChange={(event) =>
                      onVideoGenerationReferenceImagesInputChange(event.target.value)
                    }
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
            </div>
          </details>

          <div className="lab-inline-actions">
            <button disabled={isVideoGenerationBusy} onClick={onCreateVideoGenerationTask}>
              {isVideoGenerationBusy ? '处理中...' : '提交任务'}
            </button>
            <button
              disabled={isVideoGenerationBusy || !hasSelectedVideoGenerationJob}
              onClick={onQueryVideoGenerationJobDetail}
            >
              查询选中任务
            </button>
          </div>
        </div>

        <aside className="video-generation-ops-sidebar">
          <div className="lab-inline-fields video-generation-ops-fields">
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

          <details
            className="video-generation-collapsible video-generation-collapsible--inspector"
            open={showVideoGenerationInspector}
            onToggle={(event) => setShowVideoGenerationInspector(event.currentTarget.open)}
          >
            <summary>
              <span>查询与分页设置</span>
              <span>{showVideoGenerationInspector ? '收起' : '展开'}</span>
            </summary>
            <div className="video-generation-collapsible-body">
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
              <div className="video-generation-pagination">
                <span className="video-generation-pagination-label">Cursor</span>
                <code className="video-generation-pagination-value">
                  {videoGenerationCursor || '-'}
                </code>
                <span className="video-generation-pagination-sep">·</span>
                <span className="video-generation-pagination-label">hasMore</span>
                <strong>{videoGenerationHasMore ? 'true' : 'false'}</strong>
              </div>
            </div>
          </details>

          <div className="video-generation-list-head">
            <span className="video-generation-count-chip active">
              活跃任务：{activeVideoGenerationJobs.length}
            </span>
            <span className="video-generation-count-chip terminal">
              终态任务：{terminalVideoGenerationJobs.length}
            </span>
            <span
              className="video-generation-selected-chip"
              title={selectedVideoGenerationJobId || '-'}
            >
              选中：{selectedVideoGenerationJobId || '-'}
            </span>
            <button
              type="button"
              className="video-generation-terminal-toggle"
              onClick={() => setShowAllTerminalVideoJobs((prev) => !prev)}
              disabled={terminalVideoGenerationJobs.length === 0}
            >
              {showAllTerminalVideoJobs ? '折叠终态任务' : '展开终态任务'}
            </button>
          </div>

          <div className="video-generation-focus-panel" data-testid="video-generation-focus-panel">
            <div className="video-generation-focus-copy">
              <span className="creative-section-kicker">result spotlight</span>
              <strong>{focusVideoGenerationJob?.id || '暂无焦点任务'}</strong>
              <span>
                {focusVideoGenerationJob
                  ? `${focusVideoGenerationJob.generationMode} · ${focusVideoGenerationJob.modelId} · ${resolveVideoGenerationStatusText(
                      focusVideoGenerationJob.status
                    )}`
                  : '提交或选中一个任务后，这里会聚合输出、耗时与同步状态。'}
              </span>
            </div>
            {focusVideoGenerationJob ? (
              <>
                <div className="video-generation-job-progress">
                  <span
                    className={`video-generation-status-badge ${resolveVideoGenerationStatusBadgeModifier(
                      focusVideoGenerationJob.status
                    )}`}
                  >
                    {resolveVideoGenerationStatusText(focusVideoGenerationJob.status)}
                  </span>
                  <div className="video-generation-job-progress-bar" aria-hidden="true">
                    <span style={{ width: `${focusProgressValue}%` }} />
                  </div>
                  <span className="video-generation-job-progress-value">{focusProgressValue}%</span>
                </div>
                <div className="video-generation-focus-grid">
                  <div className="video-generation-focus-card">
                    <span>输出焦点</span>
                    <strong>{focusOutputText}</strong>
                    {focusVideoGenerationJob.outputUrl ? (
                      <a
                        className="video-generation-output-link"
                        href={focusVideoGenerationJob.outputUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        打开输出
                      </a>
                    ) : (
                      <small>当前尚未产出可访问链接</small>
                    )}
                  </div>
                  <div className="video-generation-focus-card">
                    <span>执行窗口</span>
                    <strong>{formatDurationMs(focusVideoGenerationJob.durationMs)}</strong>
                    <small>
                      创建 {formatLocalDateTime(focusVideoGenerationJob.createdAt)} · 开始{' '}
                      {formatLocalDateTime(focusVideoGenerationJob.startedAt)}
                    </small>
                  </div>
                  <div className="video-generation-focus-card">
                    <span>渠道同步</span>
                    <strong>{focusProviderStatus}</strong>
                    <small>
                      完成 {formatLocalDateTime(focusVideoGenerationJob.finishedAt)} · 最近同步{' '}
                      {formatLocalDateTime(focusVideoGenerationJob.lastSyncedAt)}
                    </small>
                  </div>
                </div>
                <div className="video-generation-focus-copy video-generation-focus-copy--detail">
                  <span>Prompt：{focusPrompt}</span>
                  <span>错误：{focusErrorText}</span>
                </div>
              </>
            ) : null}
          </div>
        </aside>
      </div>

      <div className="video-generation-jobs-deck">
        <div className="video-generation-job-list" data-testid="area-video-generation-job-list">
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
            const statusText = resolveVideoGenerationStatusText(job.status)
            const statusBadgeModifier = resolveVideoGenerationStatusBadgeModifier(job.status)
            const promptText = normalizeVideoGenerationDisplayText(requestPrompt)
            const errorText = normalizeVideoGenerationDisplayText(job.errorMessage)
            const outputText = normalizeVideoGenerationDisplayText(job.outputUrl)
            return (
              <div
                key={job.id}
                className={`video-generation-job-item ${isSelected ? 'selected' : ''} ${
                  isCancelled ? 'cancelled' : ''
                }`}
              >
                <div className="video-generation-job-head">
                  <button
                    className="video-generation-job-select"
                    onClick={() => onVideoGenerationSelectedJobIdChange(job.id)}
                  >
                    <span>{job.id}</span>
                    <span>
                      {job.generationMode} · {job.modelId}
                    </span>
                  </button>
                  <span className={`video-generation-status-badge ${statusBadgeModifier}`}>
                    {statusText}
                  </span>
                </div>
                <div className="video-generation-job-meta">
                  <span>渠道：{job.providerStatus}</span>
                  <span>{new Date(job.updatedAt).toLocaleString()}</span>
                </div>
                <div className="video-generation-job-meta video-generation-job-meta-stack">
                  <span className="video-generation-kv">
                    <b>Prompt</b>
                    <span className="video-generation-ellipsis" title={promptText}>
                      {promptText}
                    </span>
                  </span>
                  <span className="video-generation-kv">
                    <b>错误</b>
                    <span className="video-generation-ellipsis" title={errorText}>
                      {errorText}
                    </span>
                  </span>
                </div>
                <div className="video-generation-job-meta video-generation-job-meta-stack">
                  <span className="video-generation-kv">
                    <b>输出</b>
                    <span className="video-generation-ellipsis" title={outputText}>
                      {outputText}
                    </span>
                  </span>
                  <span>重试次数：{job.retryCount ?? 0}</span>
                  <span>
                    最近同步：{job.lastSyncedAt ? new Date(job.lastSyncedAt).toLocaleString() : '-'}
                  </span>
                </div>
                <div className="video-generation-job-progress">
                  <span className="video-generation-job-progress-label">
                    进度 {resolveVideoGenerationProgress(job.status)}%
                  </span>
                  <div className="video-generation-job-progress-bar" aria-hidden="true">
                    <span style={{ width: `${resolveVideoGenerationProgress(job.status)}%` }} />
                  </div>
                  <span className="video-generation-job-progress-value">
                    耗时 {formatDurationMs(job.durationMs)}
                  </span>
                </div>
                <div className="video-generation-job-meta">
                  <span>创建：{formatLocalDateTime(job.createdAt)}</span>
                  <span>开始：{formatLocalDateTime(job.startedAt)}</span>
                  <span>完成：{formatLocalDateTime(job.finishedAt)}</span>
                  <span>操作者：{job.createdBy || FALLBACK_TEXT}</span>
                </div>
                {job.outputUrl ? (
                  <a
                    className="video-generation-output-link"
                    href={job.outputUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    打开输出
                  </a>
                ) : null}
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
      </div>
    </section>
  )
}

export default VideoGenerationWorkbench
