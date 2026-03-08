import { useCallback } from 'react'
import {
  parseJsonArrayInput as parseJsonArrayInputHelper,
  parseJsonObjectInput as parseJsonObjectInputHelper,
  parseMentionsInput
} from '../helpers'
import type {
  JourneyErrorKind,
  JourneyFailedStage,
  JourneyStep
} from '../../../../store/journeyTelemetryStore'
import type { AuthProfile, LabMode, WorkspaceRole } from '../types'
import type { CollabAdvancedSectionsProps } from '../modes/collab/CollabAdvancedSections'
import type { CommentThreadsSectionProps } from '../modes/collab/CommentThreadsSection'
import type { InviteJoinSectionProps } from '../modes/collab/InviteJoinSection'
import type { OpsToolsSectionProps } from '../modes/collab/OpsToolsSection'
import type { PermissionMergeSectionProps } from '../modes/collab/PermissionMergeSection'
import type { ProjectGovernanceSectionProps } from '../modes/collab/ProjectGovernanceSection'
import type { RealtimeChannelSectionProps } from '../modes/collab/RealtimeChannelSection'
import type { StorageSnapshotsSectionProps } from '../modes/collab/StorageSnapshotsSection'
import type { WorkspaceSectionProps } from '../modes/collab/WorkspaceSection'
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
type CollabWorkspaceProps = WorkspaceSectionProps
type CollabInviteJoinProps = InviteJoinSectionProps
type CollabRealtimeChannelProps = RealtimeChannelSectionProps
type CollabCommentThreadProps = CommentThreadsSectionProps
type CollabGovernanceProps = ProjectGovernanceSectionProps
type CollabPermissionMergeProps = PermissionMergeSectionProps
type CollabOpsProps = OpsToolsSectionProps
type CollabStorageSnapshotsProps = StorageSnapshotsSectionProps

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
  workspaceCollaborationController
}: BuildCollabWorkspacePropsOptions): CollabWorkspaceProps => ({
  isAuthenticated: Boolean(authProfile),
  workspaceName,
  workspaceOwner,
  workspaceId,
  projectId,
  onWorkspaceNameChange: setWorkspaceName,
  onWorkspaceOwnerChange: setWorkspaceOwner,
  onCreateWorkspace: () => void workspaceCollaborationController.createWorkspace(),
  onRefreshWorkspaceState: () => void workspaceCollaborationController.refreshWorkspaceState()
})

export const buildCollabInviteJoinSectionProps = ({
  workspaceId,
  inviteRole,
  setInviteRole,
  memberName,
  setMemberName,
  collabRole,
  setCollabRole,
  inviteCode,
  setInviteCode,
  workspaceCollaborationController
}: Pick<
  BuildCollabWorkspacePropsOptions,
  | 'workspaceId'
  | 'inviteRole'
  | 'setInviteRole'
  | 'memberName'
  | 'setMemberName'
  | 'collabRole'
  | 'setCollabRole'
  | 'inviteCode'
  | 'setInviteCode'
  | 'workspaceCollaborationController'
>): CollabInviteJoinProps => ({
  workspaceId,
  onInviteRoleChange: setInviteRole,
  inviteRole,
  onMemberNameChange: setMemberName,
  memberName,
  onCollabRoleChange: setCollabRole,
  collabRole,
  onInviteCodeChange: setInviteCode,
  inviteCode,
  invites: workspaceCollaborationController.invites,
  onCreateInvite: () => void workspaceCollaborationController.createInvite(),
  onAcceptInvite: () => void workspaceCollaborationController.acceptInvite()
})

export const buildCollabRealtimeChannelSectionProps = ({
  workspaceId,
  workspaceCollaborationController
}: Pick<
  BuildCollabWorkspacePropsOptions,
  'workspaceId' | 'workspaceCollaborationController'
>): CollabRealtimeChannelProps => ({
  workspaceId,
  isWsConnected: workspaceCollaborationController.isWsConnected,
  presence: workspaceCollaborationController.presence,
  collabEvents: workspaceCollaborationController.collabEvents,
  onConnectWs: workspaceCollaborationController.connectWs,
  onDisconnectWs: workspaceCollaborationController.disconnectWs,
  onSendCollabEvent: workspaceCollaborationController.sendCollabEvent
})

export const buildCollabCommentThreadProps = (
  commentThreadsController: V4CommentThreadsController,
  options: Pick<BuildCollabWorkspacePropsOptions, 'projectId'> & {
    isV4Busy: boolean
  }
): CollabCommentThreadProps => ({
  projectId: options.projectId,
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
  isV4Busy: options.isV4Busy,
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
  projectGovernanceController: ProjectGovernanceController,
  options: { projectId: string }
): CollabGovernanceProps => ({
  projectId: options.projectId,
  isProjectGovernanceBusy: projectGovernanceController.isProjectGovernanceBusy,
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

export const buildCollabOpsProps = (v4OpsController: V4OpsController): CollabOpsProps => ({
  isOpsBusy: v4OpsController.isV4OpsBusy,
  adminToken: v4OpsController.v4AdminToken,
  reliabilityAlertLevel: v4OpsController.v4ReliabilityAlertLevel,
  reliabilityAlertStatus: v4OpsController.v4ReliabilityAlertStatus,
  reliabilityAlertLimit: v4OpsController.v4ReliabilityAlertLimit,
  reliabilityAlerts: v4OpsController.v4ReliabilityAlerts,
  errorBudget: v4OpsController.v4ErrorBudget,
  errorBudgetScope: v4OpsController.v4ErrorBudgetScope,
  errorBudgetTargetSlo: v4OpsController.v4ErrorBudgetTargetSlo,
  errorBudgetWindowDays: v4OpsController.v4ErrorBudgetWindowDays,
  errorBudgetWarningThresholdRatio: v4OpsController.v4ErrorBudgetWarningThresholdRatio,
  errorBudgetAlertThresholdRatio: v4OpsController.v4ErrorBudgetAlertThresholdRatio,
  errorBudgetFreezeDeployOnBreach: v4OpsController.v4ErrorBudgetFreezeDeployOnBreach,
  rollbackPolicyId: v4OpsController.v4RollbackPolicyId,
  rollbackEnvironment: v4OpsController.v4RollbackEnvironment,
  rollbackTriggerType: v4OpsController.v4RollbackTriggerType,
  rollbackSummary: v4OpsController.v4RollbackSummary,
  rollbackPlan: v4OpsController.v4RollbackPlan,
  rollbackResult: v4OpsController.v4RollbackResult,
  rollbackDrillId: v4OpsController.v4RollbackDrillId,
  rollbackDrillResult: v4OpsController.v4RollbackDrillResult,
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

export const buildCollabPermissionMergeProps = (
  v4OpsController: V4OpsController,
  options: { workspaceId: string; projectId: string }
): CollabPermissionMergeProps => ({
  workspaceId: options.workspaceId,
  projectId: options.projectId,
  permissionSubjectId: v4OpsController.v4PermissionSubjectId,
  permissionRole: v4OpsController.v4PermissionRole,
  permissions: v4OpsController.v4Permissions,
  timelineMergeResult: v4OpsController.v4TimelineMergeResult,
  isV4Busy: v4OpsController.isV4CollabBusy,
  onRefreshPermissions: () => void v4OpsController.refreshV4Permissions(),
  onPermissionSubjectIdChange: v4OpsController.setV4PermissionSubjectId,
  onPermissionRoleChange: v4OpsController.setV4PermissionRole,
  onUpdatePermission: () => void v4OpsController.updateV4Permission(),
  onMergeTimeline: () => void v4OpsController.mergeV4Timeline()
})

export const buildCollabStorageSnapshotsProps = (
  workspaceCollaborationController: WorkspaceCollaborationController,
  options: Pick<
    BuildCollabWorkspacePropsOptions,
    'projectId' | 'workspaceId' | 'uploadFileName' | 'setUploadFileName'
  >
): CollabStorageSnapshotsProps => ({
  projectId: options.projectId,
  workspaceId: options.workspaceId,
  uploadFileName: options.uploadFileName,
  uploadToken: workspaceCollaborationController.uploadToken,
  snapshots: workspaceCollaborationController.snapshots,
  onCreateSnapshot: () => void workspaceCollaborationController.createSnapshot(),
  onRefreshWorkspaceState: () => void workspaceCollaborationController.refreshWorkspaceState(),
  onUploadFileNameChange: options.setUploadFileName,
  onRequestUploadToken: () => void workspaceCollaborationController.requestUploadToken()
})

export const buildCollabAdvancedSectionsProps = ({
  projectId,
  workspaceId,
  uploadFileName,
  setUploadFileName,
  workspaceCollaborationController,
  projectGovernanceController,
  v4OpsController
}: Pick<
  BuildCollabWorkspacePropsOptions,
  | 'projectId'
  | 'workspaceId'
  | 'uploadFileName'
  | 'setUploadFileName'
  | 'workspaceCollaborationController'
> & {
  projectGovernanceController: ProjectGovernanceController
  v4OpsController: V4OpsController
}): CollabAdvancedSectionsProps => ({
  projectGovernanceProps: buildCollabGovernanceProps(projectGovernanceController, { projectId }),
  permissionMergeProps: buildCollabPermissionMergeProps(v4OpsController, {
    workspaceId,
    projectId
  }),
  opsToolsProps: buildCollabOpsProps(v4OpsController),
  storageSnapshotsProps: buildCollabStorageSnapshotsProps(workspaceCollaborationController, {
    projectId,
    workspaceId,
    uploadFileName,
    setUploadFileName
  })
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
    workspaceSectionProps: buildCollabWorkspaceProps({
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
    inviteJoinSectionProps: buildCollabInviteJoinSectionProps({
      workspaceId,
      inviteRole,
      setInviteRole,
      memberName,
      setMemberName,
      collabRole,
      setCollabRole,
      inviteCode,
      setInviteCode,
      workspaceCollaborationController
    }),
    realtimeChannelSectionProps: buildCollabRealtimeChannelSectionProps({
      workspaceId,
      workspaceCollaborationController
    }),
    commentThreadsSectionProps: buildCollabCommentThreadProps(commentThreadsController, {
      projectId,
      isV4Busy: v4OpsController.isV4CollabBusy
    }),
    advancedSectionsProps: buildCollabAdvancedSectionsProps({
      projectId,
      workspaceId,
      uploadFileName,
      setUploadFileName,
      workspaceCollaborationController,
      projectGovernanceController,
      v4OpsController
    })
  }
}
