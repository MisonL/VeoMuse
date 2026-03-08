import { describe, expect, it, mock } from 'bun:test'
import {
  buildCollabAdvancedSectionsProps,
  buildCollabCommentThreadProps,
  buildCollabInviteJoinSectionProps,
  buildCollabRealtimeChannelSectionProps,
  buildCollabWorkspaceProps
} from '../apps/frontend/src/components/Editor/comparison-lab/hooks/useCollabModeController'

describe('CollabModeController builders', () => {
  it('workspace、invite 与 realtime builder 应保持协作主路径接线', () => {
    const createWorkspace = mock(() => Promise.resolve())
    const createInvite = mock(() => Promise.resolve())
    const sendCollabEvent = mock(
      (_type: 'timeline.patch' | 'project.patch' | 'cursor.update') => {}
    )

    const workspaceCollaborationController = {
      invites: [{ id: 'invite_1', code: 'INVITE-1', role: 'editor', status: 'active' }],
      presence: [
        {
          workspaceId: 'ws_1',
          sessionId: 'sess_1',
          memberId: 'mem_1',
          memberName: 'Alice',
          role: 'owner',
          status: 'online',
          lastSeenAt: new Date().toISOString()
        }
      ],
      collabEvents: [
        {
          id: 'evt_1',
          workspaceId: 'ws_1',
          projectId: 'project_1',
          actorId: 'owner_1',
          actorName: 'Alice',
          eventType: 'timeline.patch',
          payload: {},
          createdAt: new Date().toISOString()
        }
      ],
      snapshots: [],
      uploadToken: 'upload-token',
      isWorkspaceCreating: false,
      isWsConnected: true,
      isWsConnecting: false,
      refreshWorkspaceState: mock(() => Promise.resolve()),
      createWorkspace,
      createInvite,
      acceptInvite: mock(() => Promise.resolve()),
      createSnapshot: mock(() => Promise.resolve()),
      requestUploadToken: mock(() => Promise.resolve()),
      connectWs: mock(() => {}),
      disconnectWs: mock(() => {}),
      sendCollabEvent
    } as any

    const workspaceProps = buildCollabWorkspaceProps({
      authProfile: { id: 'user_1', email: 'boss@example.com' },
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
      workspaceCollaborationController
    })
    const inviteProps = buildCollabInviteJoinSectionProps({
      workspaceId: 'ws_1',
      inviteRole: 'editor',
      setInviteRole: mock(() => {}),
      memberName: 'Editor A',
      setMemberName: mock(() => {}),
      collabRole: 'owner',
      setCollabRole: mock(() => {}),
      inviteCode: 'INVITE-1',
      setInviteCode: mock(() => {}),
      workspaceCollaborationController
    })
    const realtimeProps = buildCollabRealtimeChannelSectionProps({
      workspaceId: 'ws_1',
      workspaceCollaborationController
    })

    workspaceProps.onCreateWorkspace()
    inviteProps.onCreateInvite()
    realtimeProps.onSendCollabEvent('timeline.patch')

    expect(workspaceProps.isAuthenticated).toBe(true)
    expect(workspaceProps.isWorkspaceCreating).toBe(false)
    expect(workspaceProps.workspaceId).toBe('ws_1')
    expect(workspaceProps.projectId).toBe('project_1')
    expect(inviteProps.invites).toHaveLength(1)
    expect(inviteProps.collabRole).toBe('owner')
    expect(realtimeProps.isWsConnected).toBe(true)
    expect(realtimeProps.isWsConnecting).toBe(false)
    expect(realtimeProps.presence).toHaveLength(1)
    expect(realtimeProps.collabEvents).toHaveLength(1)
    expect(createWorkspace).toHaveBeenCalledTimes(1)
    expect(createInvite).toHaveBeenCalledTimes(1)
    expect(sendCollabEvent).toHaveBeenCalledWith('timeline.patch')
  })

  it('comment thread builder 应保持线程状态与动作接线', () => {
    const loadMoreV4CommentThreads = mock(() => Promise.resolve())
    const resolveV4CommentThread = mock(() => Promise.resolve())

    const commentThreadProps = buildCollabCommentThreadProps(
      {
        v4CommentThreads: [],
        v4CommentThreadCursor: 'cursor-thread',
        v4CommentThreadLimit: '20',
        v4CommentThreadHasMore: true,
        v4CommentAnchor: 'timeline:1.0',
        v4CommentContent: 'comment',
        v4CommentMentions: 'qa',
        v4SelectedThreadId: 'thread_1',
        v4CommentReplyContent: 'reply',
        v4CommentReplyMentions: 'owner',
        setV4CommentThreadLimit: mock(() => {}),
        setV4CommentAnchor: mock(() => {}),
        setV4CommentContent: mock(() => {}),
        setV4CommentMentions: mock(() => {}),
        setV4SelectedThreadId: mock(() => {}),
        setV4CommentReplyContent: mock(() => {}),
        setV4CommentReplyMentions: mock(() => {}),
        refreshV4CommentThreads: mock(() => Promise.resolve()),
        loadMoreV4CommentThreads,
        createV4CommentThread: mock(() => Promise.resolve()),
        replyV4CommentThread: mock(() => Promise.resolve()),
        resolveV4CommentThread
      } as any,
      {
        projectId: 'project_1',
        isV4Busy: true
      }
    )

    commentThreadProps.onLoadMoreCommentThreads()
    commentThreadProps.onResolveCommentThread()

    expect(commentThreadProps.projectId).toBe('project_1')
    expect(commentThreadProps.commentThreadCursor).toBe('cursor-thread')
    expect(commentThreadProps.selectedThreadId).toBe('thread_1')
    expect(commentThreadProps.isV4Busy).toBe(true)
    expect(loadMoreV4CommentThreads).toHaveBeenCalledTimes(1)
    expect(resolveV4CommentThread).toHaveBeenCalledTimes(1)
  })

  it('advanced builder 应保持治理、权限、运维与快照 grouped 接线', () => {
    const loadProjectComments = mock((_append: boolean) => Promise.resolve())
    const acknowledgeV4ReliabilityAlert = mock((_alertId: string) => Promise.resolve())
    const requestUploadToken = mock(() => Promise.resolve())

    const advancedSectionsProps = buildCollabAdvancedSectionsProps({
      projectId: 'project_1',
      workspaceId: 'ws_1',
      uploadFileName: 'demo.mp4',
      setUploadFileName: mock(() => {}),
      workspaceCollaborationController: {
        invites: [],
        presence: [],
        collabEvents: [],
        snapshots: [],
        uploadToken: 'upload-token',
        isWorkspaceCreating: false,
        isWsConnected: false,
        isWsConnecting: false,
        refreshWorkspaceState: mock(() => Promise.resolve()),
        createWorkspace: mock(() => Promise.resolve()),
        createInvite: mock(() => Promise.resolve()),
        acceptInvite: mock(() => Promise.resolve()),
        createSnapshot: mock(() => Promise.resolve()),
        requestUploadToken,
        connectWs: mock(() => {}),
        disconnectWs: mock(() => {}),
        sendCollabEvent: mock(() => {})
      } as any,
      projectGovernanceController: {
        projectComments: [],
        projectCommentCursor: 'cursor-comment',
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
        isProjectGovernanceBusy: true,
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
      } as any,
      v4OpsController: {
        v4Permissions: [],
        v4PermissionSubjectId: 'timeline.merge=true',
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
        v4AdminToken: 'token',
        isV4CollabBusy: true,
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
        acknowledgeV4ReliabilityAlert,
        loadV4ErrorBudget: mock(() => Promise.resolve()),
        updateV4ErrorBudget: mock(() => Promise.resolve()),
        triggerV4RollbackDrill: mock(() => Promise.resolve()),
        queryV4RollbackDrill: mock(() => Promise.resolve())
      } as any
    })

    advancedSectionsProps.projectGovernanceProps.onLoadMoreProjectComments()
    advancedSectionsProps.opsToolsProps.onAcknowledgeReliabilityAlert('alert_1')
    advancedSectionsProps.storageSnapshotsProps.onRequestUploadToken()

    expect(advancedSectionsProps.projectGovernanceProps.projectId).toBe('project_1')
    expect(advancedSectionsProps.projectGovernanceProps.projectCommentCursor).toBe('cursor-comment')
    expect(advancedSectionsProps.projectGovernanceProps.isProjectGovernanceBusy).toBe(true)
    expect(advancedSectionsProps.permissionMergeProps.permissionSubjectId).toBe(
      'timeline.merge=true'
    )
    expect(advancedSectionsProps.permissionMergeProps.isV4Busy).toBe(true)
    expect(advancedSectionsProps.opsToolsProps.adminToken).toBe('token')
    expect(advancedSectionsProps.opsToolsProps.isOpsBusy).toBe(false)
    expect(advancedSectionsProps.storageSnapshotsProps.uploadToken).toBe('upload-token')
    expect(loadProjectComments).toHaveBeenCalledWith(true)
    expect(acknowledgeV4ReliabilityAlert).toHaveBeenCalledWith('alert_1')
    expect(requestUploadToken).toHaveBeenCalledTimes(1)
  })
})
