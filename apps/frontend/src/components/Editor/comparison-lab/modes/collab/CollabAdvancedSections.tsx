import React from 'react'
import OpsToolsSection, { type OpsToolsSectionProps } from './OpsToolsSection'
import PermissionMergeSection, { type PermissionMergeSectionProps } from './PermissionMergeSection'
import ProjectGovernanceSection, {
  type ProjectGovernanceSectionProps
} from './ProjectGovernanceSection'
import StorageSnapshotsSection, {
  type StorageSnapshotsSectionProps
} from './StorageSnapshotsSection'
import { useCollabAdvancedSections } from './useCollabAdvancedSections'

const trimText = (value: string | null | undefined) => String(value || '').trim()

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
  const openProjectComments = projectGovernanceProps.projectComments.filter(
    (item) => item.status === 'open'
  ).length
  const changeRequestedReviews = projectGovernanceProps.projectReviews.filter(
    (item) => item.decision === 'changes_requested'
  ).length
  const openReliabilityAlerts = opsToolsProps.reliabilityAlerts.filter(
    (item) => item.status === 'open'
  ).length
  const criticalReliabilityAlerts = opsToolsProps.reliabilityAlerts.filter(
    (item) => item.status === 'open' && item.level === 'critical'
  ).length
  const mergeConflictCount = permissionMergeProps.timelineMergeResult?.conflicts.length ?? 0
  const latestMergeStatus = permissionMergeProps.timelineMergeResult?.status || '待执行'
  const snapshotCount = storageSnapshotsProps.snapshots.length
  const hasUploadToken = trimText(storageSnapshotsProps.uploadToken).length > 0
  const hasAdminToken = trimText(opsToolsProps.adminToken).length > 0
  const governanceTone =
    openProjectComments > 0 || changeRequestedReviews > 0
      ? changeRequestedReviews > 0
        ? 'warning'
        : 'accent'
      : 'success'
  const alertTone =
    !hasAdminToken
      ? 'warning'
      : openReliabilityAlerts > 0
        ? criticalReliabilityAlerts > 0
          ? 'critical'
          : 'warning'
        : 'success'
  const mergeTone = mergeConflictCount > 0 ? 'critical' : latestMergeStatus === 'merged' ? 'success' : 'neutral'
  const storageTone = snapshotCount > 0 ? 'accent' : hasUploadToken ? 'success' : 'neutral'
  const calloutTone =
    criticalReliabilityAlerts > 0
      ? 'critical'
      : mergeConflictCount > 0
        ? 'warning'
        : openProjectComments > 0
          ? 'accent'
          : 'success'
  const watchboardMessage =
    criticalReliabilityAlerts > 0
      ? `当前有 ${criticalReliabilityAlerts} 条 critical 告警待处理，建议优先检查错误预算和回滚演练。`
      : mergeConflictCount > 0
        ? `Timeline Merge 检测到 ${mergeConflictCount} 个冲突，建议先处理权限与修订差异。`
        : openProjectComments > 0
          ? `项目治理还有 ${openProjectComments} 条开放评论，适合在值班视图中快速消化。`
          : '高级治理层目前无高优先级阻塞，可按需展开专项卡片。'

  return (
    <>
      <section className="collab-card collab-card--compact collab-card--advanced-control">
        <h4>高级功能</h4>
        <div className="collab-meta">
          <span>项目治理 / 权限 / 运维 / 快照已收纳为高级区，按需展开。</span>
        </div>
        <div
          className="lab-metric-grid collab-advanced-watchboard"
          data-testid="collab-advanced-watchboard"
        >
          <div className={`lab-metric-card lab-metric-card--${governanceTone}`}>
            <span>治理待办</span>
            <strong>{openProjectComments}</strong>
            <small>变更请求 {changeRequestedReviews} 条</small>
          </div>
          <div className={`lab-metric-card lab-metric-card--${alertTone}`}>
            <span>值班告警</span>
            <strong>{openReliabilityAlerts}</strong>
            <small>
              critical {criticalReliabilityAlerts} 条 · 令牌 {hasAdminToken ? '已就绪' : '缺失'}
            </small>
          </div>
          <div className={`lab-metric-card lab-metric-card--${mergeTone}`}>
            <span>合并压力</span>
            <strong>{mergeConflictCount}</strong>
            <small>最近 Merge：{latestMergeStatus}</small>
          </div>
          <div className={`lab-metric-card lab-metric-card--${storageTone}`}>
            <span>快照归档</span>
            <strong>{snapshotCount}</strong>
            <small>上传令牌：{hasUploadToken ? '已生成' : '未生成'}</small>
          </div>
        </div>
        <div className={`collab-watch-callout collab-watch-callout--${calloutTone}`}>
          <strong>值班提醒</strong>
          <span>{watchboardMessage}</span>
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
                <span className="collab-advanced-group-copy">
                  评论、评审、模板与批量更新在这里收束为项目级治理闭环。
                </span>
              </div>
              <ProjectGovernanceSection {...projectGovernanceProps} />
            </div>
          ) : null}

          {showAdvancedOps ? (
            <div className="collab-advanced-group collab-advanced-group--reliability">
              <div className="collab-advanced-group-head">
                <span className="collab-advanced-group-kicker">reliability deck</span>
                <strong>告警、错误预算与回滚演练</strong>
                <span className="collab-advanced-group-copy">
                  面向值班和发布守门的运维态势都集中在这一列。
                </span>
              </div>
              <OpsToolsSection {...opsToolsProps} />
            </div>
          ) : null}

          {showAdvancedPermissionMerge || showAdvancedStorage ? (
            <div className="collab-advanced-group collab-advanced-group--storage">
              <div className="collab-advanced-group-head">
                <span className="collab-advanced-group-kicker">access and archive</span>
                <strong>权限、合并与云存储</strong>
                <span className="collab-advanced-group-copy">
                  处理权限配置、合并结果和快照归档的跨域收口。
                </span>
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
