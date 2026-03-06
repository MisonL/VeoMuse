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

  const {
    invites,
    presence,
    collabEvents,
    snapshots,
    uploadToken,
    isWsConnected,
    refreshWorkspaceState,
    createWorkspace,
    createInvite,
    acceptInvite,
    createSnapshot,
    requestUploadToken,
    connectWs,
    disconnectWs,
    sendCollabEvent
  } = useWorkspaceCollaborationManager({
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

  const {
    v4Permissions,
    v4PermissionSubjectId,
    v4PermissionRole,
    v4TimelineMergeResult,
    v4ErrorBudget,
    v4ReliabilityAlerts,
    v4ReliabilityAlertLevel,
    v4ReliabilityAlertStatus,
    v4ReliabilityAlertLimit,
    v4ErrorBudgetScope,
    v4ErrorBudgetTargetSlo,
    v4ErrorBudgetWindowDays,
    v4ErrorBudgetWarningThresholdRatio,
    v4ErrorBudgetAlertThresholdRatio,
    v4ErrorBudgetFreezeDeployOnBreach,
    v4RollbackPolicyId,
    v4RollbackEnvironment,
    v4RollbackTriggerType,
    v4RollbackSummary,
    v4RollbackPlan,
    v4RollbackResult,
    v4RollbackDrillId,
    v4RollbackDrillResult,
    v4AdminToken,
    isV4CollabBusy,
    isV4OpsBusy,
    setV4PermissionSubjectId,
    setV4PermissionRole,
    setV4AdminToken,
    setIsV4CollabBusy,
    setV4ReliabilityAlertLevel,
    setV4ReliabilityAlertStatus,
    setV4ReliabilityAlertLimit,
    setV4ErrorBudgetScope,
    setV4ErrorBudgetTargetSlo,
    setV4ErrorBudgetWindowDays,
    setV4ErrorBudgetWarningThresholdRatio,
    setV4ErrorBudgetAlertThresholdRatio,
    setV4ErrorBudgetFreezeDeployOnBreach,
    setV4RollbackPolicyId,
    setV4RollbackEnvironment,
    setV4RollbackTriggerType,
    setV4RollbackSummary,
    setV4RollbackPlan,
    setV4RollbackResult,
    setV4RollbackDrillId,
    refreshV4Permissions,
    updateV4Permission,
    mergeV4Timeline,
    loadV4ReliabilityAlerts,
    acknowledgeV4ReliabilityAlert,
    loadV4ErrorBudget,
    updateV4ErrorBudget,
    triggerV4RollbackDrill,
    queryV4RollbackDrill
  } = useV4OpsManager({
    workspaceId,
    projectId,
    currentActorName,
    parseJsonObjectInput,
    showToast
  })

  const {
    v4CommentThreads,
    v4CommentThreadCursor,
    v4CommentThreadLimit,
    v4CommentThreadHasMore,
    v4CommentAnchor,
    v4CommentContent,
    v4CommentMentions,
    v4SelectedThreadId,
    v4CommentReplyContent,
    v4CommentReplyMentions,
    setV4CommentThreadLimit,
    setV4CommentAnchor,
    setV4CommentContent,
    setV4CommentMentions,
    setV4SelectedThreadId,
    setV4CommentReplyContent,
    setV4CommentReplyMentions,
    refreshV4CommentThreads,
    loadMoreV4CommentThreads,
    createV4CommentThread,
    replyV4CommentThread,
    resolveV4CommentThread
  } = useV4CommentThreads({
    projectId,
    isV4CollabBusy,
    setIsV4CollabBusy,
    parseMentionsInput,
    showToast
  })

  const {
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
    isProjectGovernanceBusy,
    setProjectCommentLimit,
    setProjectCommentAnchor,
    setProjectCommentContent,
    setProjectCommentMentions,
    setProjectSelectedCommentId,
    setProjectReviewLimit,
    setProjectReviewDecision,
    setProjectReviewSummary,
    setProjectReviewScore,
    setProjectSelectedTemplateId,
    setProjectTemplateApplyOptions,
    setProjectClipBatchOperations,
    loadProjectComments,
    createProjectCommentEntry,
    resolveProjectCommentEntry,
    loadProjectReviews,
    createProjectReviewEntry,
    loadProjectTemplates,
    applyProjectTemplateEntry,
    batchUpdateProjectClipsEntry
  } = useProjectGovernance({
    projectId,
    labMode,
    showToast,
    parseMentionsInput,
    parseJsonObjectInput,
    parseJsonArrayInput
  })

  return {
    isAuthenticated: Boolean(authProfile),
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
    commentThreads: v4CommentThreads,
    commentThreadCursor: v4CommentThreadCursor,
    commentThreadLimit: v4CommentThreadLimit,
    commentThreadHasMore: v4CommentThreadHasMore,
    commentAnchor: v4CommentAnchor,
    commentContent: v4CommentContent,
    commentMentions: v4CommentMentions,
    selectedThreadId: v4SelectedThreadId,
    commentReplyContent: v4CommentReplyContent,
    commentReplyMentions: v4CommentReplyMentions,
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
    permissions: v4Permissions,
    permissionSubjectId: v4PermissionSubjectId,
    permissionRole: v4PermissionRole,
    timelineMergeResult: v4TimelineMergeResult,
    errorBudget: v4ErrorBudget,
    errorBudgetScope: v4ErrorBudgetScope,
    errorBudgetTargetSlo: v4ErrorBudgetTargetSlo,
    errorBudgetWindowDays: v4ErrorBudgetWindowDays,
    errorBudgetWarningThresholdRatio: v4ErrorBudgetWarningThresholdRatio,
    errorBudgetAlertThresholdRatio: v4ErrorBudgetAlertThresholdRatio,
    errorBudgetFreezeDeployOnBreach: v4ErrorBudgetFreezeDeployOnBreach,
    adminToken: v4AdminToken,
    reliabilityAlertLevel: v4ReliabilityAlertLevel,
    reliabilityAlertStatus: v4ReliabilityAlertStatus,
    reliabilityAlertLimit: v4ReliabilityAlertLimit,
    reliabilityAlerts: v4ReliabilityAlerts,
    rollbackPolicyId: v4RollbackPolicyId,
    rollbackEnvironment: v4RollbackEnvironment,
    rollbackTriggerType: v4RollbackTriggerType,
    rollbackSummary: v4RollbackSummary,
    rollbackPlan: v4RollbackPlan,
    rollbackResult: v4RollbackResult,
    rollbackDrillId: v4RollbackDrillId,
    rollbackDrillResult: v4RollbackDrillResult,
    isV4Busy: isV4CollabBusy,
    isOpsBusy: isV4OpsBusy,
    isProjectGovernanceBusy,
    onWorkspaceNameChange: setWorkspaceName,
    onWorkspaceOwnerChange: setWorkspaceOwner,
    onCreateWorkspace: () => void createWorkspace(),
    onRefreshWorkspaceState: () => void refreshWorkspaceState(),
    onInviteRoleChange: setInviteRole,
    onMemberNameChange: setMemberName,
    onCollabRoleChange: setCollabRole,
    onInviteCodeChange: setInviteCode,
    onCreateInvite: () => void createInvite(),
    onAcceptInvite: () => void acceptInvite(),
    onConnectWs: connectWs,
    onDisconnectWs: disconnectWs,
    onSendCollabEvent: sendCollabEvent,
    onCreateSnapshot: () => void createSnapshot(),
    onUploadFileNameChange: setUploadFileName,
    onRequestUploadToken: () => void requestUploadToken(),
    onRefreshCommentThreads: () => void refreshV4CommentThreads(),
    onLoadMoreCommentThreads: () => void loadMoreV4CommentThreads(),
    onCommentThreadLimitChange: setV4CommentThreadLimit,
    onCommentAnchorChange: setV4CommentAnchor,
    onCommentContentChange: setV4CommentContent,
    onCommentMentionsChange: setV4CommentMentions,
    onSelectedThreadIdChange: setV4SelectedThreadId,
    onCommentReplyContentChange: setV4CommentReplyContent,
    onCommentReplyMentionsChange: setV4CommentReplyMentions,
    onCreateCommentThread: () => void createV4CommentThread(),
    onReplyCommentThread: () => void replyV4CommentThread(),
    onResolveCommentThread: () => void resolveV4CommentThread(),
    onRefreshProjectComments: () => void loadProjectComments(false),
    onLoadMoreProjectComments: () => void loadProjectComments(true),
    onProjectCommentLimitChange: setProjectCommentLimit,
    onProjectCommentAnchorChange: setProjectCommentAnchor,
    onProjectCommentContentChange: setProjectCommentContent,
    onProjectCommentMentionsChange: setProjectCommentMentions,
    onProjectSelectedCommentIdChange: setProjectSelectedCommentId,
    onCreateProjectComment: () => void createProjectCommentEntry(),
    onResolveProjectComment: () => void resolveProjectCommentEntry(),
    onRefreshProjectReviews: () => void loadProjectReviews(),
    onProjectReviewLimitChange: setProjectReviewLimit,
    onProjectReviewDecisionChange: setProjectReviewDecision,
    onProjectReviewSummaryChange: setProjectReviewSummary,
    onProjectReviewScoreChange: setProjectReviewScore,
    onCreateProjectReview: () => void createProjectReviewEntry(),
    onRefreshProjectTemplates: () => void loadProjectTemplates(),
    onProjectSelectedTemplateIdChange: setProjectSelectedTemplateId,
    onProjectTemplateApplyOptionsChange: setProjectTemplateApplyOptions,
    onApplyProjectTemplate: () => void applyProjectTemplateEntry(),
    onProjectClipBatchOperationsChange: setProjectClipBatchOperations,
    onBatchUpdateProjectClips: () => void batchUpdateProjectClipsEntry(),
    onRefreshPermissions: () => void refreshV4Permissions(),
    onPermissionSubjectIdChange: setV4PermissionSubjectId,
    onPermissionRoleChange: setV4PermissionRole,
    onUpdatePermission: () => void updateV4Permission(),
    onMergeTimeline: () => void mergeV4Timeline(),
    onAdminTokenChange: setV4AdminToken,
    onReliabilityAlertLevelChange: setV4ReliabilityAlertLevel,
    onReliabilityAlertStatusChange: setV4ReliabilityAlertStatus,
    onReliabilityAlertLimitChange: setV4ReliabilityAlertLimit,
    onLoadReliabilityAlerts: () => void loadV4ReliabilityAlerts(),
    onAcknowledgeReliabilityAlert: (alertId) => void acknowledgeV4ReliabilityAlert(alertId),
    onLoadErrorBudget: () => void loadV4ErrorBudget(),
    onErrorBudgetScopeChange: setV4ErrorBudgetScope,
    onErrorBudgetTargetSloChange: setV4ErrorBudgetTargetSlo,
    onErrorBudgetWindowDaysChange: setV4ErrorBudgetWindowDays,
    onErrorBudgetWarningThresholdRatioChange: setV4ErrorBudgetWarningThresholdRatio,
    onErrorBudgetAlertThresholdRatioChange: setV4ErrorBudgetAlertThresholdRatio,
    onErrorBudgetFreezeDeployOnBreachChange: setV4ErrorBudgetFreezeDeployOnBreach,
    onRollbackPolicyIdChange: setV4RollbackPolicyId,
    onRollbackEnvironmentChange: setV4RollbackEnvironment,
    onRollbackTriggerTypeChange: setV4RollbackTriggerType,
    onRollbackSummaryChange: setV4RollbackSummary,
    onRollbackPlanChange: setV4RollbackPlan,
    onRollbackResultChange: setV4RollbackResult,
    onUpdateErrorBudget: () => void updateV4ErrorBudget(),
    onTriggerRollbackDrill: () => void triggerV4RollbackDrill(),
    onRollbackDrillIdChange: setV4RollbackDrillId,
    onQueryRollbackDrill: () => void queryV4RollbackDrill()
  }
}
