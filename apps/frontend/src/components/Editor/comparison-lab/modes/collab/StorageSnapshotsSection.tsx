import React from 'react'
import { formatLocalDateTime, formatShortId } from '../collabModePanel.logic'

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
  return (
    <section className="collab-card">
      <h4>云存储与快照</h4>
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
          <div key={item.id} className="collab-list-item">
            <span>{formatShortId(item.id, 12)}</span>
            <span>{item.actorName}</span>
            <span>{formatLocalDateTime(item.createdAt)}</span>
          </div>
        ))}
        {snapshots.length === 0 ? <div className="api-empty">暂无项目快照</div> : null}
      </div>
    </section>
  )
}

export default StorageSnapshotsSection
