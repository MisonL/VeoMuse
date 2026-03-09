import React, { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { MODEL_CAPABILITY_ROWS, SERVICE_CAPABILITY_ROWS } from './constants'
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
} from './types'

interface ChannelAccessPanelProps {
  show: boolean
  isCapabilitiesLoading: boolean
  effectiveOrganizationId: string
  authProfile: AuthProfile | null
  organizations: Organization[]
  orgMembers: OrganizationMember[]
  selectedOrganizationId: string
  activeChannelScope: 'organization' | 'workspace'
  workspaceId: string
  loginEmail: string
  loginPassword: string
  registerMode: boolean
  registerOrgName: string
  isAuthBusy: boolean
  newOrgName: string
  inviteMemberEmail: string
  inviteOrgRole: OrganizationRole
  organizationQuota: OrganizationQuota | null
  organizationUsage: OrganizationUsage | null
  quotaForm: QuotaFormState
  channelConfigs: AiChannelConfig[]
  channelForms: Record<string, ChannelFormState>
  capabilities: CapabilityPayload | null
  onClose: () => void
  onLoadCapabilities: () => void
  onRefreshChannelConfigs: () => void
  onSubmitAuth: () => void
  onToggleRegisterMode: () => void
  onLoginEmailChange: (value: string) => void
  onLoginPasswordChange: (value: string) => void
  onRegisterOrgNameChange: (value: string) => void
  onSelectedOrganizationChange: (value: string) => void
  onNewOrgNameChange: (value: string) => void
  onCreateOrganization: () => void
  onLogoutAuth: () => void
  onInviteMemberEmailChange: (value: string) => void
  onInviteOrgRoleChange: (value: OrganizationRole) => void
  onAddOrganizationMember: () => void
  onRefreshOrganizationMembers: () => void
  onActiveChannelScopeChange: (scope: 'organization' | 'workspace') => void
  onQuotaFormChange: (next: Partial<QuotaFormState>) => void
  onSaveOrganizationQuota: () => void
  onRefreshOrganizationQuota: () => void
  onExportOrganizationAudits: (format: 'json' | 'csv') => void
  onUpdateChannelForm: (providerId: string, patch: Partial<ChannelFormState>) => void
  onSaveChannelConfig: (providerId: string) => void
  onTestChannelConfig: (providerId: string) => void
}

const ChannelAccessPanel: React.FC<ChannelAccessPanelProps> = ({
  show,
  isCapabilitiesLoading,
  effectiveOrganizationId,
  authProfile,
  organizations,
  orgMembers,
  selectedOrganizationId,
  activeChannelScope,
  workspaceId,
  loginEmail,
  loginPassword,
  registerMode,
  registerOrgName,
  isAuthBusy,
  newOrgName,
  inviteMemberEmail,
  inviteOrgRole,
  organizationQuota,
  organizationUsage,
  quotaForm,
  channelConfigs,
  channelForms,
  capabilities,
  onClose,
  onLoadCapabilities,
  onRefreshChannelConfigs,
  onSubmitAuth,
  onToggleRegisterMode,
  onLoginEmailChange,
  onLoginPasswordChange,
  onRegisterOrgNameChange,
  onSelectedOrganizationChange,
  onNewOrgNameChange,
  onCreateOrganization,
  onLogoutAuth,
  onInviteMemberEmailChange,
  onInviteOrgRoleChange,
  onAddOrganizationMember,
  onRefreshOrganizationMembers,
  onActiveChannelScopeChange,
  onQuotaFormChange,
  onSaveOrganizationQuota,
  onRefreshOrganizationQuota,
  onExportOrganizationAudits,
  onUpdateChannelForm,
  onSaveChannelConfig,
  onTestChannelConfig
}) => {
  const dialogRef = useRef<HTMLElement | null>(null)
  const channelConfigMap = useMemo(() => {
    const map = new Map<string, AiChannelConfig>()
    for (const row of channelConfigs) map.set(row.providerId, row)
    return map
  }, [channelConfigs])

  useEffect(() => {
    if (!show) return
    const dialog = dialogRef.current
    if (!dialog) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const getFocusableElements = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          [
            'a[href]',
            'button:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])'
          ].join(',')
        )
      ).filter((element) => !element.hasAttribute('aria-hidden'))

    const focusables = getFocusableElements()
    const initialFocus = focusables[0] || dialog
    initialFocus.focus()

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const loopFocusables = getFocusableElements()
      if (loopFocusables.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = loopFocusables[0]
      const last = loopFocusables[loopFocusables.length - 1]
      const activeElement = document.activeElement as HTMLElement | null
      if (event.shiftKey) {
        if (!activeElement || activeElement === first || !dialog.contains(activeElement)) {
          event.preventDefault()
          last.focus()
        }
        return
      }
      if (!activeElement || activeElement === last || !dialog.contains(activeElement)) {
        event.preventDefault()
        first.focus()
      }
    }

    dialog.addEventListener('keydown', handleKeydown)

    return () => {
      dialog.removeEventListener('keydown', handleKeydown)
      document.body.style.overflow = previousOverflow
    }
  }, [show, onClose])

  const renderChannelRows = (
    rows: Array<{ id: string; label: string; env: string }>,
    source: Record<string, boolean | string> | undefined
  ) =>
    rows.map((row) => {
      const raw = source?.[row.id]
      const enabled = raw === true || (typeof raw === 'string' && raw.trim().length > 0)
      const form = channelForms[row.id] || {
        providerId: row.id,
        baseUrl: '',
        apiKey: '',
        model: '',
        path: '',
        temperature: '',
        enabled: true,
        scope: activeChannelScope
      }
      const savedConfig = channelConfigMap.get(row.id)

      return (
        <div key={row.id} className="capability-row">
          <div className="capability-meta">
            <strong>{row.label}</strong>
            <span>{row.env}</span>
            {row.id === 'openai-compatible' ? (
              <span>支持 OpenAI SDK 兼容网关与第三方模型</span>
            ) : null}
            {savedConfig?.secretMasked ? <span>已存密钥：{savedConfig.secretMasked}</span> : null}
          </div>
          <form
            className="channel-row-controls"
            onSubmit={(event) => {
              event.preventDefault()
              onSaveChannelConfig(row.id)
            }}
          >
            <span className={`capability-badge ${enabled ? 'ok' : 'off'}`}>
              {enabled ? '已接入' : '未接入'}
            </span>
            <input
              name={`channelBaseUrl-${row.id}`}
              value={form.baseUrl}
              aria-label={`${row.label} Base URL`}
              onChange={(event) => onUpdateChannelForm(row.id, { baseUrl: event.target.value })}
              placeholder="Base URL（可选）"
            />
            <input
              name={`channelApiKey-${row.id}`}
              value={form.apiKey}
              aria-label={`${row.label} API Key`}
              onChange={(event) => onUpdateChannelForm(row.id, { apiKey: event.target.value })}
              placeholder="填写 API Key"
              type="password"
              autoComplete="new-password"
            />
            {row.id === 'openai-compatible' ? (
              <>
                <input
                  name={`channelModel-${row.id}`}
                  value={form.model}
                  aria-label={`${row.label} 模型 ID`}
                  onChange={(event) => onUpdateChannelForm(row.id, { model: event.target.value })}
                  placeholder="模型 ID（必填）"
                />
                <input
                  name={`channelPath-${row.id}`}
                  value={form.path}
                  aria-label={`${row.label} 兼容路径`}
                  onChange={(event) => onUpdateChannelForm(row.id, { path: event.target.value })}
                  placeholder="兼容路径（默认 /v1/chat/completions）"
                />
                <input
                  name={`channelTemperature-${row.id}`}
                  value={form.temperature}
                  aria-label={`${row.label} temperature`}
                  onChange={(event) =>
                    onUpdateChannelForm(row.id, { temperature: event.target.value })
                  }
                  placeholder="temperature（可选，0~2）"
                />
              </>
            ) : null}
            <label className="sync-toggle">
              <input
                name={`channelEnabled-${row.id}`}
                type="checkbox"
                checked={form.enabled}
                aria-label={`启用 ${row.label} 渠道`}
                onChange={(event) => onUpdateChannelForm(row.id, { enabled: event.target.checked })}
              />
              <span>启用</span>
            </label>
            <div className="lab-inline-actions">
              <button type="button" onClick={() => onTestChannelConfig(row.id)}>
                测试
              </button>
              <button type="submit">保存</button>
            </div>
          </form>
        </div>
      )
    })

  if (!show) return null

  const panel = (
    <div
      className="channel-panel-mask"
      role="dialog"
      aria-modal="true"
      aria-label="AI 渠道接入状态"
      data-testid="area-channel-panel-mask"
      onClick={onClose}
    >
      <section
        ref={dialogRef}
        className="channel-panel"
        data-testid="area-channel-panel"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="channel-panel-head">
          <div>
            <h3>AI 渠道接入中心</h3>
            <p>统一管理组织共享与工作区覆写，所有渠道配置在这里集中生效。</p>
          </div>
          <button
            type="button"
            className="channel-close-btn"
            onClick={onClose}
            data-testid="btn-close-channel-panel"
          >
            关闭
          </button>
        </header>

        <div className="channel-panel-actions">
          <button
            type="button"
            className="channel-refresh-btn"
            onClick={onLoadCapabilities}
            disabled={isCapabilitiesLoading}
          >
            {isCapabilitiesLoading ? '刷新中...' : '刷新状态'}
          </button>
          <button
            type="button"
            className="channel-refresh-btn"
            onClick={onRefreshChannelConfigs}
            disabled={!effectiveOrganizationId}
          >
            刷新配置
          </button>
          <code className="channel-hint">
            {authProfile ? `当前账号：${authProfile.email}` : '请先登录后再管理渠道'}
          </code>
        </div>

        {!authProfile ? (
          <div className="channel-grid">
            <section className="channel-card">
              <h4>{registerMode ? '注册并创建组织' : '登录账号'}</h4>
              <div className="channel-list">
                <div className="capability-row">
                  <form
                    className="channel-row-controls"
                    onSubmit={(event) => {
                      event.preventDefault()
                      onSubmitAuth()
                    }}
                  >
                    <input
                      name="loginEmail"
                      value={loginEmail}
                      aria-label="登录邮箱"
                      onChange={(event) => onLoginEmailChange(event.target.value)}
                      placeholder="邮箱"
                      autoComplete="email"
                      data-testid="input-login-email"
                    />
                    <input
                      name="loginPassword"
                      type="password"
                      value={loginPassword}
                      aria-label="登录密码"
                      onChange={(event) => onLoginPasswordChange(event.target.value)}
                      placeholder="密码（至少 8 位）"
                      autoComplete={registerMode ? 'new-password' : 'current-password'}
                      data-testid="input-login-password"
                    />
                    {registerMode ? (
                      <input
                        name="registerOrgName"
                        value={registerOrgName}
                        aria-label="注册组织名"
                        onChange={(event) => onRegisterOrgNameChange(event.target.value)}
                        placeholder="初始组织名"
                        data-testid="input-register-organization"
                      />
                    ) : null}
                    <div className="lab-inline-actions">
                      <button type="submit" disabled={isAuthBusy} data-testid="btn-submit-auth">
                        {isAuthBusy ? '提交中...' : registerMode ? '注册并登录' : '登录'}
                      </button>
                      <button
                        type="button"
                        disabled={isAuthBusy}
                        onClick={onToggleRegisterMode}
                        data-testid="btn-toggle-register-mode"
                      >
                        {registerMode ? '切换到登录' : '切换到注册'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="channel-grid">
            <section className="channel-card">
              <h4>组织与成员</h4>
              <div className="channel-list">
                <div className="capability-row">
                  <div className="channel-row-controls">
                    <select
                      name="selectedOrganizationId"
                      value={selectedOrganizationId}
                      aria-label="当前组织"
                      onChange={(event) => onSelectedOrganizationChange(event.target.value)}
                      data-testid="select-organization"
                    >
                      {organizations.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    <input
                      name="newOrganizationName"
                      value={newOrgName}
                      aria-label="新组织名称"
                      onChange={(event) => onNewOrgNameChange(event.target.value)}
                      placeholder="新组织名称"
                      data-testid="input-new-organization-name"
                    />
                    <div className="lab-inline-actions">
                      <button onClick={onCreateOrganization} data-testid="btn-create-organization">
                        创建组织
                      </button>
                      <button onClick={onLogoutAuth} data-testid="btn-logout-auth">
                        退出登录
                      </button>
                    </div>
                    <input
                      name="inviteMemberEmail"
                      value={inviteMemberEmail}
                      aria-label="邀请成员邮箱"
                      onChange={(event) => onInviteMemberEmailChange(event.target.value)}
                      placeholder="成员邮箱（需已注册）"
                      autoComplete="email"
                    />
                    <select
                      name="inviteOrganizationRole"
                      value={inviteOrgRole}
                      aria-label="邀请成员角色"
                      onChange={(event) =>
                        onInviteOrgRoleChange(event.target.value as OrganizationRole)
                      }
                    >
                      <option value="member">成员</option>
                      <option value="admin">管理员</option>
                      <option value="owner">所有者</option>
                    </select>
                    <div className="lab-inline-actions">
                      <button onClick={onAddOrganizationMember}>添加成员</button>
                      <button onClick={onRefreshOrganizationMembers}>刷新成员</button>
                    </div>
                    <div className="capability-meta">
                      {orgMembers.slice(0, 6).map((item) => (
                        <span key={item.id}>
                          {item.email} ·{' '}
                          {item.role === 'owner'
                            ? '所有者'
                            : item.role === 'admin'
                              ? '管理员'
                              : '成员'}
                        </span>
                      ))}
                      {orgMembers.length === 0 ? <span>暂无成员</span> : null}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="channel-card">
              <h4>渠道作用域</h4>
              <div className="channel-list">
                <div className="capability-row">
                  <div className="channel-row-controls">
                    <select
                      name="activeChannelScope"
                      value={activeChannelScope}
                      aria-label="渠道作用域"
                      onChange={(event) =>
                        onActiveChannelScopeChange(
                          event.target.value as 'organization' | 'workspace'
                        )
                      }
                    >
                      <option value="organization">组织级共享</option>
                      <option value="workspace">工作区覆写</option>
                    </select>
                    <span className="channel-hint">当前工作区：{workspaceId || '未选择'}</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="channel-card">
              <h4>组织配额与审计</h4>
              <div className="channel-list">
                <div className="capability-row">
                  <div className="channel-row-controls">
                    <input
                      name="quotaRequestLimit"
                      value={quotaForm.requestLimit}
                      aria-label="请求配额"
                      onChange={(event) => onQuotaFormChange({ requestLimit: event.target.value })}
                      placeholder="请求配额（0 为不限制）"
                    />
                    <input
                      name="quotaStorageLimitMb"
                      value={quotaForm.storageLimitMb}
                      aria-label="存储配额 MB"
                      onChange={(event) =>
                        onQuotaFormChange({ storageLimitMb: event.target.value })
                      }
                      placeholder="存储配额 MB（0 为不限制）"
                    />
                    <input
                      name="quotaConcurrencyLimit"
                      value={quotaForm.concurrencyLimit}
                      aria-label="并发配额"
                      onChange={(event) =>
                        onQuotaFormChange({ concurrencyLimit: event.target.value })
                      }
                      placeholder="并发配额（0 为不限制）"
                    />
                    <div className="lab-inline-actions">
                      <button
                        type="button"
                        onClick={onSaveOrganizationQuota}
                        data-testid="btn-save-org-quota"
                      >
                        保存配额
                      </button>
                      <button
                        type="button"
                        onClick={onRefreshOrganizationQuota}
                        data-testid="btn-refresh-org-quota"
                      >
                        刷新配额
                      </button>
                    </div>
                    <div className="lab-inline-actions">
                      <button
                        type="button"
                        onClick={() => onExportOrganizationAudits('json')}
                        data-testid="btn-export-org-audit-json"
                      >
                        导出审计 JSON
                      </button>
                      <button
                        type="button"
                        onClick={() => onExportOrganizationAudits('csv')}
                        data-testid="btn-export-org-audit-csv"
                      >
                        导出审计 CSV
                      </button>
                    </div>
                    <div className="capability-meta">
                      <span>
                        已用请求：{organizationUsage?.requestCount ?? 0}
                        {organizationQuota?.requestLimit
                          ? ` / ${organizationQuota.requestLimit}`
                          : ' / 不限制'}
                      </span>
                      <span>
                        已用存储：
                        {Math.round((organizationUsage?.storageBytes || 0) / (1024 * 1024))} MB
                        {organizationQuota?.storageLimitBytes
                          ? ` / ${Math.round(organizationQuota.storageLimitBytes / (1024 * 1024))} MB`
                          : ' / 不限制'}
                      </span>
                      <span>
                        当前并发：{organizationUsage?.activeRequests ?? 0}
                        {organizationQuota?.concurrencyLimit
                          ? ` / ${organizationQuota.concurrencyLimit}`
                          : ' / 不限制'}
                      </span>
                      <span>
                        上次请求：
                        {organizationUsage?.lastRequestAt
                          ? new Date(organizationUsage.lastRequestAt).toLocaleString()
                          : '-'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {authProfile ? (
          <div className="channel-grid">
            <section className="channel-card">
              <h4>视频模型渠道</h4>
              <div className="channel-list">
                {renderChannelRows(MODEL_CAPABILITY_ROWS, capabilities?.models)}
              </div>
            </section>

            <section className="channel-card">
              <h4>媒体服务渠道</h4>
              <div className="channel-list">
                {renderChannelRows(SERVICE_CAPABILITY_ROWS, capabilities?.services)}
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </div>
  )

  if (typeof document === 'undefined') return panel
  return createPortal(panel, document.body)
}

export default ChannelAccessPanel
