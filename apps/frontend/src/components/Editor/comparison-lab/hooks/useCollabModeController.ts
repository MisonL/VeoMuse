import { useCallback } from 'react'
import {
  parseJsonArrayInput as parseJsonArrayInputHelper,
  parseJsonObjectInput as parseJsonObjectInputHelper,
  parseMentionsInput
} from '../helpers'
import type { JourneyErrorKind, JourneyFailedStage, JourneyStep } from '../../../../store/journeyTelemetryStore'
import type { AuthProfile, LabMode, WorkspaceRole } from '../types'
import { useProjectGovernance } from './useProjectGovernance'
import { useV4CommentThreads } from './useV4CommentThreads'
import { useV4OpsManager } from './useV4OpsManager'
import { useWorkspaceCollaborationManager } from './useWorkspaceCollaborationManager'
import type { CollabModePanelProps } from '../modes/CollabModePanel'

type ShowToast = (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void
type WorkspaceCollaborationController = ReturnType<typeof useWorkspaceCollaborationManager>
type V4OpsController = ReturnType<typeof useV4OpsManager>
type V4CommentThreadsController = ReturnType<typeof useV4CommentThreads>
type ProjectGovernanceController = ReturnType<typeof useProjectGovernance>

type CollabWorkspaceProps = Pick<
  CollabModePanelProps,
  | 'isAuthenticated'
  | 'workspaceName'
  | 'workspaceOwner'
  | 'workspaceId'
  | 'projectId'
  | 'inviteRole'
  | 'memberName'
  | 'collabRole'
  | 'inviteCode'
  | 'invites'
  | 'isWsConnected'
  | 'presence'
  | 'collabEvents'
  | 'snapshots'
  | 'uploadFileName'
  | 'uploadToken'
  | 'onWorkspaceNameChange'
  | 'onWorkspaceOwnerChange'
  | 'onCreateWorkspace'
  | 'onRefreshWorkspaceState'
  | 'onInviteRoleChange'
  | 'onMemberNameChange'
  | 'onCollabRoleChange'
  | 'onInviteCodeChange'
  | 'onCreateInvite'
  | 'onAcceptInvite'
  | 'onConnectWs'
  | 'onDisconnectWs'
  | 'onSendCollabEvent'
  | 'onCreateSnapshot'
  | 'onUploadFileNameChange'
  | 'onRequestUploadToken'
>

type CollabCommentThreadProps = Pick<
  CollabModePanelProps,
  | 'commentThreads'
  | 'commentThreadCursor'
  | 'commentThreadLimit'
  | 'commentThreadHasMore'
  | 'commentAnchor'
  | 'commentContent'
  | 'commentMentions'
  | 'selectedThreadId'
  | 'commentReplyContent'
  | 'commentReplyMentions'
  | 'onRefreshCommentThreads'
  | 'onLoadMoreCommentThreads'
  | 'onCommentThreadLimitChange'
  | 'onCommentAnchorChange'
  | 'onCommentContentChange'
  | 'onCommentMentionsChange'
  | 'onSelectedThreadIdChange'
  | 'onCommentReplyContentChange'
  | 'onCommentReplyMentionsChange'
  | 'onCreateCommentThread'
  | 'onReplyCommentThread'
  | 'onResolveCommentThread'
>

type CollabGovernanceProps = Pick<
  CollabModePanelProps,
  | 'projectComments'
  | 'projectCommentCursor'
  | 'projectCommentLimit'
  | 'projectCommentHasMore'
  | 'projectCommentAnchor'
  | 'projectCommentContent'
  | 'projectCommentMentions'
  | 'projectSelectedCommentId'
  | 'projectReviews'
  | 'projectReviewLimit'
  | 'projectReviewDecision'
  | 'projectReviewSummary'
  | 'projectReviewScore'
  | 'projectTemplates'
  | 'projectSelectedTemplateId'
  | 'projectTemplateApplyOptions'
  | 'projectTemplateApplyResult'
  | 'projectClipBatchOperations'
  | 'projectClipBatchResult'
  | 'onRefreshProjectComments'
  | 'onLoadMoreProjectComments'
  | 'onProjectCommentLimitChange'
  | 'onProjectCommentAnchorChange'
  | 'onProjectCommentContentChange'
  | 'onProjectCommentMentionsChange'
  | 'onProjectSelectedCommentIdChange'
  | 'onCreateProjectComment'
  | 'onResolveProjectComment'
  | 'onRefreshProjectReviews'
  | 'onProjectReviewLimitChange'
  | 'onProjectReviewDecisionChange'
  | 'onProjectReviewSummaryChange'
  | 'onProjectReviewScoreChange'
  | 'onCreateProjectReview'
  | 'onRefreshProjectTemplates'
  | 'onProjectSelectedTemplateIdChange'
  | 'onProjectTemplateApplyOptionsChange'
  | 'onApplyProjectTemplate'
  | 'onProjectClipBatchOperationsChange'
  | 'onBatchUpdateProjectClips'
>

type CollabOpsProps = Pick<
  CollabModePanelProps,
  | 'permissions'
  | 'permissionSubjectId'
  | 'permissionRole'
  | 'timelineMergeResult'
  | 'errorBudget'
  | 'errorBudgetScope'
  | 'errorBudgetTargetSlo'
  | 'errorBudgetWindowDays'
  | 'errorBudgetWarningThresholdRatio'
  | 'errorBudgetAlertThresholdRatio'
  | 'errorBudgetFreezeDeployOnBreach'
  | 'adminToken'
  | 'reliabilityAlertLevel'
  | 'reliabilityAlertStatus'
  | 'reliabilityAlertLimit'
  | 'reliabilityAlerts'
  | 'rollbackPolicyId'
  | 'rollbackEnvironment'
  | 'rollbackTriggerType'
  | 'rollbackSummary'
  | 'rollbackPlan'
  | 'rollbackResult'
  | 'rollbackDrillId'
  | 'rollbackDrillResult'
  | 'onRefreshPermissions'
  | 'onPermissionSubjectIdChange'
  | 'onPermissionRoleChange'
  | 'onUpdatePermission'
  | 'onMergeTimeline'
  | 'onAdminTokenChange'
  | 'onReliabilityAlertLevelChange'
  | 'onReliabilityAlertStatusChange'
  | 'onReliabilityAlertLimitChange'
  | 'onLoadReliabilityAlerts'
  | 'onAcknowledgeReliabilityAlert'
  | 'onLoadErrorBudget'
  | 'onErrorBudgetScopeChange'
  | 'onErrorBudgetTargetSloChange'
  | 'onErrorBudgetWindowDaysChange'
  | 'onErrorBudgetWarningThresholdRatioChange'
  | 'onErrorBudgetAlertThresholdRatioChange'
  | 'onErrorBudgetFreezeDeployOnBreachChange'
  | 'onRollbackPolicyIdChange'
  | 'onRollbackEnvironmentChange'
  | 'onRollbackTriggerTypeChange'
  | 'onRollbackSummaryChange'
  | 'onRollbackPlanChange'
  | 'onRollbackResultChange'
  | 'onUpdateErrorBudget'
  | 'onTriggerRollbackDrill'
  | 'onRollbackDrillIdChange'
  | 'onQueryRollbackDrill'
>

type CollabBusyStateProps = Pick<
  CollabModePanelProps,
  'isV4Busy' | 'isOpsBusy' | 'isProjectGovernanceBusy'
>

interface BuildCollabWorkspacePropsOptions {
  authProfile: AuthProfile | null
  workspaceName: string
  setWorkspaceName: (value: string) => void
  workspaceOwner: string
  setWorkspaceOwner: (value: string) => void
  workspaceId: string
  projectId: string
  inviteRole: WorkspaceRole
  setInviteRole: (value: WorkspaceRole) => void
  memberName: string
  setMemberName: (value: string) => void
  collabRole: WorkspaceRole
  setCollabRole: (value: WorkspaceRole) => void
  inviteCode: string
  setInviteCode: (value: string) => void
  uploadFileName: string
  setUploadFileName: (value: string) => void
  workspaceCollaborationController: WorkspaceCollaborationController
}

export const buildCollabWorkspaceProps = ({
  authProfile,
  workspaceName,
  setWorkspaceName,
  workspaceOwner,
  setWorkspaceOwner,
  workspaceId,
  projectId,
  inviteRole,
  setInviteRole,
  memberName,
  setMemberName,
  collabRole,
  setCollabRole,
  inviteCode,
  setInviteCode,
  uploadFileName,
  setUploadFileName,
  workspaceCollaborationController
}: BuildCollabWorkspacePropsOptions): CollabWorkspaceProps => ({
  isAuthenticated: Boolean(authProfile),
  workspaceName,
  workspaceOwner,
  workspaceId,
  projectId,
  inviteRole,
  memberName,
  collabRole,
  inviteCode,
  invites: workspaceCollaborationController.invites,
  isWsConnected: workspaceCollaborationController.isWsConnected,
  presence: workspaceCollaborationController.presence,
  collabEvents: workspaceCollaborationController.collabEvents,
  snapshots: workspaceCollaborationController.snapshots,
  uploadFileName,
  uploadToken: workspaceCollaborationController.uploadToken,
  onWorkspaceNameChange: setWorkspaceName,
  onWorkspaceOwnerChange: setWorkspaceOwner,
  onCreateWorkspace: () => void workspaceCollaborationController.createWorkspace(),
  onRefreshWorkspaceState: () => void workspaceCollaborationController.refreshWorkspaceState(),
  onInviteRoleChange: setInviteRole,
  onMemberNameChange: setMemberName,
  onCollabRoleChange: setCollabRole,
  onInviteCodeChange: setInviteCode,
  onCreateInvite: () => void workspaceCollaborationController.createInvite(),
  onAcceptInvite: () => void workspaceCollaborationController.acceptInvite(),
  onConnectWs: workspaceCollaborationController.connectWs,
  onDisconnectWs: workspaceCollaborationController.disconnectWs,
  onSendCollabEvent: workspaceCollaborationController.sendCollabEvent,
  onCreateSnapshot: () => void workspaceCollaborationController.createSnapshot(),
  onUploadFileNameChange: setUploadFileName,
  onRequestUploadToken: () => void workspaceCollaborationController.requestUploadToken()
})

export const buildCollabCommentThreadProps = (
  commentThreadsController: V4CommentThreadsController
): CollabCommentThreadProps => ({
  commentThreads: commentThreadsController.v4CommentThreads,
  commentThreadCursor: commentThreadsController.v4CommentThreadCursor,
  commentThreadLimit: commentThreadsController.v4CommentThreadLimit,
  commentThreadHasMore: commentThreadsController.v4CommentThreadHasMore,
  commentAnchor: commentThreadsController.v4CommentAnchor,
  commentContent: commentThreadsController.v4CommentContent,
  commentMentions: commentThreadsController.v4CommentMentions,
  selectedThreadId: commentThreadsController.v4SelectedThreadId,
  commentReplyContent: commentThreadsController.v4CommentReplyContent,
  commentReplyMentions: commentThreadsController.v4CommentReplyMentions,
  onRefreshCommentThreads: () => void commentThreadsController.refreshV4CommentThreads(),
  onLoadMoreCommentThreads: () => void commentThreadsController.loadMoreV4CommentThreads(),
  onCommentThreadLimitChange: commentThreadsController.setV4CommentThreadLimit,
  onCommentAnchorChange: commentThreadsController.setV4CommentAnchor,
  onCommentContentChange: commentThreadsController.setV4CommentContent,
  onCommentMentionsChange: commentThreadsController.setV4CommentMentions,
  onSelectedThreadIdChange: commentThreadsController.setV4SelectedThreadId,
  onCommentReplyContentChange: commentThreadsController.setV4CommentReplyContent,
  onCommentReplyMentionsChange: commentThreadsController.setV4CommentReplyMentions,
  onCreateCommentThread: () => void commentThreadsController.createV4CommentThread(),
  onReplyCommentThread: () => void commentThreadsController.replyV4CommentThread(),
  onResolveCommentThread: () => void commentThreadsController.resolveV4CommentThread()
})

export const buildCollabGovernanceProps = (
  projectGovernanceController: ProjectGovernanceController
): CollabGovernanceProps => ({
  projectComments: projectGovernanceController.projectComments,
  projectCommentCursor: projectGovernanceController.projectCommentCursor,
  projectCommentLimit: projectGovernanceController.projectCommentLimit,
  projectCommentHasMore: projectGovernanceController.projectCommentHasMore,
  projectCommentAnchor: projectGovernanceController.projectCommentAnchor,
  projectCommentContent: projectGovernanceController.projectCommentContent,
  projectCommentMentions: projectGovernanceController.projectCommentMentions,
  projectSelectedCommentId: projectGovernanceController.projectSelectedCommentId,
  projectReviews: projectGovernanceController.projectReviews,
  projectReviewLimit: projectGovernanceController.projectReviewLimit,
  projectReviewDecision: projectGovernanceController.projectReviewDecision,
  projectReviewSummary: projectGovernanceController.projectReviewSummary,
  projectReviewScore: projectGovernanceController.projectReviewScore,
  projectTemplates: projectGovernanceController.projectTemplates,
  projectSelectedTemplateId: projectGovernanceController.projectSelectedTemplateId,
  projectTemplateApplyOptions: projectGovernanceController.projectTemplateApplyOptions,
  projectTemplateApplyResult: projectGovernanceController.projectTemplateApplyResult,
  projectClipBatchOperations: projectGovernanceController.projectClipBatchOperations,
  projectClipBatchResult: projectGovernanceController.projectClipBatchResult,
  onRefreshProjectComments: () => void projectGovernanceController.loadProjectComments(false),
  onLoadMoreProjectComments: () => void projectGovernanceController.loadProjectComments(true),
  onProjectCommentLimitChange: projectGovernanceController.setProjectCommentLimit,
  onProjectCommentAnchorChange: projectGovernanceController.setProjectCommentAnchor,
  onProjectCommentContentChange: projectGovernanceController.setProjectCommentContent,
  onProjectCommentMentionsChange: projectGovernanceController.setProjectCommentMentions,
  onProjectSelectedCommentIdChange: projectGovernanceController.setProjectSelectedCommentId,
  onCreateProjectComment: () => void projectGovernanceController.createProjectCommentEntry(),
  onResolveProjectComment: () => void projectGovernanceController.resolveProjectCommentEntry(),
  onRefreshProjectReviews: () => void projectGovernanceController.loadProjectReviews(),
  onProjectReviewLimitChange: projectGovernanceController.setProjectReviewLimit,
  onProjectReviewDecisionChange: projectGovernanceController.setProjectReviewDecision,
  onProjectReviewSummaryChange: projectGovernanceController.setProjectReviewSummary,
  onProjectReviewScoreChange: projectGovernanceController.setProjectReviewScore,
  onCreateProjectReview: () => void projectGovernanceController.createProjectReviewEntry(),
  onRefreshProjectTemplates: () => void projectGovernanceController.loadProjectTemplates(),
  onProjectSelectedTemplateIdChange: projectGovernanceController.setProjectSelectedTemplateId,
  onProjectTemplateApplyOptionsChange: projectGovernanceController.setProjectTemplateApplyOptions,
  onApplyProjectTemplate: () => void projectGovernanceController.applyProjectTemplateEntry(),
  onProjectClipBatchOperationsChange: projectGovernanceController.setProjectClipBatchOperations,
  onBatchUpdateProjectClips: () => void projectGovernanceController.batchUpdateProjectClipsEntry()
})

export const buildCollabOpsProps = (
  v4OpsController: V4OpsController
): CollabOpsProps => ({
  permissions: v4OpsController.v4Permissions,
  permissionSubjectId: v4OpsController.v4PermissionSubjectId,
  permissionRole: v4OpsController.v4PermissionRole,
  timelineMergeResult: v4OpsController.v4TimelineMergeResult,
  errorBudget: v4OpsController.v4ErrorBudget,
  errorBudgetScope: v4OpsController.v4ErrorBudgetScope,
  errorBudgetTargetSlo: v4OpsController.v4ErrorBudgetTargetSlo,
  errorBudgetWindowDays: v4OpsController.v4ErrorBudgetWindowDays,
  errorBudgetWarningThresholdRatio: v4OpsController.v4ErrorBudgetWarningThresholdRatio,
  errorBudgetAlertThresholdRatio: v4OpsController.v4ErrorBudgetAlertThresholdRatio,
  errorBudgetFreezeDeployOnBreach: v4OpsController.v4ErrorBudgetFreezeDeployOnBreach,
  adminToken: v4OpsController.v4AdminToken,
  reliabilityAlertLevel: v4OpsController.v4ReliabilityAlertLevel,
  reliabilityAlertStatus: v4OpsController.v4ReliabilityAlertStatus,
  reliabilityAlertLimit: v4OpsController.v4ReliabilityAlertLimit,
  reliabilityAlerts: v4OpsController.v4ReliabilityAlerts,
  rollbackPolicyId: v4OpsController.v4RollbackPolicyId,
  rollbackEnvironment: v4OpsController.v4RollbackEnvironment,
  rollbackTriggerType: v4OpsController.v4RollbackTriggerType,
  rollbackSummary: v4OpsController.v4RollbackSummary,
  rollbackPlan: v4OpsController.v4RollbackPlan,
  rollbackResult: v4OpsController.v4RollbackResult,
  rollbackDrillId: v4OpsController.v4RollbackDrillId,
  rollbackDrillResult: v4OpsController.v4RollbackDrillResult,
  onRefreshPermissions: () => void v4OpsController.refreshV4Permissions(),
  onPermissionSubjectIdChange: v4OpsController.setV4PermissionSubjectId,
  onPermissionRoleChange: v4OpsController.setV4PermissionRole,
  onUpdatePermission: () => void v4OpsController.updateV4Permission(),
  onMergeTimeline: () => void v4OpsController.mergeV4Timeline(),
  onAdminTokenChange: v4OpsController.setV4AdminToken,
  onReliabilityAlertLevelChange: v4OpsController.setV4ReliabilityAlertLevel,
  onReliabilityAlertStatusChange: v4OpsController.setV4ReliabilityAlertStatus,
  onReliabilityAlertLimitChange: v4OpsController.setV4ReliabilityAlertLimit,
  onLoadReliabilityAlerts: () => void v4OpsController.loadV4ReliabilityAlerts(),
  onAcknowledgeReliabilityAlert: (alertId) =>
    void v4OpsController.acknowledgeV4ReliabilityAlert(alertId),
  onLoadErrorBudget: () => void v4OpsController.loadV4ErrorBudget(),
  onErrorBudgetScopeChange: v4OpsController.setV4ErrorBudgetScope,
  onErrorBudgetTargetSloChange: v4OpsController.setV4ErrorBudgetTargetSlo,
  onErrorBudgetWindowDaysChange: v4OpsController.setV4ErrorBudgetWindowDays,
  onErrorBudgetWarningThresholdRatioChange: v4OpsController.setV4ErrorBudgetWarningThresholdRatio,
  onErrorBudgetAlertThresholdRatioChange: v4OpsController.setV4ErrorBudgetAlertThresholdRatio,
  onErrorBudgetFreezeDeployOnBreachChange: v4OpsController.setV4ErrorBudgetFreezeDeployOnBreach,
  onRollbackPolicyIdChange: v4OpsController.setV4RollbackPolicyId,
  onRollbackEnvironmentChange: v4OpsController.setV4RollbackEnvironment,
  onRollbackTriggerTypeChange: v4OpsController.setV4RollbackTriggerType,
  onRollbackSummaryChange: v4OpsController.setV4RollbackSummary,
  onRollbackPlanChange: v4OpsController.setV4RollbackPlan,
  onRollbackResultChange: v4OpsController.setV4RollbackResult,
  onUpdateErrorBudget: () => void v4OpsController.updateV4ErrorBudget(),
  onTriggerRollbackDrill: () => void v4OpsController.triggerV4RollbackDrill(),
  onRollbackDrillIdChange: v4OpsController.setV4RollbackDrillId,
  onQueryRollbackDrill: () => void v4OpsController.queryV4RollbackDrill()
})

export const buildCollabBusyStateProps = ({
  isV4Busy,
  isOpsBusy,
  isProjectGovernanceBusy
}: CollabBusyStateProps): CollabBusyStateProps => ({
  isV4Busy,
  isOpsBusy,
  isProjectGovernanceBusy
})

interface UseCollabModeControllerOptions {
  authProfile: AuthProfile | null
  workspaceName: string
  setWorkspaceName: (value: string) => void
  workspaceOwner: string
  setWorkspaceOwner: (value: string) => void
  workspaceId: string
  setWorkspaceId: (value: string) => void
  projectId: string
  setProjectId: (value: string) => void
  memberName: string
  setMemberName: (value: string) => void
  collabRole: WorkspaceRole
  setCollabRole: (value: WorkspaceRole) => void
  inviteRole: WorkspaceRole
  setInviteRole: (value: WorkspaceRole) => void
  inviteCode: string
  setInviteCode: (value: string) => void
  uploadFileName: string
  setUploadFileName: (value: string) => void
  effectiveOrganizationId: string
  selectOrganization: (organizationId: string) => void
  labMode: LabMode
  openChannelPanel: () => void
  showToast: ShowToast
  markJourneyStep: (
    step: JourneyStep,
    payload?: { organizationId?: string; workspaceId?: string }
  ) => void
  reportJourney: (
    success: boolean,
    payload?: {
      reason?: string
      durationMs?: number
      failedStage?: JourneyFailedStage
      errorKind?: JourneyErrorKind
      httpStatus?: number
    }
  ) => Promise<boolean>
}

export const useCollabModeController = ({
  authProfile,
  workspaceName,
  setWorkspaceName,
  workspaceOwner,
  setWorkspaceOwner,
  workspaceId,
  setWorkspaceId,
  projectId,
  setProjectId,
  memberName,
  setMemberName,
  collabRole,
  setCollabRole,
  inviteRole,
  setInviteRole,
  inviteCode,
  setInviteCode,
  uploadFileName,
  setUploadFileName,
  effectiveOrganizationId,
  selectOrganization,
  labMode,
  openChannelPanel,
  showToast,
  markJourneyStep,
  reportJourney
}: UseCollabModeControllerOptions): CollabModePanelProps => {
  const currentActorName = memberName.trim() || workspaceOwner.trim() || 'Owner'

  const parseJsonObjectInput = useCallback(
    (raw: string, fieldName: string): Record<string, unknown> | null =>
      parseJsonObjectInputHelper(raw, fieldName, (message) => showToast(message, 'warning')),
    [showToast]
  )

  const parseJsonArrayInput = useCallback(
    (raw: string, fieldName: string): unknown[] | null =>
      parseJsonArrayInputHelper(raw, fieldName, (message) => showToast(message, 'warning')),
    [showToast]
  )

  const workspaceCollaborationController = useWorkspaceCollaborationManager({
    authProfile,
    workspaceName,
    workspaceOwner,
    workspaceId,
    setWorkspaceId,
    projectId,
    setProjectId,
    memberName,
    setMemberName,
    collabRole,
    setCollabRole,
    inviteRole,
    inviteCode,
    setInviteCode,
    uploadFileName,
    effectiveOrganizationId,
    selectOrganization,
    labMode,
    openChannelPanel,
    showToast,
    markJourneyStep,
    reportJourney
  })

  const v4OpsController = useV4OpsManager({
    workspaceId,
    projectId,
    currentActorName,
    parseJsonObjectInput,
    showToast
  })

  const commentThreadsController = useV4CommentThreads({
    projectId,
    isV4CollabBusy: v4OpsController.isV4CollabBusy,
    setIsV4CollabBusy: v4OpsController.setIsV4CollabBusy,
    parseMentionsInput,
    showToast
  })

  const projectGovernanceController = useProjectGovernance({
    projectId,
    labMode,
    showToast,
    parseMentionsInput,
    parseJsonObjectInput,
    parseJsonArrayInput
  })

  return {
    ...buildCollabWorkspaceProps({
      authProfile,
      workspaceName,
      setWorkspaceName,
      workspaceOwner,
      setWorkspaceOwner,
      workspaceId,
      projectId,
      inviteRole,
      setInviteRole,
      memberName,
      setMemberName,
      collabRole,
      setCollabRole,
      inviteCode,
      setInviteCode,
      uploadFileName,
      setUploadFileName,
      workspaceCollaborationController
    }),
    ...buildCollabCommentThreadProps(commentThreadsController),
    ...buildCollabGovernanceProps(projectGovernanceController),
    ...buildCollabOpsProps(v4OpsController),
    ...buildCollabBusyStateProps({
      isV4Busy: v4OpsController.isV4CollabBusy,
      isOpsBusy: v4OpsController.isV4OpsBusy,
      isProjectGovernanceBusy: projectGovernanceController.isProjectGovernanceBusy
    })
  }
}
