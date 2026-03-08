import React from 'react'

export interface WorkspaceSectionProps {
  isAuthenticated: boolean
  isWorkspaceCreating: boolean
  workspaceName: string
  workspaceOwner: string
  workspaceId: string
  projectId: string
  onWorkspaceNameChange: (value: string) => void
  onWorkspaceOwnerChange: (value: string) => void
  onCreateWorkspace: () => void
  onRefreshWorkspaceState: () => void
}

const WorkspaceSection: React.FC<WorkspaceSectionProps> = ({
  isAuthenticated,
  isWorkspaceCreating,
  workspaceName,
  workspaceOwner,
  workspaceId,
  projectId,
  onWorkspaceNameChange,
  onWorkspaceOwnerChange,
  onCreateWorkspace,
  onRefreshWorkspaceState
}) => {
  return (
    <section className="collab-card" data-testid="area-collab-workspace-card">
      <h4>团队空间</h4>
      <div className="lab-inline-fields">
        <label className="lab-field">
          <span>空间名</span>
          <input
            name="workspaceName"
            value={workspaceName}
            onChange={(event) => onWorkspaceNameChange(event.target.value)}
            data-testid="input-workspace-name"
          />
        </label>
        <label className="lab-field">
          <span>Owner</span>
          <input
            name="workspaceOwner"
            value={workspaceOwner}
            onChange={(event) => onWorkspaceOwnerChange(event.target.value)}
            data-testid="input-workspace-owner"
          />
        </label>
      </div>
      <div className="lab-inline-actions">
        <button
          onClick={onCreateWorkspace}
          data-testid="btn-create-workspace"
          disabled={!isAuthenticated || isWorkspaceCreating}
          title={
            !isAuthenticated
              ? '请先登录后再创建工作区'
              : isWorkspaceCreating
                ? '工作区创建中，请勿重复提交'
                : ''
          }
          aria-busy={isWorkspaceCreating}
        >
          {isWorkspaceCreating ? '创建中...' : '创建工作区'}
        </button>
        <button
          disabled={!workspaceId || isWorkspaceCreating}
          onClick={onRefreshWorkspaceState}
          data-testid="btn-refresh-workspace-state"
        >
          刷新状态
        </button>
      </div>
      <div className="collab-meta">
        <span data-testid="text-workspace-id">workspace: {workspaceId || '-'}</span>
        <span>project: {projectId || '-'}</span>
      </div>
    </section>
  )
}

export default WorkspaceSection
