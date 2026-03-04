import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { useToastStore } from '../../store/toastStore'
import { useJourneyTelemetryStore } from '../../store/journeyTelemetryStore'
import { classifyRequestError } from '../../utils/requestError'
import {
  api,
  buildAuthHeaders,
  clearAuthSession,
  getAdminToken,
  getAccessToken,
  getOrganizationId,
  getRefreshToken,
  resolveApiBase,
  setAdminToken,
  setAccessToken,
  setOrganizationId,
  setRefreshToken
} from '../../utils/eden'
import {
  applyProjectGovernanceTemplate,
  batchUpdateProjectGovernanceClips,
  createProjectGovernanceComment,
  createProjectGovernanceReview,
  listProjectGovernanceComments,
  listProjectGovernanceReviews,
  listProjectGovernanceTemplates,
  normalizeProjectGovernanceLimit,
  resolveGeminiQuickCheck,
  resolveProjectGovernanceComment
} from './comparison-lab/types'
import type {
  AiChannelConfig,
  CollabEvent,
  CollabPresence,
  ComparisonLabProps,
  CreativeRun,
  LabMode,
  ModelRecommendation,
  Organization,
  OrganizationMember,
  OrganizationRole,
  OrganizationQuota,
  OrganizationUsage,
  PolicyPriority,
  QuotaFormState,
  RoutingDecision,
  RoutingExecution,
  RoutingPolicy,
  V4AssetReuseRecord,
  V4AssetReuseResult,
  V4BatchJob,
  V4CommentThread,
  V4ErrorBudget,
  V4PermissionGrant,
  V4ReliabilityAlert,
  V4ReliabilityAlertLevel,
  V4RollbackDrillResult,
  V4TimelineMergeResult,
  V4Workflow,
  V4WorkflowRun,
  WorkspaceInvite,
  WorkspaceRole,
  ProjectGovernanceClipBatchUpdateResult,
  ProjectGovernanceComment,
  ProjectGovernanceReview,
  ProjectGovernanceTemplate,
  ProjectGovernanceTemplateApplyResult,
  CapabilityPayload,
  AuthProfile,
  ChannelFormState,
  VideoGenerationCreatePayload,
  VideoGenerationJob,
  VideoGenerationJobStatus,
  VideoGenerationMode,
  VideoInputSourceType
} from './comparison-lab/types'
import { DEFAULT_POLICY_WEIGHTS, POLICY_EXEC_PAGE_SIZE } from './comparison-lab/constants'
import { requestJson, requestJsonWithRetry, requestV4, wsBaseFromApi } from './comparison-lab/api'
import LabToolbar from './comparison-lab/LabToolbar'
import CompareModePanel from './comparison-lab/modes/CompareModePanel'
import MarketplaceModePanel from './comparison-lab/modes/MarketplaceModePanel'
import CreativeModePanel from './comparison-lab/modes/CreativeModePanel'
import CollabModePanel from './comparison-lab/modes/CollabModePanel'
import ChannelAccessPanel from './comparison-lab/ChannelAccessPanel'
import './ComparisonLab.css'

const ComparisonLab: React.FC<ComparisonLabProps> = ({ onOpenAssets }) => {
  const allAssets = useEditorStore((state) => state.assets)
  const { showToast } = useToastStore()
  const markJourneyStep = useJourneyTelemetryStore((state) => state.markStep)
  const reportJourney = useJourneyTelemetryStore((state) => state.reportJourney)
  const resetJourney = useJourneyTelemetryStore((state) => state.resetJourney)

  const [labMode, setLabMode] = useState<LabMode>('compare')

  const [syncPlayback, setSyncPlayback] = useState(true)
  const [leftAssetId, setLeftAssetId] = useState<string>('')
  const [rightAssetId, setRightAssetId] = useState<string>('')
  const [leftModel, setLeftModel] = useState('veo-3.1')
  const [rightModel, setRightModel] = useState('kling-v1')
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string }>>([])
  const [marketplace, setMarketplace] = useState<Array<any>>([])

  const [policies, setPolicies] = useState<RoutingPolicy[]>([])
  const [isPolicyLoading, setIsPolicyLoading] = useState(false)
  const [isPolicySimulating, setIsPolicySimulating] = useState(false)
  const [selectedPolicyId, setSelectedPolicyId] = useState('')
  const [policyCreateName, setPolicyCreateName] = useState('默认创作策略')
  const [policyCreatePriority, setPolicyCreatePriority] = useState<PolicyPriority>('quality')
  const [policyCreateBudget, setPolicyCreateBudget] = useState(1.2)
  const [policyAllowedModels, setPolicyAllowedModels] = useState<string[]>([])
  const [policyWeights, setPolicyWeights] = useState(DEFAULT_POLICY_WEIGHTS)
  const [policyPrompt, setPolicyPrompt] = useState('')
  const [policyBudget, setPolicyBudget] = useState<number>(0.8)
  const [policyPriority, setPolicyPriority] = useState<PolicyPriority>('quality')
  const [policyDecision, setPolicyDecision] = useState<RoutingDecision | null>(null)
  const [policyExecutions, setPolicyExecutions] = useState<RoutingExecution[]>([])
  const [policyExecOffset, setPolicyExecOffset] = useState(0)
  const [policyExecHasMore, setPolicyExecHasMore] = useState(false)
  const [policyExecLoading, setPolicyExecLoading] = useState(false)

  const [creativeScript, setCreativeScript] = useState('')
  const [creativeStyle, setCreativeStyle] = useState('cinematic')
  const [creativeRun, setCreativeRun] = useState<CreativeRun | null>(null)
  const [creativeVersions, setCreativeVersions] = useState<CreativeRun[]>([])
  const [creativeRunFeedback, setCreativeRunFeedback] = useState('')
  const [sceneFeedbackMap, setSceneFeedbackMap] = useState<Record<string, string>>({})
  const [commitScore, setCommitScore] = useState<number>(0.9)
  const [isCreativeBusy, setIsCreativeBusy] = useState(false)
  const [videoGenerationMode, setVideoGenerationMode] =
    useState<VideoGenerationMode>('text_to_video')
  const [videoGenerationModelId, setVideoGenerationModelId] = useState('veo-3.1')
  const [videoGenerationPrompt, setVideoGenerationPrompt] = useState('')
  const [videoGenerationNegativePrompt, setVideoGenerationNegativePrompt] = useState('')
  const [videoGenerationInputSourceType, setVideoGenerationInputSourceType] =
    useState<VideoInputSourceType>('url')
  const [videoGenerationImageInput, setVideoGenerationImageInput] = useState('')
  const [videoGenerationReferenceImagesInput, setVideoGenerationReferenceImagesInput] = useState('')
  const [videoGenerationVideoInput, setVideoGenerationVideoInput] = useState('')
  const [videoGenerationFirstFrameInput, setVideoGenerationFirstFrameInput] = useState('')
  const [videoGenerationLastFrameInput, setVideoGenerationLastFrameInput] = useState('')
  const [videoGenerationListLimit, setVideoGenerationListLimit] = useState('20')
  const [videoGenerationStatusFilter, setVideoGenerationStatusFilter] = useState<
    'all' | VideoGenerationJobStatus
  >('all')
  const [videoGenerationJobs, setVideoGenerationJobs] = useState<VideoGenerationJob[]>([])
  const [videoGenerationCursor, setVideoGenerationCursor] = useState('')
  const [videoGenerationHasMore, setVideoGenerationHasMore] = useState(false)
  const [videoGenerationSelectedJobId, setVideoGenerationSelectedJobId] = useState('')
  const [videoGenerationPollingEnabled, setVideoGenerationPollingEnabled] = useState(true)
  const [isVideoGenerationBusy, setIsVideoGenerationBusy] = useState(false)
  const [v4Workflows, setV4Workflows] = useState<V4Workflow[]>([])
  const [v4SelectedWorkflowId, setV4SelectedWorkflowId] = useState('')
  const [v4WorkflowName, setV4WorkflowName] = useState('默认 Workflow')
  const [v4WorkflowDescription, setV4WorkflowDescription] = useState('')
  const [v4WorkflowRunPayload, setV4WorkflowRunPayload] = useState('{}')
  const [v4WorkflowRunResult, setV4WorkflowRunResult] = useState<V4WorkflowRun | null>(null)
  const [v4WorkflowRuns, setV4WorkflowRuns] = useState<V4WorkflowRun[]>([])
  const [v4WorkflowRunsCursor, setV4WorkflowRunsCursor] = useState('')
  const [v4WorkflowRunsLimit, setV4WorkflowRunsLimit] = useState('20')
  const [v4WorkflowRunsHasMore, setV4WorkflowRunsHasMore] = useState(false)
  const [v4BatchJobType, setV4BatchJobType] = useState('render.batch')
  const [v4BatchJobPayload, setV4BatchJobPayload] = useState('{"items":[]}')
  const [v4BatchJobId, setV4BatchJobId] = useState('')
  const [v4BatchJobStatus, setV4BatchJobStatus] = useState<V4BatchJob | null>(null)
  const [v4AssetReuseSourceId, setV4AssetReuseSourceId] = useState('')
  const [v4AssetReuseTargetId, setV4AssetReuseTargetId] = useState('')
  const [v4AssetReuseNote, setV4AssetReuseNote] = useState('')
  const [v4AssetReuseResult, setV4AssetReuseResult] = useState<V4AssetReuseResult | null>(null)
  const [v4AssetReuseHistoryAssetId, setV4AssetReuseHistoryAssetId] = useState('')
  const [v4AssetReuseHistorySourceProjectId, setV4AssetReuseHistorySourceProjectId] = useState('')
  const [v4AssetReuseHistoryTargetProjectId, setV4AssetReuseHistoryTargetProjectId] = useState('')
  const [v4AssetReuseHistoryLimit, setV4AssetReuseHistoryLimit] = useState('20')
  const [v4AssetReuseHistoryOffset, setV4AssetReuseHistoryOffset] = useState('0')
  const [v4AssetReuseHistoryRecords, setV4AssetReuseHistoryRecords] = useState<
    V4AssetReuseRecord[]
  >([])
  const [isV4CreativeBusy, setIsV4CreativeBusy] = useState(false)

  const [workspaceName, setWorkspaceName] = useState('VeoMuse 协作空间')
  const [workspaceOwner, setWorkspaceOwner] = useState('Owner')
  const [workspaceId, setWorkspaceId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [memberName, setMemberName] = useState('Editor A')
  const [collabRole, setCollabRole] = useState<WorkspaceRole>('editor')
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('editor')
  const [inviteCode, setInviteCode] = useState('')
  const [invites, setInvites] = useState<WorkspaceInvite[]>([])
  const [presence, setPresence] = useState<CollabPresence[]>([])
  const [collabEvents, setCollabEvents] = useState<CollabEvent[]>([])
  const [snapshots, setSnapshots] = useState<
    Array<{ id: string; actorName: string; createdAt: string }>
  >([])
  const [uploadFileName, setUploadFileName] = useState('demo.mp4')
  const [uploadToken, setUploadToken] = useState<string>('')
  const [isWsConnected, setIsWsConnected] = useState(false)
  const [v4CommentThreads, setV4CommentThreads] = useState<V4CommentThread[]>([])
  const [v4CommentThreadCursor, setV4CommentThreadCursor] = useState('')
  const [v4CommentThreadLimit, setV4CommentThreadLimit] = useState('20')
  const [v4CommentThreadHasMore, setV4CommentThreadHasMore] = useState(false)
  const [v4CommentAnchor, setV4CommentAnchor] = useState('')
  const [v4CommentContent, setV4CommentContent] = useState('')
  const [v4CommentMentions, setV4CommentMentions] = useState('')
  const [v4SelectedThreadId, setV4SelectedThreadId] = useState('')
  const [v4CommentReplyContent, setV4CommentReplyContent] = useState('')
  const [v4CommentReplyMentions, setV4CommentReplyMentions] = useState('')
  const [projectComments, setProjectComments] = useState<ProjectGovernanceComment[]>([])
  const [projectCommentCursor, setProjectCommentCursor] = useState('')
  const [projectCommentLimit, setProjectCommentLimit] = useState('20')
  const [projectCommentHasMore, setProjectCommentHasMore] = useState(false)
  const [projectCommentAnchor, setProjectCommentAnchor] = useState('')
  const [projectCommentContent, setProjectCommentContent] = useState('')
  const [projectCommentMentions, setProjectCommentMentions] = useState('')
  const [projectSelectedCommentId, setProjectSelectedCommentId] = useState('')
  const [projectReviews, setProjectReviews] = useState<ProjectGovernanceReview[]>([])
  const [projectReviewLimit, setProjectReviewLimit] = useState('20')
  const [projectReviewDecision, setProjectReviewDecision] =
    useState<ProjectGovernanceReview['decision']>('approved')
  const [projectReviewSummary, setProjectReviewSummary] = useState('')
  const [projectReviewScore, setProjectReviewScore] = useState('')
  const [projectTemplates, setProjectTemplates] = useState<ProjectGovernanceTemplate[]>([])
  const [projectSelectedTemplateId, setProjectSelectedTemplateId] = useState('')
  const [projectTemplateApplyOptions, setProjectTemplateApplyOptions] = useState('{}')
  const [projectTemplateApplyResult, setProjectTemplateApplyResult] =
    useState<ProjectGovernanceTemplateApplyResult | null>(null)
  const [projectClipBatchOperations, setProjectClipBatchOperations] = useState(
    '[\n  {"clipId":"clip-a","patch":{"start":0,"end":4}}\n]'
  )
  const [projectClipBatchResult, setProjectClipBatchResult] =
    useState<ProjectGovernanceClipBatchUpdateResult | null>(null)
  const [isProjectGovernanceBusy, setIsProjectGovernanceBusy] = useState(false)
  const [v4Permissions, setV4Permissions] = useState<V4PermissionGrant[]>([])
  const [v4PermissionSubjectId, setV4PermissionSubjectId] = useState('')
  const [v4PermissionRole, setV4PermissionRole] = useState<WorkspaceRole>('viewer')
  const [v4TimelineMergeResult, setV4TimelineMergeResult] = useState<V4TimelineMergeResult | null>(
    null
  )
  const [v4ErrorBudget, setV4ErrorBudget] = useState<V4ErrorBudget | null>(null)
  const [v4ReliabilityAlerts, setV4ReliabilityAlerts] = useState<V4ReliabilityAlert[]>([])
  const [v4ReliabilityAlertLevel, setV4ReliabilityAlertLevel] = useState<
    'all' | V4ReliabilityAlertLevel
  >('all')
  const [v4ReliabilityAlertStatus, setV4ReliabilityAlertStatus] = useState<
    'all' | V4ReliabilityAlert['status']
  >('all')
  const [v4ReliabilityAlertLimit, setV4ReliabilityAlertLimit] = useState('20')
  const [v4ErrorBudgetScope, setV4ErrorBudgetScope] = useState('global')
  const [v4ErrorBudgetTargetSlo, setV4ErrorBudgetTargetSlo] = useState('0.99')
  const [v4ErrorBudgetWindowDays, setV4ErrorBudgetWindowDays] = useState('30')
  const [v4ErrorBudgetWarningThresholdRatio, setV4ErrorBudgetWarningThresholdRatio] =
    useState('0.7')
  const [v4ErrorBudgetAlertThresholdRatio, setV4ErrorBudgetAlertThresholdRatio] = useState('0.9')
  const [v4ErrorBudgetFreezeDeployOnBreach, setV4ErrorBudgetFreezeDeployOnBreach] = useState(false)
  const [v4RollbackPolicyId, setV4RollbackPolicyId] = useState('')
  const [v4RollbackEnvironment, setV4RollbackEnvironment] = useState('staging')
  const [v4RollbackTriggerType, setV4RollbackTriggerType] = useState('manual')
  const [v4RollbackSummary, setV4RollbackSummary] = useState('Triggered from comparison-lab')
  const [v4RollbackPlan, setV4RollbackPlan] = useState('{"steps":[]}')
  const [v4RollbackResult, setV4RollbackResult] = useState('{}')
  const [v4RollbackDrillId, setV4RollbackDrillId] = useState('')
  const [v4RollbackDrillResult, setV4RollbackDrillResult] = useState<V4RollbackDrillResult | null>(
    null
  )
  const [v4AdminToken, setV4AdminToken] = useState(() => getAdminToken())
  const [isV4CollabBusy, setIsV4CollabBusy] = useState(false)
  const [isV4OpsBusy, setIsV4OpsBusy] = useState(false)
  const [showChannelPanel, setShowChannelPanel] = useState(false)
  const [isCapabilitiesLoading, setIsCapabilitiesLoading] = useState(false)
  const [capabilities, setCapabilities] = useState<CapabilityPayload | null>(null)
  const [authProfile, setAuthProfile] = useState<AuthProfile | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(() => getOrganizationId())
  const [orgMembers, setOrgMembers] = useState<OrganizationMember[]>([])
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [registerMode, setRegisterMode] = useState(false)
  const [registerOrgName, setRegisterOrgName] = useState('我的组织')
  const [newOrgName, setNewOrgName] = useState('')
  const [inviteMemberEmail, setInviteMemberEmail] = useState('')
  const [inviteOrgRole, setInviteOrgRole] = useState<OrganizationRole>('member')
  const [isAuthBusy, setIsAuthBusy] = useState(false)
  const [channelConfigs, setChannelConfigs] = useState<AiChannelConfig[]>([])
  const [channelForms, setChannelForms] = useState<Record<string, ChannelFormState>>({})
  const [activeChannelScope, setActiveChannelScope] = useState<'organization' | 'workspace'>(
    'organization'
  )
  const [organizationQuota, setOrganizationQuota] = useState<OrganizationQuota | null>(null)
  const [organizationUsage, setOrganizationUsage] = useState<OrganizationUsage | null>(null)
  const [quotaForm, setQuotaForm] = useState<QuotaFormState>({
    requestLimit: '0',
    storageLimitMb: '0',
    concurrencyLimit: '0'
  })

  const wsRef = useRef<WebSocket | null>(null)
  const heartbeatRef = useRef<number | null>(null)
  const leftVideoRef = useRef<HTMLVideoElement | null>(null)
  const rightVideoRef = useRef<HTMLVideoElement | null>(null)
  const policyExecRequestSeqRef = useRef(0)
  const policySimulateSeqRef = useRef(0)

  const assets = useMemo(() => allAssets.filter((asset) => asset.type === 'video'), [allAssets])

  const selectedPolicy = useMemo(
    () => policies.find((item) => item.id === selectedPolicyId) || null,
    [policies, selectedPolicyId]
  )

  const leftAsset = useMemo(() => assets.find((a) => a.id === leftAssetId), [assets, leftAssetId])
  const rightAsset = useMemo(
    () => assets.find((a) => a.id === rightAssetId),
    [assets, rightAssetId]
  )
  const geminiQuickCheck = useMemo(() => resolveGeminiQuickCheck(capabilities), [capabilities])
  const currentActorName = memberName.trim() || workspaceOwner.trim() || 'Owner'
  const effectiveOrganizationId = selectedOrganizationId.trim() || organizations[0]?.id || ''
  const buildIdempotencyKey = useCallback((action: string) => {
    const uuid =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    return `${action}:${uuid}`
  }, [])

  const parseJsonObjectInput = useCallback(
    (raw: string, fieldName: string): Record<string, unknown> | null => {
      const text = raw.trim()
      if (!text) return {}
      try {
        const parsed = JSON.parse(text) as unknown
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          showToast(`${fieldName} 必须是 JSON 对象`, 'warning')
          return null
        }
        return parsed as Record<string, unknown>
      } catch {
        showToast(`${fieldName} 解析失败，请检查 JSON 格式`, 'warning')
        return null
      }
    },
    [showToast]
  )

  const parseJsonArrayInput = useCallback(
    (raw: string, fieldName: string): unknown[] | null => {
      const text = raw.trim()
      if (!text) return []
      try {
        const parsed = JSON.parse(text) as unknown
        if (!Array.isArray(parsed)) {
          showToast(`${fieldName} 必须是 JSON 数组`, 'warning')
          return null
        }
        return parsed
      } catch {
        showToast(`${fieldName} 解析失败，请检查 JSON 格式`, 'warning')
        return null
      }
    },
    [showToast]
  )

  const parseMentionsInput = useCallback(
    (raw: string) =>
      Array.from(
        new Set(
          raw
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        )
      ),
    []
  )

  const parseVideoReferenceInputs = useCallback((raw: string) => {
    return raw
      .split(/[\n,]/g)
      .map((item) => item.trim())
      .filter(Boolean)
  }, [])

  const isRecord = useCallback(
    (value: unknown): value is Record<string, unknown> =>
      Boolean(value) && typeof value === 'object' && !Array.isArray(value),
    []
  )

  const normalizeVideoSourceInput = useCallback(
    (raw: string) => {
      const value = raw.trim()
      if (!value) return undefined
      return {
        sourceType: videoGenerationInputSourceType,
        value
      } as const
    },
    [videoGenerationInputSourceType]
  )

  const buildV4AdminHeaders = useCallback(
    (customHeaders?: Record<string, string>) => {
      const headers: Record<string, string> = {
        ...(customHeaders || {})
      }
      const token = v4AdminToken.trim()
      if (token) headers['x-admin-token'] = token
      return headers
    },
    [v4AdminToken]
  )

  const applySession = useCallback(
    (payload: {
      session: { accessToken: string; refreshToken: string; user: { id: string; email: string } }
      organizations?: Organization[]
    }) => {
      setAccessToken(payload.session.accessToken)
      setRefreshToken(payload.session.refreshToken)
      setAuthProfile({
        id: payload.session.user.id,
        email: payload.session.user.email
      })
      const orgRows = payload.organizations || []
      setOrganizations(orgRows)
      const nextOrgId = orgRows.some((item) => item.id === selectedOrganizationId)
        ? selectedOrganizationId
        : orgRows[0]?.id || ''
      if (nextOrgId) {
        setSelectedOrganizationId(nextOrgId)
        setOrganizationId(nextOrgId)
      }
    },
    [selectedOrganizationId]
  )

  const loadAuthProfile = useCallback(async () => {
    const accessToken = getAccessToken().trim()
    if (!accessToken) {
      setAuthProfile(null)
      setOrganizations([])
      return
    }
    try {
      const payload = await requestJson<{
        success: boolean
        user: AuthProfile
        organizations: Organization[]
      }>('/api/auth/me')
      setAuthProfile(payload.user)
      setOrganizations(payload.organizations || [])
      const storedOrgId = getOrganizationId()
      const preferredOrgId = payload.organizations?.some((item) => item.id === storedOrgId)
        ? storedOrgId
        : payload.organizations?.[0]?.id || ''
      if (preferredOrgId) {
        setSelectedOrganizationId(preferredOrgId)
        setOrganizationId(preferredOrgId)
      }
      void loadPolicies(false)
    } catch {
      clearAuthSession()
      setAuthProfile(null)
      setOrganizations([])
    }
  }, [])

  const submitAuth = async () => {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      showToast('请输入邮箱和密码', 'info')
      return
    }
    setIsAuthBusy(true)
    markJourneyStep('register_or_login')
    try {
      if (registerMode) {
        const payload = await requestJsonWithRetry<{
          success: boolean
          session: {
            accessToken: string
            refreshToken: string
            user: { id: string; email: string }
          }
          organizations: Organization[]
        }>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email: loginEmail.trim(),
            password: loginPassword,
            organizationName: registerOrgName.trim() || '我的组织'
          })
        })
        applySession(payload)
        await loadPolicies(false)
        const organizationId = payload.organizations?.[0]?.id || ''
        markJourneyStep('register_or_login', { organizationId })
        markJourneyStep('organization_ready', { organizationId })
        showToast('注册并登录成功', 'success')
      } else {
        const payload = await requestJsonWithRetry<{
          success: boolean
          session: {
            accessToken: string
            refreshToken: string
            user: { id: string; email: string }
          }
          organizations: Organization[]
        }>(
          '/api/auth/login',
          {
            method: 'POST',
            body: JSON.stringify({
              email: loginEmail.trim(),
              password: loginPassword
            })
          },
          {
            idempotent: true
          }
        )
        applySession(payload)
        await loadPolicies(false)
        const organizationId = payload.organizations?.[0]?.id || ''
        markJourneyStep('register_or_login', { organizationId })
        markJourneyStep('organization_ready', { organizationId })
        showToast('登录成功', 'success')
      }
    } catch (error: any) {
      const { errorKind, httpStatus } = classifyRequestError(error)
      void reportJourney(false, {
        reason: registerMode ? 'register-failed' : 'login-failed',
        failedStage: 'register',
        errorKind,
        httpStatus
      })
      showToast(error.message || '登录失败', 'error')
    } finally {
      setIsAuthBusy(false)
    }
  }

  const logoutAuth = async () => {
    const refreshToken = getRefreshToken().trim()
    try {
      await requestJson('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({
          refreshToken
        })
      })
    } catch {
      // noop
    }
    clearAuthSession()
    setAuthProfile(null)
    setOrganizations([])
    setSelectedOrganizationId('')
    setOrgMembers([])
    resetJourney()
    showToast('已退出登录', 'success')
  }

  const createOrganization = async () => {
    if (!newOrgName.trim()) {
      showToast('请输入组织名称', 'info')
      return
    }
    try {
      const payload = await requestJson<{ success: boolean; organization: Organization }>(
        '/api/organizations',
        {
          method: 'POST',
          body: JSON.stringify({ name: newOrgName.trim() })
        }
      )
      const nextOrganizations = [...organizations, payload.organization]
      setOrganizations(nextOrganizations)
      setNewOrgName('')
      setSelectedOrganizationId(payload.organization.id)
      setOrganizationId(payload.organization.id)
      markJourneyStep('organization_ready', { organizationId: payload.organization.id })
      showToast('组织创建成功', 'success')
    } catch (error: any) {
      showToast(error.message || '创建组织失败', 'error')
    }
  }

  const refreshOrganizationMembers = useCallback(async () => {
    if (!effectiveOrganizationId) {
      setOrgMembers([])
      return
    }
    try {
      const payload = await requestJson<{ success: boolean; members: OrganizationMember[] }>(
        `/api/organizations/${effectiveOrganizationId}/members`
      )
      setOrgMembers(payload.members || [])
    } catch {
      setOrgMembers([])
    }
  }, [effectiveOrganizationId])

  const addOrganizationMember = async () => {
    if (!effectiveOrganizationId) {
      showToast('请先选择组织', 'info')
      return
    }
    if (!inviteMemberEmail.trim()) {
      showToast('请输入成员邮箱', 'info')
      return
    }
    try {
      await requestJson(`/api/organizations/${effectiveOrganizationId}/members`, {
        method: 'POST',
        body: JSON.stringify({
          email: inviteMemberEmail.trim(),
          role: inviteOrgRole
        })
      })
      setInviteMemberEmail('')
      showToast('成员已加入组织', 'success')
      await refreshOrganizationMembers()
    } catch (error: any) {
      showToast(error.message || '添加成员失败', 'error')
    }
  }

  const applyQuotaForm = useCallback((quota: OrganizationQuota) => {
    setQuotaForm({
      requestLimit: String(quota.requestLimit || 0),
      storageLimitMb: String(Math.round((quota.storageLimitBytes || 0) / (1024 * 1024))),
      concurrencyLimit: String(quota.concurrencyLimit || 0)
    })
  }, [])

  const refreshOrganizationQuota = useCallback(async () => {
    if (!effectiveOrganizationId) {
      setOrganizationQuota(null)
      setOrganizationUsage(null)
      return
    }
    try {
      const payload = await requestJson<{
        success: boolean
        quota: OrganizationQuota
        usage: OrganizationUsage
      }>(`/api/organizations/${effectiveOrganizationId}/quota`)
      setOrganizationQuota(payload.quota || null)
      setOrganizationUsage(payload.usage || null)
      if (payload.quota) applyQuotaForm(payload.quota)
    } catch (error: any) {
      setOrganizationQuota(null)
      setOrganizationUsage(null)
      showToast(error.message || '加载组织配额失败', 'error')
    }
  }, [applyQuotaForm, effectiveOrganizationId, showToast])

  const saveOrganizationQuota = async () => {
    if (!effectiveOrganizationId) {
      showToast('请先选择组织', 'info')
      return
    }
    const requestLimit = Number.parseInt(quotaForm.requestLimit.trim() || '0', 10)
    const storageLimitMb = Number.parseInt(quotaForm.storageLimitMb.trim() || '0', 10)
    const concurrencyLimit = Number.parseInt(quotaForm.concurrencyLimit.trim() || '0', 10)
    if (!Number.isFinite(requestLimit) || requestLimit < 0) {
      showToast('请求配额必须是大于等于 0 的整数', 'warning')
      return
    }
    if (!Number.isFinite(storageLimitMb) || storageLimitMb < 0) {
      showToast('存储配额（MB）必须是大于等于 0 的整数', 'warning')
      return
    }
    if (!Number.isFinite(concurrencyLimit) || concurrencyLimit < 0) {
      showToast('并发配额必须是大于等于 0 的整数', 'warning')
      return
    }
    try {
      const payload = await requestJson<{
        success: boolean
        quota: OrganizationQuota
        usage: OrganizationUsage
      }>(`/api/organizations/${effectiveOrganizationId}/quota`, {
        method: 'PUT',
        body: JSON.stringify({
          requestLimit,
          storageLimitBytes: storageLimitMb * 1024 * 1024,
          concurrencyLimit
        })
      })
      if (payload.quota) {
        setOrganizationQuota(payload.quota)
        applyQuotaForm(payload.quota)
      }
      if (payload.usage) setOrganizationUsage(payload.usage)
      showToast('组织配额已更新', 'success')
    } catch (error: any) {
      showToast(error.message || '更新组织配额失败', 'error')
    }
  }

  const exportOrganizationAudits = async (format: 'json' | 'csv') => {
    if (!effectiveOrganizationId) {
      showToast('请先选择组织', 'info')
      return
    }
    const headers = buildAuthHeaders()
    const url = `${resolveApiBase()}/api/organizations/${encodeURIComponent(effectiveOrganizationId)}/audits/export?format=${format}&scope=all&limit=2000`
    try {
      const response = await fetch(url, { method: 'GET', headers })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as any
        throw new Error(payload?.error || `HTTP ${response.status}`)
      }
      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = downloadUrl
      anchor.download = `veomuse-${effectiveOrganizationId}-audits-${Date.now()}.${format}`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(downloadUrl)
      showToast(`审计记录已导出（${format.toUpperCase()}）`, 'success')
    } catch (error: any) {
      showToast(error.message || '导出审计记录失败', 'error')
    }
  }

  const applyChannelForms = useCallback((configs: AiChannelConfig[]) => {
    const next: Record<string, ChannelFormState> = {}
    for (const row of configs) {
      const extra =
        row.extra && typeof row.extra === 'object' ? (row.extra as Record<string, unknown>) : {}
      next[row.providerId] = {
        providerId: row.providerId,
        baseUrl: row.baseUrl || '',
        apiKey: '',
        model: String(extra.model || ''),
        path: String(extra.path || ''),
        temperature:
          extra.temperature === undefined || extra.temperature === null
            ? ''
            : String(extra.temperature),
        enabled: row.enabled,
        scope: row.workspaceId ? 'workspace' : 'organization'
      }
    }
    setChannelForms(next)
  }, [])

  const updateChannelForm = (providerId: string, patch: Partial<ChannelFormState>) => {
    setChannelForms((prev) => ({
      ...prev,
      [providerId]: {
        providerId,
        baseUrl: patch.baseUrl ?? prev[providerId]?.baseUrl ?? '',
        apiKey: patch.apiKey ?? prev[providerId]?.apiKey ?? '',
        model: patch.model ?? prev[providerId]?.model ?? '',
        path: patch.path ?? prev[providerId]?.path ?? '',
        temperature: patch.temperature ?? prev[providerId]?.temperature ?? '',
        enabled: patch.enabled ?? prev[providerId]?.enabled ?? true,
        scope: patch.scope ?? prev[providerId]?.scope ?? activeChannelScope
      }
    }))
  }

  const refreshChannelConfigs = useCallback(async () => {
    if (!effectiveOrganizationId) return
    try {
      if (activeChannelScope === 'workspace' && workspaceId) {
        const payload = await requestJson<{
          success: boolean
          configs: AiChannelConfig[]
          capabilities: CapabilityPayload
        }>(`/api/workspaces/${workspaceId}/channels`)
        setChannelConfigs(payload.configs || [])
        setCapabilities(payload.capabilities || null)
        applyChannelForms(payload.configs || [])
      } else {
        const payload = await requestJson<{
          success: boolean
          configs: AiChannelConfig[]
          capabilities: CapabilityPayload
        }>(`/api/organizations/${effectiveOrganizationId}/channels`)
        setChannelConfigs(payload.configs || [])
        setCapabilities(payload.capabilities || null)
        applyChannelForms(payload.configs || [])
      }
    } catch (error: any) {
      showToast(error.message || '加载渠道配置失败', 'error')
    }
  }, [activeChannelScope, applyChannelForms, effectiveOrganizationId, showToast, workspaceId])

  const buildChannelExtra = (providerId: string, form: ChannelFormState) => {
    if (providerId !== 'openai-compatible') return {}
    const model = form.model.trim()
    const path = form.path.trim()
    const temperatureRaw = form.temperature.trim()
    const extra: Record<string, unknown> = {}
    if (model) extra.model = model
    if (path) extra.path = path
    if (temperatureRaw) extra.temperature = Number(temperatureRaw)
    return extra
  }

  const validateChannelForm = (providerId: string, form: ChannelFormState) => {
    if (providerId !== 'openai-compatible' || !form.enabled) return true
    if (!form.model.trim()) {
      showToast('OpenAI 兼容渠道必须填写 model', 'warning')
      return false
    }
    const temperatureRaw = form.temperature.trim()
    if (!temperatureRaw) return true
    const temperature = Number(temperatureRaw)
    if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
      showToast('temperature 需在 0 到 2 之间', 'warning')
      return false
    }
    return true
  }

  const saveChannelConfig = async (providerId: string) => {
    if (!effectiveOrganizationId) {
      showToast('请先选择组织', 'info')
      return
    }
    const form = channelForms[providerId]
    if (!form) return
    if (!validateChannelForm(providerId, form)) return
    const path =
      activeChannelScope === 'workspace' && workspaceId
        ? `/api/workspaces/${workspaceId}/channels/${providerId}`
        : `/api/organizations/${effectiveOrganizationId}/channels/${providerId}`
    const extra = buildChannelExtra(providerId, form)
    try {
      await requestJson(path, {
        method: 'PUT',
        body: JSON.stringify({
          baseUrl: form.baseUrl.trim() || undefined,
          apiKey: form.apiKey.trim() || undefined,
          enabled: form.enabled,
          extra
        })
      })
      setChannelForms((prev) => ({
        ...prev,
        [providerId]: {
          ...prev[providerId],
          apiKey: ''
        }
      }))
      showToast('渠道配置已保存', 'success')
      await refreshChannelConfigs()
      await loadCapabilities()
    } catch (error: any) {
      showToast(error.message || '保存渠道配置失败', 'error')
    }
  }

  const testChannelConfig = async (providerId: string) => {
    const form = channelForms[providerId]
    if (!form) return
    if (!validateChannelForm(providerId, form)) return
    const extra = buildChannelExtra(providerId, form)
    try {
      const payload = await requestJson<{ success: boolean; message: string }>(
        '/api/channels/test',
        {
          method: 'POST',
          body: JSON.stringify({
            providerId,
            baseUrl: form.baseUrl.trim() || undefined,
            apiKey: form.apiKey.trim() || undefined,
            workspaceId:
              activeChannelScope === 'workspace' && workspaceId ? workspaceId : undefined,
            extra
          })
        }
      )
      if (payload.success) {
        showToast(payload.message || '测试通过', 'success')
      } else {
        showToast(payload.message || '测试失败', 'error')
      }
    } catch (error: any) {
      showToast(error.message || '测试失败', 'error')
    }
  }

  useEffect(() => {
    const loadModels = async () => {
      const { data, error } = await api.api.models.get()
      if (error) return
      if (Array.isArray(data)) {
        const rows = data as Array<{ id: string; name: string }>
        setAvailableModels(rows)
        setPolicyAllowedModels(rows.map((item) => item.id))
        if (rows[0]?.id) setLeftModel(rows[0].id)
        if (rows[1]?.id) setRightModel(rows[1].id)
      }
    }
    void loadModels()
    void refreshMarketplace(false)
  }, [])

  useEffect(() => {
    void loadAuthProfile()
  }, [loadAuthProfile])

  useEffect(() => {
    setAdminToken(v4AdminToken)
  }, [v4AdminToken])

  useEffect(() => {
    if (!effectiveOrganizationId) return
    setOrganizationId(effectiveOrganizationId)
    void refreshOrganizationMembers()
    void refreshOrganizationQuota()
  }, [effectiveOrganizationId, refreshOrganizationMembers, refreshOrganizationQuota])

  useEffect(() => {
    if (!selectedPolicyId) return
    setPolicyExecutions([])
    setPolicyExecOffset(0)
    setPolicyExecHasMore(false)
    void loadPolicyExecutions(true, selectedPolicyId)
  }, [selectedPolicyId])

  useEffect(() => {
    setV4WorkflowRuns([])
    setV4WorkflowRunsCursor('')
    setV4WorkflowRunsHasMore(false)
  }, [v4SelectedWorkflowId])

  useEffect(() => {
    setV4CommentThreadCursor('')
    setV4CommentThreadHasMore(false)
    setProjectCommentCursor('')
    setProjectCommentHasMore(false)
    setProjectSelectedCommentId('')
    setProjectTemplateApplyResult(null)
    setProjectClipBatchResult(null)
  }, [projectId])

  useEffect(() => {
    if (labMode !== 'collab' || !projectId) return
    void loadProjectComments(false)
    void loadProjectReviews()
    void loadProjectTemplates()
  }, [labMode, projectId])

  useEffect(() => {
    if (!syncPlayback) return
    const left = leftVideoRef.current
    const right = rightVideoRef.current
    if (!left || !right) return

    const onLeftPlay = () => right.play().catch(() => {})
    const onLeftPause = () => right.pause()
    const onLeftSeek = () => {
      if (Math.abs(right.currentTime - left.currentTime) > 0.08)
        right.currentTime = left.currentTime
    }
    const onRightPlay = () => left.play().catch(() => {})
    const onRightPause = () => left.pause()
    const onRightSeek = () => {
      if (Math.abs(left.currentTime - right.currentTime) > 0.08)
        left.currentTime = right.currentTime
    }

    left.addEventListener('play', onLeftPlay)
    left.addEventListener('pause', onLeftPause)
    left.addEventListener('seeked', onLeftSeek)
    right.addEventListener('play', onRightPlay)
    right.addEventListener('pause', onRightPause)
    right.addEventListener('seeked', onRightSeek)

    return () => {
      left.removeEventListener('play', onLeftPlay)
      left.removeEventListener('pause', onLeftPause)
      left.removeEventListener('seeked', onLeftSeek)
      right.removeEventListener('play', onRightPlay)
      right.removeEventListener('pause', onRightPause)
      right.removeEventListener('seeked', onRightSeek)
    }
  }, [syncPlayback, leftAssetId, rightAssetId])

  useEffect(() => {
    if (!leftAssetId && assets[0]) setLeftAssetId(assets[0].id)
    if (!rightAssetId && assets[1]) setRightAssetId(assets[1].id)
  }, [assets, leftAssetId, rightAssetId])

  useEffect(() => {
    return () => {
      if (heartbeatRef.current) window.clearInterval(heartbeatRef.current)
      if (wsRef.current) wsRef.current.close()
    }
  }, [])

  const loadCapabilities = useCallback(async () => {
    setIsCapabilitiesLoading(true)
    try {
      const query =
        activeChannelScope === 'workspace' && workspaceId
          ? `?workspaceId=${encodeURIComponent(workspaceId)}`
          : ''
      const payload = await requestJson<CapabilityPayload>(`/api/capabilities${query}`)
      setCapabilities(payload)
    } catch (error: any) {
      showToast(error.message || '加载渠道接入状态失败', 'error')
    } finally {
      setIsCapabilitiesLoading(false)
    }
  }, [activeChannelScope, showToast, workspaceId])

  const openChannelPanel = useCallback(() => {
    setShowChannelPanel(true)
  }, [])

  useEffect(() => {
    const handleOpenChannelPanel = () => {
      setLabMode('marketplace')
      setShowChannelPanel(true)
    }

    window.addEventListener('veomuse:open-channel-panel', handleOpenChannelPanel as EventListener)
    return () => {
      window.removeEventListener(
        'veomuse:open-channel-panel',
        handleOpenChannelPanel as EventListener
      )
    }
  }, [])

  useEffect(() => {
    if (!showChannelPanel || !authProfile) return
    void refreshChannelConfigs()
    void loadCapabilities()
    void refreshOrganizationQuota()
  }, [
    showChannelPanel,
    authProfile,
    activeChannelScope,
    workspaceId,
    effectiveOrganizationId,
    refreshChannelConfigs,
    loadCapabilities,
    refreshOrganizationQuota
  ])

  const refreshMarketplace = async (notify: boolean) => {
    try {
      const payload = await requestJson<{ success: boolean; models: any[] }>(
        '/api/models/marketplace'
      )
      if (Array.isArray(payload.models)) {
        setMarketplace(payload.models)
      } else {
        setMarketplace([])
      }
      if (notify) showToast('模型超市数据已刷新', 'success')
    } catch (error: any) {
      showToast(error.message || '加载模型超市失败', 'error')
    }
  }

  const loadPolicies = async (notify: boolean) => {
    if (!getAccessToken().trim()) {
      setPolicies([])
      setSelectedPolicyId('')
      return
    }
    setIsPolicyLoading(true)
    try {
      const payload = await requestJson<{ success: boolean; policies: RoutingPolicy[] }>(
        '/api/models/policies'
      )
      const rows = payload.policies || []
      setPolicies(rows)
      if (!selectedPolicyId && rows[0]?.id) {
        setSelectedPolicyId(rows[0].id)
      }
      if (notify) showToast(`已加载 ${rows.length} 条策略`, 'success')
    } catch (error: any) {
      setPolicies([])
      showToast(error.message || '加载策略失败', 'error')
    } finally {
      setIsPolicyLoading(false)
    }
  }

  const loadPolicyExecutions = async (reset: boolean, policyIdOverride?: string) => {
    const policyId = policyIdOverride || selectedPolicyId
    if (!policyId) return
    const requestSeq = ++policyExecRequestSeqRef.current
    setPolicyExecLoading(true)
    try {
      const offset = reset ? 0 : policyExecOffset
      const payload = await requestJson<{
        success: boolean
        executions: RoutingExecution[]
        page: { hasMore: boolean; offset: number; total: number }
      }>(
        `/api/models/policies/${policyId}/executions?limit=${POLICY_EXEC_PAGE_SIZE}&offset=${offset}`
      )
      if (requestSeq !== policyExecRequestSeqRef.current) return
      const rows = payload.executions || []
      setPolicyExecutions((prev) => (reset ? rows : [...prev, ...rows]))
      setPolicyExecHasMore(Boolean(payload.page?.hasMore))
      setPolicyExecOffset(offset + rows.length)
    } catch (error: any) {
      if (requestSeq === policyExecRequestSeqRef.current) {
        showToast(error.message || '加载策略执行记录失败', 'error')
      }
    } finally {
      if (requestSeq === policyExecRequestSeqRef.current) {
        setPolicyExecLoading(false)
      }
    }
  }

  const exportReport = async () => {
    try {
      const modelName = (id: string) => availableModels.find((m) => m.id === id)?.name || id
      const report = {
        timestamp: new Date().toISOString(),
        mode: labMode,
        left: {
          modelId: leftModel,
          modelName: modelName(leftModel),
          assetName: leftAsset?.name || null
        },
        right: {
          modelId: rightModel,
          modelName: modelName(rightModel),
          assetName: rightAsset?.name || null
        },
        syncPlayback
      }
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `comparison-report-${Date.now()}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      showToast('对比报告已导出', 'success')
    } catch (error: any) {
      showToast(error.message || '导出失败', 'error')
    }
  }

  const requestRecommendation = async (side: 'left' | 'right') => {
    const prompt = side === 'left' ? leftAsset?.name : rightAsset?.name
    if (!prompt) return showToast('请先选择对比素材', 'info')

    let data: ModelRecommendation
    try {
      data = await requestJson<ModelRecommendation>('/api/models/recommend', {
        method: 'POST',
        body: JSON.stringify({ prompt })
      })
    } catch (error: any) {
      return showToast(error.message || '推荐模型失败', 'error')
    }

    if (data?.recommendedModelId) {
      if (side === 'left') setLeftModel(data.recommendedModelId)
      else setRightModel(data.recommendedModelId)
      showToast(
        `${side === 'left' ? '左侧' : '右侧'}推荐模型: ${data.recommendedModelId}`,
        'success'
      )
    }
  }

  const toggleAllowedModel = (modelId: string) => {
    setPolicyAllowedModels((prev) =>
      prev.includes(modelId) ? prev.filter((item) => item !== modelId) : [...prev, modelId]
    )
  }

  const createPolicy = async () => {
    if (!policyCreateName.trim()) {
      showToast('请输入策略名称', 'info')
      return
    }
    if (policyAllowedModels.length === 0) {
      showToast('至少选择一个可用模型', 'warning')
      return
    }

    try {
      const payload = await requestJson<{ success: boolean; policy: RoutingPolicy }>(
        '/api/models/policies',
        {
          method: 'POST',
          body: JSON.stringify({
            name: policyCreateName.trim(),
            description: '来自实验室策略中心',
            priority: policyCreatePriority,
            maxBudgetUsd: policyCreateBudget,
            enabled: true,
            allowedModels: policyAllowedModels,
            weights: policyWeights
          })
        }
      )
      showToast(`策略已创建：${payload.policy.name}`, 'success')
      await loadPolicies(false)
      setSelectedPolicyId(payload.policy.id)
    } catch (error: any) {
      showToast(error.message || '创建策略失败', 'error')
    }
  }

  const updateSelectedPolicy = async () => {
    if (!selectedPolicy) return
    try {
      const payload = await requestJson<{ success: boolean; policy: RoutingPolicy }>(
        `/api/models/policies/${selectedPolicy.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            enabled: !selectedPolicy.enabled,
            maxBudgetUsd: policyBudget,
            priority: policyPriority
          })
        }
      )
      setPolicies((prev) =>
        prev.map((item) => (item.id === payload.policy.id ? payload.policy : item))
      )
      showToast(`策略状态已更新：${payload.policy.enabled ? '启用' : '停用'}`, 'success')
    } catch (error: any) {
      showToast(error.message || '更新策略失败', 'error')
    }
  }

  const simulatePolicy = async (overridePrompt?: string) => {
    const prompt = (overridePrompt || policyPrompt).trim()
    if (!prompt) {
      showToast('请输入路由提示词', 'info')
      return null
    }
    if (isPolicySimulating) {
      return null
    }
    const policyIdAtRequest = selectedPolicyId
    const requestSeq = ++policySimulateSeqRef.current
    setIsPolicySimulating(true)
    try {
      const endpoint = policyIdAtRequest
        ? `/api/models/policies/${policyIdAtRequest}/simulate`
        : '/api/models/policy/simulate'
      const payload = await requestJson<{ success: boolean; decision: RoutingDecision }>(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          budgetUsd: policyBudget,
          priority: policyPriority
        })
      })
      if (requestSeq !== policySimulateSeqRef.current) return null
      const decision = payload.decision || null
      setPolicyDecision(decision)
      if (decision?.recommendedModelId) {
        setLeftModel(decision.recommendedModelId)
      }
      showToast(`策略推荐模型：${decision?.recommendedModelId || '--'}`, 'success')
      if (policyIdAtRequest) {
        await loadPolicyExecutions(true, policyIdAtRequest)
      }
      return decision
    } catch (error: any) {
      if (requestSeq === policySimulateSeqRef.current) {
        showToast(error.message || '策略模拟失败', 'error')
      }
      return null
    } finally {
      if (requestSeq === policySimulateSeqRef.current) {
        setIsPolicySimulating(false)
      }
    }
  }

  const resolveRoutingDecisionForCreativeRun = async () => {
    if (!selectedPolicyId) return null
    if (policyDecision && policyDecision.policyId === selectedPolicyId) {
      return policyDecision
    }
    const previewPrompt =
      creativeScript
        .trim()
        .split(/\n|。|\.|!|！|\?|？/)
        .map((item) => item.trim())
        .find(Boolean) || creativeScript.trim()
    return await simulatePolicy(previewPrompt)
  }

  const createCreativeRun = async () => {
    if (!creativeScript.trim()) {
      showToast('请输入创意脚本', 'info')
      return
    }
    if (isCreativeBusy) return
    setIsCreativeBusy(true)
    try {
      const routingDecision = await resolveRoutingDecisionForCreativeRun()
      const payload = await requestJson<{ success: boolean; run: CreativeRun }>(
        '/api/ai/creative/run',
        {
          method: 'POST',
          body: JSON.stringify({
            script: creativeScript.trim(),
            style: creativeStyle,
            context: {
              source: 'comparison-lab',
              createdBy: 'frontend-user',
              routingPolicyId: selectedPolicyId || null,
              routingDecision: routingDecision || null
            }
          })
        }
      )
      setCreativeRun(payload.run)
      setSceneFeedbackMap({})
      setCreativeRunFeedback('')
      showToast(`创意 run 已创建：${payload.run.id}`, 'success')
      await refreshCreativeVersions(payload.run.id)
    } catch (error: any) {
      showToast(error.message || '创建创意 run 失败', 'error')
    } finally {
      setIsCreativeBusy(false)
    }
  }

  const refreshCreativeVersions = async (runId?: string) => {
    const targetRunId = runId || creativeRun?.id
    if (!targetRunId) return
    try {
      const payload = await requestJson<{ success: boolean; versions: CreativeRun[] }>(
        `/api/ai/creative/run/${targetRunId}/versions`
      )
      setCreativeVersions(payload.versions || [])
    } catch {
      setCreativeVersions([])
    }
  }

  const applyCreativeFeedback = async () => {
    if (!creativeRun?.id) {
      showToast('请先创建创意 run', 'info')
      return
    }
    if (isCreativeBusy) return

    const sceneFeedbacks = Object.entries(sceneFeedbackMap)
      .map(([sceneId, feedback]) => ({ sceneId, feedback: feedback.trim() }))
      .filter((item) => item.feedback.length > 0)

    if (!creativeRunFeedback.trim() && sceneFeedbacks.length === 0) {
      showToast('请至少填写一条反馈', 'warning')
      return
    }

    setIsCreativeBusy(true)
    try {
      const payload = await requestJson<{
        success: boolean
        run: CreativeRun
        parentRun: CreativeRun | null
      }>(`/api/ai/creative/run/${creativeRun.id}/feedback`, {
        method: 'POST',
        body: JSON.stringify({
          runFeedback: creativeRunFeedback.trim() || undefined,
          sceneFeedbacks
        })
      })
      setCreativeRun(payload.run)
      setSceneFeedbackMap({})
      setCreativeRunFeedback('')
      showToast(`反馈已应用，生成版本 v${payload.run.version || 1}`, 'success')
      await refreshCreativeVersions(payload.run.id)
    } catch (error: any) {
      showToast(error.message || '反馈应用失败', 'error')
    } finally {
      setIsCreativeBusy(false)
    }
  }

  const commitCreativeRun = async () => {
    if (!creativeRun?.id) {
      showToast('请先创建创意 run', 'info')
      return
    }
    if (isCreativeBusy) return
    setIsCreativeBusy(true)
    try {
      const payload = await requestJson<{ success: boolean; run: CreativeRun }>(
        `/api/ai/creative/run/${creativeRun.id}/commit`,
        {
          method: 'POST',
          body: JSON.stringify({
            qualityScore: commitScore,
            notes: {
              source: 'comparison-lab',
              reviewedAt: new Date().toISOString()
            }
          })
        }
      )
      setCreativeRun(payload.run)
      showToast('创意 run 已提交完成', 'success')
      await refreshCreativeVersions(payload.run.id)
    } catch (error: any) {
      showToast(error.message || '提交创意 run 失败', 'error')
    } finally {
      setIsCreativeBusy(false)
    }
  }

  const upsertVideoGenerationJob = useCallback((job: VideoGenerationJob) => {
    setVideoGenerationJobs((prev) => {
      const index = prev.findIndex((item) => item.id === job.id)
      if (index < 0) return [job, ...prev]
      const next = [...prev]
      next[index] = job
      return next
    })
  }, [])

  const createVideoGenerationTask = async () => {
    const prompt = videoGenerationPrompt.trim()
    const negativePrompt = videoGenerationNegativePrompt.trim()
    const imageInput = normalizeVideoSourceInput(videoGenerationImageInput)
    const videoInput = normalizeVideoSourceInput(videoGenerationVideoInput)
    const firstFrameInput = normalizeVideoSourceInput(videoGenerationFirstFrameInput)
    const lastFrameInput = normalizeVideoSourceInput(videoGenerationLastFrameInput)
    const referenceImages = parseVideoReferenceInputs(videoGenerationReferenceImagesInput)
      .map((value) => normalizeVideoSourceInput(value))
      .filter(Boolean) as Array<NonNullable<VideoGenerationCreatePayload['inputs']>['image']>

    if (videoGenerationMode === 'text_to_video' && !prompt) {
      showToast('文生视频模式需要填写 Prompt', 'warning')
      return
    }
    if (videoGenerationMode === 'image_to_video' && !imageInput && referenceImages.length === 0) {
      showToast('图生视频模式需要填写图片输入或参考图列表', 'warning')
      return
    }
    if (videoGenerationMode === 'video_extend' && !videoInput) {
      showToast('视频扩展模式需要填写视频输入', 'warning')
      return
    }
    if (
      videoGenerationMode === 'first_last_frame_transition' &&
      (!firstFrameInput || !lastFrameInput)
    ) {
      showToast('首末帧过渡模式需要同时填写首帧与末帧输入', 'warning')
      return
    }
    if (isVideoGenerationBusy) return

    const inputs: VideoGenerationCreatePayload['inputs'] = {}
    if (imageInput) inputs.image = imageInput
    if (referenceImages.length > 0) inputs.referenceImages = referenceImages
    if (videoInput) inputs.video = videoInput
    if (firstFrameInput) inputs.firstFrame = firstFrameInput
    if (lastFrameInput) inputs.lastFrame = lastFrameInput

    const payloadBody: VideoGenerationCreatePayload = {
      modelId: videoGenerationModelId.trim() || undefined,
      generationMode: videoGenerationMode,
      prompt: prompt || undefined,
      text: prompt || undefined,
      negativePrompt: negativePrompt || undefined,
      workspaceId: workspaceId.trim() || undefined,
      inputs: Object.keys(inputs).length > 0 ? inputs : undefined
    }

    setIsVideoGenerationBusy(true)
    try {
      const payload = await requestJson<{
        success: boolean
        job: VideoGenerationJob | null
        providerResult?: { status?: string; message?: string } | null
      }>('/api/video/generations', {
        method: 'POST',
        body: JSON.stringify(payloadBody)
      })
      if (!payload.job) {
        showToast('任务创建成功，但未返回任务对象', 'warning')
        return
      }
      setVideoGenerationSelectedJobId(payload.job.id)
      setVideoGenerationCancelledJobIds((prev) => {
        if (!prev[payload.job!.id]) return prev
        const next = { ...prev }
        delete next[payload.job!.id]
        return next
      })
      upsertVideoGenerationJob(payload.job)
      showToast(
        `视频任务已创建：${payload.job.id}（${payload.providerResult?.status || payload.job.status}）`,
        'success'
      )
    } catch (error: any) {
      showToast(error.message || '创建视频任务失败', 'error')
    } finally {
      setIsVideoGenerationBusy(false)
    }
  }

  const loadVideoGenerationJobs = useCallback(
    async (append = false, options?: { silent?: boolean }) => {
      const limitRaw = videoGenerationListLimit.trim() || '20'
      const limit = Number.parseInt(limitRaw, 10)
      if (!Number.isFinite(limit) || limit <= 0) {
        showToast('视频任务列表 limit 必须是大于 0 的整数', 'warning')
        return
      }

      const cursor = append ? videoGenerationCursor.trim() : ''
      if (append && !cursor) {
        setVideoGenerationHasMore(false)
        return
      }
      if (isVideoGenerationBusy) return

      setIsVideoGenerationBusy(true)
      try {
        const query = new URLSearchParams({
          limit: String(Math.min(limit, 100))
        })
        if (workspaceId.trim()) query.set('workspaceId', workspaceId.trim())
        if (videoGenerationStatusFilter !== 'all') query.set('status', videoGenerationStatusFilter)
        if (cursor) query.set('cursor', cursor)
        if (videoGenerationModelId.trim()) query.set('modelId', videoGenerationModelId.trim())

        const payload = await requestJson<{
          success: boolean
          jobs: VideoGenerationJob[]
          page?: {
            cursor?: string | null
            nextCursor?: string | null
            limit?: number
            hasMore?: boolean
          }
        }>(`/api/video/generations?${query.toString()}`)
        const rows = payload.jobs || []
        const merged = append
          ? [
              ...videoGenerationJobs,
              ...rows.filter((item) => videoGenerationJobs.every((prev) => prev.id !== item.id))
            ]
          : rows
        setVideoGenerationJobs(merged)

        const inferredCursor = rows.length > 0 ? rows[rows.length - 1]?.createdAt || '' : ''
        const cursorFromPage =
          typeof payload.page?.nextCursor === 'string'
            ? payload.page.nextCursor
            : typeof payload.page?.cursor === 'string'
              ? payload.page.cursor
              : inferredCursor
        const hasMore =
          typeof payload.page?.hasMore === 'boolean'
            ? payload.page.hasMore
            : rows.length >= Math.min(limit, 100)
        setVideoGenerationCursor(cursorFromPage || '')
        setVideoGenerationHasMore(Boolean(cursorFromPage) && hasMore)
        if (!options?.silent) {
          showToast(`已加载 ${rows.length} 条视频任务`, 'success')
        }
      } catch (error: any) {
        if (!options?.silent) {
          showToast(error.message || '加载视频任务失败', 'error')
        }
      } finally {
        setIsVideoGenerationBusy(false)
      }
    },
    [
      isVideoGenerationBusy,
      showToast,
      videoGenerationCursor,
      videoGenerationJobs,
      videoGenerationListLimit,
      videoGenerationModelId,
      videoGenerationStatusFilter,
      workspaceId
    ]
  )

  const queryVideoGenerationJobDetail = useCallback(
    async (jobId?: string, options?: { silent?: boolean }) => {
      const targetJobId = String(jobId || videoGenerationSelectedJobId || '').trim()
      if (!targetJobId) {
        if (!options?.silent) showToast('请先选择任务 ID', 'info')
        return
      }
      if (isVideoGenerationBusy) return
      setIsVideoGenerationBusy(true)
      try {
        const payload = await requestJson<{ success: boolean; job: VideoGenerationJob }>(
          `/api/video/generations/${encodeURIComponent(targetJobId)}`
        )
        if (payload.job) {
          upsertVideoGenerationJob(payload.job)
          setVideoGenerationSelectedJobId(payload.job.id)
        }
        if (!options?.silent) {
          showToast(`任务详情已刷新：${payload.job?.status || '-'}`, 'success')
        }
      } catch (error: any) {
        if (!options?.silent) {
          showToast(error.message || '查询任务详情失败', 'error')
        }
      } finally {
        setIsVideoGenerationBusy(false)
      }
    },
    [isVideoGenerationBusy, showToast, upsertVideoGenerationJob, videoGenerationSelectedJobId]
  )

  const syncVideoGenerationJob = async (jobId: string, options?: { silent?: boolean }) => {
    const normalizedJobId = jobId.trim()
    if (!normalizedJobId) return
    if (isVideoGenerationBusy) return
    setIsVideoGenerationBusy(true)
    try {
      const payload = await requestJson<{
        success: boolean
        job: VideoGenerationJob
        queryResult?: { state?: string; status?: string } | null
      }>(`/api/video/generations/${encodeURIComponent(normalizedJobId)}/sync`, {
        method: 'POST'
      })
      if (payload.job) {
        setVideoGenerationSelectedJobId(payload.job.id)
        upsertVideoGenerationJob(payload.job)
      }
      if (!options?.silent) {
        showToast(
          `同步完成：${payload.queryResult?.state || payload.job?.status || '-'}`,
          payload.job?.status === 'failed' ? 'warning' : 'success'
        )
      }
    } catch (error: any) {
      if (!options?.silent) {
        showToast(error.message || '同步任务失败', 'error')
      }
    } finally {
      setIsVideoGenerationBusy(false)
    }
  }

  const retryVideoGenerationJob = async (jobId: string) => {
    const normalizedJobId = jobId.trim()
    if (!normalizedJobId) return
    if (isVideoGenerationBusy) return
    setIsVideoGenerationBusy(true)
    try {
      const payload = await requestJson<{
        success: boolean
        job: VideoGenerationJob
        providerResult?: { status?: string } | null
      }>(`/api/video/generations/${encodeURIComponent(normalizedJobId)}/retry`, {
        method: 'POST'
      })
      setVideoGenerationSelectedJobId(payload.job.id)
      upsertVideoGenerationJob(payload.job)
      showToast(
        `重试任务已创建：${payload.job.id}（${payload.providerResult?.status || payload.job.status}）`,
        'success'
      )
    } catch (error: any) {
      showToast(error.message || '重试任务失败', 'error')
    } finally {
      setIsVideoGenerationBusy(false)
    }
  }

  const cancelVideoGenerationJob = async (jobId: string) => {
    const normalizedJobId = jobId.trim()
    if (!normalizedJobId) return
    if (isVideoGenerationBusy) return
    setIsVideoGenerationBusy(true)
    try {
      const payload = await requestJson<{
        success: boolean
        job: VideoGenerationJob
        cancelResult?: { state?: string } | null
      }>(`/api/video/generations/${encodeURIComponent(normalizedJobId)}/cancel`, {
        method: 'POST'
      })
      setVideoGenerationSelectedJobId(payload.job.id)
      upsertVideoGenerationJob(payload.job)
      showToast(
        `取消结果：${payload.cancelResult?.state || payload.job.status}`,
        payload.job.status === 'canceled' ? 'success' : 'info'
      )
    } catch (error: any) {
      showToast(error.message || '取消任务失败', 'error')
    } finally {
      setIsVideoGenerationBusy(false)
    }
  }

  const refreshVideoGenerationJobDetail = async (jobId: string) => {
    await queryVideoGenerationJobDetail(jobId)
  }

  useEffect(() => {
    if (labMode !== 'creative' || !authProfile) return
    if (!capabilities && !isCapabilitiesLoading) {
      void loadCapabilities()
    }
    if (videoGenerationJobs.length === 0) {
      void loadVideoGenerationJobs(false, { silent: true })
    }
  }, [
    authProfile,
    capabilities,
    isCapabilitiesLoading,
    labMode,
    loadCapabilities,
    loadVideoGenerationJobs,
    videoGenerationJobs.length
  ])

  useEffect(() => {
    if (labMode !== 'creative' || !authProfile || !videoGenerationPollingEnabled) return
    if (isVideoGenerationBusy) return
    const trackedJobs = videoGenerationJobs.filter(
      (job) =>
        job.status === 'queued' ||
        job.status === 'submitted' ||
        job.status === 'processing' ||
        job.status === 'cancel_requested'
    )
    if (trackedJobs.length === 0 && !videoGenerationSelectedJobId) return

    const timer = window.setInterval(() => {
      void loadVideoGenerationJobs(false, { silent: true })
      const candidateJobId = videoGenerationSelectedJobId || trackedJobs[0]?.id || ''
      if (candidateJobId) {
        void syncVideoGenerationJob(candidateJobId, { silent: true })
      }
    }, 6_000)

    return () => {
      window.clearInterval(timer)
    }
  }, [
    authProfile,
    isVideoGenerationBusy,
    labMode,
    loadVideoGenerationJobs,
    queryVideoGenerationJobDetail,
    videoGenerationJobs,
    videoGenerationPollingEnabled,
    videoGenerationSelectedJobId
  ])

  const refreshV4Workflows = async () => {
    setIsV4CreativeBusy(true)
    try {
      const payload = await requestV4<{ success: boolean; workflows: V4Workflow[] }>(
        '/creative/prompt-workflows'
      )
      const rows = payload.workflows || []
      setV4Workflows(rows)
      if (!v4SelectedWorkflowId || rows.every((item) => item.id !== v4SelectedWorkflowId)) {
        setV4SelectedWorkflowId(rows[0]?.id || '')
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '加载 workflow 失败'
      showToast(message || '加载 workflow 失败', 'error')
    } finally {
      setIsV4CreativeBusy(false)
    }
  }

  const createV4Workflow = async () => {
    if (!v4WorkflowName.trim()) {
      showToast('请输入 workflow 名称', 'info')
      return
    }
    if (isV4CreativeBusy) return
    setIsV4CreativeBusy(true)
    try {
      const payload = await requestV4<{ success: boolean; workflow: V4Workflow }>(
        '/creative/prompt-workflows',
        {
          method: 'POST',
          body: JSON.stringify({
            name: v4WorkflowName.trim(),
            description: v4WorkflowDescription.trim() || undefined
          })
        },
        {
          retry: {
            idempotent: true,
            maxRetries: 1
          }
        }
      )
      if (payload.workflow) {
        setV4Workflows((prev) => [
          payload.workflow,
          ...prev.filter((item) => item.id !== payload.workflow.id)
        ])
        setV4SelectedWorkflowId(payload.workflow.id)
      }
      showToast('v4 Workflow 创建成功', 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '创建 workflow 失败'
      showToast(message || '创建 workflow 失败', 'error')
    } finally {
      setIsV4CreativeBusy(false)
    }
  }

  const runV4Workflow = async () => {
    if (!v4SelectedWorkflowId) {
      showToast('请先选择 workflow', 'info')
      return
    }
    const input = parseJsonObjectInput(v4WorkflowRunPayload, 'Workflow Run Payload')
    if (!input) return
    if (isV4CreativeBusy) return
    setIsV4CreativeBusy(true)
    try {
      const payload = await requestV4<{ success: boolean; run: V4WorkflowRun }>(
        `/creative/prompt-workflows/${encodeURIComponent(v4SelectedWorkflowId)}/run`,
        {
          method: 'POST',
          body: JSON.stringify({
            triggerType: 'manual',
            input
          })
        }
      )
      setV4WorkflowRunResult(payload.run || null)
      if (payload.run) {
        setV4WorkflowRuns((prev) => [
          payload.run,
          ...prev.filter((item) => item.id !== payload.run.id)
        ])
      }
      showToast(`Workflow 已触发：${payload.run?.id || '-'}`, 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '运行 workflow 失败'
      showToast(message || '运行 workflow 失败', 'error')
    } finally {
      setIsV4CreativeBusy(false)
    }
  }

  const queryV4WorkflowRuns = async (append = false) => {
    if (!v4SelectedWorkflowId) {
      showToast('请先选择 workflow', 'info')
      return
    }
    const limitRaw = v4WorkflowRunsLimit.trim() || '20'
    const limit = Number.parseInt(limitRaw, 10)
    if (!Number.isFinite(limit) || limit <= 0) {
      showToast('Workflow runs limit 必须是大于 0 的整数', 'warning')
      return
    }
    const nextCursor = append ? v4WorkflowRunsCursor.trim() : ''
    if (append && !nextCursor) {
      setV4WorkflowRunsHasMore(false)
      return
    }
    if (isV4CreativeBusy) return
    setIsV4CreativeBusy(true)
    try {
      const query = new URLSearchParams({
        limit: String(Math.min(limit, 200))
      })
      if (nextCursor) query.set('cursor', nextCursor)
      const payload = await requestV4<{
        success: boolean
        runs: V4WorkflowRun[]
        page?: {
          cursor?: string | null
          nextCursor?: string | null
          limit?: number
          hasMore?: boolean
        }
      }>(
        `/creative/prompt-workflows/${encodeURIComponent(v4SelectedWorkflowId)}/runs?${query.toString()}`
      )
      const rows = payload.runs || []
      const merged = append
        ? [
            ...v4WorkflowRuns,
            ...rows.filter((item) => v4WorkflowRuns.every((prev) => prev.id !== item.id))
          ]
        : rows
      setV4WorkflowRuns(merged)
      const inferredCursor = rows.length > 0 ? rows[rows.length - 1]?.createdAt || '' : ''
      const cursorFromPage =
        typeof payload.page?.nextCursor === 'string'
          ? payload.page.nextCursor
          : typeof payload.page?.cursor === 'string'
            ? payload.page.cursor
            : inferredCursor
      const hasMore =
        typeof payload.page?.hasMore === 'boolean'
          ? payload.page.hasMore
          : rows.length >= Math.min(limit, 200)
      setV4WorkflowRunsCursor(cursorFromPage || '')
      setV4WorkflowRunsHasMore(Boolean(cursorFromPage) && hasMore)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '加载 Workflow runs 失败'
      showToast(message || '加载 Workflow runs 失败', 'error')
    } finally {
      setIsV4CreativeBusy(false)
    }
  }

  const createV4BatchJob = async () => {
    if (!v4BatchJobType.trim()) {
      showToast('请输入 batch job 类型', 'info')
      return
    }
    const input = parseJsonObjectInput(v4BatchJobPayload, 'Batch Job Payload')
    if (!input) return
    if (isV4CreativeBusy) return
    setIsV4CreativeBusy(true)
    try {
      const workflowRunId =
        typeof input.workflowRunId === 'string' && input.workflowRunId.trim()
          ? input.workflowRunId.trim()
          : undefined
      const createdBy =
        typeof input.createdBy === 'string' && input.createdBy.trim()
          ? input.createdBy.trim()
          : undefined
      const items = Array.isArray(input.items)
        ? input.items
            .map((item, index) => {
              if (!item || typeof item !== 'object' || Array.isArray(item)) return null
              const row = item as Record<string, unknown>
              const itemInput =
                row.input && typeof row.input === 'object' && !Array.isArray(row.input)
                  ? (row.input as Record<string, unknown>)
                  : undefined
              const itemKeyRaw = typeof row.itemKey === 'string' ? row.itemKey.trim() : ''
              return {
                itemKey: itemKeyRaw || `item-${index + 1}`,
                input: itemInput
              }
            })
            .filter(
              (item): item is { itemKey: string; input: Record<string, unknown> | undefined } =>
                Boolean(item)
            )
        : undefined
      const explicitPayload =
        input.payload && typeof input.payload === 'object' && !Array.isArray(input.payload)
          ? (input.payload as Record<string, unknown>)
          : null
      const fallbackPayload = Object.entries(input).reduce<Record<string, unknown>>(
        (acc, [key, value]) => {
          if (
            key === 'workflowRunId' ||
            key === 'items' ||
            key === 'createdBy' ||
            key === 'payload'
          ) {
            return acc
          }
          acc[key] = value
          return acc
        },
        {}
      )
      const payloadInput = explicitPayload || fallbackPayload
      const payloadRecord = Object.keys(payloadInput).length > 0 ? payloadInput : undefined

      const payload = await requestV4<{ success: boolean; job: V4BatchJob }>(
        '/creative/batch-jobs',
        {
          method: 'POST',
          body: JSON.stringify({
            workflowRunId,
            jobType: v4BatchJobType.trim(),
            payload: payloadRecord,
            items,
            createdBy
          })
        }
      )
      setV4BatchJobStatus(payload.job || null)
      setV4BatchJobId(payload.job?.id || '')
      showToast(`Batch Job 已创建：${payload.job?.id || '-'}`, 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '创建 batch job 失败'
      showToast(message || '创建 batch job 失败', 'error')
    } finally {
      setIsV4CreativeBusy(false)
    }
  }

  const queryV4BatchJob = async () => {
    const jobId = v4BatchJobId.trim()
    if (!jobId) {
      showToast('请填写 Batch Job ID', 'info')
      return
    }
    if (isV4CreativeBusy) return
    setIsV4CreativeBusy(true)
    try {
      const payload = await requestV4<{ success: boolean; job: V4BatchJob }>(
        `/creative/batch-jobs/${encodeURIComponent(jobId)}`
      )
      setV4BatchJobStatus(payload.job || null)
      showToast(`Batch Job 状态：${payload.job?.status || '-'}`, 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '查询 batch job 失败'
      showToast(message || '查询 batch job 失败', 'error')
    } finally {
      setIsV4CreativeBusy(false)
    }
  }

  const callV4AssetReuse = async () => {
    if (!v4AssetReuseSourceId.trim() || !v4AssetReuseTargetId.trim()) {
      showToast('请填写来源 Asset 与目标 ID', 'info')
      return
    }
    if (isV4CreativeBusy) return
    setIsV4CreativeBusy(true)
    try {
      const assetId = v4AssetReuseSourceId.trim()
      const payload = await requestV4<{ success: boolean; record: V4AssetReuseResult }>(
        `/assets/${encodeURIComponent(assetId)}/reuse`,
        {
          method: 'POST',
          body: JSON.stringify({
            sourceProjectId: projectId || undefined,
            targetProjectId: v4AssetReuseTargetId.trim() || undefined,
            reusedBy: currentActorName || undefined,
            context: {
              note: v4AssetReuseNote.trim() || undefined,
              source: 'comparison-lab'
            }
          })
        }
      )
      setV4AssetReuseResult(payload.record || null)
      if (
        payload.record &&
        (!v4AssetReuseHistoryAssetId.trim() ||
          v4AssetReuseHistoryAssetId.trim() === payload.record.assetId)
      ) {
        setV4AssetReuseHistoryRecords((prev) => [
          payload.record,
          ...prev.filter((item) => item.id !== payload.record.id)
        ])
      }
      showToast(`Asset Reuse 记录已创建：${payload.record?.id || '-'}`, 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Asset Reuse 调用失败'
      showToast(message || 'Asset Reuse 调用失败', 'error')
    } finally {
      setIsV4CreativeBusy(false)
    }
  }

  const queryV4AssetReuseHistory = async () => {
    const limitRaw = v4AssetReuseHistoryLimit.trim() || '20'
    const limit = Number.parseInt(limitRaw, 10)
    if (!Number.isFinite(limit) || limit <= 0) {
      showToast('资产复用历史 limit 必须是大于 0 的整数', 'warning')
      return
    }
    const offsetRaw = v4AssetReuseHistoryOffset.trim() || '0'
    const offset = Number.parseInt(offsetRaw, 10)
    if (!Number.isFinite(offset) || offset < 0) {
      showToast('资产复用历史 offset 必须是大于等于 0 的整数', 'warning')
      return
    }
    if (isV4CreativeBusy) return
    setIsV4CreativeBusy(true)
    try {
      const query = new URLSearchParams({
        limit: String(Math.min(limit, 200)),
        offset: String(offset)
      })
      const assetId = v4AssetReuseHistoryAssetId.trim()
      if (assetId) query.set('assetId', assetId)
      const sourceProjectId = v4AssetReuseHistorySourceProjectId.trim()
      if (sourceProjectId) query.set('sourceProjectId', sourceProjectId)
      const targetProjectId = v4AssetReuseHistoryTargetProjectId.trim()
      if (targetProjectId) query.set('targetProjectId', targetProjectId)
      const payload = await requestV4<{ success: boolean; records: V4AssetReuseRecord[] }>(
        `/assets/reuse-history?${query.toString()}`
      )
      const records = payload.records || []
      setV4AssetReuseHistoryRecords(records)
      showToast(`资产复用历史已加载 ${records.length} 条`, 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '查询资产复用历史失败'
      showToast(message || '查询资产复用历史失败', 'error')
    } finally {
      setIsV4CreativeBusy(false)
    }
  }

  const loadV4CommentThreads = async (append = false) => {
    if (!projectId) {
      setV4CommentThreads([])
      setV4SelectedThreadId('')
      setV4CommentThreadCursor('')
      setV4CommentThreadHasMore(false)
      return
    }
    const limitRaw = v4CommentThreadLimit.trim() || '20'
    const limit = Number.parseInt(limitRaw, 10)
    if (!Number.isFinite(limit) || limit <= 0) {
      showToast('评论线程 limit 必须是大于 0 的整数', 'warning')
      return
    }
    const nextCursor = append ? v4CommentThreadCursor.trim() : ''
    if (append && !nextCursor) {
      setV4CommentThreadHasMore(false)
      return
    }
    if (isV4CollabBusy) return
    setIsV4CollabBusy(true)
    try {
      const query = new URLSearchParams({
        limit: String(Math.min(limit, 100))
      })
      if (nextCursor) query.set('cursor', nextCursor)
      const payload = await requestV4<{
        success: boolean
        threads: V4CommentThread[]
        page?: {
          cursor?: string | null
          nextCursor?: string | null
          limit?: number
          hasMore?: boolean
        }
      }>(`/projects/${projectId}/comment-threads?${query.toString()}`)
      const rows = payload.threads || []
      const merged = append
        ? [
            ...v4CommentThreads,
            ...rows.filter((item) => v4CommentThreads.every((prev) => prev.id !== item.id))
          ]
        : rows
      setV4CommentThreads(merged)
      const inferredCursor = rows.length > 0 ? rows[rows.length - 1]?.createdAt || '' : ''
      const cursorFromPage =
        typeof payload.page?.nextCursor === 'string'
          ? payload.page.nextCursor
          : typeof payload.page?.cursor === 'string'
            ? payload.page.cursor
            : inferredCursor
      const hasMore =
        typeof payload.page?.hasMore === 'boolean'
          ? payload.page.hasMore
          : rows.length >= Math.min(limit, 100)
      setV4CommentThreadCursor(cursorFromPage || '')
      setV4CommentThreadHasMore(Boolean(cursorFromPage) && hasMore)
      if (!v4SelectedThreadId || merged.every((item) => item.id !== v4SelectedThreadId)) {
        setV4SelectedThreadId(merged[0]?.id || '')
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '加载评论线程失败'
      showToast(message || '加载评论线程失败', 'error')
    } finally {
      setIsV4CollabBusy(false)
    }
  }

  const refreshV4CommentThreads = async () => {
    await loadV4CommentThreads(false)
  }

  const loadMoreV4CommentThreads = async () => {
    await loadV4CommentThreads(true)
  }

  const createV4CommentThread = async () => {
    if (!projectId) {
      showToast('请先创建或加入项目', 'info')
      return
    }
    if (!v4CommentContent.trim()) {
      showToast('请输入评论内容', 'info')
      return
    }
    if (isV4CollabBusy) return
    setIsV4CollabBusy(true)
    try {
      const mentions = parseMentionsInput(v4CommentMentions)
      const payload = await requestV4<{ success: boolean; thread: V4CommentThread }>(
        `/projects/${projectId}/comment-threads`,
        {
          method: 'POST',
          body: JSON.stringify({
            anchor: v4CommentAnchor.trim() || undefined,
            content: v4CommentContent.trim(),
            mentions: mentions.length > 0 ? mentions : undefined
          })
        }
      )
      if (payload.thread) {
        setV4CommentThreads((prev) => [
          payload.thread,
          ...prev.filter((item) => item.id !== payload.thread.id)
        ])
        setV4SelectedThreadId(payload.thread.id)
      }
      setV4CommentContent('')
      setV4CommentMentions('')
      showToast('评论线程已创建', 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '创建评论线程失败'
      showToast(message || '创建评论线程失败', 'error')
    } finally {
      setIsV4CollabBusy(false)
    }
  }

  const replyV4CommentThread = async () => {
    if (!projectId || !v4SelectedThreadId) {
      showToast('请先选择线程', 'info')
      return
    }
    if (!v4CommentReplyContent.trim()) {
      showToast('请输入回复内容', 'info')
      return
    }
    if (isV4CollabBusy) return
    setIsV4CollabBusy(true)
    try {
      const mentions = parseMentionsInput(v4CommentReplyMentions)
      const payload = await requestV4<{
        success: boolean
        thread?: V4CommentThread
      }>(`/projects/${projectId}/comment-threads/${v4SelectedThreadId}/replies`, {
        method: 'POST',
        body: JSON.stringify({
          content: v4CommentReplyContent.trim(),
          mentions: mentions.length > 0 ? mentions : undefined
        })
      })
      if (payload.thread) {
        setV4CommentThreads((prev) =>
          prev.map((item) => (item.id === payload.thread?.id ? payload.thread : item))
        )
      } else {
        await refreshV4CommentThreads()
      }
      setV4CommentReplyContent('')
      setV4CommentReplyMentions('')
      showToast('线程回复成功', 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '回复线程失败'
      showToast(message || '回复线程失败', 'error')
    } finally {
      setIsV4CollabBusy(false)
    }
  }

  const resolveV4CommentThread = async () => {
    if (!projectId || !v4SelectedThreadId) {
      showToast('请先选择线程', 'info')
      return
    }
    if (isV4CollabBusy) return
    setIsV4CollabBusy(true)
    try {
      const payload = await requestV4<{ success: boolean; thread: V4CommentThread }>(
        `/projects/${projectId}/comment-threads/${v4SelectedThreadId}/resolve`,
        {
          method: 'POST'
        }
      )
      if (payload.thread) {
        setV4CommentThreads((prev) =>
          prev.map((item) => (item.id === payload.thread.id ? payload.thread : item))
        )
      }
      showToast('线程已标记为 Resolve', 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Resolve 线程失败'
      showToast(message || 'Resolve 线程失败', 'error')
    } finally {
      setIsV4CollabBusy(false)
    }
  }

  const loadProjectComments = async (append = false) => {
    if (!projectId) {
      setProjectComments([])
      setProjectSelectedCommentId('')
      setProjectCommentCursor('')
      setProjectCommentHasMore(false)
      return
    }
    const limit = normalizeProjectGovernanceLimit(projectCommentLimit, 20)
    const nextCursor = append ? projectCommentCursor.trim() : ''
    if (append && !nextCursor) {
      setProjectCommentHasMore(false)
      return
    }
    if (isProjectGovernanceBusy) return
    setIsProjectGovernanceBusy(true)
    try {
      const payload = await listProjectGovernanceComments(projectId, {
        limit,
        cursor: nextCursor || undefined
      })
      const rows = payload.comments || []
      const merged = append
        ? [
            ...projectComments,
            ...rows.filter((item) => projectComments.every((prev) => prev.id !== item.id))
          ]
        : rows
      setProjectComments(merged)
      const cursor = payload.page.nextCursor || ''
      const hasMore = Boolean(cursor) && payload.page.hasMore
      setProjectCommentCursor(cursor)
      setProjectCommentHasMore(hasMore)
      if (
        !projectSelectedCommentId ||
        merged.every((item) => item.id !== projectSelectedCommentId)
      ) {
        setProjectSelectedCommentId(merged[0]?.id || '')
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '加载项目评论失败'
      showToast(message || '加载项目评论失败', 'error')
    } finally {
      setIsProjectGovernanceBusy(false)
    }
  }

  const createProjectCommentEntry = async () => {
    if (!projectId) {
      showToast('请先创建或加入项目', 'info')
      return
    }
    if (!projectCommentContent.trim()) {
      showToast('请输入评论内容', 'info')
      return
    }
    if (isProjectGovernanceBusy) return
    setIsProjectGovernanceBusy(true)
    try {
      const comment = await createProjectGovernanceComment(projectId, {
        anchor: projectCommentAnchor.trim() || undefined,
        content: projectCommentContent.trim(),
        mentions: parseMentionsInput(projectCommentMentions)
      })
      if (comment) {
        setProjectComments((prev) => [comment, ...prev.filter((item) => item.id !== comment.id)])
        setProjectSelectedCommentId(comment.id)
      }
      setProjectCommentContent('')
      setProjectCommentMentions('')
      showToast('项目评论已创建', 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '创建项目评论失败'
      showToast(message || '创建项目评论失败', 'error')
    } finally {
      setIsProjectGovernanceBusy(false)
    }
  }

  const resolveProjectCommentEntry = async () => {
    if (!projectId || !projectSelectedCommentId.trim()) {
      showToast('请先选择评论', 'info')
      return
    }
    if (isProjectGovernanceBusy) return
    setIsProjectGovernanceBusy(true)
    try {
      const comment = await resolveProjectGovernanceComment(projectId, projectSelectedCommentId)
      if (comment) {
        setProjectComments((prev) => prev.map((item) => (item.id === comment.id ? comment : item)))
      }
      showToast('项目评论已标记为已解决', 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '标记项目评论失败'
      showToast(message || '标记项目评论失败', 'error')
    } finally {
      setIsProjectGovernanceBusy(false)
    }
  }

  const loadProjectReviews = async () => {
    if (!projectId) {
      setProjectReviews([])
      return
    }
    const limit = normalizeProjectGovernanceLimit(projectReviewLimit, 20)
    if (isProjectGovernanceBusy) return
    setIsProjectGovernanceBusy(true)
    try {
      const rows = await listProjectGovernanceReviews(projectId, { limit })
      setProjectReviews(rows)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '加载项目评审失败'
      showToast(message || '加载项目评审失败', 'error')
    } finally {
      setIsProjectGovernanceBusy(false)
    }
  }

  const createProjectReviewEntry = async () => {
    if (!projectId) {
      showToast('请先创建或加入项目', 'info')
      return
    }
    if (!projectReviewSummary.trim()) {
      showToast('请输入评审摘要', 'info')
      return
    }
    let score: number | undefined
    const scoreRaw = projectReviewScore.trim()
    if (scoreRaw) {
      score = Number.parseFloat(scoreRaw)
      if (!Number.isFinite(score)) {
        showToast('评分必须为数字', 'warning')
        return
      }
    }
    if (isProjectGovernanceBusy) return
    setIsProjectGovernanceBusy(true)
    try {
      const review = await createProjectGovernanceReview(projectId, {
        decision: projectReviewDecision,
        summary: projectReviewSummary.trim(),
        score
      })
      if (review) {
        setProjectReviews((prev) => [review, ...prev.filter((item) => item.id !== review.id)])
      }
      setProjectReviewSummary('')
      setProjectReviewScore('')
      showToast('项目评审已提交', 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '提交项目评审失败'
      showToast(message || '提交项目评审失败', 'error')
    } finally {
      setIsProjectGovernanceBusy(false)
    }
  }

  const loadProjectTemplates = async () => {
    if (!projectId) {
      setProjectTemplates([])
      setProjectSelectedTemplateId('')
      return
    }
    if (isProjectGovernanceBusy) return
    setIsProjectGovernanceBusy(true)
    try {
      const rows = await listProjectGovernanceTemplates(projectId)
      setProjectTemplates(rows)
      if (
        !projectSelectedTemplateId ||
        rows.every((item) => item.id !== projectSelectedTemplateId)
      ) {
        setProjectSelectedTemplateId(rows[0]?.id || '')
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '加载项目模板失败'
      showToast(message || '加载项目模板失败', 'error')
    } finally {
      setIsProjectGovernanceBusy(false)
    }
  }

  const applyProjectTemplateEntry = async () => {
    if (!projectId) {
      showToast('请先创建或加入项目', 'info')
      return
    }
    if (!projectSelectedTemplateId.trim()) {
      showToast('请先选择模板', 'info')
      return
    }
    const options = parseJsonObjectInput(projectTemplateApplyOptions, '模板应用参数')
    if (!options) return
    if (isProjectGovernanceBusy) return
    setIsProjectGovernanceBusy(true)
    try {
      const result = await applyProjectGovernanceTemplate(projectId, {
        templateId: projectSelectedTemplateId.trim(),
        options: Object.keys(options).length > 0 ? options : undefined
      })
      setProjectTemplateApplyResult(result || null)
      showToast(`模板应用成功：${result?.traceId || '-'}`, 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '应用模板失败'
      showToast(message || '应用模板失败', 'error')
    } finally {
      setIsProjectGovernanceBusy(false)
    }
  }

  const batchUpdateProjectClipsEntry = async () => {
    if (!projectId) {
      showToast('请先创建或加入项目', 'info')
      return
    }
    const operationsRaw = parseJsonArrayInput(projectClipBatchOperations, '片段批量更新操作')
    if (!operationsRaw) return
    const operations = operationsRaw
      .map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return null
        const row = item as Record<string, unknown>
        const clipId = typeof row.clipId === 'string' ? row.clipId.trim() : ''
        const patch =
          row.patch && typeof row.patch === 'object' && !Array.isArray(row.patch)
            ? (row.patch as Record<string, unknown>)
            : null
        if (!clipId || !patch) return null
        return { clipId, patch }
      })
      .filter((item): item is { clipId: string; patch: Record<string, unknown> } => Boolean(item))
    if (operations.length === 0) {
      showToast('至少提供一条有效操作（clipId + patch）', 'warning')
      return
    }
    if (isProjectGovernanceBusy) return
    setIsProjectGovernanceBusy(true)
    try {
      const result = await batchUpdateProjectGovernanceClips(projectId, operations)
      setProjectClipBatchResult(result || null)
      showToast(`片段批量更新完成：accepted ${result?.accepted ?? 0}`, 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '片段批量更新失败'
      showToast(message || '片段批量更新失败', 'error')
    } finally {
      setIsProjectGovernanceBusy(false)
    }
  }

  const refreshV4Permissions = async () => {
    if (!workspaceId) {
      setV4Permissions([])
      return
    }
    if (isV4CollabBusy) return
    setIsV4CollabBusy(true)
    try {
      const payload = await requestV4<{ success: boolean; permissions: V4PermissionGrant[] }>(
        `/workspaces/${workspaceId}/permissions`
      )
      setV4Permissions(payload.permissions || [])
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '加载权限失败'
      showToast(message || '加载权限失败', 'error')
    } finally {
      setIsV4CollabBusy(false)
    }
  }

  const updateV4Permission = async () => {
    if (!workspaceId) {
      showToast('请先创建或加入工作区', 'info')
      return
    }
    const rawPermissionInput = v4PermissionSubjectId.trim()
    if (!rawPermissionInput) {
      showToast('请输入权限键（如 timeline.merge）', 'info')
      return
    }
    let permissionKey = rawPermissionInput
    let allowed = true
    if (rawPermissionInput.includes('=')) {
      const [left, ...rightParts] = rawPermissionInput.split('=')
      permissionKey = left.trim()
      const normalizedValue = rightParts.join('=').trim().toLowerCase()
      if (['true', '1', 'yes', 'on', 'allow', 'allowed'].includes(normalizedValue)) {
        allowed = true
      } else if (['false', '0', 'no', 'off', 'deny', 'denied'].includes(normalizedValue)) {
        allowed = false
      } else {
        showToast('权限值仅支持 true/false，例如 timeline.merge=true', 'warning')
        return
      }
    }
    if (!permissionKey) {
      showToast('请输入有效权限键（如 timeline.merge）', 'info')
      return
    }
    if (isV4CollabBusy) return
    setIsV4CollabBusy(true)
    try {
      const currentRolePermission = v4Permissions.find((item) => item.role === v4PermissionRole)
      const mergedPermissions = {
        ...(currentRolePermission?.permissions || {}),
        [permissionKey]: allowed
      }
      const payload = await requestV4<{ success: boolean; permission?: V4PermissionGrant }>(
        `/workspaces/${workspaceId}/permissions/${v4PermissionRole}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            permissions: mergedPermissions,
            updatedBy: currentActorName || undefined
          })
        }
      )
      const nextPermission = payload.permission
      if (nextPermission) {
        setV4Permissions((prev) => [
          nextPermission,
          ...prev.filter((item) => item.role !== nextPermission.role)
        ])
      } else {
        await refreshV4Permissions()
      }
      showToast(`权限已更新：${permissionKey}=${allowed}`, 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '更新权限失败'
      showToast(message || '更新权限失败', 'error')
    } finally {
      setIsV4CollabBusy(false)
    }
  }

  const mergeV4Timeline = async () => {
    if (!projectId) {
      showToast('请先创建或加入项目', 'info')
      return
    }
    if (isV4CollabBusy) return
    setIsV4CollabBusy(true)
    try {
      const payload = await requestV4<{ success: boolean; merge: V4TimelineMergeResult }>(
        `/projects/${projectId}/timeline/merge`,
        {
          method: 'POST',
          body: JSON.stringify({
            result: {
              source: 'comparison-lab',
              actorName: currentActorName
            }
          })
        }
      )
      setV4TimelineMergeResult(payload.merge || null)
      showToast(`Timeline Merge 已触发：${payload.merge?.status || '-'}`, 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Timeline Merge 调用失败'
      showToast(message || 'Timeline Merge 调用失败', 'error')
    } finally {
      setIsV4CollabBusy(false)
    }
  }

  const loadV4ReliabilityAlerts = async () => {
    const limitRaw = v4ReliabilityAlertLimit.trim() || '20'
    const limit = Number.parseInt(limitRaw, 10)
    if (!Number.isFinite(limit) || limit <= 0) {
      showToast('告警查询 limit 必须是大于 0 的整数', 'warning')
      return
    }
    if (isV4OpsBusy) return
    setIsV4OpsBusy(true)
    try {
      const query = new URLSearchParams({
        limit: String(Math.min(limit, 200))
      })
      if (v4ReliabilityAlertLevel !== 'all') query.set('level', v4ReliabilityAlertLevel)
      if (v4ReliabilityAlertStatus !== 'all') query.set('status', v4ReliabilityAlertStatus)
      const payload = await requestV4<{ success: boolean; alerts: V4ReliabilityAlert[] }>(
        `/admin/reliability/alerts?${query.toString()}`,
        {
          headers: buildV4AdminHeaders()
        }
      )
      const alerts = payload.alerts || []
      setV4ReliabilityAlerts(alerts)
      showToast(`可靠性告警已加载 ${alerts.length} 条`, 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '加载可靠性告警失败'
      showToast(message || '加载可靠性告警失败', 'error')
    } finally {
      setIsV4OpsBusy(false)
    }
  }

  const acknowledgeV4ReliabilityAlert = async (alertId: string) => {
    const normalizedAlertId = alertId.trim()
    if (!normalizedAlertId) return
    if (isV4OpsBusy) return
    setIsV4OpsBusy(true)
    try {
      const payload = await requestV4<{
        success: boolean
        alert?: V4ReliabilityAlert
      }>(`/admin/reliability/alerts/${encodeURIComponent(normalizedAlertId)}/ack`, {
        method: 'POST',
        headers: buildV4AdminHeaders(),
        body: JSON.stringify({
          acknowledgedBy: currentActorName || undefined
        })
      })
      const acknowledgedAt = payload.alert?.acknowledgedAt || new Date().toISOString()
      setV4ReliabilityAlerts((prev) =>
        prev.map((item) => {
          if (item.id !== normalizedAlertId) return item
          return (
            payload.alert || {
              ...item,
              status: 'acknowledged',
              acknowledgedAt
            }
          )
        })
      )
      showToast('告警已 ACK', 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'ACK 告警失败'
      showToast(message || 'ACK 告警失败', 'error')
    } finally {
      setIsV4OpsBusy(false)
    }
  }

  const loadV4ErrorBudget = async () => {
    if (isV4OpsBusy) return
    setIsV4OpsBusy(true)
    try {
      const payload = await requestV4<{
        success: boolean
        policy: V4ErrorBudget['policy']
        evaluation: V4ErrorBudget['evaluation']
      }>('/admin/reliability/error-budget', {
        headers: buildV4AdminHeaders()
      })
      setV4ErrorBudget(
        payload.policy && payload.evaluation
          ? {
              policy: payload.policy,
              evaluation: payload.evaluation
            }
          : null
      )
      if (payload.policy) {
        setV4ErrorBudgetScope(payload.policy.scope || 'global')
        setV4ErrorBudgetTargetSlo(String(payload.policy.targetSlo))
        setV4ErrorBudgetWindowDays(String(payload.policy.windowDays))
        setV4ErrorBudgetWarningThresholdRatio(String(payload.policy.warningThresholdRatio))
        setV4ErrorBudgetAlertThresholdRatio(String(payload.policy.alertThresholdRatio))
        setV4ErrorBudgetFreezeDeployOnBreach(Boolean(payload.policy.freezeDeployOnBreach))
      }
      showToast('错误预算读取成功', 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '读取错误预算失败'
      showToast(message || '读取错误预算失败', 'error')
    } finally {
      setIsV4OpsBusy(false)
    }
  }

  const updateV4ErrorBudget = async () => {
    const targetSlo = Number.parseFloat(v4ErrorBudgetTargetSlo.trim() || '0.99')
    if (!Number.isFinite(targetSlo) || targetSlo < 0.5 || targetSlo > 0.99999) {
      showToast('targetSlo 必须在 0.5 ~ 0.99999 之间', 'warning')
      return
    }
    const windowDays = Number.parseInt(v4ErrorBudgetWindowDays.trim() || '30', 10)
    if (!Number.isFinite(windowDays) || windowDays < 1 || windowDays > 3650) {
      showToast('windowDays 必须是 1 ~ 3650 的整数', 'warning')
      return
    }
    const warningThresholdRatio = Number.parseFloat(
      v4ErrorBudgetWarningThresholdRatio.trim() || '0.7'
    )
    if (
      !Number.isFinite(warningThresholdRatio) ||
      warningThresholdRatio < 0 ||
      warningThresholdRatio > 1
    ) {
      showToast('warningThresholdRatio 必须在 0 ~ 1 之间', 'warning')
      return
    }
    const alertThresholdRatio = Number.parseFloat(v4ErrorBudgetAlertThresholdRatio.trim() || '0.9')
    if (
      !Number.isFinite(alertThresholdRatio) ||
      alertThresholdRatio < 0 ||
      alertThresholdRatio > 1
    ) {
      showToast('alertThresholdRatio 必须在 0 ~ 1 之间', 'warning')
      return
    }
    if (warningThresholdRatio > alertThresholdRatio) {
      showToast('warningThresholdRatio 不能大于 alertThresholdRatio', 'warning')
      return
    }
    if (isV4OpsBusy) return
    setIsV4OpsBusy(true)
    try {
      const payload = await requestV4<{
        success: boolean
        policy: V4ErrorBudget['policy']
        evaluation: V4ErrorBudget['evaluation']
      }>('/admin/reliability/error-budget', {
        method: 'PUT',
        headers: buildV4AdminHeaders(),
        body: JSON.stringify({
          policyId: v4ErrorBudget?.policy.id || undefined,
          scope: v4ErrorBudgetScope.trim() || undefined,
          targetSlo,
          windowDays,
          warningThresholdRatio,
          alertThresholdRatio,
          freezeDeployOnBreach: v4ErrorBudgetFreezeDeployOnBreach,
          updatedBy: currentActorName || 'comparison-lab'
        })
      })
      if (payload.policy && payload.evaluation) {
        setV4ErrorBudget({
          policy: payload.policy,
          evaluation: payload.evaluation
        })
      }
      showToast('错误预算策略已更新', 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '更新错误预算策略失败'
      showToast(message || '更新错误预算策略失败', 'error')
    } finally {
      setIsV4OpsBusy(false)
    }
  }

  const triggerV4RollbackDrill = async () => {
    const plan = parseJsonObjectInput(v4RollbackPlan, '回滚演练 plan')
    if (!plan) return
    const result = parseJsonObjectInput(v4RollbackResult, '回滚演练 result')
    if (!result) return
    if (isV4OpsBusy) return
    setIsV4OpsBusy(true)
    try {
      const payload = await requestV4<{ success: boolean; drill: V4RollbackDrillResult }>(
        '/admin/reliability/drills/rollback',
        {
          method: 'POST',
          headers: buildV4AdminHeaders(),
          body: JSON.stringify({
            policyId: v4RollbackPolicyId.trim() || undefined,
            environment: v4RollbackEnvironment.trim() || undefined,
            initiatedBy: currentActorName || 'comparison-lab',
            triggerType: v4RollbackTriggerType.trim() || undefined,
            summary: v4RollbackSummary.trim() || undefined,
            plan,
            result
          })
        }
      )
      setV4RollbackDrillResult(payload.drill || null)
      if (payload.drill) {
        if (payload.drill.id) setV4RollbackDrillId(payload.drill.id)
        setV4RollbackPolicyId(payload.drill.policyId || '')
        setV4RollbackEnvironment(payload.drill.environment || '')
        setV4RollbackTriggerType(payload.drill.triggerType || '')
        setV4RollbackSummary(payload.drill.summary || '')
        setV4RollbackPlan(JSON.stringify(payload.drill.plan || {}, null, 2))
        setV4RollbackResult(JSON.stringify(payload.drill.result || {}, null, 2))
      }
      showToast(`回滚演练已触发：${payload.drill?.id || '-'}`, 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '触发回滚演练失败'
      showToast(message || '触发回滚演练失败', 'error')
    } finally {
      setIsV4OpsBusy(false)
    }
  }

  const queryV4RollbackDrill = async () => {
    const targetDrillId = v4RollbackDrillId.trim() || v4RollbackDrillResult?.id || ''
    if (!targetDrillId) {
      showToast('请填写演练 ID 或先触发一次演练', 'info')
      return
    }
    if (isV4OpsBusy) return
    setIsV4OpsBusy(true)
    try {
      const payload = await requestV4<{ success: boolean; drill: V4RollbackDrillResult }>(
        `/admin/reliability/drills/${encodeURIComponent(targetDrillId)}`,
        {
          headers: buildV4AdminHeaders()
        }
      )
      setV4RollbackDrillResult(payload.drill || null)
      if (payload.drill) {
        if (payload.drill.id) setV4RollbackDrillId(payload.drill.id)
        setV4RollbackPolicyId(payload.drill.policyId || '')
        setV4RollbackEnvironment(payload.drill.environment || '')
        setV4RollbackTriggerType(payload.drill.triggerType || '')
        setV4RollbackSummary(payload.drill.summary || '')
        setV4RollbackPlan(JSON.stringify(payload.drill.plan || {}, null, 2))
        setV4RollbackResult(JSON.stringify(payload.drill.result || {}, null, 2))
      }
      showToast(`演练状态：${payload.drill?.status || '-'}`, 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '查询回滚演练失败'
      showToast(message || '查询回滚演练失败', 'error')
    } finally {
      setIsV4OpsBusy(false)
    }
  }

  const refreshWorkspaceState = async (nextWorkspaceId?: string, nextProjectId?: string) => {
    const wid = nextWorkspaceId || workspaceId
    const pid = nextProjectId || projectId
    if (!wid) return

    try {
      const [presencePayload, eventsPayload] = await Promise.all([
        requestJson<{ success: boolean; members: CollabPresence[] }>(
          `/api/workspaces/${wid}/presence`
        ),
        requestJson<{ success: boolean; events: CollabEvent[] }>(
          `/api/workspaces/${wid}/collab/events?limit=50`
        )
      ])
      setPresence(presencePayload.members || [])
      setCollabEvents(eventsPayload.events || [])
    } catch (error: any) {
      showToast(error.message || '刷新协作状态失败', 'error')
    }

    if (pid) {
      try {
        const snapshotsPayload = await requestJson<{
          success: boolean
          snapshots: Array<{ id: string; actorName: string; createdAt: string }>
        }>(`/api/projects/${pid}/snapshots?limit=20`)
        setSnapshots(snapshotsPayload.snapshots || [])
      } catch {
        setSnapshots([])
      }
    }

    try {
      const invitesPayload = await requestJson<{ success: boolean; invites: WorkspaceInvite[] }>(
        `/api/workspaces/${wid}/invites`
      )
      setInvites(invitesPayload.invites || [])
    } catch {
      setInvites([])
    }
  }

  const createWorkspace = async () => {
    if (!authProfile) {
      showToast('请先登录后再创建工作区', 'info')
      setShowChannelPanel(true)
      return
    }
    if (!workspaceName.trim()) {
      showToast('请输入工作区名称', 'info')
      return
    }
    const idempotencyKey = buildIdempotencyKey('workspace:create')
    try {
      const payload = await requestJsonWithRetry<{
        success: boolean
        workspace: { id: string; organizationId?: string }
        defaultProject: { id: string }
        owner?: { name?: string; role?: WorkspaceRole }
      }>(
        '/api/workspaces',
        {
          method: 'POST',
          body: JSON.stringify({
            name: workspaceName.trim(),
            ownerName: workspaceOwner.trim() || 'Owner',
            organizationId: effectiveOrganizationId || undefined,
            idempotencyKey
          })
        },
        {
          idempotent: true
        }
      )
      setWorkspaceId(payload.workspace.id)
      if (payload.workspace.organizationId) {
        setSelectedOrganizationId(payload.workspace.organizationId)
        setOrganizationId(payload.workspace.organizationId)
      }
      setProjectId(payload.defaultProject.id)
      const ownerName = payload.owner?.name || workspaceOwner.trim() || 'Owner'
      setMemberName(ownerName)
      setCollabRole(payload.owner?.role || 'owner')
      markJourneyStep('workspace_ready', {
        organizationId: payload.workspace.organizationId || effectiveOrganizationId,
        workspaceId: payload.workspace.id
      })
      showToast('协作空间创建成功', 'success')
      await refreshWorkspaceState(payload.workspace.id, payload.defaultProject.id)
    } catch (error: any) {
      const { errorKind, httpStatus } = classifyRequestError(error)
      void reportJourney(false, {
        reason: 'workspace-create-failed',
        failedStage: 'workspace',
        errorKind,
        httpStatus
      })
      showToast(error.message || '创建工作区失败', 'error')
    }
  }

  const createInvite = async () => {
    if (!workspaceId) {
      showToast('请先创建工作区', 'info')
      return
    }
    if (collabRole !== 'owner') {
      showToast('仅 owner 可生成邀请', 'warning')
      return
    }
    try {
      const payload = await requestJson<{ success: boolean; invite: WorkspaceInvite }>(
        `/api/workspaces/${workspaceId}/invites`,
        {
          method: 'POST',
          body: JSON.stringify({
            role: inviteRole,
            expiresInHours: 24
          })
        }
      )
      setInviteCode(payload.invite.code)
      setInvites((prev) => [payload.invite, ...prev])
      showToast(`邀请已生成：${payload.invite.code}`, 'success')
    } catch (error: any) {
      showToast(error.message || '创建邀请失败', 'error')
    }
  }

  const acceptInvite = async () => {
    if (!inviteCode.trim()) {
      showToast('请输入邀请码', 'info')
      return
    }
    const idempotencyKey = buildIdempotencyKey('workspace:invite-accept')
    try {
      const payload = await requestJsonWithRetry<{
        success: boolean
        member: { role: WorkspaceRole } | null
        workspace: { id: string; organizationId?: string } | null
        defaultProject: { id: string } | null
      }>(
        `/api/workspaces/invites/${inviteCode.trim()}/accept`,
        {
          method: 'POST',
          body: JSON.stringify({
            memberName: currentActorName,
            idempotencyKey
          })
        },
        {
          idempotent: true
        }
      )
      if (payload.workspace?.id) setWorkspaceId(payload.workspace.id)
      if (payload.workspace?.organizationId) {
        setSelectedOrganizationId(payload.workspace.organizationId)
        setOrganizationId(payload.workspace.organizationId)
      }
      if (payload.defaultProject?.id) setProjectId(payload.defaultProject.id)
      if (payload.member?.role) setCollabRole(payload.member.role)
      markJourneyStep('workspace_ready', {
        organizationId: payload.workspace?.organizationId || effectiveOrganizationId,
        workspaceId: payload.workspace?.id || ''
      })
      showToast('已接受邀请并加入空间', 'success')
      await refreshWorkspaceState(
        payload.workspace?.id || undefined,
        payload.defaultProject?.id || undefined
      )
    } catch (error: any) {
      const { errorKind, httpStatus } = classifyRequestError(error)
      void reportJourney(false, {
        reason: 'workspace-accept-invite-failed',
        failedStage: 'workspace',
        errorKind,
        httpStatus
      })
      showToast(error.message || '接受邀请失败', 'error')
    }
  }

  const createSnapshot = async () => {
    if (!projectId) {
      showToast('当前无项目可快照', 'info')
      return
    }
    try {
      await requestJson<{ success: boolean }>(`/api/projects/${projectId}/snapshots`, {
        method: 'POST',
        body: JSON.stringify({
          content: {
            source: 'comparison-lab',
            timestamp: Date.now(),
            mode: labMode
          }
        })
      })
      showToast('项目快照已创建', 'success')
      await refreshWorkspaceState()
    } catch (error: any) {
      showToast(error.message || '创建快照失败', 'error')
    }
  }

  const requestUploadToken = async () => {
    if (!workspaceId) {
      showToast('请先创建或加入工作区', 'info')
      return
    }
    if (!uploadFileName.trim()) {
      showToast('请输入文件名', 'info')
      return
    }
    try {
      const payload = await requestJson<{
        success: boolean
        token: { uploadUrl: string; objectKey: string }
      }>('/api/storage/upload-token', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId,
          projectId: projectId || undefined,
          fileName: uploadFileName.trim(),
          contentType: 'video/mp4'
        })
      })
      setUploadToken(payload.token.objectKey)
      showToast('上传令牌已生成', 'success')
    } catch (error: any) {
      showToast(error.message || '生成上传令牌失败', 'error')
    }
  }

  const disconnectWs = () => {
    if (heartbeatRef.current) {
      window.clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setIsWsConnected(false)
  }

  const connectWs = () => {
    if (!workspaceId) {
      showToast('请先创建工作区', 'info')
      return
    }
    disconnectWs()
    const accessToken = getAccessToken().trim()
    if (!accessToken) {
      showToast('请先登录后再连接协作通道', 'info')
      return
    }
    const query = new URLSearchParams({
      memberName: memberName.trim() || 'Editor',
      role: collabRole,
      sessionId: `sess-${Math.random().toString(36).slice(2, 10)}`
    })
    const wsUrl = `${wsBaseFromApi(resolveApiBase())}/ws/collab/${workspaceId}?${query.toString()}`
    const socket = new WebSocket(wsUrl, ['veomuse-collab.v1', `veomuse-auth.${accessToken}`])
    wsRef.current = socket

    socket.onopen = () => {
      setIsWsConnected(true)
      showToast('协作实时通道已连接', 'success')
      heartbeatRef.current = window.setInterval(() => {
        socket.send(JSON.stringify({ type: 'presence.heartbeat' }))
      }, 12_000)
    }

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (
          payload.type === 'presence.snapshot' ||
          payload.type === 'presence.joined' ||
          payload.type === 'presence.left'
        ) {
          if (Array.isArray(payload.members)) setPresence(payload.members as CollabPresence[])
          return
        }
        if (payload.type === 'collab.event') {
          const eventRow = {
            id: `rt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            workspaceId,
            projectId: payload.projectId || null,
            actorName: payload.actorName || 'Unknown',
            sessionId: payload.sessionId || null,
            eventType: payload.eventType || 'project.patch',
            payload: payload.payload || {},
            createdAt: new Date(payload.ts || Date.now()).toISOString()
          } as CollabEvent
          setCollabEvents((prev) => [eventRow, ...prev].slice(0, 100))
        }
      } catch {
        // noop
      }
    }

    socket.onclose = () => {
      disconnectWs()
    }

    socket.onerror = () => {
      showToast('协作通道连接异常', 'error')
      disconnectWs()
    }
  }

  const sendCollabEvent = (type: 'timeline.patch' | 'project.patch' | 'cursor.update') => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      showToast('请先连接协作通道', 'info')
      return
    }
    const actorName = memberName.trim() || 'Editor'
    const eventPayload = {
      at: Date.now(),
      from: actorName,
      detail: type === 'cursor.update' ? 'cursor-x=0.42' : 'timeline patched'
    }
    wsRef.current.send(
      JSON.stringify({
        type,
        projectId: projectId || undefined,
        payload: eventPayload
      })
    )
    const optimisticEvent: CollabEvent = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      organizationId: effectiveOrganizationId || 'local',
      workspaceId: workspaceId || 'local',
      projectId: projectId || null,
      actorName,
      sessionId: null,
      eventType: type,
      payload: eventPayload,
      createdAt: new Date(eventPayload.at).toISOString()
    }
    setCollabEvents((prev) => [optimisticEvent, ...prev].slice(0, 100))
  }

  return (
    <div className="comparison-lab-pro" data-testid="area-comparison-lab">
      <LabToolbar
        labMode={labMode}
        syncPlayback={syncPlayback}
        onSyncPlaybackChange={setSyncPlayback}
        onModeChange={setLabMode}
        onExportReport={() => void exportReport()}
        onRefreshMarketplace={() => void refreshMarketplace(true)}
        onOpenChannelPanel={openChannelPanel}
      />

      {labMode === 'compare' ? (
        <CompareModePanel
          availableModels={availableModels}
          assets={assets}
          leftModel={leftModel}
          rightModel={rightModel}
          leftAssetId={leftAssetId}
          rightAssetId={rightAssetId}
          leftAsset={leftAsset}
          rightAsset={rightAsset}
          leftVideoRef={leftVideoRef}
          rightVideoRef={rightVideoRef}
          onLeftModelChange={setLeftModel}
          onRightModelChange={setRightModel}
          onLeftAssetChange={setLeftAssetId}
          onRightAssetChange={setRightAssetId}
          onRequestRecommendation={requestRecommendation}
          onOpenAssets={onOpenAssets}
        />
      ) : null}

      {labMode === 'marketplace' ? (
        <MarketplaceModePanel
          selectedPolicyId={selectedPolicyId}
          policies={policies}
          selectedPolicy={selectedPolicy}
          availableModels={availableModels}
          marketplace={marketplace}
          policyCreateName={policyCreateName}
          policyCreatePriority={policyCreatePriority}
          policyCreateBudget={policyCreateBudget}
          policyAllowedModels={policyAllowedModels}
          policyWeights={policyWeights}
          policyPrompt={policyPrompt}
          policyBudget={policyBudget}
          policyPriority={policyPriority}
          policyDecision={policyDecision}
          policyExecutions={policyExecutions}
          policyExecHasMore={policyExecHasMore}
          isPolicyLoading={isPolicyLoading}
          isPolicySimulating={isPolicySimulating}
          policyExecLoading={policyExecLoading}
          onSelectedPolicyChange={setSelectedPolicyId}
          onPolicyCreateNameChange={setPolicyCreateName}
          onPolicyCreatePriorityChange={setPolicyCreatePriority}
          onPolicyCreateBudgetChange={setPolicyCreateBudget}
          onPolicyWeightChange={(key, value) =>
            setPolicyWeights((prev) => ({ ...prev, [key]: value }))
          }
          onToggleAllowedModel={toggleAllowedModel}
          onCreatePolicy={() => void createPolicy()}
          onLoadPolicies={(notify) => void loadPolicies(notify)}
          onUpdateSelectedPolicy={() => void updateSelectedPolicy()}
          onPolicyPromptChange={setPolicyPrompt}
          onPolicyBudgetChange={setPolicyBudget}
          onPolicyPriorityChange={setPolicyPriority}
          onSimulatePolicy={() => void simulatePolicy()}
          onLoadPolicyExecutions={(reset) => void loadPolicyExecutions(reset)}
        />
      ) : null}

      {labMode === 'creative' ? (
        <CreativeModePanel
          creativeScript={creativeScript}
          creativeStyle={creativeStyle}
          commitScore={commitScore}
          isCreativeBusy={isCreativeBusy}
          creativeRun={creativeRun}
          creativeRunFeedback={creativeRunFeedback}
          sceneFeedbackMap={sceneFeedbackMap}
          creativeVersions={creativeVersions}
          geminiQuickCheck={geminiQuickCheck}
          videoGenerationMode={videoGenerationMode}
          videoGenerationModelId={videoGenerationModelId}
          videoGenerationPrompt={videoGenerationPrompt}
          videoGenerationNegativePrompt={videoGenerationNegativePrompt}
          videoGenerationInputSourceType={videoGenerationInputSourceType}
          videoGenerationImageInput={videoGenerationImageInput}
          videoGenerationReferenceImagesInput={videoGenerationReferenceImagesInput}
          videoGenerationVideoInput={videoGenerationVideoInput}
          videoGenerationFirstFrameInput={videoGenerationFirstFrameInput}
          videoGenerationLastFrameInput={videoGenerationLastFrameInput}
          videoGenerationListLimit={videoGenerationListLimit}
          videoGenerationStatusFilter={videoGenerationStatusFilter}
          videoGenerationJobs={videoGenerationJobs}
          videoGenerationCursor={videoGenerationCursor}
          videoGenerationHasMore={videoGenerationHasMore}
          videoGenerationSelectedJobId={videoGenerationSelectedJobId}
          videoGenerationPollingEnabled={videoGenerationPollingEnabled}
          isVideoGenerationBusy={isVideoGenerationBusy}
          workflows={v4Workflows}
          selectedWorkflowId={v4SelectedWorkflowId}
          workflowName={v4WorkflowName}
          workflowDescription={v4WorkflowDescription}
          workflowRunPayload={v4WorkflowRunPayload}
          workflowRunResult={v4WorkflowRunResult}
          workflowRuns={v4WorkflowRuns}
          workflowRunsLimit={v4WorkflowRunsLimit}
          workflowRunsHasMore={v4WorkflowRunsHasMore}
          batchJobType={v4BatchJobType}
          batchJobPayload={v4BatchJobPayload}
          batchJobId={v4BatchJobId}
          batchJobStatus={v4BatchJobStatus}
          assetReuseSourceId={v4AssetReuseSourceId}
          assetReuseTargetId={v4AssetReuseTargetId}
          assetReuseNote={v4AssetReuseNote}
          assetReuseResult={v4AssetReuseResult}
          assetReuseHistoryAssetId={v4AssetReuseHistoryAssetId}
          assetReuseHistorySourceProjectId={v4AssetReuseHistorySourceProjectId}
          assetReuseHistoryTargetProjectId={v4AssetReuseHistoryTargetProjectId}
          assetReuseHistoryLimit={v4AssetReuseHistoryLimit}
          assetReuseHistoryOffset={v4AssetReuseHistoryOffset}
          assetReuseHistoryRecords={v4AssetReuseHistoryRecords}
          isV4Busy={isV4CreativeBusy}
          onCreativeScriptChange={setCreativeScript}
          onCreativeStyleChange={setCreativeStyle}
          onCommitScoreChange={setCommitScore}
          onCreateCreativeRun={() => void createCreativeRun()}
          onApplyCreativeFeedback={() => void applyCreativeFeedback()}
          onCommitCreativeRun={() => void commitCreativeRun()}
          onRefreshCreativeVersions={() => void refreshCreativeVersions()}
          onRunGeminiQuickCheck={() => void loadCapabilities()}
          onOpenChannelPanel={openChannelPanel}
          onVideoGenerationModeChange={setVideoGenerationMode}
          onVideoGenerationModelIdChange={setVideoGenerationModelId}
          onVideoGenerationPromptChange={setVideoGenerationPrompt}
          onVideoGenerationNegativePromptChange={setVideoGenerationNegativePrompt}
          onVideoGenerationInputSourceTypeChange={setVideoGenerationInputSourceType}
          onVideoGenerationImageInputChange={setVideoGenerationImageInput}
          onVideoGenerationReferenceImagesInputChange={setVideoGenerationReferenceImagesInput}
          onVideoGenerationVideoInputChange={setVideoGenerationVideoInput}
          onVideoGenerationFirstFrameInputChange={setVideoGenerationFirstFrameInput}
          onVideoGenerationLastFrameInputChange={setVideoGenerationLastFrameInput}
          onVideoGenerationListLimitChange={setVideoGenerationListLimit}
          onVideoGenerationStatusFilterChange={setVideoGenerationStatusFilter}
          onVideoGenerationSelectedJobIdChange={setVideoGenerationSelectedJobId}
          onVideoGenerationPollingEnabledChange={setVideoGenerationPollingEnabled}
          onCreateVideoGenerationTask={() => void createVideoGenerationTask()}
          onRefreshVideoGenerationJobs={() => void loadVideoGenerationJobs(false)}
          onLoadMoreVideoGenerationJobs={() => void loadVideoGenerationJobs(true)}
          onQueryVideoGenerationJobDetail={() => void queryVideoGenerationJobDetail()}
          onSyncVideoGenerationJob={(jobId) => void syncVideoGenerationJob(jobId)}
          onRetryVideoGenerationJob={(jobId) => void retryVideoGenerationJob(jobId)}
          onCancelVideoGenerationJob={(jobId) => void cancelVideoGenerationJob(jobId)}
          onRefreshVideoGenerationJobDetail={(jobId) => void refreshVideoGenerationJobDetail(jobId)}
          onCreativeRunFeedbackChange={setCreativeRunFeedback}
          onSceneFeedbackChange={(sceneId, value) =>
            setSceneFeedbackMap((prev) => ({ ...prev, [sceneId]: value }))
          }
          onSwitchCreativeRunVersion={setCreativeRun}
          onRefreshWorkflows={() => void refreshV4Workflows()}
          onSelectedWorkflowIdChange={setV4SelectedWorkflowId}
          onWorkflowNameChange={setV4WorkflowName}
          onWorkflowDescriptionChange={setV4WorkflowDescription}
          onWorkflowRunPayloadChange={setV4WorkflowRunPayload}
          onCreateWorkflow={() => void createV4Workflow()}
          onRunWorkflow={() => void runV4Workflow()}
          onWorkflowRunsLimitChange={setV4WorkflowRunsLimit}
          onQueryWorkflowRuns={() => void queryV4WorkflowRuns(false)}
          onLoadMoreWorkflowRuns={() => void queryV4WorkflowRuns(true)}
          onBatchJobTypeChange={setV4BatchJobType}
          onBatchJobPayloadChange={setV4BatchJobPayload}
          onBatchJobIdChange={setV4BatchJobId}
          onCreateBatchJob={() => void createV4BatchJob()}
          onQueryBatchJob={() => void queryV4BatchJob()}
          onAssetReuseSourceIdChange={setV4AssetReuseSourceId}
          onAssetReuseTargetIdChange={setV4AssetReuseTargetId}
          onAssetReuseNoteChange={setV4AssetReuseNote}
          onCallAssetReuse={() => void callV4AssetReuse()}
          onAssetReuseHistoryAssetIdChange={setV4AssetReuseHistoryAssetId}
          onAssetReuseHistorySourceProjectIdChange={setV4AssetReuseHistorySourceProjectId}
          onAssetReuseHistoryTargetProjectIdChange={setV4AssetReuseHistoryTargetProjectId}
          onAssetReuseHistoryLimitChange={setV4AssetReuseHistoryLimit}
          onAssetReuseHistoryOffsetChange={setV4AssetReuseHistoryOffset}
          onQueryAssetReuseHistory={() => void queryV4AssetReuseHistory()}
        />
      ) : null}

      {labMode === 'collab' ? (
        <CollabModePanel
          isAuthenticated={Boolean(authProfile)}
          workspaceName={workspaceName}
          workspaceOwner={workspaceOwner}
          workspaceId={workspaceId}
          projectId={projectId}
          inviteRole={inviteRole}
          memberName={memberName}
          collabRole={collabRole}
          inviteCode={inviteCode}
          invites={invites}
          isWsConnected={isWsConnected}
          presence={presence}
          collabEvents={collabEvents}
          snapshots={snapshots}
          uploadFileName={uploadFileName}
          uploadToken={uploadToken}
          commentThreads={v4CommentThreads}
          commentThreadCursor={v4CommentThreadCursor}
          commentThreadLimit={v4CommentThreadLimit}
          commentThreadHasMore={v4CommentThreadHasMore}
          commentAnchor={v4CommentAnchor}
          commentContent={v4CommentContent}
          commentMentions={v4CommentMentions}
          selectedThreadId={v4SelectedThreadId}
          commentReplyContent={v4CommentReplyContent}
          commentReplyMentions={v4CommentReplyMentions}
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
          permissions={v4Permissions}
          permissionSubjectId={v4PermissionSubjectId}
          permissionRole={v4PermissionRole}
          timelineMergeResult={v4TimelineMergeResult}
          errorBudget={v4ErrorBudget}
          errorBudgetScope={v4ErrorBudgetScope}
          errorBudgetTargetSlo={v4ErrorBudgetTargetSlo}
          errorBudgetWindowDays={v4ErrorBudgetWindowDays}
          errorBudgetWarningThresholdRatio={v4ErrorBudgetWarningThresholdRatio}
          errorBudgetAlertThresholdRatio={v4ErrorBudgetAlertThresholdRatio}
          errorBudgetFreezeDeployOnBreach={v4ErrorBudgetFreezeDeployOnBreach}
          adminToken={v4AdminToken}
          reliabilityAlertLevel={v4ReliabilityAlertLevel}
          reliabilityAlertStatus={v4ReliabilityAlertStatus}
          reliabilityAlertLimit={v4ReliabilityAlertLimit}
          reliabilityAlerts={v4ReliabilityAlerts}
          rollbackPolicyId={v4RollbackPolicyId}
          rollbackEnvironment={v4RollbackEnvironment}
          rollbackTriggerType={v4RollbackTriggerType}
          rollbackSummary={v4RollbackSummary}
          rollbackPlan={v4RollbackPlan}
          rollbackResult={v4RollbackResult}
          rollbackDrillId={v4RollbackDrillId}
          rollbackDrillResult={v4RollbackDrillResult}
          isV4Busy={isV4CollabBusy}
          isOpsBusy={isV4OpsBusy}
          isProjectGovernanceBusy={isProjectGovernanceBusy}
          onWorkspaceNameChange={setWorkspaceName}
          onWorkspaceOwnerChange={setWorkspaceOwner}
          onCreateWorkspace={() => void createWorkspace()}
          onRefreshWorkspaceState={() => void refreshWorkspaceState()}
          onInviteRoleChange={setInviteRole}
          onMemberNameChange={setMemberName}
          onCollabRoleChange={setCollabRole}
          onInviteCodeChange={setInviteCode}
          onCreateInvite={() => void createInvite()}
          onAcceptInvite={() => void acceptInvite()}
          onConnectWs={connectWs}
          onDisconnectWs={disconnectWs}
          onSendCollabEvent={sendCollabEvent}
          onCreateSnapshot={() => void createSnapshot()}
          onUploadFileNameChange={setUploadFileName}
          onRequestUploadToken={() => void requestUploadToken()}
          onRefreshCommentThreads={() => void refreshV4CommentThreads()}
          onLoadMoreCommentThreads={() => void loadMoreV4CommentThreads()}
          onCommentThreadLimitChange={setV4CommentThreadLimit}
          onCommentAnchorChange={setV4CommentAnchor}
          onCommentContentChange={setV4CommentContent}
          onCommentMentionsChange={setV4CommentMentions}
          onSelectedThreadIdChange={setV4SelectedThreadId}
          onCommentReplyContentChange={setV4CommentReplyContent}
          onCommentReplyMentionsChange={setV4CommentReplyMentions}
          onCreateCommentThread={() => void createV4CommentThread()}
          onReplyCommentThread={() => void replyV4CommentThread()}
          onResolveCommentThread={() => void resolveV4CommentThread()}
          onRefreshProjectComments={() => void loadProjectComments(false)}
          onLoadMoreProjectComments={() => void loadProjectComments(true)}
          onProjectCommentLimitChange={setProjectCommentLimit}
          onProjectCommentAnchorChange={setProjectCommentAnchor}
          onProjectCommentContentChange={setProjectCommentContent}
          onProjectCommentMentionsChange={setProjectCommentMentions}
          onProjectSelectedCommentIdChange={setProjectSelectedCommentId}
          onCreateProjectComment={() => void createProjectCommentEntry()}
          onResolveProjectComment={() => void resolveProjectCommentEntry()}
          onRefreshProjectReviews={() => void loadProjectReviews()}
          onProjectReviewLimitChange={setProjectReviewLimit}
          onProjectReviewDecisionChange={setProjectReviewDecision}
          onProjectReviewSummaryChange={setProjectReviewSummary}
          onProjectReviewScoreChange={setProjectReviewScore}
          onCreateProjectReview={() => void createProjectReviewEntry()}
          onRefreshProjectTemplates={() => void loadProjectTemplates()}
          onProjectSelectedTemplateIdChange={setProjectSelectedTemplateId}
          onProjectTemplateApplyOptionsChange={setProjectTemplateApplyOptions}
          onApplyProjectTemplate={() => void applyProjectTemplateEntry()}
          onProjectClipBatchOperationsChange={setProjectClipBatchOperations}
          onBatchUpdateProjectClips={() => void batchUpdateProjectClipsEntry()}
          onRefreshPermissions={() => void refreshV4Permissions()}
          onPermissionSubjectIdChange={setV4PermissionSubjectId}
          onPermissionRoleChange={setV4PermissionRole}
          onUpdatePermission={() => void updateV4Permission()}
          onMergeTimeline={() => void mergeV4Timeline()}
          onAdminTokenChange={setV4AdminToken}
          onReliabilityAlertLevelChange={setV4ReliabilityAlertLevel}
          onReliabilityAlertStatusChange={setV4ReliabilityAlertStatus}
          onReliabilityAlertLimitChange={setV4ReliabilityAlertLimit}
          onLoadReliabilityAlerts={() => void loadV4ReliabilityAlerts()}
          onAcknowledgeReliabilityAlert={(alertId) => void acknowledgeV4ReliabilityAlert(alertId)}
          onLoadErrorBudget={() => void loadV4ErrorBudget()}
          onErrorBudgetScopeChange={setV4ErrorBudgetScope}
          onErrorBudgetTargetSloChange={setV4ErrorBudgetTargetSlo}
          onErrorBudgetWindowDaysChange={setV4ErrorBudgetWindowDays}
          onErrorBudgetWarningThresholdRatioChange={setV4ErrorBudgetWarningThresholdRatio}
          onErrorBudgetAlertThresholdRatioChange={setV4ErrorBudgetAlertThresholdRatio}
          onErrorBudgetFreezeDeployOnBreachChange={setV4ErrorBudgetFreezeDeployOnBreach}
          onRollbackPolicyIdChange={setV4RollbackPolicyId}
          onRollbackEnvironmentChange={setV4RollbackEnvironment}
          onRollbackTriggerTypeChange={setV4RollbackTriggerType}
          onRollbackSummaryChange={setV4RollbackSummary}
          onRollbackPlanChange={setV4RollbackPlan}
          onRollbackResultChange={setV4RollbackResult}
          onUpdateErrorBudget={() => void updateV4ErrorBudget()}
          onTriggerRollbackDrill={() => void triggerV4RollbackDrill()}
          onRollbackDrillIdChange={setV4RollbackDrillId}
          onQueryRollbackDrill={() => void queryV4RollbackDrill()}
        />
      ) : null}

      <ChannelAccessPanel
        show={showChannelPanel}
        isCapabilitiesLoading={isCapabilitiesLoading}
        effectiveOrganizationId={effectiveOrganizationId}
        authProfile={authProfile}
        organizations={organizations}
        orgMembers={orgMembers}
        selectedOrganizationId={effectiveOrganizationId}
        activeChannelScope={activeChannelScope}
        workspaceId={workspaceId}
        loginEmail={loginEmail}
        loginPassword={loginPassword}
        registerMode={registerMode}
        registerOrgName={registerOrgName}
        isAuthBusy={isAuthBusy}
        newOrgName={newOrgName}
        inviteMemberEmail={inviteMemberEmail}
        inviteOrgRole={inviteOrgRole}
        organizationQuota={organizationQuota}
        organizationUsage={organizationUsage}
        quotaForm={quotaForm}
        channelConfigs={channelConfigs}
        channelForms={channelForms}
        capabilities={capabilities}
        onClose={() => setShowChannelPanel(false)}
        onLoadCapabilities={() => void loadCapabilities()}
        onRefreshChannelConfigs={() => void refreshChannelConfigs()}
        onSubmitAuth={() => void submitAuth()}
        onToggleRegisterMode={() => setRegisterMode((prev) => !prev)}
        onLoginEmailChange={setLoginEmail}
        onLoginPasswordChange={setLoginPassword}
        onRegisterOrgNameChange={setRegisterOrgName}
        onSelectedOrganizationChange={(value) => {
          setSelectedOrganizationId(value)
          setOrganizationId(value)
        }}
        onNewOrgNameChange={setNewOrgName}
        onCreateOrganization={() => void createOrganization()}
        onLogoutAuth={() => void logoutAuth()}
        onInviteMemberEmailChange={setInviteMemberEmail}
        onInviteOrgRoleChange={setInviteOrgRole}
        onAddOrganizationMember={() => void addOrganizationMember()}
        onRefreshOrganizationMembers={() => void refreshOrganizationMembers()}
        onActiveChannelScopeChange={setActiveChannelScope}
        onQuotaFormChange={(next) => setQuotaForm((prev) => ({ ...prev, ...next }))}
        onSaveOrganizationQuota={() => void saveOrganizationQuota()}
        onRefreshOrganizationQuota={() => void refreshOrganizationQuota()}
        onExportOrganizationAudits={(format) => void exportOrganizationAudits(format)}
        onUpdateChannelForm={updateChannelForm}
        onSaveChannelConfig={(providerId) => void saveChannelConfig(providerId)}
        onTestChannelConfig={(providerId) => void testChannelConfig(providerId)}
      />
    </div>
  )
}

export default ComparisonLab
