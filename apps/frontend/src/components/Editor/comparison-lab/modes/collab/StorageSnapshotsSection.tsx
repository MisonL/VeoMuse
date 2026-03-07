import React from 'react'
import { formatLocalDateTime, formatShortId } from '../collabModePanel.logic'

const FALLBACK_TEXT = '-'

export interface StorageSnapshotItem {
  id: string
  actorName: string
  createdAt: string
}

export interface StorageSnapshotsSectionProps {
  projectId: string
  workspaceId: string
  uploadFileName: string
  uploadToken: string
  snapshots: StorageSnapshotItem[]
  onCreateSnapshot: () => void
  onRefreshWorkspaceState: () => void
  onUploadFileNameChange: (value: string) => void
  onRequestUploadToken: () => void
}

const StorageSnapshotsSection: React.FC<StorageSnapshotsSectionProps> = ({
  projectId,
  workspaceId,
  uploadFileName,
  uploadToken,
  snapshots,
  onCreateSnapshot,
  onRefreshWorkspaceState,
  onUploadFileNameChange,
  onRequestUploadToken
}) => {
  const latestSnapshot = snapshots[0] || null
  const hasUploadToken = uploadToken.trim().length > 0
  const snapshotTone = latestSnapshot ? 'accent' : 'neutral'
  const uploadTone = hasUploadToken ? 'success' : 'neutral'
  const watchTone = latestSnapshot ? 'success' : hasUploadToken ? 'accent' : 'neutral'

  return (
    <section className="collab-card">
      <h4>云存储与快照</h4>
      <div
        className="lab-metric-grid storage-snapshot-summary-grid"
        data-testid="storage-snapshot-watchboard"
      >
        <div className={`lab-metric-card lab-metric-card--${snapshotTone}`}>
          <span>项目快照</span>
          <strong>{snapshots.length}</strong>
          <small>最近快照：{formatLocalDateTime(latestSnapshot?.createdAt)}</small>
        </div>
        <div className={`lab-metric-card lab-metric-card--${uploadTone}`}>
          <span>上传令牌</span>
          <strong>{hasUploadToken ? 'ready' : 'pending'}</strong>
          <small>文件名：{uploadFileName || FALLBACK_TEXT}</small>
        </div>
      </div>
      <div className={`collab-watch-spotlight collab-watch-spotlight--${watchTone}`}>
        <div className="collab-watch-spotlight-copy">
          <span className="collab-advanced-group-kicker">archive watch</span>
          <strong>{latestSnapshot ? latestSnapshot.actorName : '等待首次快照'}</strong>
          <span>
            {latestSnapshot
              ? `最近快照创建于 ${formatLocalDateTime(latestSnapshot.createdAt)}。`
              : '创建快照或生成上传令牌后，可在这里快速确认归档准备状态。'}
          </span>
        </div>
        <div className="collab-watch-inline collab-watch-inline--readout">
          <div>
            <b>Workspace</b>
            <span>{workspaceId || FALLBACK_TEXT}</span>
          </div>
          <div>
            <b>Project</b>
            <span>{projectId || FALLBACK_TEXT}</span>
          </div>
          <div>
            <b>令牌状态</b>
            <span>{hasUploadToken ? '已生成' : '未生成'}</span>
          </div>
        </div>
      </div>
      <div className="lab-inline-actions">
        <button disabled={!projectId} onClick={onCreateSnapshot}>
          创建快照
        </button>
        <button disabled={!workspaceId} onClick={onRefreshWorkspaceState}>
          刷新列表
        </button>
      </div>
      <div className="lab-inline-fields">
        <label className="lab-field">
          <span>文件名</span>
          <input
            name="uploadFileName"
            value={uploadFileName}
            onChange={(event) => onUploadFileNameChange(event.target.value)}
          />
        </label>
        <button className="inline-fill-btn" onClick={onRequestUploadToken}>
          生成上传令牌
        </button>
      </div>
      <div className="collab-meta">
        <span>令牌对象：{uploadToken || '-'}</span>
      </div>
      <div className="collab-list">
        {snapshots.map((item) => (
          <div key={item.id} className="collab-list-item collab-list-item--rich">
            <div className="collab-list-item-head">
              <strong>{formatShortId(item.id, 12)}</strong>
              <span className="lab-status-badge lab-status-badge--neutral">snapshot</span>
            </div>
            <div className="collab-list-meta">
              <span>操作者：{item.actorName || FALLBACK_TEXT}</span>
              <span>时间：{formatLocalDateTime(item.createdAt)}</span>
            </div>
          </div>
        ))}
        {snapshots.length === 0 ? <div className="api-empty">暂无项目快照</div> : null}
      </div>
    </section>
  )
}

export default StorageSnapshotsSection
