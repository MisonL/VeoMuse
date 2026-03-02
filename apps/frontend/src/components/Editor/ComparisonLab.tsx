import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { useToastStore } from '../../store/toastStore'
import { useJourneyTelemetryStore } from '../../store/journeyTelemetryStore'
import {
  api,
  buildAuthHeaders,
  clearAuthSession,
  getAccessToken,
  getOrganizationId,
  getRefreshToken,
  resolveApiBase,
  setAccessToken,
  setOrganizationId,
  setRefreshToken
} from '../../utils/eden'
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
  WorkspaceInvite,
  WorkspaceRole,
  CapabilityPayload,
  AuthProfile,
  ChannelFormState
} from './comparison-lab/types'
import { DEFAULT_POLICY_WEIGHTS, POLICY_EXEC_PAGE_SIZE } from './comparison-lab/constants'
import { requestJson, wsBaseFromApi } from './comparison-lab/api'
import LabToolbar from './comparison-lab/LabToolbar'
import CompareModePanel from './comparison-lab/modes/CompareModePanel'
import MarketplaceModePanel from './comparison-lab/modes/MarketplaceModePanel'
import CreativeModePanel from './comparison-lab/modes/CreativeModePanel'
import CollabModePanel from './comparison-lab/modes/CollabModePanel'
import ChannelAccessPanel from './comparison-lab/ChannelAccessPanel'
import './ComparisonLab.css'

const ComparisonLab: React.FC<ComparisonLabProps> = ({ onOpenAssets }) => {
  const allAssets = useEditorStore(state => state.assets)
  const { showToast } = useToastStore()
  const markJourneyStep = useJourneyTelemetryStore(state => state.markStep)
  const resetJourney = useJourneyTelemetryStore(state => state.resetJourney)

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
  const [snapshots, setSnapshots] = useState<Array<{ id: string; actorName: string; createdAt: string }>>([])
  const [uploadFileName, setUploadFileName] = useState('demo.mp4')
  const [uploadToken, setUploadToken] = useState<string>('')
  const [isWsConnected, setIsWsConnected] = useState(false)
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
  const [activeChannelScope, setActiveChannelScope] = useState<'organization' | 'workspace'>('organization')
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

  const assets = useMemo(
    () => allAssets.filter(asset => asset.type === 'video'),
    [allAssets]
  )

  const selectedPolicy = useMemo(
    () => policies.find(item => item.id === selectedPolicyId) || null,
    [policies, selectedPolicyId]
  )

  const leftAsset = useMemo(() => assets.find(a => a.id === leftAssetId), [assets, leftAssetId])
  const rightAsset = useMemo(() => assets.find(a => a.id === rightAssetId), [assets, rightAssetId])
  const currentActorName = memberName.trim() || workspaceOwner.trim() || 'Owner'
  const effectiveOrganizationId = selectedOrganizationId.trim() || organizations[0]?.id || ''

  const applySession = useCallback((payload: {
    session: { accessToken: string; refreshToken: string; user: { id: string; email: string } };
    organizations?: Organization[];
  }) => {
    setAccessToken(payload.session.accessToken)
    setRefreshToken(payload.session.refreshToken)
    setAuthProfile({
      id: payload.session.user.id,
      email: payload.session.user.email
    })
    const orgRows = payload.organizations || []
    setOrganizations(orgRows)
    const nextOrgId = orgRows.some(item => item.id === selectedOrganizationId)
      ? selectedOrganizationId
      : orgRows[0]?.id || ''
    if (nextOrgId) {
      setSelectedOrganizationId(nextOrgId)
      setOrganizationId(nextOrgId)
    }
  }, [selectedOrganizationId])

  const loadAuthProfile = useCallback(async () => {
    const accessToken = getAccessToken().trim()
    if (!accessToken) {
      setAuthProfile(null)
      setOrganizations([])
      return
    }
    try {
      const payload = await requestJson<{ success: boolean; user: AuthProfile; organizations: Organization[] }>('/api/auth/me')
      setAuthProfile(payload.user)
      setOrganizations(payload.organizations || [])
      const storedOrgId = getOrganizationId()
      const preferredOrgId = payload.organizations?.some(item => item.id === storedOrgId)
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
    try {
      if (registerMode) {
        const payload = await requestJson<{
          success: boolean;
          session: { accessToken: string; refreshToken: string; user: { id: string; email: string } };
          organizations: Organization[];
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
        const payload = await requestJson<{
          success: boolean;
          session: { accessToken: string; refreshToken: string; user: { id: string; email: string } };
          organizations: Organization[];
        }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: loginEmail.trim(),
            password: loginPassword
          })
        })
        applySession(payload)
        await loadPolicies(false)
        const organizationId = payload.organizations?.[0]?.id || ''
        markJourneyStep('register_or_login', { organizationId })
        markJourneyStep('organization_ready', { organizationId })
        showToast('登录成功', 'success')
      }
    } catch (error: any) {
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
      const payload = await requestJson<{ success: boolean; organization: Organization }>('/api/organizations', {
        method: 'POST',
        body: JSON.stringify({ name: newOrgName.trim() })
      })
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
      const payload = await requestJson<{ success: boolean; members: OrganizationMember[] }>(`/api/organizations/${effectiveOrganizationId}/members`)
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
        const payload = await response.json().catch(() => null) as any
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
      const extra = row.extra && typeof row.extra === 'object'
        ? row.extra as Record<string, unknown>
        : {}
      next[row.providerId] = {
        providerId: row.providerId,
        baseUrl: row.baseUrl || '',
        apiKey: '',
        model: String(extra.model || ''),
        path: String(extra.path || ''),
        temperature: extra.temperature === undefined || extra.temperature === null
          ? ''
          : String(extra.temperature),
        enabled: row.enabled,
        scope: row.workspaceId ? 'workspace' : 'organization'
      }
    }
    setChannelForms(next)
  }, [])

  const updateChannelForm = (providerId: string, patch: Partial<ChannelFormState>) => {
    setChannelForms(prev => ({
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
        const payload = await requestJson<{ success: boolean; configs: AiChannelConfig[]; capabilities: CapabilityPayload }>(`/api/workspaces/${workspaceId}/channels`)
        setChannelConfigs(payload.configs || [])
        setCapabilities(payload.capabilities || null)
        applyChannelForms(payload.configs || [])
      } else {
        const payload = await requestJson<{ success: boolean; configs: AiChannelConfig[]; capabilities: CapabilityPayload }>(`/api/organizations/${effectiveOrganizationId}/channels`)
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
    const path = activeChannelScope === 'workspace' && workspaceId
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
      setChannelForms(prev => ({
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
      const payload = await requestJson<{ success: boolean; message: string }>('/api/channels/test', {
        method: 'POST',
        body: JSON.stringify({
          providerId,
          baseUrl: form.baseUrl.trim() || undefined,
          apiKey: form.apiKey.trim() || undefined,
          workspaceId: activeChannelScope === 'workspace' && workspaceId ? workspaceId : undefined,
          extra
        })
      })
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
        setPolicyAllowedModels(rows.map(item => item.id))
        if (rows[0]?.id) setLeftModel(rows[0].id)
        if (rows[1]?.id) setRightModel(rows[1].id)
      }
    }
    void loadModels()
    void refreshMarketplace(false)
    void loadPolicies(false)
  }, [])

  useEffect(() => {
    void loadAuthProfile()
  }, [loadAuthProfile])

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
    if (!syncPlayback) return
    const left = leftVideoRef.current
    const right = rightVideoRef.current
    if (!left || !right) return

    const onLeftPlay = () => right.play().catch(() => {})
    const onLeftPause = () => right.pause()
    const onLeftSeek = () => {
      if (Math.abs(right.currentTime - left.currentTime) > 0.08) right.currentTime = left.currentTime
    }
    const onRightPlay = () => left.play().catch(() => {})
    const onRightPause = () => left.pause()
    const onRightSeek = () => {
      if (Math.abs(left.currentTime - right.currentTime) > 0.08) left.currentTime = right.currentTime
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
      const query = activeChannelScope === 'workspace' && workspaceId
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
    void loadCapabilities()
    void refreshChannelConfigs()
    void refreshOrganizationMembers()
    void refreshOrganizationQuota()
  }, [loadCapabilities, refreshChannelConfigs, refreshOrganizationMembers, refreshOrganizationQuota])

  useEffect(() => {
    const handleOpenChannelPanel = () => {
      setLabMode('marketplace')
      setShowChannelPanel(true)
      void loadCapabilities()
    }

    window.addEventListener('veomuse:open-channel-panel', handleOpenChannelPanel as EventListener)
    return () => {
      window.removeEventListener('veomuse:open-channel-panel', handleOpenChannelPanel as EventListener)
    }
  }, [loadCapabilities])

  useEffect(() => {
    if (!showChannelPanel || !authProfile) return
    void refreshChannelConfigs()
    void loadCapabilities()
    void refreshOrganizationQuota()
  }, [showChannelPanel, authProfile, activeChannelScope, workspaceId, effectiveOrganizationId, refreshChannelConfigs, loadCapabilities, refreshOrganizationQuota])

  const refreshMarketplace = async (notify: boolean) => {
    try {
      const payload = await requestJson<{ success: boolean; models: any[] }>('/api/models/marketplace')
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
      const payload = await requestJson<{ success: boolean; policies: RoutingPolicy[] }>('/api/models/policies')
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
        success: boolean;
        executions: RoutingExecution[];
        page: { hasMore: boolean; offset: number; total: number };
      }>(`/api/models/policies/${policyId}/executions?limit=${POLICY_EXEC_PAGE_SIZE}&offset=${offset}`)
      if (requestSeq !== policyExecRequestSeqRef.current) return
      const rows = payload.executions || []
      setPolicyExecutions(prev => (reset ? rows : [...prev, ...rows]))
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
      const modelName = (id: string) => availableModels.find(m => m.id === id)?.name || id
      const report = {
        timestamp: new Date().toISOString(),
        mode: labMode,
        left: { modelId: leftModel, modelName: modelName(leftModel), assetName: leftAsset?.name || null },
        right: { modelId: rightModel, modelName: modelName(rightModel), assetName: rightAsset?.name || null },
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
      showToast(`${side === 'left' ? '左侧' : '右侧'}推荐模型: ${data.recommendedModelId}`, 'success')
    }
  }

  const toggleAllowedModel = (modelId: string) => {
    setPolicyAllowedModels(prev => (
      prev.includes(modelId) ? prev.filter(item => item !== modelId) : [...prev, modelId]
    ))
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
      const payload = await requestJson<{ success: boolean; policy: RoutingPolicy }>('/api/models/policies', {
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
      })
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
      setPolicies(prev => prev.map(item => item.id === payload.policy.id ? payload.policy : item))
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
    const previewPrompt = creativeScript
      .trim()
      .split(/\n|。|\.|!|！|\?|？/)
      .map(item => item.trim())
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
      const payload = await requestJson<{ success: boolean; run: CreativeRun }>('/api/ai/creative/run', {
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
      })
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
      .filter(item => item.feedback.length > 0)

    if (!creativeRunFeedback.trim() && sceneFeedbacks.length === 0) {
      showToast('请至少填写一条反馈', 'warning')
      return
    }

    setIsCreativeBusy(true)
    try {
      const payload = await requestJson<{ success: boolean; run: CreativeRun; parentRun: CreativeRun | null }>(
        `/api/ai/creative/run/${creativeRun.id}/feedback`,
        {
          method: 'POST',
          body: JSON.stringify({
            runFeedback: creativeRunFeedback.trim() || undefined,
            sceneFeedbacks
          })
        }
      )
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

  const refreshWorkspaceState = async (nextWorkspaceId?: string, nextProjectId?: string) => {
    const wid = nextWorkspaceId || workspaceId
    const pid = nextProjectId || projectId
    if (!wid) return

    try {
      const [presencePayload, eventsPayload] = await Promise.all([
        requestJson<{ success: boolean; members: CollabPresence[] }>(`/api/workspaces/${wid}/presence`),
        requestJson<{ success: boolean; events: CollabEvent[] }>(`/api/workspaces/${wid}/collab/events?limit=50`)
      ])
      setPresence(presencePayload.members || [])
      setCollabEvents(eventsPayload.events || [])
    } catch (error: any) {
      showToast(error.message || '刷新协作状态失败', 'error')
    }

    if (pid) {
      try {
        const snapshotsPayload = await requestJson<{ success: boolean; snapshots: Array<{ id: string; actorName: string; createdAt: string }> }>(
          `/api/projects/${pid}/snapshots?limit=20`
        )
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
    if (!workspaceName.trim()) {
      showToast('请输入工作区名称', 'info')
      return
    }
    try {
      const payload = await requestJson<{
        success: boolean;
        workspace: { id: string; organizationId?: string };
        defaultProject: { id: string };
        owner?: { name?: string; role?: WorkspaceRole };
      }>('/api/workspaces', {
        method: 'POST',
        body: JSON.stringify({
          name: workspaceName.trim(),
          ownerName: workspaceOwner.trim() || 'Owner',
          organizationId: effectiveOrganizationId || undefined
        })
      })
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
      setInvites(prev => [payload.invite, ...prev])
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
    try {
      const payload = await requestJson<{
        success: boolean;
        member: { role: WorkspaceRole } | null;
        workspace: { id: string; organizationId?: string } | null;
        defaultProject: { id: string } | null;
      }>(`/api/workspaces/invites/${inviteCode.trim()}/accept`, {
        method: 'POST',
        body: JSON.stringify({
          memberName: currentActorName
        })
      })
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
      await refreshWorkspaceState(payload.workspace?.id || undefined, payload.defaultProject?.id || undefined)
    } catch (error: any) {
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
        success: boolean;
        token: { uploadUrl: string; objectKey: string };
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
        if (payload.type === 'presence.snapshot' || payload.type === 'presence.joined' || payload.type === 'presence.left') {
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
          setCollabEvents(prev => [eventRow, ...prev].slice(0, 100))
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
    wsRef.current.send(JSON.stringify({
      type,
      projectId: projectId || undefined,
      payload: eventPayload
    }))
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
    setCollabEvents(prev => [optimisticEvent, ...prev].slice(0, 100))
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
          onPolicyWeightChange={(key, value) => setPolicyWeights(prev => ({ ...prev, [key]: value }))}
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
          onCreativeScriptChange={setCreativeScript}
          onCreativeStyleChange={setCreativeStyle}
          onCommitScoreChange={setCommitScore}
          onCreateCreativeRun={() => void createCreativeRun()}
          onApplyCreativeFeedback={() => void applyCreativeFeedback()}
          onCommitCreativeRun={() => void commitCreativeRun()}
          onRefreshCreativeVersions={() => void refreshCreativeVersions()}
          onCreativeRunFeedbackChange={setCreativeRunFeedback}
          onSceneFeedbackChange={(sceneId, value) => setSceneFeedbackMap(prev => ({ ...prev, [sceneId]: value }))}
          onSwitchCreativeRunVersion={setCreativeRun}
        />
      ) : null}

      {labMode === 'collab' ? (
        <CollabModePanel
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
        onToggleRegisterMode={() => setRegisterMode(prev => !prev)}
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
        onQuotaFormChange={(next) => setQuotaForm(prev => ({ ...prev, ...next }))}
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
