import React, { useMemo } from 'react'
import type { V4Workflow, V4WorkflowRun } from '../../types'

const FALLBACK_TEXT = '-'

const formatLocalDateTime = (value: string | null | undefined) => {
  const text = String(value || '').trim()
  if (!text) return FALLBACK_TEXT
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? FALLBACK_TEXT : date.toLocaleString()
}

const resolveWorkflowRunTone = (status: V4WorkflowRun['status']) => {
  if (status === 'completed') return 'success'
  if (status === 'failed') return 'critical'
  return 'accent'
}

export interface WorkflowSectionProps {
  workflows: V4Workflow[]
  selectedWorkflowId: string
  workflowName: string
  workflowDescription: string
  workflowRunPayload: string
  workflowRunResult: V4WorkflowRun | null
  workflowRuns: V4WorkflowRun[]
  workflowRunsLimit: string
  workflowRunsHasMore: boolean
  isV4Busy: boolean
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
}

const WorkflowSection: React.FC<WorkflowSectionProps> = ({
  workflows,
  selectedWorkflowId,
  workflowName,
  workflowDescription,
  workflowRunPayload,
  workflowRunResult,
  workflowRuns,
  workflowRunsLimit,
  workflowRunsHasMore,
  isV4Busy,
  onRefreshWorkflows,
  onSelectedWorkflowIdChange,
  onWorkflowNameChange,
  onWorkflowDescriptionChange,
  onWorkflowRunPayloadChange,
  onCreateWorkflow,
  onRunWorkflow,
  onWorkflowRunsLimitChange,
  onQueryWorkflowRuns,
  onLoadMoreWorkflowRuns
}) => {
  const selectedWorkflow = useMemo(
    () => workflows.find((item) => item.id === selectedWorkflowId) || null,
    [selectedWorkflowId, workflows]
  )
  const latestWorkflowRun = useMemo(() => {
    return (
      [...workflowRuns].sort((left, right) => {
        return Date.parse(right.createdAt) - Date.parse(left.createdAt)
      })[0] || null
    )
  }, [workflowRuns])
  const focusWorkflowRun = workflowRunResult || latestWorkflowRun
  const completedWorkflowRuns = workflowRuns.filter((item) => item.status === 'completed')
  const failedWorkflowRuns = workflowRuns.filter((item) => item.status === 'failed')
  const isWorkflowIdle =
    workflows.length === 0 && workflowRuns.length === 0 && !selectedWorkflowId.trim()
  const workflowLeadText = isWorkflowIdle
    ? '先创建或选择一个 Workflow，再把 payload 送进运行队列。'
    : '工作流已就绪，继续围绕当前选择的编排链做运行和复盘。'

  return (
    <section
      className={`creative-card creative-card--workflow ${isWorkflowIdle ? 'is-idle' : 'has-runs'}`}
    >
      <div className="creative-section-head">
        <div className="creative-section-copy">
          <span className="creative-section-kicker">workflow deck</span>
          <h4>v4 Workflow</h4>
        </div>
        <div className="creative-section-chip">编排器</div>
      </div>
      <div className="lab-inline-actions">
        <button disabled={isV4Busy} onClick={onRefreshWorkflows}>
          刷新列表
        </button>
      </div>
      <div className="lab-metric-grid workflow-summary-grid" data-testid="workflow-summary-grid">
        <div className="lab-metric-card lab-metric-card--accent">
          <span>工作流库</span>
          <strong>{workflows.length}</strong>
          <small>当前选择：{selectedWorkflow?.name || '未选择'}</small>
        </div>
        <div className="lab-metric-card lab-metric-card--success">
          <span>运行完成</span>
          <strong>{completedWorkflowRuns.length}</strong>
          <small>
            失败 {failedWorkflowRuns.length} · 可继续翻页 {workflowRunsHasMore ? '是' : '否'}
          </small>
        </div>
        <div className="lab-metric-card lab-metric-card--neutral">
          <span>最近触发</span>
          <strong>{focusWorkflowRun?.triggerType || FALLBACK_TEXT}</strong>
          <small>{formatLocalDateTime(focusWorkflowRun?.createdAt)}</small>
        </div>
      </div>
      <div className="workflow-stage-layout">
        <div className="workflow-stage-compose">
          <div className="creative-stage-callout">
            <span className="creative-section-kicker">compose focus</span>
            <strong>Workflow 先承担编排入口，再承接运行回放。</strong>
            <span>{workflowLeadText}</span>
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
        </div>
        <aside className="workflow-stage-sidebar">
          <div className="workflow-focus-card">
            <span className="creative-section-kicker">workflow spotlight</span>
            <strong>{selectedWorkflow?.name || '请选择 Workflow'}</strong>
            <span>
              {selectedWorkflow?.description ||
                '创建或选择一个 Workflow 后，可在这里查看最近运行的触发、状态与时序。'}
            </span>
          </div>
          <div className="creative-summary">
            <div>Run ID: {focusWorkflowRun?.id || FALLBACK_TEXT}</div>
            <div>状态: {focusWorkflowRun?.status || FALLBACK_TEXT}</div>
            <div>触发: {focusWorkflowRun?.triggerType || FALLBACK_TEXT}</div>
            <div>最近更新: {formatLocalDateTime(selectedWorkflow?.updatedAt)}</div>
          </div>
        </aside>
      </div>
      <div className="creative-scene-list">
        {workflowRuns.map((item) => (
          <div key={item.id} className="creative-scene-item creative-scene-item--rich">
            <div className="scene-headline">
              <strong>{item.id}</strong>
              <span
                className={`lab-status-badge lab-status-badge--${resolveWorkflowRunTone(item.status)}`}
              >
                {item.status}
              </span>
            </div>
            <div className="scene-meta-line">
              <span>触发方式：{item.triggerType || '-'}</span>
              <span>创建：{formatLocalDateTime(item.createdAt)}</span>
              <span>发起人：{item.createdBy || FALLBACK_TEXT}</span>
            </div>
            <div className="scene-meta-line">
              <span>开始：{formatLocalDateTime(item.startedAt)}</span>
              <span>完成：{formatLocalDateTime(item.completedAt)}</span>
              <span>错误：{item.errorMessage || FALLBACK_TEXT}</span>
            </div>
          </div>
        ))}
        {workflowRuns.length === 0 ? (
          <div className="api-empty">暂无 Workflow Runs 记录</div>
        ) : null}
      </div>
    </section>
  )
}

export default WorkflowSection
