import React from 'react'
import {
  formatCursor,
  formatLocalDateTime,
  formatLocalTime,
  formatMentions,
  formatRatioPercent,
  formatShortId,
  getAckLabel,
  getBusyStatusText,
  getConnectionStatusText,
  isAlertAckDisabled,
  isCreateInviteDisabled,
  isLoadMoreDisabled,
  isPermissionUpdateDisabled,
  isProjectActionDisabled,
  takePreviewItems
} from './collabModePanel.logic'
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

interface CollabModePanelProps {
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
  const hasAdminToken = adminToken.trim().length > 0

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
            <section className="collab-card" data-testid="area-project-governance-card">
              <h4>项目治理闭环</h4>
              <div className="collab-meta">
                <span>项目 ID：{projectId || '-'}</span>
                <span>状态：{getBusyStatusText(isProjectGovernanceBusy)}</span>
              </div>

              <div className="lab-inline-actions">
                <button
                  disabled={isProjectActionDisabled(projectId, isProjectGovernanceBusy)}
                  onClick={onRefreshProjectComments}
                >
                  刷新评论
                </button>
                <label className="lab-field">
                  <span>评论 limit</span>
                  <input
                    type="number"
                    min={1}
                    name="projectCommentLimit"
                    value={projectCommentLimit}
                    onChange={(event) => onProjectCommentLimitChange(event.target.value)}
                    placeholder="20"
                  />
                </label>
                <button
                  disabled={isLoadMoreDisabled(
                    projectId,
                    projectCommentHasMore,
                    isProjectGovernanceBusy
                  )}
                  onClick={onLoadMoreProjectComments}
                >
                  加载更多评论
                </button>
              </div>
              <div className="collab-meta">
                <span>评论下一页游标：{formatCursor(projectCommentCursor)}</span>
              </div>
              <div className="lab-inline-fields">
                <label className="lab-field">
                  <span>评论锚点</span>
                  <input
                    name="projectCommentAnchor"
                    value={projectCommentAnchor}
                    onChange={(event) => onProjectCommentAnchorChange(event.target.value)}
                    placeholder="timeline:track-v1:clip-1"
                  />
                </label>
                <label className="lab-field">
                  <span>评论内容</span>
                  <input
                    name="projectCommentContent"
                    value={projectCommentContent}
                    onChange={(event) => onProjectCommentContentChange(event.target.value)}
                    placeholder="输入项目评论内容"
                  />
                </label>
                <label className="lab-field">
                  <span>评论 mentions</span>
                  <input
                    name="projectCommentMentions"
                    value={projectCommentMentions}
                    onChange={(event) => onProjectCommentMentionsChange(event.target.value)}
                    placeholder="owner,editor"
                  />
                </label>
                <button
                  className="inline-fill-btn"
                  disabled={isProjectActionDisabled(projectId, isProjectGovernanceBusy)}
                  onClick={onCreateProjectComment}
                >
                  新建评论
                </button>
              </div>
              <div className="lab-inline-fields">
                <label className="lab-field">
                  <span>待 Resolve 评论</span>
                  <select
                    name="projectSelectedCommentId"
                    value={projectSelectedCommentId}
                    onChange={(event) => onProjectSelectedCommentIdChange(event.target.value)}
                  >
                    <option value="">选择评论</option>
                    {projectComments.map((item) => (
                      <option key={item.id} value={item.id}>
                        {formatShortId(item.id, 8)} · {item.status}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  disabled={!projectSelectedCommentId || isProjectGovernanceBusy}
                  onClick={onResolveProjectComment}
                >
                  标记评论已解决
                </button>
              </div>
              <div className="collab-list">
                {takePreviewItems(projectComments, 12).map((item) => (
                  <div key={item.id} className="collab-list-item">
                    <span>{item.content}</span>
                    <span>{item.status}</span>
                    <span>{formatMentions(item.mentions)}</span>
                    <span>{formatLocalTime(item.updatedAt)}</span>
                  </div>
                ))}
                {projectComments.length === 0 ? (
                  <div className="api-empty">暂无项目评论</div>
                ) : null}
              </div>

              <div className="lab-inline-actions">
                <button
                  disabled={isProjectActionDisabled(projectId, isProjectGovernanceBusy)}
                  onClick={onRefreshProjectReviews}
                >
                  刷新评审
                </button>
                <label className="lab-field">
                  <span>评审 limit</span>
                  <input
                    type="number"
                    min={1}
                    name="projectReviewLimit"
                    value={projectReviewLimit}
                    onChange={(event) => onProjectReviewLimitChange(event.target.value)}
                    placeholder="20"
                  />
                </label>
              </div>
              <div className="lab-inline-fields">
                <label className="lab-field">
                  <span>评审决策</span>
                  <select
                    name="projectReviewDecision"
                    value={projectReviewDecision}
                    onChange={(event) =>
                      onProjectReviewDecisionChange(
                        event.target.value as ProjectGovernanceReview['decision']
                      )
                    }
                  >
                    <option value="approved">approved</option>
                    <option value="changes_requested">changes_requested</option>
                  </select>
                </label>
                <label className="lab-field">
                  <span>评审摘要</span>
                  <input
                    name="projectReviewSummary"
                    value={projectReviewSummary}
                    onChange={(event) => onProjectReviewSummaryChange(event.target.value)}
                    placeholder="输入评审结论"
                  />
                </label>
                <label className="lab-field">
                  <span>评分（可选）</span>
                  <input
                    name="projectReviewScore"
                    value={projectReviewScore}
                    onChange={(event) => onProjectReviewScoreChange(event.target.value)}
                    placeholder="8.5"
                  />
                </label>
                <button
                  className="inline-fill-btn"
                  disabled={isProjectActionDisabled(projectId, isProjectGovernanceBusy)}
                  onClick={onCreateProjectReview}
                >
                  新建评审
                </button>
              </div>
              <div className="collab-list">
                {takePreviewItems(projectReviews, 12).map((item) => (
                  <div key={item.id} className="collab-list-item">
                    <span>{item.decision}</span>
                    <span>{item.summary}</span>
                    <span>{item.score ?? '-'}</span>
                    <span>{formatLocalTime(item.createdAt)}</span>
                  </div>
                ))}
                {projectReviews.length === 0 ? <div className="api-empty">暂无项目评审</div> : null}
              </div>

              <div className="lab-inline-actions">
                <button
                  disabled={isProjectActionDisabled(projectId, isProjectGovernanceBusy)}
                  onClick={onRefreshProjectTemplates}
                >
                  刷新模板
                </button>
                <label className="lab-field">
                  <span>模板</span>
                  <select
                    name="projectSelectedTemplateId"
                    value={projectSelectedTemplateId}
                    onChange={(event) => onProjectSelectedTemplateIdChange(event.target.value)}
                  >
                    <option value="">选择模板</option>
                    {projectTemplates.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  disabled={!projectSelectedTemplateId || isProjectGovernanceBusy}
                  onClick={onApplyProjectTemplate}
                >
                  应用模板
                </button>
              </div>
              <label className="lab-field">
                <span>模板应用参数（JSON）</span>
                <textarea
                  name="projectTemplateApplyOptions"
                  value={projectTemplateApplyOptions}
                  onChange={(event) => onProjectTemplateApplyOptionsChange(event.target.value)}
                  placeholder='{"targetTrack":"track-v1","blendMode":"replace"}'
                />
              </label>
              <div className="collab-meta">
                <span>模板回执 Trace：{projectTemplateApplyResult?.traceId || '-'}</span>
                <span>模板名称：{projectTemplateApplyResult?.templateName || '-'}</span>
              </div>
              <div className="collab-list">
                {takePreviewItems(projectTemplates, 10).map((item) => (
                  <div key={item.id} className="collab-list-item">
                    <span>{item.name}</span>
                    <span>{item.description}</span>
                    <span>{item.createdBy}</span>
                    <span>{formatLocalTime(item.updatedAt)}</span>
                  </div>
                ))}
                {projectTemplates.length === 0 ? (
                  <div className="api-empty">暂无项目模板</div>
                ) : null}
              </div>

              <label className="lab-field">
                <span>片段批量更新 operations（JSON 数组）</span>
                <textarea
                  name="projectClipBatchOperations"
                  value={projectClipBatchOperations}
                  onChange={(event) => onProjectClipBatchOperationsChange(event.target.value)}
                  placeholder='[{"clipId":"clip-a","patch":{"start":0,"end":3}}]'
                />
              </label>
              <div className="lab-inline-actions">
                <button
                  disabled={isProjectActionDisabled(projectId, isProjectGovernanceBusy)}
                  onClick={onBatchUpdateProjectClips}
                >
                  提交片段批量更新
                </button>
              </div>
              <div className="collab-meta">
                <span>requested：{projectClipBatchResult?.requested ?? '-'}</span>
                <span>accepted：{projectClipBatchResult?.accepted ?? '-'}</span>
                <span>skipped：{projectClipBatchResult?.skipped ?? '-'}</span>
                <span>rejected：{projectClipBatchResult?.rejected ?? '-'}</span>
                <span>updated：{projectClipBatchResult?.updated ?? '-'}</span>
              </div>
            </section>
          ) : null}

          {showAdvancedPermissionMerge ? (
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
                    onChange={(event) =>
                      onPermissionRoleChange(event.target.value as WorkspaceRole)
                    }
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
                <span>
                  冲突数：{timelineMergeResult ? timelineMergeResult.conflicts.length : '-'}
                </span>
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
          ) : null}

          {showAdvancedOps ? (
            <section className="collab-card">
              <h4>运维工具</h4>
              <div className="lab-inline-fields">
                <label className="lab-field">
                  <span>管理员令牌</span>
                  <input
                    name="v4AdminToken"
                    value={adminToken}
                    onChange={(event) => onAdminTokenChange(event.target.value)}
                    placeholder="用于 x-admin-token 请求头，可持久化"
                  />
                </label>
              </div>
              {!hasAdminToken ? (
                <div className="api-empty">未填写管理员令牌，运维动作按钮已禁用。</div>
              ) : null}
              <div className="lab-inline-fields">
                <label className="lab-field">
                  <span>告警级别</span>
                  <select
                    name="v4AlertLevel"
                    value={reliabilityAlertLevel}
                    onChange={(event) =>
                      onReliabilityAlertLevelChange(
                        event.target.value as 'all' | V4ReliabilityAlertLevel
                      )
                    }
                  >
                    <option value="all">全部</option>
                    <option value="info">info</option>
                    <option value="warning">warning</option>
                    <option value="critical">critical</option>
                  </select>
                </label>
                <label className="lab-field">
                  <span>告警状态</span>
                  <select
                    name="v4AlertStatus"
                    value={reliabilityAlertStatus}
                    onChange={(event) =>
                      onReliabilityAlertStatusChange(
                        event.target.value as 'all' | V4ReliabilityAlert['status']
                      )
                    }
                  >
                    <option value="all">全部</option>
                    <option value="open">open</option>
                    <option value="acknowledged">acknowledged</option>
                  </select>
                </label>
                <label className="lab-field">
                  <span>查询数量</span>
                  <input
                    type="number"
                    min={1}
                    name="v4AlertLimit"
                    value={reliabilityAlertLimit}
                    onChange={(event) => onReliabilityAlertLimitChange(event.target.value)}
                    placeholder="20"
                  />
                </label>
                <button
                  className="inline-fill-btn"
                  disabled={!hasAdminToken || isOpsBusy}
                  onClick={onLoadReliabilityAlerts}
                >
                  查询告警
                </button>
              </div>
              <div className="collab-meta">
                <span>告警列表</span>
              </div>
              <div className="collab-list">
                {reliabilityAlerts.map((item) => (
                  <div key={item.id} className="collab-list-item">
                    <span>{item.level}</span>
                    <span>{item.status}</span>
                    <span>{item.title}</span>
                    <span>{formatLocalDateTime(item.triggeredAt)}</span>
                    <span>{formatLocalDateTime(item.acknowledgedAt)}</span>
                    <button
                      disabled={!hasAdminToken || isAlertAckDisabled(isOpsBusy, item.status)}
                      onClick={() => onAcknowledgeReliabilityAlert(item.id)}
                    >
                      {getAckLabel(item.status)}
                    </button>
                  </div>
                ))}
                {reliabilityAlerts.length === 0 ? (
                  <div className="api-empty">暂无可靠性告警</div>
                ) : null}
              </div>
              <div className="lab-inline-actions">
                <button disabled={!hasAdminToken || isOpsBusy} onClick={onLoadErrorBudget}>
                  读取错误预算
                </button>
                <button disabled={!hasAdminToken || isOpsBusy} onClick={onUpdateErrorBudget}>
                  更新错误预算策略
                </button>
                <button disabled={!hasAdminToken || isOpsBusy} onClick={onTriggerRollbackDrill}>
                  触发回滚演练
                </button>
              </div>
              <div className="lab-inline-fields">
                <label className="lab-field">
                  <span>作用域</span>
                  <input
                    name="v4ErrorBudgetScope"
                    value={errorBudgetScope}
                    onChange={(event) => onErrorBudgetScopeChange(event.target.value)}
                    placeholder="global"
                  />
                </label>
                <label className="lab-field">
                  <span>targetSlo</span>
                  <input
                    type="number"
                    min={0.5}
                    max={0.99999}
                    step={0.00001}
                    name="v4ErrorBudgetTargetSlo"
                    value={errorBudgetTargetSlo}
                    onChange={(event) => onErrorBudgetTargetSloChange(event.target.value)}
                    placeholder="0.99"
                  />
                </label>
                <label className="lab-field">
                  <span>windowDays</span>
                  <input
                    type="number"
                    min={1}
                    name="v4ErrorBudgetWindowDays"
                    value={errorBudgetWindowDays}
                    onChange={(event) => onErrorBudgetWindowDaysChange(event.target.value)}
                    placeholder="30"
                  />
                </label>
              </div>
              <div className="lab-inline-fields">
                <label className="lab-field">
                  <span>warningRatio</span>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    name="v4ErrorBudgetWarningThresholdRatio"
                    value={errorBudgetWarningThresholdRatio}
                    onChange={(event) =>
                      onErrorBudgetWarningThresholdRatioChange(event.target.value)
                    }
                    placeholder="0.7"
                  />
                </label>
                <label className="lab-field">
                  <span>alertRatio</span>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    name="v4ErrorBudgetAlertThresholdRatio"
                    value={errorBudgetAlertThresholdRatio}
                    onChange={(event) => onErrorBudgetAlertThresholdRatioChange(event.target.value)}
                    placeholder="0.9"
                  />
                </label>
                <label className="lab-field">
                  <span>超限冻结发布</span>
                  <input
                    type="checkbox"
                    name="v4ErrorBudgetFreezeDeployOnBreach"
                    checked={errorBudgetFreezeDeployOnBreach}
                    onChange={(event) =>
                      onErrorBudgetFreezeDeployOnBreachChange(event.target.checked)
                    }
                  />
                </label>
              </div>
              <div className="lab-inline-fields">
                <label className="lab-field">
                  <span>policyId</span>
                  <input
                    name="v4RollbackPolicyId"
                    value={rollbackPolicyId}
                    onChange={(event) => onRollbackPolicyIdChange(event.target.value)}
                    placeholder="可选"
                  />
                </label>
                <label className="lab-field">
                  <span>environment</span>
                  <input
                    name="v4RollbackEnvironment"
                    value={rollbackEnvironment}
                    onChange={(event) => onRollbackEnvironmentChange(event.target.value)}
                    placeholder="staging"
                  />
                </label>
                <label className="lab-field">
                  <span>triggerType</span>
                  <input
                    name="v4RollbackTriggerType"
                    value={rollbackTriggerType}
                    onChange={(event) => onRollbackTriggerTypeChange(event.target.value)}
                    placeholder="manual"
                  />
                </label>
              </div>
              <label className="lab-field">
                <span>summary</span>
                <input
                  name="v4RollbackSummary"
                  value={rollbackSummary}
                  onChange={(event) => onRollbackSummaryChange(event.target.value)}
                  placeholder="触发回滚演练说明"
                />
              </label>
              <div className="lab-inline-fields">
                <label className="lab-field">
                  <span>plan(JSON)</span>
                  <textarea
                    name="v4RollbackPlan"
                    value={rollbackPlan}
                    onChange={(event) => onRollbackPlanChange(event.target.value)}
                    placeholder='{"steps":[]}'
                  />
                </label>
                <label className="lab-field">
                  <span>result(JSON)</span>
                  <textarea
                    name="v4RollbackResult"
                    value={rollbackResult}
                    onChange={(event) => onRollbackResultChange(event.target.value)}
                    placeholder="{}"
                  />
                </label>
              </div>
              <div className="lab-inline-fields">
                <label className="lab-field">
                  <span>演练 ID</span>
                  <input
                    name="v4RollbackDrillId"
                    value={rollbackDrillId}
                    onChange={(event) => onRollbackDrillIdChange(event.target.value)}
                    placeholder="留空则使用最近一次记录"
                  />
                </label>
                <button
                  className="inline-fill-btn"
                  disabled={!hasAdminToken || isOpsBusy}
                  onClick={onQueryRollbackDrill}
                >
                  查询演练结果
                </button>
              </div>
              <div className="collab-meta">
                <span>预算余量：{errorBudget?.evaluation.budgetRemaining ?? '-'}</span>
                <span>
                  预算比例：
                  {formatRatioPercent(errorBudget?.evaluation.budgetRemainingRatio)}
                </span>
                <span>BurnRate：{errorBudget?.evaluation.burnRate ?? '-'}</span>
                <span>状态：{errorBudget?.evaluation.status ?? '-'}</span>
                <span>演练：{rollbackDrillResult?.status || '-'}</span>
              </div>
              <div className="collab-list">
                {rollbackDrillResult ? (
                  <div className="collab-list-item">
                    <span>{rollbackDrillResult.id}</span>
                    <span>{rollbackDrillResult.status}</span>
                    <span>{formatLocalTime(rollbackDrillResult.completedAt)}</span>
                  </div>
                ) : (
                  <div className="api-empty">暂无回滚演练结果</div>
                )}
              </div>
            </section>
          ) : null}

          {showAdvancedStorage ? (
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
          ) : null}
        </>
      ) : null}
    </div>
  )
}

export default CollabModePanel
