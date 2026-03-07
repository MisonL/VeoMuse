import './helpers/dom-test-setup'
import React from 'react'
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render } from '@testing-library/react'
import CollabModePanel from '../apps/frontend/src/components/Editor/comparison-lab/modes/CollabModePanel'

const noop = () => {}

const createProps = (overrides: Record<string, unknown> = {}) =>
  ({
    isAuthenticated: true,
    workspaceName: 'VeoMuse 协作空间',
    workspaceOwner: 'Owner',
    workspaceId: '',
    projectId: '',
    inviteRole: 'editor',
    memberName: 'Editor A',
    collabRole: 'editor',
    inviteCode: '',
    invites: [],
    isWsConnected: false,
    presence: [],
    collabEvents: [],
    snapshots: [],
    uploadFileName: 'demo.mp4',
    uploadToken: '',
    commentThreads: [],
    commentThreadCursor: '',
    commentThreadLimit: '20',
    commentThreadHasMore: false,
    commentAnchor: '',
    commentContent: '',
    commentMentions: '',
    selectedThreadId: '',
    commentReplyContent: '',
    commentReplyMentions: '',
    projectComments: [],
    projectCommentCursor: '',
    projectCommentLimit: '20',
    projectCommentHasMore: false,
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
    permissions: [],
    permissionSubjectId: '',
    permissionRole: 'viewer',
    timelineMergeResult: null,
    errorBudget: null,
    errorBudgetScope: 'global',
    errorBudgetTargetSlo: '0.99',
    errorBudgetWindowDays: '30',
    errorBudgetWarningThresholdRatio: '0.7',
    errorBudgetAlertThresholdRatio: '0.9',
    errorBudgetFreezeDeployOnBreach: false,
    adminToken: '',
    reliabilityAlertLevel: 'all',
    reliabilityAlertStatus: 'all',
    reliabilityAlertLimit: '20',
    reliabilityAlerts: [],
    rollbackPolicyId: '',
    rollbackEnvironment: 'staging',
    rollbackTriggerType: 'manual',
    rollbackSummary: 'Triggered from comparison-lab',
    rollbackPlan: '{"steps":[]}',
    rollbackResult: '{}',
    rollbackDrillId: '',
    rollbackDrillResult: null,
    isV4Busy: false,
    isOpsBusy: false,
    isProjectGovernanceBusy: false,
    onWorkspaceNameChange: noop,
    onWorkspaceOwnerChange: noop,
    onCreateWorkspace: noop,
    onRefreshWorkspaceState: noop,
    onInviteRoleChange: noop,
    onMemberNameChange: noop,
    onCollabRoleChange: noop,
    onInviteCodeChange: noop,
    onCreateInvite: noop,
    onAcceptInvite: noop,
    onConnectWs: noop,
    onDisconnectWs: noop,
    onSendCollabEvent: noop,
    onCreateSnapshot: noop,
    onUploadFileNameChange: noop,
    onRequestUploadToken: noop,
    onRefreshCommentThreads: noop,
    onLoadMoreCommentThreads: noop,
    onCommentThreadLimitChange: noop,
    onCommentAnchorChange: noop,
    onCommentContentChange: noop,
    onCommentMentionsChange: noop,
    onSelectedThreadIdChange: noop,
    onCommentReplyContentChange: noop,
    onCommentReplyMentionsChange: noop,
    onCreateCommentThread: noop,
    onReplyCommentThread: noop,
    onResolveCommentThread: noop,
    onRefreshProjectComments: noop,
    onLoadMoreProjectComments: noop,
    onProjectCommentLimitChange: noop,
    onProjectCommentAnchorChange: noop,
    onProjectCommentContentChange: noop,
    onProjectCommentMentionsChange: noop,
    onProjectSelectedCommentIdChange: noop,
    onCreateProjectComment: noop,
    onResolveProjectComment: noop,
    onRefreshProjectReviews: noop,
    onProjectReviewLimitChange: noop,
    onProjectReviewDecisionChange: noop,
    onProjectReviewSummaryChange: noop,
    onProjectReviewScoreChange: noop,
    onCreateProjectReview: noop,
    onRefreshProjectTemplates: noop,
    onProjectSelectedTemplateIdChange: noop,
    onProjectTemplateApplyOptionsChange: noop,
    onApplyProjectTemplate: noop,
    onProjectClipBatchOperationsChange: noop,
    onBatchUpdateProjectClips: noop,
    onRefreshPermissions: noop,
    onPermissionSubjectIdChange: noop,
    onPermissionRoleChange: noop,
    onUpdatePermission: noop,
    onMergeTimeline: noop,
    onAdminTokenChange: noop,
    onReliabilityAlertLevelChange: noop,
    onReliabilityAlertStatusChange: noop,
    onReliabilityAlertLimitChange: noop,
    onLoadReliabilityAlerts: noop,
    onAcknowledgeReliabilityAlert: noop,
    onLoadErrorBudget: noop,
    onErrorBudgetScopeChange: noop,
    onErrorBudgetTargetSloChange: noop,
    onErrorBudgetWindowDaysChange: noop,
    onErrorBudgetWarningThresholdRatioChange: noop,
    onErrorBudgetAlertThresholdRatioChange: noop,
    onErrorBudgetFreezeDeployOnBreachChange: noop,
    onRollbackPolicyIdChange: noop,
    onRollbackEnvironmentChange: noop,
    onRollbackTriggerTypeChange: noop,
    onRollbackSummaryChange: noop,
    onRollbackPlanChange: noop,
    onRollbackResultChange: noop,
    onUpdateErrorBudget: noop,
    onTriggerRollbackDrill: noop,
    onRollbackDrillIdChange: noop,
    onQueryRollbackDrill: noop,
    ...overrides
  }) as any

describe('CollabModePanel DOM 组件回归', () => {
  afterEach(() => {
    cleanup()
  })

  it('空态应渲染关键卡片与默认提示', () => {
    const view = render(<CollabModePanel {...createProps()} />)

    expect(view.getByTestId('area-collab-shell')).toBeInTheDocument()
    expect(view.getByTestId('area-collab-live-grid')).toBeInTheDocument()
    expect(view.getByTestId('area-realtime-channel-hero')).toBeInTheDocument()
    expect(view.getByTestId('area-comment-threads-desk')).toBeInTheDocument()
    expect(view.getByTestId('collab-advanced-watchboard')).toBeInTheDocument()
    expect(view.getByText('团队空间')).toBeInTheDocument()
    expect(view.getByText('邀请与加入')).toBeInTheDocument()
    expect(view.getByText('多人协同通道')).toBeInTheDocument()
    expect(view.getByText('v4 评论线程')).toBeInTheDocument()
    fireEvent.click(view.getByTestId('btn-toggle-advanced-sections'))
    expect(view.getByTestId('project-governance-watchboard')).toBeInTheDocument()
    expect(view.getByTestId('ops-watchboard')).toBeInTheDocument()
    expect(view.getByTestId('permission-merge-watchboard')).toBeInTheDocument()
    expect(view.getByTestId('storage-snapshot-watchboard')).toBeInTheDocument()
    expect(view.getByText('评论处理')).toBeInTheDocument()
    expect(view.getAllByText('评审决策').length).toBeGreaterThan(0)
    expect(view.getByText('模板下发')).toBeInTheDocument()
    expect(view.getByText('片段批量更新')).toBeInTheDocument()
    expect(view.getByText('告警值班')).toBeInTheDocument()
    expect(view.getAllByText('错误预算').length).toBeGreaterThan(0)
    expect(view.getAllByText('回滚演练').length).toBeGreaterThan(0)
    expect(view.getByText('项目治理闭环')).toBeInTheDocument()
    expect(view.getByText('运维工具')).toBeInTheDocument()
    expect(view.getAllByText('暂无邀请记录').length).toBe(1)
    expect(view.getAllByText('暂无评论线程').length).toBe(1)
    expect(view.getAllByText('暂无可靠性告警').length).toBe(1)
    expect(view.getAllByText('暂无项目快照').length).toBe(1)
  })

  it('非空态应渲染列表并触发关键操作回调', () => {
    const onCreateWorkspace = mock(() => {})
    const onCreateInvite = mock(() => {})
    const onLoadReliabilityAlerts = mock(() => {})
    const onAcknowledgeReliabilityAlert = mock((_alertId: string) => {})
    const onUpdatePermission = mock(() => {})
    const onBatchUpdateProjectClips = mock(() => {})

    const view = render(
      <CollabModePanel
        {...createProps({
          isAuthenticated: true,
          workspaceId: 'ws_1',
          projectId: 'project_1',
          collabRole: 'owner',
          inviteCode: 'INVITE-1',
          invites: [{ id: 'i1', code: 'INVITE-1', role: 'editor', status: 'active' }],
          isWsConnected: true,
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
              payload: { clips: 1 },
              createdAt: new Date().toISOString()
            }
          ],
          commentThreads: [
            {
              id: 'pc_1',
              projectId: 'project_1',
              anchor: 'timeline:1.2s',
              content: '请优化节奏',
              mentions: ['qa'],
              createdBy: 'owner_1',
              status: 'open',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              replyCount: 0
            }
          ],
          projectComments: [
            {
              id: 'c_1',
              projectId: 'project_1',
              anchor: 'timeline:2.0s',
              content: '增加过渡镜头',
              mentions: ['editor'],
              createdBy: 'owner_1',
              status: 'open',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              replyCount: 0
            }
          ],
          projectReviews: [
            {
              id: 'r_1',
              projectId: 'project_1',
              decision: 'approved',
              summary: '可发布',
              score: 9.2,
              createdBy: 'owner_1',
              createdAt: new Date().toISOString()
            }
          ],
          projectTemplates: [
            {
              id: 'tpl_1',
              projectId: 'project_1',
              name: '快节奏模板',
              description: '适配短视频节奏',
              payload: {},
              createdBy: 'owner_1',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ],
          projectClipBatchResult: {
            requested: 2,
            accepted: 2,
            skipped: 0,
            rejected: 0,
            updated: 2
          },
          permissions: [
            {
              workspaceId: 'ws_1',
              role: 'viewer',
              permissions: { 'timeline.merge': false },
              updatedBy: 'owner_1',
              updatedAt: new Date().toISOString()
            }
          ],
          permissionSubjectId: 'timeline.merge',
          timelineMergeResult: {
            id: 'merge_1',
            projectId: 'project_1',
            sourceRevision: 'rev-a',
            targetRevision: 'rev-b',
            status: 'merged',
            conflicts: [],
            result: {},
            createdBy: 'owner_1',
            createdAt: new Date().toISOString()
          },
          errorBudget: {
            policy: {
              id: 'policy_1',
              scope: 'global',
              targetSlo: 0.99,
              windowDays: 30,
              warningThresholdRatio: 0.7,
              alertThresholdRatio: 0.9,
              freezeDeployOnBreach: false,
              updatedBy: 'owner_1',
              updatedAt: new Date().toISOString()
            },
            evaluation: {
              asOf: new Date().toISOString(),
              totalRequests: 100,
              errorRequests: 1,
              observedSlo: 0.99,
              budgetRemaining: 0.01,
              budgetRemainingRatio: 0.8,
              burnRate: 0.2,
              status: 'healthy'
            }
          },
          reliabilityAlerts: [
            {
              id: 'rel_alert_1',
              level: 'critical',
              status: 'open',
              title: '错误预算告警',
              description: 'burn rate 过高',
              payload: {},
              triggeredAt: new Date().toISOString(),
              acknowledgedAt: null
            }
          ],
          adminToken: 'admin-token-demo',
          rollbackDrillResult: {
            id: 'drill_1',
            policyId: 'policy_1',
            environment: 'staging',
            triggerType: 'manual',
            summary: '演练完成',
            plan: {},
            status: 'completed',
            initiatedBy: 'owner_1',
            result: {},
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString()
          },
          snapshots: [{ id: 'snap_1', actorName: 'owner_1', createdAt: new Date().toISOString() }],
          onCreateWorkspace,
          onCreateInvite,
          onLoadReliabilityAlerts,
          onAcknowledgeReliabilityAlert,
          onUpdatePermission,
          onBatchUpdateProjectClips
        })}
      />
    )

    fireEvent.click(view.getByTestId('btn-toggle-advanced-sections'))

    expect(view.getByText('INVITE-1')).toBeInTheDocument()
    expect(view.getAllByText('Alice').length).toBeGreaterThan(0)
    expect(view.getByText('连接状态：已连接')).toBeInTheDocument()
    expect(view.getByText('请优化节奏')).toBeInTheDocument()
    expect(view.getByText('评论处理')).toBeInTheDocument()
    expect(view.getByText('告警值班')).toBeInTheDocument()
    expect(view.getByText('增加过渡镜头')).toBeInTheDocument()
    expect(view.getAllByText('快节奏模板').length).toBeGreaterThan(0)
    expect(view.getByText('错误预算告警')).toBeInTheDocument()
    expect(view.getByText('snap_1')).toBeInTheDocument()
    expect(view.getByText('merge_1')).toBeInTheDocument()
    expect(view.getByText('drill_1')).toBeInTheDocument()

    fireEvent.click(view.getByTestId('btn-create-workspace'))
    fireEvent.click(view.getByTestId('btn-create-invite'))
    fireEvent.click(view.getByText('查询告警'))
    fireEvent.click(view.getByText('ACK'))
    fireEvent.click(view.getByText('更新权限'))
    fireEvent.click(view.getByText('提交片段批量更新'))

    expect(onCreateWorkspace).toHaveBeenCalledTimes(1)
    expect(onCreateInvite).toHaveBeenCalledTimes(1)
    expect(onLoadReliabilityAlerts).toHaveBeenCalledTimes(1)
    expect(onAcknowledgeReliabilityAlert).toHaveBeenCalledTimes(1)
    expect(onAcknowledgeReliabilityAlert).toHaveBeenCalledWith('rel_alert_1')
    expect(onUpdatePermission).toHaveBeenCalledTimes(1)
    expect(onBatchUpdateProjectClips).toHaveBeenCalledTimes(1)
  })

  it('未登录态应禁用创建工作区按钮并展示提示', () => {
    const view = render(
      <CollabModePanel
        {...createProps({
          isAuthenticated: false
        })}
      />
    )

    const createWorkspaceBtn = view.getByTestId('btn-create-workspace')
    expect(createWorkspaceBtn).toBeDisabled()
    expect(createWorkspaceBtn).toHaveAttribute('title', '请先登录后再创建工作区')
  })
})
