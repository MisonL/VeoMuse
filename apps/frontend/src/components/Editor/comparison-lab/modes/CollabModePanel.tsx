import React from 'react'
import CollabAdvancedSections, {
  type CollabAdvancedSectionsProps
} from './collab/CollabAdvancedSections'
import CommentThreadsSection from './collab/CommentThreadsSection'
import InviteJoinSection from './collab/InviteJoinSection'
import RealtimeChannelSection from './collab/RealtimeChannelSection'
import WorkspaceSection from './collab/WorkspaceSection'
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
  const advancedSectionsProps: CollabAdvancedSectionsProps = {
    projectGovernanceProps: {
      projectId,
      isProjectGovernanceBusy,
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
      onBatchUpdateProjectClips
    },
    permissionMergeProps: {
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
    },
    opsToolsProps: {
      adminToken,
      reliabilityAlertLevel,
      reliabilityAlertStatus,
      reliabilityAlertLimit,
      reliabilityAlerts,
      errorBudget,
      errorBudgetScope,
      errorBudgetTargetSlo,
      errorBudgetWindowDays,
      errorBudgetWarningThresholdRatio,
      errorBudgetAlertThresholdRatio,
      errorBudgetFreezeDeployOnBreach,
      rollbackPolicyId,
      rollbackEnvironment,
      rollbackTriggerType,
      rollbackSummary,
      rollbackPlan,
      rollbackResult,
      rollbackDrillId,
      rollbackDrillResult,
      isOpsBusy,
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
    },
    storageSnapshotsProps: {
      projectId,
      workspaceId,
      uploadFileName,
      uploadToken,
      snapshots,
      onCreateSnapshot,
      onRefreshWorkspaceState,
      onUploadFileNameChange,
      onRequestUploadToken
    }
  }

  return (
    <div className="collab-shell collab-command-room" data-testid="area-collab-shell">
      <section className="collab-command-stage">
        <div className="collab-command-card collab-command-card--workspace">
          <WorkspaceSection
            isAuthenticated={isAuthenticated}
            workspaceName={workspaceName}
            workspaceOwner={workspaceOwner}
            workspaceId={workspaceId}
            projectId={projectId}
            onWorkspaceNameChange={onWorkspaceNameChange}
            onWorkspaceOwnerChange={onWorkspaceOwnerChange}
            onCreateWorkspace={onCreateWorkspace}
            onRefreshWorkspaceState={onRefreshWorkspaceState}
          />
        </div>

        <div className="collab-command-card collab-command-card--invite">
          <InviteJoinSection
            workspaceId={workspaceId}
            inviteRole={inviteRole}
            memberName={memberName}
            collabRole={collabRole}
            inviteCode={inviteCode}
            invites={invites}
            onInviteRoleChange={onInviteRoleChange}
            onMemberNameChange={onMemberNameChange}
            onCollabRoleChange={onCollabRoleChange}
            onInviteCodeChange={onInviteCodeChange}
            onCreateInvite={onCreateInvite}
            onAcceptInvite={onAcceptInvite}
          />
        </div>
      </section>

      <section className="collab-live-grid" data-testid="area-collab-live-grid">
        <div className="collab-live-primary">
          <RealtimeChannelSection
            workspaceId={workspaceId}
            isWsConnected={isWsConnected}
            presence={presence}
            collabEvents={collabEvents}
            onConnectWs={onConnectWs}
            onDisconnectWs={onDisconnectWs}
            onSendCollabEvent={onSendCollabEvent}
          />
        </div>

        <div className="collab-live-secondary">
          <CommentThreadsSection
            projectId={projectId}
            commentThreads={commentThreads}
            commentThreadCursor={commentThreadCursor}
            commentThreadLimit={commentThreadLimit}
            commentThreadHasMore={commentThreadHasMore}
            commentAnchor={commentAnchor}
            commentContent={commentContent}
            commentMentions={commentMentions}
            selectedThreadId={selectedThreadId}
            commentReplyContent={commentReplyContent}
            commentReplyMentions={commentReplyMentions}
            isV4Busy={isV4Busy}
            onRefreshCommentThreads={onRefreshCommentThreads}
            onLoadMoreCommentThreads={onLoadMoreCommentThreads}
            onCommentThreadLimitChange={onCommentThreadLimitChange}
            onCommentAnchorChange={onCommentAnchorChange}
            onCommentContentChange={onCommentContentChange}
            onCommentMentionsChange={onCommentMentionsChange}
            onSelectedThreadIdChange={onSelectedThreadIdChange}
            onCommentReplyContentChange={onCommentReplyContentChange}
            onCommentReplyMentionsChange={onCommentReplyMentionsChange}
            onCreateCommentThread={onCreateCommentThread}
            onReplyCommentThread={onReplyCommentThread}
            onResolveCommentThread={onResolveCommentThread}
          />
        </div>
      </section>

      <section className="collab-governance-deck">
        <CollabAdvancedSections {...advancedSectionsProps} />
      </section>
    </div>
  )
}

export default CollabModePanel
