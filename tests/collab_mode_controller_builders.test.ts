import { describe, expect, it, mock } from 'bun:test'
import {
  buildCollabBusyStateProps,
  buildCollabCommentThreadProps,
  buildCollabGovernanceProps,
  buildCollabOpsProps,
  buildCollabWorkspaceProps
} from '../apps/frontend/src/components/Editor/comparison-lab/hooks/useCollabModeController'

describe('CollabModeController builders', () => {
  it('workspace builder 应保持协作主路径接线', () => {
    const createWorkspace = mock(() => Promise.resolve())
    const requestUploadToken = mock(() => Promise.resolve())
    const sendCollabEvent = mock((_type: 'timeline.patch' | 'project.patch' | 'cursor.update') => {})

    const workspaceProps = buildCollabWorkspaceProps({
      authProfile: { id: 'user_1', email: 'boss@example.com' } as any,
      workspaceName: 'VeoMuse 协作空间',
      setWorkspaceName: mock(() => {}),
      workspaceOwner: 'Owner',
      setWorkspaceOwner: mock(() => {}),
      workspaceId: 'ws_1',
      projectId: 'project_1',
      inviteRole: 'editor',
      setInviteRole: mock(() => {}),
      memberName: 'Editor A',
      setMemberName: mock(() => {}),
      collabRole: 'owner',
      setCollabRole: mock(() => {}),
      inviteCode: 'INVITE-1',
      setInviteCode: mock(() => {}),
      uploadFileName: 'demo.mp4',
      setUploadFileName: mock(() => {}),
      workspaceCollaborationController: {
        invites: [{ id: 'invite_1', code: 'INVITE-1', role: 'editor', status: 'active' }],
        presence: [],
        collabEvents: [],
        snapshots: [],
        uploadToken: 'upload-token',
        isWsConnected: true,
        refreshWorkspaceState: mock(() => Promise.resolve()),
        createWorkspace,
        createInvite: mock(() => Promise.resolve()),
        acceptInvite: mock(() => Promise.resolve()),
        createSnapshot: mock(() => Promise.resolve()),
        requestUploadToken,
        connectWs: mock(() => {}),
        disconnectWs: mock(() => {}),
        sendCollabEvent
      } as Parameters<typeof buildCollabWorkspaceProps>[0]['workspaceCollaborationController']
    })

    workspaceProps.onCreateWorkspace()
    workspaceProps.onRequestUploadToken()
    workspaceProps.onSendCollabEvent('timeline.patch')

    expect(workspaceProps.isAuthenticated).toBe(true)
    expect(workspaceProps.uploadToken).toBe('upload-token')
    expect(createWorkspace).toHaveBeenCalledTimes(1)
    expect(requestUploadToken).toHaveBeenCalledTimes(1)
    expect(sendCollabEvent).toHaveBeenCalledWith('timeline.patch')
  })

  it('评论、治理、运维 builder 应保持 wrapper 语义与忙碌态', () => {
    const loadProjectComments = mock((_append: boolean) => Promise.resolve())
    const acknowledgeReliabilityAlert = mock((_alertId: string) => Promise.resolve())

    const commentThreadProps = buildCollabCommentThreadProps({
      v4CommentThreads: [],
      v4CommentThreadCursor: '',
      v4CommentThreadLimit: '20',
      v4CommentThreadHasMore: false,
      v4CommentAnchor: '',
      v4CommentContent: '',
      v4CommentMentions: '',
      v4SelectedThreadId: '',
      v4CommentReplyContent: '',
      v4CommentReplyMentions: '',
      setV4CommentThreadLimit: mock(() => {}),
      setV4CommentAnchor: mock(() => {}),
      setV4CommentContent: mock(() => {}),
      setV4CommentMentions: mock(() => {}),
      setV4SelectedThreadId: mock(() => {}),
      setV4CommentReplyContent: mock(() => {}),
      setV4CommentReplyMentions: mock(() => {}),
      refreshV4CommentThreads: mock(() => Promise.resolve()),
      loadMoreV4CommentThreads: mock(() => Promise.resolve()),
      createV4CommentThread: mock(() => Promise.resolve()),
      replyV4CommentThread: mock(() => Promise.resolve()),
      resolveV4CommentThread: mock(() => Promise.resolve())
    } as Parameters<typeof buildCollabCommentThreadProps>[0])
    const governanceProps = buildCollabGovernanceProps({
      projectComments: [],
      projectCommentCursor: 'cursor_1',
      projectCommentLimit: '20',
      projectCommentHasMore: true,
      projectCommentAnchor: '',
      projectCommentContent: '',
      projectCommentMentions: '',
      projectSelectedCommentId: '',
      projectReviews: [],
      projectReviewLimit: '20',
      projectReviewDecision: 'approved',
      projectReviewSummary: '',
      projectReviewScore: '',
      projectTemplates: [],
      projectSelectedTemplateId: '',
      projectTemplateApplyOptions: '{}',
      projectTemplateApplyResult: null,
      projectClipBatchOperations: '[]',
      projectClipBatchResult: null,
      isProjectGovernanceBusy: false,
      setProjectCommentLimit: mock(() => {}),
      setProjectCommentAnchor: mock(() => {}),
      setProjectCommentContent: mock(() => {}),
      setProjectCommentMentions: mock(() => {}),
      setProjectSelectedCommentId: mock(() => {}),
      setProjectReviewLimit: mock(() => {}),
      setProjectReviewDecision: mock(() => {}),
      setProjectReviewSummary: mock(() => {}),
      setProjectReviewScore: mock(() => {}),
      setProjectSelectedTemplateId: mock(() => {}),
      setProjectTemplateApplyOptions: mock(() => {}),
      setProjectClipBatchOperations: mock(() => {}),
      loadProjectComments,
      createProjectCommentEntry: mock(() => Promise.resolve()),
      resolveProjectCommentEntry: mock(() => Promise.resolve()),
      loadProjectReviews: mock(() => Promise.resolve()),
      createProjectReviewEntry: mock(() => Promise.resolve()),
      loadProjectTemplates: mock(() => Promise.resolve()),
      applyProjectTemplateEntry: mock(() => Promise.resolve()),
      batchUpdateProjectClipsEntry: mock(() => Promise.resolve())
    } as Parameters<typeof buildCollabGovernanceProps>[0])
    const opsProps = buildCollabOpsProps({
      v4Permissions: [],
      v4PermissionSubjectId: '',
      v4PermissionRole: 'viewer',
      v4TimelineMergeResult: null,
      v4ErrorBudget: null,
      v4ReliabilityAlerts: [],
      v4ReliabilityAlertLevel: 'all',
      v4ReliabilityAlertStatus: 'all',
      v4ReliabilityAlertLimit: '20',
      v4ErrorBudgetScope: 'global',
      v4ErrorBudgetTargetSlo: '0.99',
      v4ErrorBudgetWindowDays: '30',
      v4ErrorBudgetWarningThresholdRatio: '0.7',
      v4ErrorBudgetAlertThresholdRatio: '0.9',
      v4ErrorBudgetFreezeDeployOnBreach: false,
      v4RollbackPolicyId: '',
      v4RollbackEnvironment: 'staging',
      v4RollbackTriggerType: 'manual',
      v4RollbackSummary: '',
      v4RollbackPlan: '{}',
      v4RollbackResult: '{}',
      v4RollbackDrillId: '',
      v4RollbackDrillResult: null,
      v4AdminToken: '',
      isV4CollabBusy: false,
      isV4OpsBusy: false,
      setV4PermissionSubjectId: mock(() => {}),
      setV4PermissionRole: mock(() => {}),
      setV4AdminToken: mock(() => {}),
      setIsV4CollabBusy: mock(() => {}),
      setV4ReliabilityAlertLevel: mock(() => {}),
      setV4ReliabilityAlertStatus: mock(() => {}),
      setV4ReliabilityAlertLimit: mock(() => {}),
      setV4ErrorBudgetScope: mock(() => {}),
      setV4ErrorBudgetTargetSlo: mock(() => {}),
      setV4ErrorBudgetWindowDays: mock(() => {}),
      setV4ErrorBudgetWarningThresholdRatio: mock(() => {}),
      setV4ErrorBudgetAlertThresholdRatio: mock(() => {}),
      setV4ErrorBudgetFreezeDeployOnBreach: mock(() => {}),
      setV4RollbackPolicyId: mock(() => {}),
      setV4RollbackEnvironment: mock(() => {}),
      setV4RollbackTriggerType: mock(() => {}),
      setV4RollbackSummary: mock(() => {}),
      setV4RollbackPlan: mock(() => {}),
      setV4RollbackResult: mock(() => {}),
      setV4RollbackDrillId: mock(() => {}),
      refreshV4Permissions: mock(() => Promise.resolve()),
      updateV4Permission: mock(() => Promise.resolve()),
      mergeV4Timeline: mock(() => Promise.resolve()),
      loadV4ReliabilityAlerts: mock(() => Promise.resolve()),
      acknowledgeV4ReliabilityAlert: acknowledgeReliabilityAlert,
      loadV4ErrorBudget: mock(() => Promise.resolve()),
      updateV4ErrorBudget: mock(() => Promise.resolve()),
      triggerV4RollbackDrill: mock(() => Promise.resolve()),
      queryV4RollbackDrill: mock(() => Promise.resolve())
    } as Parameters<typeof buildCollabOpsProps>[0])

    commentThreadProps.onCreateCommentThread()
    governanceProps.onLoadMoreProjectComments()
    opsProps.onAcknowledgeReliabilityAlert('alert_1')

    expect(commentThreadProps.commentThreadLimit).toBe('20')
    expect(governanceProps.projectCommentCursor).toBe('cursor_1')
    expect(loadProjectComments).toHaveBeenCalledWith(true)
    expect(acknowledgeReliabilityAlert).toHaveBeenCalledWith('alert_1')
    expect(
      buildCollabBusyStateProps({
        isV4Busy: true,
        isOpsBusy: false,
        isProjectGovernanceBusy: true
      })
    ).toEqual({
      isV4Busy: true,
      isOpsBusy: false,
      isProjectGovernanceBusy: true
    })
  })
})
