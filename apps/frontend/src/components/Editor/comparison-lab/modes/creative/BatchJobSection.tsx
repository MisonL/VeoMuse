import React from 'react'
import type { V4BatchJob } from '../../types'

const FALLBACK_TEXT = '-'

const formatLocalDateTime = (value: string | null | undefined) => {
  const text = String(value || '').trim()
  if (!text) return FALLBACK_TEXT
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? FALLBACK_TEXT : date.toLocaleString()
}

const resolveBatchStatusTone = (status: string | null | undefined) => {
  if (status === 'completed') return 'success'
  if (status === 'failed') return 'critical'
  return 'accent'
}

export interface BatchJobSectionProps {
  batchJobType: string
  batchJobPayload: string
  batchJobId: string
  batchJobStatus: V4BatchJob | null
  isV4Busy: boolean
  onBatchJobTypeChange: (value: string) => void
  onBatchJobPayloadChange: (value: string) => void
  onBatchJobIdChange: (value: string) => void
  onCreateBatchJob: () => void
  onQueryBatchJob: () => void
}

const BatchJobSection: React.FC<BatchJobSectionProps> = ({
  batchJobType,
  batchJobPayload,
  batchJobId,
  batchJobStatus,
  isV4Busy,
  onBatchJobTypeChange,
  onBatchJobPayloadChange,
  onBatchJobIdChange,
  onCreateBatchJob,
  onQueryBatchJob
}) => {
  const totalItems = batchJobStatus?.totalItems ?? 0
  const completedItems = batchJobStatus?.completedItems ?? 0
  const failedItems = batchJobStatus?.failedItems ?? 0
  const pendingItems = Math.max(0, totalItems - completedItems - failedItems)
  const handledItems = completedItems + failedItems
  const progressPercent =
    totalItems > 0
      ? Math.round((handledItems / totalItems) * 100)
      : batchJobStatus?.status === 'completed'
        ? 100
        : 0
  const isBatchIdle =
    !batchJobId.trim() &&
    !(batchJobStatus?.id || '').trim() &&
    (batchJobStatus?.items || []).length === 0
  const batchLeadText = isBatchIdle
    ? '先定义 Job 类型和 Payload，再让执行塔台接管后续进度。'
    : '队列已启动，继续围绕进度塔台观察处理率、失败项和刷新节奏。'

  return (
    <section
      className={`creative-card creative-card--batch ${isBatchIdle ? 'is-idle' : 'has-items'}`}
    >
      <div className="creative-section-head">
        <div className="creative-section-copy">
          <span className="creative-section-kicker">batch engine</span>
          <h4>v4 Batch Job</h4>
        </div>
        <div className="creative-section-chip">后台执行器</div>
      </div>
      <div className="batch-job-layout">
        <div className="batch-job-compose">
          <div className="creative-stage-callout">
            <span className="creative-section-kicker">dispatch queue</span>
            <strong>Batch 先定义任务，再把执行进度交给右侧塔台。</strong>
            <span>{batchLeadText}</span>
          </div>
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
        </div>
        <aside className="batch-job-progress-panel">
          <div className="workflow-focus-card">
            <span className="creative-section-kicker">execution progress</span>
            <strong>{progressPercent}%</strong>
            <span>批处理项会在这里集中展示完成率、失败量和最近一次状态刷新时间。</span>
          </div>
          <div className="lab-mini-progress" aria-hidden="true">
            <span style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="creative-summary">
            <div>状态: {batchJobStatus?.status || FALLBACK_TEXT}</div>
            <div>
              项数:{' '}
              {batchJobStatus
                ? `${batchJobStatus.completedItems}/${batchJobStatus.totalItems}`
                : FALLBACK_TEXT}
            </div>
            <div>失败: {batchJobStatus?.failedItems ?? FALLBACK_TEXT}</div>
            <div>创建时间: {formatLocalDateTime(batchJobStatus?.createdAt)}</div>
          </div>
        </aside>
      </div>
      <div className="lab-metric-grid batch-job-summary-grid" data-testid="batch-job-summary-grid">
        <div className="lab-metric-card lab-metric-card--accent">
          <span>任务状态</span>
          <strong>{batchJobStatus?.status || 'idle'}</strong>
          <small>Job ID：{batchJobStatus?.id || batchJobId || FALLBACK_TEXT}</small>
        </div>
        <div className="lab-metric-card lab-metric-card--success">
          <span>已处理项</span>
          <strong>
            {handledItems}/{totalItems || 0}
          </strong>
          <small>
            完成 {completedItems} · 失败 {failedItems}
          </small>
        </div>
        <div className="lab-metric-card lab-metric-card--neutral">
          <span>待处理项</span>
          <strong>{pendingItems}</strong>
          <small>最近刷新：{formatLocalDateTime(batchJobStatus?.updatedAt)}</small>
        </div>
      </div>
      <div className="creative-scene-list">
        {(batchJobStatus?.items || []).map((item) => (
          <div key={item.id} className="creative-scene-item creative-scene-item--rich">
            <div className="scene-headline">
              <strong>{item.itemKey}</strong>
              <span
                className={`lab-status-badge lab-status-badge--${resolveBatchStatusTone(item.status)}`}
              >
                {item.status}
              </span>
            </div>
            <div className="scene-meta-line">
              <span>错误：{item.errorMessage || FALLBACK_TEXT}</span>
              <span>更新时间：{formatLocalDateTime(item.updatedAt)}</span>
              <span>输出字段：{Object.keys(item.output || {}).length}</span>
            </div>
          </div>
        ))}
        {batchJobStatus && (batchJobStatus.items || []).length === 0 ? (
          <div className="api-empty">暂无 Batch Job Items</div>
        ) : null}
      </div>
    </section>
  )
}

export default BatchJobSection
