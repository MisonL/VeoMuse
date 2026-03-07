import React from 'react'
import { isPermissionUpdateDisabled, takePreviewItems } from '../collabModePanel.logic'
import type { V4PermissionGrant, V4TimelineMergeResult, WorkspaceRole } from '../../types'

const FALLBACK_TEXT = '-'

const resolveMergeTone = (status: string | null | undefined) => {
  if (status === 'merged') return 'success'
  if (status === 'conflict') return 'critical'
  return 'neutral'
}

const summarizeConflict = (value: Record<string, unknown>) => {
  const entries = Object.entries(value || {})
  if (entries.length === 0) return '未返回冲突详情'
  return entries
    .slice(0, 3)
    .map(([key, conflictValue]) => `${key}:${String(conflictValue)}`)
    .join(' · ')
}

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
  const mergeConflictCount = timelineMergeResult?.conflicts.length ?? 0
  const enabledPermissionCount = permissions.reduce((sum, item) => {
    return sum + Object.values(item.permissions || {}).filter(Boolean).length
  }, 0)

  return (
    <section className="collab-card">
      <h4>v4 权限与 Timeline Merge</h4>
      <div
        className="lab-metric-grid permission-merge-summary-grid"
        data-testid="permission-merge-watchboard"
      >
        <div className="lab-metric-card lab-metric-card--accent">
          <span>权限记录</span>
          <strong>{permissions.length}</strong>
          <small>启用权限 {enabledPermissionCount} 项</small>
        </div>
        <div
          className={`lab-metric-card lab-metric-card--${resolveMergeTone(timelineMergeResult?.status)}`}
        >
          <span>Merge 结果</span>
          <strong>{timelineMergeResult?.status || '待执行'}</strong>
          <small>冲突 {mergeConflictCount} 项</small>
        </div>
        <div className="lab-metric-card lab-metric-card--neutral">
          <span>当前角色</span>
          <strong>{permissionRole}</strong>
          <small>权限键：{permissionSubjectId || FALLBACK_TEXT}</small>
        </div>
      </div>
      <div className="collab-watch-spotlight">
        <div className="collab-watch-spotlight-copy">
          <span className="collab-advanced-group-kicker">merge watch</span>
          <strong>
            {mergeConflictCount > 0 ? `${mergeConflictCount} 个冲突待处理` : '当前无冲突阻塞'}
          </strong>
          <span>
            {timelineMergeResult
              ? `源修订 ${timelineMergeResult.sourceRevision} → 目标修订 ${timelineMergeResult.targetRevision}`
              : '权限更新和 Timeline Merge 的最新结果会在这里汇总展示。'}
          </span>
        </div>
        <div className="collab-watch-inline">
          <div>
            <b>Workspace</b>
            <span>{workspaceId || FALLBACK_TEXT}</span>
          </div>
          <div>
            <b>Project</b>
            <span>{projectId || FALLBACK_TEXT}</span>
          </div>
          <div>
            <b>Merge ID</b>
            <span>{timelineMergeResult?.id || FALLBACK_TEXT}</span>
          </div>
        </div>
      </div>
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
      {timelineMergeResult && mergeConflictCount > 0 ? (
        <div className="collab-conflict-list">
          {timelineMergeResult.conflicts.slice(0, 3).map((conflict, index) => (
            <div key={`${timelineMergeResult.id}-${index}`} className="collab-conflict-item">
              <strong>冲突 {index + 1}</strong>
              <span>{summarizeConflict(conflict)}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="collab-list">
        {takePreviewItems(permissions, 12).map((item) => (
          <div
            key={`${item.workspaceId}-${item.role}`}
            className="collab-list-item collab-list-item--rich"
          >
            <div className="collab-list-item-head">
              <strong>{item.role}</strong>
              <span className="lab-status-badge lab-status-badge--neutral">
                {Object.keys(item.permissions || {}).length} 项权限
              </span>
            </div>
            <div className="collab-list-meta">
              <span>启用：{Object.values(item.permissions || {}).filter(Boolean).length}</span>
              <span>更新人：{item.updatedBy || FALLBACK_TEXT}</span>
            </div>
          </div>
        ))}
        {permissions.length === 0 ? <div className="api-empty">暂无权限记录</div> : null}
      </div>
    </section>
  )
}

export default PermissionMergeSection
