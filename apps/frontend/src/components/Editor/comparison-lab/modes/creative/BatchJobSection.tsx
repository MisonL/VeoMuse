import React from 'react'
import type { V4BatchJob } from '../../types'

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
  return (
    <section className="creative-card creative-card--batch">
      <div className="creative-section-head">
        <div className="creative-section-copy">
          <span className="creative-section-kicker">batch engine</span>
          <h4>v4 Batch Job</h4>
        </div>
        <div className="creative-section-chip">后台执行器</div>
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
  )
}

export default BatchJobSection
