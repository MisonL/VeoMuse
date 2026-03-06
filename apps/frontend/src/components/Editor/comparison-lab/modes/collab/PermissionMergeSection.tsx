import React from 'react'
import { isPermissionUpdateDisabled, takePreviewItems } from '../collabModePanel.logic'
import type { V4PermissionGrant, V4TimelineMergeResult, WorkspaceRole } from '../../types'

export interface PermissionMergeSectionProps {
  workspaceId: string
  projectId: string
  permissionSubjectId: string
  permissionRole: WorkspaceRole
  permissions: V4PermissionGrant[]
  timelineMergeResult: V4TimelineMergeResult | null
  isV4Busy: boolean
  onRefreshPermissions: () => void
  onPermissionSubjectIdChange: (value: string) => void
  onPermissionRoleChange: (value: WorkspaceRole) => void
  onUpdatePermission: () => void
  onMergeTimeline: () => void
}

const PermissionMergeSection: React.FC<PermissionMergeSectionProps> = ({
  workspaceId,
  projectId,
  permissionSubjectId,
  permissionRole,
  permissions,
  timelineMergeResult,
  isV4Busy,
  onRefreshPermissions,
  onPermissionSubjectIdChange,
  onPermissionRoleChange,
  onUpdatePermission,
  onMergeTimeline
}) => {
  return (
    <section className="collab-card">
      <h4>v4 权限与 Timeline Merge</h4>
      <div className="lab-inline-actions">
        <button disabled={!workspaceId || isV4Busy} onClick={onRefreshPermissions}>
          刷新权限
        </button>
      </div>
      <div className="lab-inline-fields">
        <label className="lab-field">
          <span>权限键</span>
          <input
            name="v4PermissionSubjectId"
            value={permissionSubjectId}
            onChange={(event) => onPermissionSubjectIdChange(event.target.value)}
            placeholder="timeline.merge=true"
          />
        </label>
        <label className="lab-field">
          <span>角色</span>
          <select
            name="v4PermissionRole"
            value={permissionRole}
            onChange={(event) => onPermissionRoleChange(event.target.value as WorkspaceRole)}
          >
            <option value="viewer">viewer</option>
            <option value="editor">editor</option>
            <option value="owner">owner</option>
          </select>
        </label>
      </div>
      <div className="lab-inline-actions">
        <button
          disabled={isPermissionUpdateDisabled(workspaceId, permissionSubjectId, isV4Busy)}
          onClick={onUpdatePermission}
        >
          更新权限
        </button>
        <button disabled={!projectId || isV4Busy} onClick={onMergeTimeline}>
          调用 Timeline Merge
        </button>
      </div>
      <div className="collab-meta">
        <span>Merge 结果：{timelineMergeResult?.status || '-'}</span>
        <span>Merge ID：{timelineMergeResult?.id || '-'}</span>
        <span>冲突数：{timelineMergeResult ? timelineMergeResult.conflicts.length : '-'}</span>
      </div>
      <div className="collab-list">
        {takePreviewItems(permissions, 12).map((item) => (
          <div key={`${item.workspaceId}-${item.role}`} className="collab-list-item">
            <span>{item.role}</span>
            <span>{Object.keys(item.permissions || {}).length} 项权限</span>
            <span>{item.updatedBy}</span>
          </div>
        ))}
        {permissions.length === 0 ? <div className="api-empty">暂无权限记录</div> : null}
      </div>
    </section>
  )
}

export default PermissionMergeSection
