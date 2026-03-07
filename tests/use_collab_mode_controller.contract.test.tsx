import './helpers/dom-test-setup'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { act, cleanup, render } from '@testing-library/react'
import { useCollabModeController } from '../apps/frontend/src/components/Editor/comparison-lab/hooks/useCollabModeController'
import * as workspaceCollaborationModule from '../apps/frontend/src/components/Editor/comparison-lab/hooks/useWorkspaceCollaborationManager'
import * as commentThreadsModule from '../apps/frontend/src/components/Editor/comparison-lab/hooks/useV4CommentThreads'
import * as opsModule from '../apps/frontend/src/components/Editor/comparison-lab/hooks/useV4OpsManager'
import * as governanceModule from '../apps/frontend/src/components/Editor/comparison-lab/hooks/useProjectGovernance'

describe('useCollabModeController contract', () => {
  const originalConfirm = window.confirm
  let workspaceSpy: ReturnType<typeof spyOn>
  let commentsSpy: ReturnType<typeof spyOn>
  let opsSpy: ReturnType<typeof spyOn>
  let governanceSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    window.confirm = () => true
    workspaceSpy = spyOn(workspaceCollaborationModule, 'useWorkspaceCollaborationManager').mockReturnValue({
      invites: [{ id: 'invite_1', code: 'INVITE-1', role: 'editor', status: 'active' }],
      presence: [],
      collabEvents: [{ id: 'evt_1', workspaceId: 'ws_1', projectId: 'project_1', actorId: 'u1', actorName: 'Alice', eventType: 'timeline.patch', payload: {}, createdAt: new Date().toISOString() }],
      snapshots: [{ id: 'snap_1', actorName: 'Alice', createdAt: new Date().toISOString() }],
      uploadToken: 'upload-token',
      isWsConnected: true,
      refreshWorkspaceState: mock(() => Promise.resolve()),
      createWorkspace: mock(() => Promise.resolve()),
      createInvite: mock(() => Promise.resolve()),
      acceptInvite: mock(() => Promise.resolve()),
      createSnapshot: mock(() => Promise.resolve()),
      requestUploadToken: mock(() => Promise.resolve()),
      connectWs: mock(() => {}),
      disconnectWs: mock(() => {}),
      sendCollabEvent: mock((_type: 'timeline.patch' | 'project.patch' | 'cursor.update') => {})
    } as any)
    commentsSpy = spyOn(commentThreadsModule, 'useV4CommentThreads').mockReturnValue({
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
      loadMoreV4CommentThreads: mock(() => Promise.resolve()),
      createV4CommentThread: mock(() => Promise.resolve()),
      replyV4CommentThread: mock(() => Promise.resolve()),
      resolveV4CommentThread: mock(() => Promise.resolve())
    } as any)
    opsSpy = spyOn(opsModule, 'useV4OpsManager').mockReturnValue({
      v4Permissions: [],
      v4PermissionSubjectId: 'timeline.merge=true',
      v4PermissionRole: 'owner',
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
      acknowledgeV4ReliabilityAlert: mock((_alertId: string) => Promise.resolve()),
      loadV4ErrorBudget: mock(() => Promise.resolve()),
      updateV4ErrorBudget: mock(() => Promise.resolve()),
      triggerV4RollbackDrill: mock(() => Promise.resolve()),
      queryV4RollbackDrill: mock(() => Promise.resolve())
    } as any)
    governanceSpy = spyOn(governanceModule, 'useProjectGovernance').mockReturnValue({
      projectComments: [],
      projectCommentCursor: 'cursor-comment',
      projectCommentLimit: '20',
      projectCommentHasMore: true,
      projectCommentAnchor: 'timeline:2.0',
      projectCommentContent: 'governance-comment',
      projectCommentMentions: 'qa',
      projectSelectedCommentId: 'comment_1',
      projectReviews: [],
      projectReviewLimit: '20',
      projectReviewDecision: 'approved',
      projectReviewSummary: '',
      projectReviewScore: '',
      projectTemplates: [],
      projectSelectedTemplateId: 'template_1',
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
      loadProjectComments: mock((_append: boolean) => Promise.resolve()),
      createProjectCommentEntry: mock(() => Promise.resolve()),
      resolveProjectCommentEntry: mock(() => Promise.resolve()),
      loadProjectReviews: mock(() => Promise.resolve()),
      createProjectReviewEntry: mock(() => Promise.resolve()),
      loadProjectTemplates: mock(() => Promise.resolve()),
      applyProjectTemplateEntry: mock(() => Promise.resolve()),
      batchUpdateProjectClipsEntry: mock(() => Promise.resolve())
    } as any)
  })

  afterEach(() => {
    cleanup()
    workspaceSpy.mockRestore()
    commentsSpy.mockRestore()
    opsSpy.mockRestore()
    governanceSpy.mockRestore()
    window.confirm = originalConfirm
  })

  it('应保持 flat props contract 与关键 wrapper 接线', async () => {
    let controller: ReturnType<typeof useCollabModeController> | null = null

    const Harness = () => {
      controller = useCollabModeController({
        authProfile: { id: 'user_1', email: 'boss@example.com' },
        workspaceName: 'VeoMuse 协作空间',
        setWorkspaceName: mock(() => {}),
        workspaceOwner: 'Owner',
        setWorkspaceOwner: mock(() => {}),
        workspaceId: 'ws_1',
        setWorkspaceId: mock(() => {}),
        projectId: 'project_1',
        setProjectId: mock(() => {}),
        memberName: 'Editor A',
        setMemberName: mock(() => {}),
        collabRole: 'owner',
        setCollabRole: mock(() => {}),
        inviteRole: 'editor',
        setInviteRole: mock(() => {}),
        inviteCode: 'INVITE-1',
        setInviteCode: mock(() => {}),
        uploadFileName: 'demo.mp4',
        setUploadFileName: mock(() => {}),
        effectiveOrganizationId: 'org_1',
        selectOrganization: mock(() => {}),
        labMode: 'collab',
        openChannelPanel: mock(() => {}),
        showToast: mock(() => {}),
        markJourneyStep: mock(() => {}),
        reportJourney: mock(() => Promise.resolve(true))
      })
      return null
    }

    render(<Harness />)

    expect(controller?.workspaceId).toBe('ws_1')
    expect(controller?.projectId).toBe('project_1')
    expect(controller?.uploadToken).toBe('upload-token')
    expect(controller?.commentThreadCursor).toBe('cursor-thread')
    expect(controller?.projectCommentCursor).toBe('cursor-comment')
    expect(controller?.permissionSubjectId).toBe('timeline.merge=true')
    expect(controller?.isV4Busy).toBe(true)
    expect(controller?.isOpsBusy).toBe(false)
    expect(controller?.isProjectGovernanceBusy).toBe(true)

    await act(async () => {
      controller?.onLoadMoreProjectComments()
      controller?.onAcknowledgeReliabilityAlert('alert_1')
      controller?.onCreateWorkspace()
      controller?.onRequestUploadToken()
    })

    const governanceReturn = governanceSpy.mock.results[0]?.value as any
    const opsReturn = opsSpy.mock.results[0]?.value as any
    const workspaceReturn = workspaceSpy.mock.results[0]?.value as any

    expect(governanceReturn.loadProjectComments).toHaveBeenCalledWith(true)
    expect(opsReturn.acknowledgeV4ReliabilityAlert).toHaveBeenCalledWith('alert_1')
    expect(workspaceReturn.createWorkspace).toHaveBeenCalledTimes(1)
    expect(workspaceReturn.requestUploadToken).toHaveBeenCalledTimes(1)
  })
})
