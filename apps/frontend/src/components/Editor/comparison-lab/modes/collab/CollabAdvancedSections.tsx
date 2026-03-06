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
      <section className="collab-card collab-card--compact">
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
        <>
          {showAdvancedGovernance ? (
            <ProjectGovernanceSection {...projectGovernanceProps} />
          ) : null}
          {showAdvancedPermissionMerge ? (
            <PermissionMergeSection {...permissionMergeProps} />
          ) : null}
          {showAdvancedOps ? <OpsToolsSection {...opsToolsProps} /> : null}
          {showAdvancedStorage ? (
            <StorageSnapshotsSection {...storageSnapshotsProps} />
          ) : null}
        </>
      ) : null}
    </>
  )
}

export default CollabAdvancedSections
