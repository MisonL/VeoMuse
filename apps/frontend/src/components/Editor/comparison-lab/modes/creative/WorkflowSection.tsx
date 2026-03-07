import React from 'react'
import type { V4Workflow, V4WorkflowRun } from '../../types'

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
  return (
    <section className="creative-card creative-card--workflow">
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
  )
}

export default WorkflowSection
