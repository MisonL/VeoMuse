import React from 'react'
import {
  formatCursor,
  formatLocalTime,
  formatMentions,
  formatShortId,
  getConnectionStatusText,
  isCreateInviteDisabled,
  isLoadMoreDisabled,
  takePreviewItems
} from './collabModePanel.logic'
import OpsToolsSection from './collab/OpsToolsSection'
import PermissionMergeSection from './collab/PermissionMergeSection'
import ProjectGovernanceSection from './collab/ProjectGovernanceSection'
import StorageSnapshotsSection from './collab/StorageSnapshotsSection'
import type {
  CollabEvent,
  CollabPresence,
  ProjectGovernanceClipBatchUpdateResult,
  ProjectGovernanceComment,
  ProjectGovernanceReview,
  ProjectGovernanceTemplate,
  ProjectGovernanceTemplateApplyResult,
  V4CommentThread,
  V4ErrorBudget,
  V4PermissionGrant,
  V4ReliabilityAlert,
  V4ReliabilityAlertLevel,
  V4RollbackDrillResult,
  V4TimelineMergeResult,
  WorkspaceInvite,
  WorkspaceRole
} from '../types'

export interface CollabModePanelProps {
  isAuthenticated: boolean
  workspaceName: string
  workspaceOwner: string
  workspaceId: string
  projectId: string
  inviteRole: WorkspaceRole
  memberName: string
  collabRole: WorkspaceRole
  inviteCode: string
  invites: WorkspaceInvite[]
  isWsConnected: boolean
  presence: CollabPresence[]
  collabEvents: CollabEvent[]
  snapshots: Array<{ id: string; actorName: string; createdAt: string }>
  uploadFileName: string
  uploadToken: string
  commentThreads: V4CommentThread[]
  commentThreadCursor: string
  commentThreadLimit: string
  commentThreadHasMore: boolean
  commentAnchor: string
  commentContent: string
  commentMentions: string
  selectedThreadId: string
  commentReplyContent: string
  commentReplyMentions: string
  projectComments: ProjectGovernanceComment[]
  projectCommentCursor: string
  projectCommentLimit: string
  projectCommentHasMore: boolean
  projectCommentAnchor: string
  projectCommentContent: string
  projectCommentMentions: string
  projectSelectedCommentId: string
  projectReviews: ProjectGovernanceReview[]
  projectReviewLimit: string
  projectReviewDecision: ProjectGovernanceReview['decision']
  projectReviewSummary: string
  projectReviewScore: string
  projectTemplates: ProjectGovernanceTemplate[]
  projectSelectedTemplateId: string
  projectTemplateApplyOptions: string
  projectTemplateApplyResult: ProjectGovernanceTemplateApplyResult | null
  projectClipBatchOperations: string
  projectClipBatchResult: ProjectGovernanceClipBatchUpdateResult | null
  permissions: V4PermissionGrant[]
  permissionSubjectId: string
  permissionRole: WorkspaceRole
  timelineMergeResult: V4TimelineMergeResult | null
  errorBudget: V4ErrorBudget | null
  errorBudgetScope: string
  errorBudgetTargetSlo: string
  errorBudgetWindowDays: string
  errorBudgetWarningThresholdRatio: string
  errorBudgetAlertThresholdRatio: string
  errorBudgetFreezeDeployOnBreach: boolean
  adminToken: string
  reliabilityAlertLevel: 'all' | V4ReliabilityAlertLevel
  reliabilityAlertStatus: 'all' | V4ReliabilityAlert['status']
  reliabilityAlertLimit: string
  reliabilityAlerts: V4ReliabilityAlert[]
  rollbackPolicyId: string
  rollbackEnvironment: string
  rollbackTriggerType: string
  rollbackSummary: string
  rollbackPlan: string
  rollbackResult: string
  rollbackDrillId: string
  rollbackDrillResult: V4RollbackDrillResult | null
  isV4Busy: boolean
  isOpsBusy: boolean
  isProjectGovernanceBusy: boolean
  onWorkspaceNameChange: (value: string) => void
  onWorkspaceOwnerChange: (value: string) => void
  onCreateWorkspace: () => void
  onRefreshWorkspaceState: () => void
  onInviteRoleChange: (value: WorkspaceRole) => void
  onMemberNameChange: (value: string) => void
  onCollabRoleChange: (value: WorkspaceRole) => void
  onInviteCodeChange: (value: string) => void
  onCreateInvite: () => void
  onAcceptInvite: () => void
  onConnectWs: () => void
  onDisconnectWs: () => void
  onSendCollabEvent: (type: 'timeline.patch' | 'project.patch' | 'cursor.update') => void
  onCreateSnapshot: () => void
  onUploadFileNameChange: (value: string) => void
  onRequestUploadToken: () => void
  onRefreshCommentThreads: () => void
  onLoadMoreCommentThreads: () => void
  onCommentThreadLimitChange: (value: string) => void
  onCommentAnchorChange: (value: string) => void
  onCommentContentChange: (value: string) => void
  onCommentMentionsChange: (value: string) => void
  onSelectedThreadIdChange: (value: string) => void
  onCommentReplyContentChange: (value: string) => void
  onCommentReplyMentionsChange: (value: string) => void
  onCreateCommentThread: () => void
  onReplyCommentThread: () => void
  onResolveCommentThread: () => void
  onRefreshProjectComments: () => void
  onLoadMoreProjectComments: () => void
  onProjectCommentLimitChange: (value: string) => void
  onProjectCommentAnchorChange: (value: string) => void
  onProjectCommentContentChange: (value: string) => void
  onProjectCommentMentionsChange: (value: string) => void
  onProjectSelectedCommentIdChange: (value: string) => void
  onCreateProjectComment: () => void
  onResolveProjectComment: () => void
  onRefreshProjectReviews: () => void
  onProjectReviewLimitChange: (value: string) => void
  onProjectReviewDecisionChange: (value: ProjectGovernanceReview['decision']) => void
  onProjectReviewSummaryChange: (value: string) => void
  onProjectReviewScoreChange: (value: string) => void
  onCreateProjectReview: () => void
  onRefreshProjectTemplates: () => void
  onProjectSelectedTemplateIdChange: (value: string) => void
  onProjectTemplateApplyOptionsChange: (value: string) => void
  onApplyProjectTemplate: () => void
  onProjectClipBatchOperationsChange: (value: string) => void
  onBatchUpdateProjectClips: () => void
  onRefreshPermissions: () => void
  onPermissionSubjectIdChange: (value: string) => void
  onPermissionRoleChange: (value: WorkspaceRole) => void
  onUpdatePermission: () => void
  onMergeTimeline: () => void
  onAdminTokenChange: (value: string) => void
  onReliabilityAlertLevelChange: (value: 'all' | V4ReliabilityAlertLevel) => void
  onReliabilityAlertStatusChange: (value: 'all' | V4ReliabilityAlert['status']) => void
  onReliabilityAlertLimitChange: (value: string) => void
  onLoadReliabilityAlerts: () => void
  onAcknowledgeReliabilityAlert: (alertId: string) => void
  onLoadErrorBudget: () => void
  onErrorBudgetScopeChange: (value: string) => void
  onErrorBudgetTargetSloChange: (value: string) => void
  onErrorBudgetWindowDaysChange: (value: string) => void
  onErrorBudgetWarningThresholdRatioChange: (value: string) => void
  onErrorBudgetAlertThresholdRatioChange: (value: string) => void
  onErrorBudgetFreezeDeployOnBreachChange: (value: boolean) => void
  onRollbackPolicyIdChange: (value: string) => void
  onRollbackEnvironmentChange: (value: string) => void
  onRollbackTriggerTypeChange: (value: string) => void
  onRollbackSummaryChange: (value: string) => void
  onRollbackPlanChange: (value: string) => void
  onRollbackResultChange: (value: string) => void
  onUpdateErrorBudget: () => void
  onTriggerRollbackDrill: () => void
  onRollbackDrillIdChange: (value: string) => void
  onQueryRollbackDrill: () => void
}

const CollabModePanel: React.FC<CollabModePanelProps> = ({
  isAuthenticated,
  workspaceName,
  workspaceOwner,
  workspaceId,
  projectId,
  inviteRole,
  memberName,
  collabRole,
  inviteCode,
  invites,
  isWsConnected,
  presence,
  collabEvents,
  snapshots,
  uploadFileName,
  uploadToken,
  commentThreads,
  commentThreadCursor,
  commentThreadLimit,
  commentThreadHasMore,
  commentAnchor,
  commentContent,
  commentMentions,
  selectedThreadId,
  commentReplyContent,
  commentReplyMentions,
  projectComments,
  projectCommentCursor,
  projectCommentLimit,
  projectCommentHasMore,
  projectCommentAnchor,
  projectCommentContent,
  projectCommentMentions,
  projectSelectedCommentId,
  projectReviews,
  projectReviewLimit,
  projectReviewDecision,
  projectReviewSummary,
  projectReviewScore,
  projectTemplates,
  projectSelectedTemplateId,
  projectTemplateApplyOptions,
  projectTemplateApplyResult,
  projectClipBatchOperations,
  projectClipBatchResult,
  permissions,
  permissionSubjectId,
  permissionRole,
  timelineMergeResult,
  errorBudget,
  errorBudgetScope,
  errorBudgetTargetSlo,
  errorBudgetWindowDays,
  errorBudgetWarningThresholdRatio,
  errorBudgetAlertThresholdRatio,
  errorBudgetFreezeDeployOnBreach,
  adminToken,
  reliabilityAlertLevel,
  reliabilityAlertStatus,
  reliabilityAlertLimit,
  reliabilityAlerts,
  rollbackPolicyId,
  rollbackEnvironment,
  rollbackTriggerType,
  rollbackSummary,
  rollbackPlan,
  rollbackResult,
  rollbackDrillId,
  rollbackDrillResult,
  isV4Busy,
  isOpsBusy,
  isProjectGovernanceBusy,
  onWorkspaceNameChange,
  onWorkspaceOwnerChange,
  onCreateWorkspace,
  onRefreshWorkspaceState,
  onInviteRoleChange,
  onMemberNameChange,
  onCollabRoleChange,
  onInviteCodeChange,
  onCreateInvite,
  onAcceptInvite,
  onConnectWs,
  onDisconnectWs,
  onSendCollabEvent,
  onCreateSnapshot,
  onUploadFileNameChange,
  onRequestUploadToken,
  onRefreshCommentThreads,
  onLoadMoreCommentThreads,
  onCommentThreadLimitChange,
  onCommentAnchorChange,
  onCommentContentChange,
  onCommentMentionsChange,
  onSelectedThreadIdChange,
  onCommentReplyContentChange,
  onCommentReplyMentionsChange,
  onCreateCommentThread,
  onReplyCommentThread,
  onResolveCommentThread,
  onRefreshProjectComments,
  onLoadMoreProjectComments,
  onProjectCommentLimitChange,
  onProjectCommentAnchorChange,
  onProjectCommentContentChange,
  onProjectCommentMentionsChange,
  onProjectSelectedCommentIdChange,
  onCreateProjectComment,
  onResolveProjectComment,
  onRefreshProjectReviews,
  onProjectReviewLimitChange,
  onProjectReviewDecisionChange,
  onProjectReviewSummaryChange,
  onProjectReviewScoreChange,
  onCreateProjectReview,
  onRefreshProjectTemplates,
  onProjectSelectedTemplateIdChange,
  onProjectTemplateApplyOptionsChange,
  onApplyProjectTemplate,
  onProjectClipBatchOperationsChange,
  onBatchUpdateProjectClips,
  onRefreshPermissions,
  onPermissionSubjectIdChange,
  onPermissionRoleChange,
  onUpdatePermission,
  onMergeTimeline,
  onAdminTokenChange,
  onReliabilityAlertLevelChange,
  onReliabilityAlertStatusChange,
  onReliabilityAlertLimitChange,
  onLoadReliabilityAlerts,
  onAcknowledgeReliabilityAlert,
  onLoadErrorBudget,
  onErrorBudgetScopeChange,
  onErrorBudgetTargetSloChange,
  onErrorBudgetWindowDaysChange,
  onErrorBudgetWarningThresholdRatioChange,
  onErrorBudgetAlertThresholdRatioChange,
  onErrorBudgetFreezeDeployOnBreachChange,
  onRollbackPolicyIdChange,
  onRollbackEnvironmentChange,
  onRollbackTriggerTypeChange,
  onRollbackSummaryChange,
  onRollbackPlanChange,
  onRollbackResultChange,
  onUpdateErrorBudget,
  onTriggerRollbackDrill,
  onRollbackDrillIdChange,
  onQueryRollbackDrill
}) => {
  const [showAdvancedSections, setShowAdvancedSections] = React.useState(false)
  const [showAdvancedGovernance, setShowAdvancedGovernance] = React.useState(true)
  const [showAdvancedPermissionMerge, setShowAdvancedPermissionMerge] = React.useState(true)
  const [showAdvancedOps, setShowAdvancedOps] = React.useState(true)
  const [showAdvancedStorage, setShowAdvancedStorage] = React.useState(true)

  return (
    <div className="collab-shell" data-testid="area-collab-shell">
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
            disabled={!isAuthenticated}
            title={!isAuthenticated ? '请先登录后再创建工作区' : ''}
          >
            创建工作区
          </button>
          <button
            disabled={!workspaceId}
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

      <section className="collab-card" data-testid="area-collab-invite-card">
        <h4>邀请与加入</h4>
        <div className="lab-inline-fields">
          <label className="lab-field">
            <span>邀请角色</span>
            <select
              name="inviteRole"
              value={inviteRole}
              onChange={(event) => onInviteRoleChange(event.target.value as WorkspaceRole)}
            >
              <option value="editor">editor</option>
              <option value="viewer">viewer</option>
              <option value="owner">owner</option>
            </select>
          </label>
          <label className="lab-field">
            <span>成员名</span>
            <input
              name="memberName"
              value={memberName}
              onChange={(event) => onMemberNameChange(event.target.value)}
            />
          </label>
          <label className="lab-field">
            <span>协作角色</span>
            <select
              name="collabRole"
              value={collabRole}
              onChange={(event) => onCollabRoleChange(event.target.value as WorkspaceRole)}
            >
              <option value="editor">editor</option>
              <option value="viewer">viewer</option>
              <option value="owner">owner</option>
            </select>
          </label>
        </div>
        <div className="lab-inline-fields">
          <label className="lab-field">
            <span>邀请码</span>
            <input
              name="inviteCode"
              value={inviteCode}
              onChange={(event) => onInviteCodeChange(event.target.value)}
              data-testid="input-invite-code"
            />
          </label>
        </div>
        <div className="lab-inline-actions">
          <button
            disabled={isCreateInviteDisabled(workspaceId, collabRole)}
            onClick={onCreateInvite}
            data-testid="btn-create-invite"
          >
            生成邀请
          </button>
          <button onClick={onAcceptInvite} data-testid="btn-accept-invite">
            接受邀请
          </button>
        </div>
        <div className="collab-list">
          {takePreviewItems(invites, 6).map((item) => (
            <div key={item.id} className="collab-list-item">
              <span>{item.code}</span>
              <span>{item.role}</span>
              <span>{item.status}</span>
            </div>
          ))}
          {invites.length === 0 ? <div className="api-empty">暂无邀请记录</div> : null}
        </div>
      </section>

      <section className="collab-card">
        <h4>多人协同通道</h4>
        <div className="lab-inline-actions">
          <button
            aria-label="连接协作通道"
            disabled={isWsConnected || !workspaceId}
            onClick={onConnectWs}
          >
            连接 WS
          </button>
          <button aria-label="断开协作通道" disabled={!isWsConnected} onClick={onDisconnectWs}>
            断开 WS
          </button>
          <button
            aria-label="发送时间轴补丁"
            disabled={!isWsConnected}
            onClick={() => onSendCollabEvent('timeline.patch')}
          >
            发送 Timeline Patch
          </button>
          <button
            aria-label="发送光标更新"
            disabled={!isWsConnected}
            onClick={() => onSendCollabEvent('cursor.update')}
          >
            发送 Cursor 更新
          </button>
        </div>
        <div className="collab-meta">
          <span>连接状态：{getConnectionStatusText(isWsConnected)}</span>
          <span>在线人数：{presence.length}</span>
        </div>
        <div className="collab-split">
          <div className="collab-column">
            <h5>在线成员</h5>
            <div className="collab-list">
              {presence.map((item) => (
                <div key={`${item.workspaceId}-${item.sessionId}`} className="collab-list-item">
                  <span>{item.memberName}</span>
                  <span>{item.role}</span>
                  <span>{item.status}</span>
                </div>
              ))}
              {presence.length === 0 ? <div className="api-empty">暂无在线成员</div> : null}
            </div>
          </div>
          <div className="collab-column">
            <h5>协作事件</h5>
            <div className="collab-list">
              {takePreviewItems(collabEvents, 20).map((item) => (
                <div key={item.id} className="collab-list-item">
                  <span>{item.eventType}</span>
                  <span>{item.actorName}</span>
                  <span>{formatLocalTime(item.createdAt)}</span>
                </div>
              ))}
              {collabEvents.length === 0 ? <div className="api-empty">暂无协作事件</div> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="collab-card">
        <h4>v4 评论线程</h4>
        <div className="lab-inline-actions">
          <button disabled={!projectId || isV4Busy} onClick={onRefreshCommentThreads}>
            {isV4Busy ? '处理中...' : '刷新线程'}
          </button>
          <label className="lab-field">
            <span>limit</span>
            <input
              type="number"
              min={1}
              name="v4CommentThreadLimit"
              value={commentThreadLimit}
              onChange={(event) => onCommentThreadLimitChange(event.target.value)}
              placeholder="20"
            />
          </label>
          <button
            disabled={isLoadMoreDisabled(projectId, commentThreadHasMore, isV4Busy)}
            onClick={onLoadMoreCommentThreads}
          >
            加载更多
          </button>
        </div>
        <div className="collab-meta">
          <span>下一页游标：{formatCursor(commentThreadCursor)}</span>
        </div>
        <div className="lab-inline-fields">
          <label className="lab-field">
            <span>锚点</span>
            <input
              name="v4CommentAnchor"
              value={commentAnchor}
              onChange={(event) => onCommentAnchorChange(event.target.value)}
              placeholder="timeline:12.4s"
            />
          </label>
          <label className="lab-field">
            <span>线程内容</span>
            <input
              name="v4CommentContent"
              value={commentContent}
              onChange={(event) => onCommentContentChange(event.target.value)}
              placeholder="输入评论线程内容"
            />
          </label>
          <label className="lab-field">
            <span>mentions</span>
            <input
              name="v4CommentMentions"
              value={commentMentions}
              onChange={(event) => onCommentMentionsChange(event.target.value)}
              placeholder="alice,bob"
            />
          </label>
          <button
            className="inline-fill-btn"
            disabled={!projectId || isV4Busy}
            onClick={onCreateCommentThread}
          >
            创建线程
          </button>
        </div>
        <div className="lab-inline-fields">
          <label className="lab-field">
            <span>线程</span>
            <select
              name="v4SelectedThreadId"
              value={selectedThreadId}
              onChange={(event) => onSelectedThreadIdChange(event.target.value)}
            >
              <option value="">选择线程</option>
              {commentThreads.map((item) => (
                <option key={item.id} value={item.id}>
                  {formatShortId(item.id, 8)} · {item.status}
                </option>
              ))}
            </select>
          </label>
          <label className="lab-field">
            <span>回复</span>
            <input
              name="v4CommentReplyContent"
              value={commentReplyContent}
              onChange={(event) => onCommentReplyContentChange(event.target.value)}
              placeholder="输入回复内容"
            />
          </label>
          <label className="lab-field">
            <span>回复 mentions</span>
            <input
              name="v4CommentReplyMentions"
              value={commentReplyMentions}
              onChange={(event) => onCommentReplyMentionsChange(event.target.value)}
              placeholder="alice,bob"
            />
          </label>
        </div>
        <div className="lab-inline-actions">
          <button disabled={!selectedThreadId || isV4Busy} onClick={onReplyCommentThread}>
            回复线程
          </button>
          <button disabled={!selectedThreadId || isV4Busy} onClick={onResolveCommentThread}>
            标记 Resolve
          </button>
        </div>
        <div className="collab-list">
          {takePreviewItems(commentThreads, 12).map((item) => (
            <div key={item.id} className="collab-list-item">
              <span>{item.content}</span>
              <span>{item.status}</span>
              <span>{formatMentions(item.mentions)}</span>
              <span>{formatLocalTime(item.updatedAt)}</span>
            </div>
          ))}
          {commentThreads.length === 0 ? <div className="api-empty">暂无评论线程</div> : null}
        </div>
      </section>

      <section className="collab-card collab-card--compact">
        <h4>高级功能</h4>
        <div className="collab-meta">
          <span>项目治理 / 权限 / 运维 / 快照已收纳为高级区，按需展开。</span>
        </div>
        <div className="lab-inline-actions">
          <button
            data-testid="btn-toggle-advanced-sections"
            onClick={() => setShowAdvancedSections((prev) => !prev)}
          >
            {showAdvancedSections ? '收起高级功能' : '展开高级功能'}
          </button>
        </div>
        {showAdvancedSections ? (
          <div className="lab-inline-actions">
            <button
              type="button"
              className="collab-sub-toggle"
              data-testid="btn-toggle-advanced-governance"
              onClick={() => setShowAdvancedGovernance((prev) => !prev)}
            >
              {showAdvancedGovernance ? '隐藏项目治理' : '显示项目治理'}
            </button>
            <button
              type="button"
              className="collab-sub-toggle"
              data-testid="btn-toggle-advanced-permission-merge"
              onClick={() => setShowAdvancedPermissionMerge((prev) => !prev)}
            >
              {showAdvancedPermissionMerge ? '隐藏权限与合并' : '显示权限与合并'}
            </button>
            <button
              type="button"
              className="collab-sub-toggle"
              data-testid="btn-toggle-advanced-ops"
              onClick={() => setShowAdvancedOps((prev) => !prev)}
            >
              {showAdvancedOps ? '隐藏运维工具' : '显示运维工具'}
            </button>
            <button
              type="button"
              className="collab-sub-toggle"
              data-testid="btn-toggle-advanced-storage"
              onClick={() => setShowAdvancedStorage((prev) => !prev)}
            >
              {showAdvancedStorage ? '隐藏云存储与快照' : '显示云存储与快照'}
            </button>
          </div>
        ) : null}
      </section>

      {showAdvancedSections ? (
        <>
          {showAdvancedGovernance ? (
            <ProjectGovernanceSection
              projectId={projectId}
              isProjectGovernanceBusy={isProjectGovernanceBusy}
              projectComments={projectComments}
              projectCommentCursor={projectCommentCursor}
              projectCommentLimit={projectCommentLimit}
              projectCommentHasMore={projectCommentHasMore}
              projectCommentAnchor={projectCommentAnchor}
              projectCommentContent={projectCommentContent}
              projectCommentMentions={projectCommentMentions}
              projectSelectedCommentId={projectSelectedCommentId}
              projectReviews={projectReviews}
              projectReviewLimit={projectReviewLimit}
              projectReviewDecision={projectReviewDecision}
              projectReviewSummary={projectReviewSummary}
              projectReviewScore={projectReviewScore}
              projectTemplates={projectTemplates}
              projectSelectedTemplateId={projectSelectedTemplateId}
              projectTemplateApplyOptions={projectTemplateApplyOptions}
              projectTemplateApplyResult={projectTemplateApplyResult}
              projectClipBatchOperations={projectClipBatchOperations}
              projectClipBatchResult={projectClipBatchResult}
              onRefreshProjectComments={onRefreshProjectComments}
              onLoadMoreProjectComments={onLoadMoreProjectComments}
              onProjectCommentLimitChange={onProjectCommentLimitChange}
              onProjectCommentAnchorChange={onProjectCommentAnchorChange}
              onProjectCommentContentChange={onProjectCommentContentChange}
              onProjectCommentMentionsChange={onProjectCommentMentionsChange}
              onProjectSelectedCommentIdChange={onProjectSelectedCommentIdChange}
              onCreateProjectComment={onCreateProjectComment}
              onResolveProjectComment={onResolveProjectComment}
              onRefreshProjectReviews={onRefreshProjectReviews}
              onProjectReviewLimitChange={onProjectReviewLimitChange}
              onProjectReviewDecisionChange={onProjectReviewDecisionChange}
              onProjectReviewSummaryChange={onProjectReviewSummaryChange}
              onProjectReviewScoreChange={onProjectReviewScoreChange}
              onCreateProjectReview={onCreateProjectReview}
              onRefreshProjectTemplates={onRefreshProjectTemplates}
              onProjectSelectedTemplateIdChange={onProjectSelectedTemplateIdChange}
              onProjectTemplateApplyOptionsChange={onProjectTemplateApplyOptionsChange}
              onApplyProjectTemplate={onApplyProjectTemplate}
              onProjectClipBatchOperationsChange={onProjectClipBatchOperationsChange}
              onBatchUpdateProjectClips={onBatchUpdateProjectClips}
            />
          ) : null}

          {showAdvancedPermissionMerge ? (
            <PermissionMergeSection
              workspaceId={workspaceId}
              projectId={projectId}
              permissionSubjectId={permissionSubjectId}
              permissionRole={permissionRole}
              permissions={permissions}
              timelineMergeResult={timelineMergeResult}
              isV4Busy={isV4Busy}
              onRefreshPermissions={onRefreshPermissions}
              onPermissionSubjectIdChange={onPermissionSubjectIdChange}
              onPermissionRoleChange={onPermissionRoleChange}
              onUpdatePermission={onUpdatePermission}
              onMergeTimeline={onMergeTimeline}
            />
          ) : null}

          {showAdvancedOps ? (
            <OpsToolsSection
              adminToken={adminToken}
              reliabilityAlertLevel={reliabilityAlertLevel}
              reliabilityAlertStatus={reliabilityAlertStatus}
              reliabilityAlertLimit={reliabilityAlertLimit}
              reliabilityAlerts={reliabilityAlerts}
              errorBudget={errorBudget}
              errorBudgetScope={errorBudgetScope}
              errorBudgetTargetSlo={errorBudgetTargetSlo}
              errorBudgetWindowDays={errorBudgetWindowDays}
              errorBudgetWarningThresholdRatio={errorBudgetWarningThresholdRatio}
              errorBudgetAlertThresholdRatio={errorBudgetAlertThresholdRatio}
              errorBudgetFreezeDeployOnBreach={errorBudgetFreezeDeployOnBreach}
              rollbackPolicyId={rollbackPolicyId}
              rollbackEnvironment={rollbackEnvironment}
              rollbackTriggerType={rollbackTriggerType}
              rollbackSummary={rollbackSummary}
              rollbackPlan={rollbackPlan}
              rollbackResult={rollbackResult}
              rollbackDrillId={rollbackDrillId}
              rollbackDrillResult={rollbackDrillResult}
              isOpsBusy={isOpsBusy}
              onAdminTokenChange={onAdminTokenChange}
              onReliabilityAlertLevelChange={onReliabilityAlertLevelChange}
              onReliabilityAlertStatusChange={onReliabilityAlertStatusChange}
              onReliabilityAlertLimitChange={onReliabilityAlertLimitChange}
              onLoadReliabilityAlerts={onLoadReliabilityAlerts}
              onAcknowledgeReliabilityAlert={onAcknowledgeReliabilityAlert}
              onLoadErrorBudget={onLoadErrorBudget}
              onErrorBudgetScopeChange={onErrorBudgetScopeChange}
              onErrorBudgetTargetSloChange={onErrorBudgetTargetSloChange}
              onErrorBudgetWindowDaysChange={onErrorBudgetWindowDaysChange}
              onErrorBudgetWarningThresholdRatioChange={onErrorBudgetWarningThresholdRatioChange}
              onErrorBudgetAlertThresholdRatioChange={onErrorBudgetAlertThresholdRatioChange}
              onErrorBudgetFreezeDeployOnBreachChange={onErrorBudgetFreezeDeployOnBreachChange}
              onRollbackPolicyIdChange={onRollbackPolicyIdChange}
              onRollbackEnvironmentChange={onRollbackEnvironmentChange}
              onRollbackTriggerTypeChange={onRollbackTriggerTypeChange}
              onRollbackSummaryChange={onRollbackSummaryChange}
              onRollbackPlanChange={onRollbackPlanChange}
              onRollbackResultChange={onRollbackResultChange}
              onUpdateErrorBudget={onUpdateErrorBudget}
              onTriggerRollbackDrill={onTriggerRollbackDrill}
              onRollbackDrillIdChange={onRollbackDrillIdChange}
              onQueryRollbackDrill={onQueryRollbackDrill}
            />
          ) : null}

          {showAdvancedStorage ? (
            <StorageSnapshotsSection
              projectId={projectId}
              workspaceId={workspaceId}
              uploadFileName={uploadFileName}
              uploadToken={uploadToken}
              snapshots={snapshots}
              onCreateSnapshot={onCreateSnapshot}
              onRefreshWorkspaceState={onRefreshWorkspaceState}
              onUploadFileNameChange={onUploadFileNameChange}
              onRequestUploadToken={onRequestUploadToken}
            />
          ) : null}
        </>
      ) : null}
    </div>
  )
}

export default CollabModePanel
