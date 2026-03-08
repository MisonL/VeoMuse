import { useCallback, useEffect, useState } from 'react'
import type {
  JourneyErrorKind,
  JourneyFailedStage,
  JourneyStep
} from '../../../../store/journeyTelemetryStore'
import { classifyRequestError } from '../../../../utils/requestError'
import {
  buildAuthHeaders,
  clearAuthSession,
  getAccessToken,
  getOrganizationId,
  getRefreshToken,
  resolveApiBase,
  setAccessToken,
  setOrganizationId,
  setRefreshToken
} from '../../../../utils/eden'
import { requestJson, requestJsonWithRetry } from '../api'
import { buildChannelExtra, validateChannelForm } from '../helpers'
import type {
  AiChannelConfig,
  AuthProfile,
  CapabilityPayload,
  ChannelFormState,
  Organization,
  OrganizationMember,
  OrganizationQuota,
  OrganizationRole,
  OrganizationUsage,
  QuotaFormState
} from '../types'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface UseAuthOrganizationChannelManagerOptions {
  workspaceId: string
  showChannelPanel: boolean
  loadPolicies: (notify: boolean) => Promise<void>
  showToast: (message: string, type?: ToastType) => void
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
  resetJourney: (force?: boolean) => void
}

interface AuthSessionPayload {
  session: { accessToken: string; refreshToken: string; user: { id: string; email: string } }
  organizations?: Organization[]
}

interface ChannelConfigsPayload {
  configs: AiChannelConfig[]
  capabilities: CapabilityPayload
}

interface OrganizationQuotaPayload {
  quota: OrganizationQuota
  usage: OrganizationUsage
}

interface ParsedOrganizationQuotaForm {
  requestLimit: number
  storageLimitMb: number
  concurrencyLimit: number
}

interface ResolvedChannelConfigRequest {
  form: ChannelFormState
  extra: Record<string, unknown>
  path: string
  workspaceId?: string
}

const resolveResponseError = (payload: unknown, status: number) => {
  if (!payload || typeof payload !== 'object') return `HTTP ${status}`
  const candidate = payload as { error?: unknown }
  if (typeof candidate.error === 'string' && candidate.error.trim()) {
    return candidate.error
  }
  return `HTTP ${status}`
}

export const useAuthOrganizationChannelManager = ({
  workspaceId,
  showChannelPanel,
  loadPolicies,
  showToast,
  markJourneyStep,
  reportJourney,
  resetJourney
}: UseAuthOrganizationChannelManagerOptions) => {
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

  const effectiveOrganizationId = selectedOrganizationId.trim() || organizations[0]?.id || ''
  const normalizeError = useCallback((error: unknown, fallbackMessage: string) => {
    if (error instanceof Error) {
      return error.message ? error : new Error(fallbackMessage)
    }
    const message = String(error || '').trim()
    return new Error(message || fallbackMessage)
  }, [])
  const showRequestError = useCallback(
    (error: unknown, fallbackMessage: string, type: ToastType = 'error') => {
      showToast(normalizeError(error, fallbackMessage).message, type)
    },
    [normalizeError, showToast]
  )
  const reportAuthFailure = useCallback(
    (error: unknown, reason: string) => {
      const normalizedError = normalizeError(error, reason)
      const { errorKind, httpStatus } = classifyRequestError(normalizedError)
      void reportJourney(false, {
        reason,
        failedStage: 'register',
        errorKind,
        httpStatus
      })
      return normalizedError
    },
    [normalizeError, reportJourney]
  )

  const selectOrganization = useCallback((organizationId: string) => {
    setSelectedOrganizationId(organizationId)
    setOrganizationId(organizationId)
  }, [])
  const applyAuthProfilePayload = useCallback(
    (payload: { user: AuthProfile; organizations?: Organization[] }) => {
      setAuthProfile(payload.user)
      const rows = payload.organizations || []
      setOrganizations(rows)
      const storedOrgId = getOrganizationId()
      const preferredOrgId = rows.some((item) => item.id === storedOrgId)
        ? storedOrgId
        : rows[0]?.id || ''
      if (preferredOrgId) {
        selectOrganization(preferredOrgId)
      }
    },
    [selectOrganization]
  )
  const applyCreatedOrganization = useCallback(
    (organization: Organization) => {
      setOrganizations((prev) => [...prev, organization])
      setNewOrgName('')
      selectOrganization(organization.id)
    },
    [selectOrganization]
  )

  const applySession = useCallback(
    (payload: AuthSessionPayload) => {
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
        selectOrganization(nextOrgId)
      }
    },
    [selectOrganization, selectedOrganizationId]
  )
  const resetAuthResources = useCallback(() => {
    setAuthProfile(null)
    setOrganizations([])
    setSelectedOrganizationId('')
    setOrgMembers([])
    setChannelConfigs([])
    setChannelForms({})
    setOrganizationQuota(null)
    setOrganizationUsage(null)
  }, [])

  const applyQuotaForm = useCallback((quota: OrganizationQuota) => {
    setQuotaForm({
      requestLimit: String(quota.requestLimit || 0),
      storageLimitMb: String(Math.round((quota.storageLimitBytes || 0) / (1024 * 1024))),
      concurrencyLimit: String(quota.concurrencyLimit || 0)
    })
  }, [])

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
  const applyChannelConfigPayload = useCallback(
    (payload: ChannelConfigsPayload) => {
      const rows = payload.configs || []
      setChannelConfigs(rows)
      setCapabilities(payload.capabilities || null)
      applyChannelForms(rows)
    },
    [applyChannelForms]
  )
  const applyOrganizationQuotaPayload = useCallback(
    (payload: OrganizationQuotaPayload | null) => {
      if (!payload) {
        setOrganizationQuota(null)
        setOrganizationUsage(null)
        return
      }
      setOrganizationQuota(payload.quota || null)
      setOrganizationUsage(payload.usage || null)
      if (payload.quota) applyQuotaForm(payload.quota)
    },
    [applyQuotaForm]
  )
  const resolveScopedChannelConfigPath = useCallback(() => {
    if (activeChannelScope === 'workspace' && workspaceId) {
      return `/api/workspaces/${workspaceId}/channels`
    }
    return effectiveOrganizationId ? `/api/organizations/${effectiveOrganizationId}/channels` : ''
  }, [activeChannelScope, effectiveOrganizationId, workspaceId])
  const handleAuthSuccess = useCallback(
    async (payload: AuthSessionPayload, successMessage: string) => {
      applySession(payload)
      await loadPolicies(false)
      const organizationId = payload.organizations?.[0]?.id || ''
      markJourneyStep('register_or_login', { organizationId })
      markJourneyStep('organization_ready', { organizationId })
      showToast(successMessage, 'success')
    },
    [applySession, loadPolicies, markJourneyStep, showToast]
  )
  const resolveCapabilitiesPath = useCallback(() => {
    if (activeChannelScope === 'workspace' && workspaceId) {
      return `/api/capabilities?workspaceId=${encodeURIComponent(workspaceId)}`
    }
    return '/api/capabilities'
  }, [activeChannelScope, workspaceId])
  const parseOrganizationQuotaForm = useCallback((): ParsedOrganizationQuotaForm | null => {
    const requestLimit = Number.parseInt(quotaForm.requestLimit.trim() || '0', 10)
    if (!Number.isFinite(requestLimit) || requestLimit < 0) {
      showToast('请求配额必须是大于等于 0 的整数', 'warning')
      return null
    }
    const storageLimitMb = Number.parseInt(quotaForm.storageLimitMb.trim() || '0', 10)
    if (!Number.isFinite(storageLimitMb) || storageLimitMb < 0) {
      showToast('存储配额（MB）必须是大于等于 0 的整数', 'warning')
      return null
    }
    const concurrencyLimit = Number.parseInt(quotaForm.concurrencyLimit.trim() || '0', 10)
    if (!Number.isFinite(concurrencyLimit) || concurrencyLimit < 0) {
      showToast('并发配额必须是大于等于 0 的整数', 'warning')
      return null
    }
    return {
      requestLimit,
      storageLimitMb,
      concurrencyLimit
    }
  }, [quotaForm, showToast])
  const resolveChannelConfigRequest = useCallback(
    (providerId: string): ResolvedChannelConfigRequest | null => {
      const form = channelForms[providerId]
      if (!form) return null
      if (!validateChannelForm(providerId, form, (message) => showToast(message, 'warning'))) {
        return null
      }
      return {
        form,
        extra: buildChannelExtra(providerId, form),
        path:
          activeChannelScope === 'workspace' && workspaceId
            ? `/api/workspaces/${workspaceId}/channels/${providerId}`
            : `/api/organizations/${effectiveOrganizationId}/channels/${providerId}`,
        workspaceId: activeChannelScope === 'workspace' && workspaceId ? workspaceId : undefined
      }
    },
    [activeChannelScope, channelForms, effectiveOrganizationId, showToast, workspaceId]
  )
  const clearChannelApiKey = useCallback((providerId: string) => {
    setChannelForms((prev) => ({
      ...prev,
      [providerId]: {
        ...prev[providerId],
        apiKey: ''
      }
    }))
  }, [])

  const loadAuthProfile = useCallback(async () => {
    const accessToken = getAccessToken().trim()
    if (!accessToken) {
      resetAuthResources()
      return
    }
    try {
      const payload = await requestJson<{
        success: boolean
        user: AuthProfile
        organizations: Organization[]
      }>('/api/auth/me')
      applyAuthProfilePayload(payload)
      void loadPolicies(false)
    } catch {
      clearAuthSession()
      resetAuthResources()
    }
  }, [applyAuthProfilePayload, loadPolicies, resetAuthResources])

  const submitAuth = useCallback(async () => {
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
          session: AuthSessionPayload['session']
          organizations: Organization[]
        }>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email: loginEmail.trim(),
            password: loginPassword,
            organizationName: registerOrgName.trim() || '我的组织'
          })
        })
        await handleAuthSuccess(payload, '注册并登录成功')
      } else {
        const payload = await requestJsonWithRetry<{
          success: boolean
          session: AuthSessionPayload['session']
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
        await handleAuthSuccess(payload, '登录成功')
      }
    } catch (error: unknown) {
      const fallbackMessage = registerMode ? '注册失败' : '登录失败'
      showToast(
        reportAuthFailure(error, registerMode ? 'register-failed' : 'login-failed').message ||
          fallbackMessage,
        'error'
      )
    } finally {
      setIsAuthBusy(false)
    }
  }, [
    handleAuthSuccess,
    loginEmail,
    loginPassword,
    markJourneyStep,
    registerMode,
    registerOrgName,
    reportAuthFailure,
    showToast
  ])

  const logoutAuth = useCallback(async () => {
    const refreshToken = getRefreshToken().trim()
    try {
      await requestJson('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({
          refreshToken
        })
      })
    } catch (error: unknown) {
      const logoutError = normalizeError(error, 'unknown error')
      showToast(`已本地退出，但服务端会话撤销失败：${logoutError.message}`, 'warning')
      window.setTimeout(() => {
        void requestJson('/api/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken })
        }).catch(() => {})
      }, 1_500)
    }
    clearAuthSession()
    resetAuthResources()
    resetJourney()
    showToast('已退出登录', 'success')
  }, [normalizeError, resetAuthResources, resetJourney, showToast])

  const createOrganization = useCallback(async () => {
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
      applyCreatedOrganization(payload.organization)
      markJourneyStep('organization_ready', { organizationId: payload.organization.id })
      showToast('组织创建成功', 'success')
    } catch (error: unknown) {
      showRequestError(error, '创建组织失败')
    }
  }, [applyCreatedOrganization, markJourneyStep, newOrgName, showRequestError, showToast])

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

  const addOrganizationMember = useCallback(async () => {
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
    } catch (error: unknown) {
      showRequestError(error, '添加成员失败')
    }
  }, [
    effectiveOrganizationId,
    inviteMemberEmail,
    inviteOrgRole,
    refreshOrganizationMembers,
    showRequestError,
    showToast
  ])

  const refreshOrganizationQuota = useCallback(async () => {
    if (!effectiveOrganizationId) {
      applyOrganizationQuotaPayload(null)
      return
    }
    try {
      const payload = await requestJson<{
        success: boolean
        quota: OrganizationQuota
        usage: OrganizationUsage
      }>(`/api/organizations/${effectiveOrganizationId}/quota`)
      applyOrganizationQuotaPayload(payload)
    } catch (error: unknown) {
      applyOrganizationQuotaPayload(null)
      showRequestError(error, '加载组织配额失败')
    }
  }, [applyOrganizationQuotaPayload, effectiveOrganizationId, showRequestError])

  const saveOrganizationQuota = useCallback(async () => {
    if (!effectiveOrganizationId) {
      showToast('请先选择组织', 'info')
      return
    }
    const parsedQuotaForm = parseOrganizationQuotaForm()
    if (!parsedQuotaForm) return
    try {
      const payload = await requestJson<{
        success: boolean
        quota: OrganizationQuota
        usage: OrganizationUsage
      }>(`/api/organizations/${effectiveOrganizationId}/quota`, {
        method: 'PUT',
        body: JSON.stringify({
          requestLimit: parsedQuotaForm.requestLimit,
          storageLimitBytes: parsedQuotaForm.storageLimitMb * 1024 * 1024,
          concurrencyLimit: parsedQuotaForm.concurrencyLimit
        })
      })
      applyOrganizationQuotaPayload(payload)
      showToast('组织配额已更新', 'success')
    } catch (error: unknown) {
      showRequestError(error, '更新组织配额失败')
    }
  }, [
    applyOrganizationQuotaPayload,
    effectiveOrganizationId,
    parseOrganizationQuotaForm,
    showRequestError,
    showToast
  ])

  const exportOrganizationAudits = useCallback(
    async (format: 'json' | 'csv') => {
      if (!effectiveOrganizationId) {
        showToast('请先选择组织', 'info')
        return
      }
      const headers = buildAuthHeaders()
      const url = `${resolveApiBase()}/api/organizations/${encodeURIComponent(effectiveOrganizationId)}/audits/export?format=${format}&scope=all&limit=2000`
      try {
        const response = await fetch(url, { method: 'GET', headers })
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as unknown
          throw new Error(resolveResponseError(payload, response.status))
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
      } catch (error: unknown) {
        showRequestError(error, '获取审计记录失败')
      }
    },
    [effectiveOrganizationId, showRequestError, showToast]
  )

  const updateChannelForm = useCallback(
    (providerId: string, patch: Partial<ChannelFormState>) => {
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
    },
    [activeChannelScope]
  )

  const refreshChannelConfigs = useCallback(async () => {
    if (!effectiveOrganizationId) return
    try {
      const path = resolveScopedChannelConfigPath()
      if (!path) return
      const payload = await requestJson<{
        success: boolean
        configs: AiChannelConfig[]
        capabilities: CapabilityPayload
      }>(path)
      applyChannelConfigPayload(payload)
    } catch (error: unknown) {
      showRequestError(error, '加载模型失败')
    }
  }, [
    applyChannelConfigPayload,
    effectiveOrganizationId,
    resolveScopedChannelConfigPath,
    showRequestError
  ])

  const loadCapabilities = useCallback(async () => {
    setIsCapabilitiesLoading(true)
    try {
      const payload = await requestJson<CapabilityPayload>(resolveCapabilitiesPath())
      setCapabilities(payload)
    } catch (error: unknown) {
      showRequestError(error, '加载渠道接入状态失败')
    } finally {
      setIsCapabilitiesLoading(false)
    }
  }, [resolveCapabilitiesPath, showRequestError])
  const refreshChannelAccessResources = useCallback(
    async (options?: { includeQuota?: boolean }) => {
      await refreshChannelConfigs()
      await loadCapabilities()
      if (options?.includeQuota) {
        await refreshOrganizationQuota()
      }
    },
    [loadCapabilities, refreshChannelConfigs, refreshOrganizationQuota]
  )

  const saveChannelConfig = useCallback(
    async (providerId: string) => {
      if (!effectiveOrganizationId) {
        showToast('请先选择组织', 'info')
        return
      }
      const resolvedRequest = resolveChannelConfigRequest(providerId)
      if (!resolvedRequest) return
      try {
        await requestJson(resolvedRequest.path, {
          method: 'PUT',
          body: JSON.stringify({
            baseUrl: resolvedRequest.form.baseUrl.trim() || undefined,
            apiKey: resolvedRequest.form.apiKey.trim() || undefined,
            enabled: resolvedRequest.form.enabled,
            extra: resolvedRequest.extra
          })
        })
        clearChannelApiKey(providerId)
        showToast('渠道配置已保存', 'success')
        await refreshChannelAccessResources()
      } catch (error: unknown) {
        showRequestError(error, '保存渠道配置失败')
      }
    },
    [
      clearChannelApiKey,
      effectiveOrganizationId,
      refreshChannelAccessResources,
      resolveChannelConfigRequest,
      showRequestError,
      showToast
    ]
  )

  const testChannelConfig = useCallback(
    async (providerId: string) => {
      const resolvedRequest = resolveChannelConfigRequest(providerId)
      if (!resolvedRequest) return
      try {
        const payload = await requestJson<{ success: boolean; message: string }>(
          '/api/channels/test',
          {
            method: 'POST',
            body: JSON.stringify({
              providerId,
              baseUrl: resolvedRequest.form.baseUrl.trim() || undefined,
              apiKey: resolvedRequest.form.apiKey.trim() || undefined,
              workspaceId: resolvedRequest.workspaceId,
              extra: resolvedRequest.extra
            })
          }
        )
        if (payload.success) {
          showToast(payload.message || '测试通过', 'success')
        } else {
          showToast(payload.message || '测试失败', 'error')
        }
      } catch (error: unknown) {
        showRequestError(error, '初始化失败')
      }
    },
    [resolveChannelConfigRequest, showRequestError, showToast]
  )
  useEffect(() => {
    void loadAuthProfile()
  }, [loadAuthProfile])

  useEffect(() => {
    if (!effectiveOrganizationId) return
    selectOrganization(effectiveOrganizationId)
    void refreshOrganizationMembers()
    void refreshOrganizationQuota()
  }, [
    effectiveOrganizationId,
    refreshOrganizationMembers,
    refreshOrganizationQuota,
    selectOrganization
  ])

  useEffect(() => {
    if (!showChannelPanel || !authProfile) return
    void refreshChannelAccessResources({ includeQuota: true })
  }, [
    activeChannelScope,
    authProfile,
    effectiveOrganizationId,
    refreshChannelAccessResources,
    showChannelPanel,
    workspaceId
  ])

  return {
    isCapabilitiesLoading,
    capabilities,
    authProfile,
    organizations,
    selectedOrganizationId,
    orgMembers,
    loginEmail,
    loginPassword,
    registerMode,
    registerOrgName,
    newOrgName,
    inviteMemberEmail,
    inviteOrgRole,
    isAuthBusy,
    channelConfigs,
    channelForms,
    activeChannelScope,
    organizationQuota,
    organizationUsage,
    quotaForm,
    effectiveOrganizationId,
    selectOrganization,
    setSelectedOrganizationId,
    setLoginEmail,
    setLoginPassword,
    setRegisterMode,
    setRegisterOrgName,
    setNewOrgName,
    setInviteMemberEmail,
    setInviteOrgRole,
    setActiveChannelScope,
    setQuotaForm,
    loadCapabilities,
    submitAuth,
    logoutAuth,
    createOrganization,
    refreshOrganizationMembers,
    addOrganizationMember,
    refreshOrganizationQuota,
    saveOrganizationQuota,
    exportOrganizationAudits,
    updateChannelForm,
    refreshChannelConfigs,
    saveChannelConfig,
    testChannelConfig
  }
}
