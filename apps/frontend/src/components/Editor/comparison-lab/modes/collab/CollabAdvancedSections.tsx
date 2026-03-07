import React from 'react'
import OpsToolsSection, { type OpsToolsSectionProps } from './OpsToolsSection'
import PermissionMergeSection, {
  type PermissionMergeSectionProps
} from './PermissionMergeSection'
import ProjectGovernanceSection, {
  type ProjectGovernanceSectionProps
} from './ProjectGovernanceSection'
import StorageSnapshotsSection, {
  type StorageSnapshotsSectionProps
} from './StorageSnapshotsSection'
import { useCollabAdvancedSections } from './useCollabAdvancedSections'

export interface CollabAdvancedSectionsProps {
  projectGovernanceProps: ProjectGovernanceSectionProps
  permissionMergeProps: PermissionMergeSectionProps
  opsToolsProps: OpsToolsSectionProps
  storageSnapshotsProps: StorageSnapshotsSectionProps
}

const CollabAdvancedSections: React.FC<CollabAdvancedSectionsProps> = ({
  projectGovernanceProps,
  permissionMergeProps,
  opsToolsProps,
  storageSnapshotsProps
}) => {
  const {
    showAdvancedSections,
    showAdvancedGovernance,
    showAdvancedPermissionMerge,
    showAdvancedOps,
    showAdvancedStorage,
    toggleAdvancedSections,
    toggleAdvancedGovernance,
    toggleAdvancedPermissionMerge,
    toggleAdvancedOps,
    toggleAdvancedStorage
  } = useCollabAdvancedSections()

  return (
    <>
      <section className="collab-card collab-card--compact collab-card--advanced-control">
        <h4>高级功能</h4>
        <div className="collab-meta">
          <span>项目治理 / 权限 / 运维 / 快照已收纳为高级区，按需展开。</span>
        </div>
        <div className="lab-inline-actions">
          <button data-testid="btn-toggle-advanced-sections" onClick={toggleAdvancedSections}>
            {showAdvancedSections ? '收起高级功能' : '展开高级功能'}
          </button>
        </div>
        {showAdvancedSections ? (
          <div className="lab-inline-actions">
            <button
              type="button"
              className="collab-sub-toggle"
              data-testid="btn-toggle-advanced-governance"
              onClick={toggleAdvancedGovernance}
            >
              {showAdvancedGovernance ? '隐藏项目治理' : '显示项目治理'}
            </button>
            <button
              type="button"
              className="collab-sub-toggle"
              data-testid="btn-toggle-advanced-permission-merge"
              onClick={toggleAdvancedPermissionMerge}
            >
              {showAdvancedPermissionMerge ? '隐藏权限与合并' : '显示权限与合并'}
            </button>
            <button
              type="button"
              className="collab-sub-toggle"
              data-testid="btn-toggle-advanced-ops"
              onClick={toggleAdvancedOps}
            >
              {showAdvancedOps ? '隐藏运维工具' : '显示运维工具'}
            </button>
            <button
              type="button"
              className="collab-sub-toggle"
              data-testid="btn-toggle-advanced-storage"
              onClick={toggleAdvancedStorage}
            >
              {showAdvancedStorage ? '隐藏云存储与快照' : '显示云存储与快照'}
            </button>
          </div>
        ) : null}
      </section>

      {showAdvancedSections ? (
        <div className="collab-advanced-grid">
          {showAdvancedGovernance ? (
            <div className="collab-advanced-group collab-advanced-group--governance">
              <div className="collab-advanced-group-head">
                <span className="collab-advanced-group-kicker">governance deck</span>
                <strong>项目治理</strong>
              </div>
              <ProjectGovernanceSection {...projectGovernanceProps} />
            </div>
          ) : null}

          {showAdvancedOps ? (
            <div className="collab-advanced-group collab-advanced-group--reliability">
              <div className="collab-advanced-group-head">
                <span className="collab-advanced-group-kicker">reliability deck</span>
                <strong>告警、错误预算与回滚演练</strong>
              </div>
              <OpsToolsSection {...opsToolsProps} />
            </div>
          ) : null}

          {showAdvancedPermissionMerge || showAdvancedStorage ? (
            <div className="collab-advanced-group collab-advanced-group--storage">
              <div className="collab-advanced-group-head">
                <span className="collab-advanced-group-kicker">access and archive</span>
                <strong>权限、合并与云存储</strong>
              </div>
              <div className="collab-advanced-stack">
                {showAdvancedPermissionMerge ? (
                  <PermissionMergeSection {...permissionMergeProps} />
                ) : null}
                {showAdvancedStorage ? (
                  <StorageSnapshotsSection {...storageSnapshotsProps} />
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

export default CollabAdvancedSections
