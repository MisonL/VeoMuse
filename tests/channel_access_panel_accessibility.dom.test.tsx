import './helpers/dom-test-setup'
import React from 'react'
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import ChannelAccessPanel from '../apps/frontend/src/components/Editor/comparison-lab/ChannelAccessPanel'

const noop = () => {}

const renderPanel = (
  onClose: () => void,
  overrides: Partial<React.ComponentProps<typeof ChannelAccessPanel>> = {}
) =>
  render(
    <ChannelAccessPanel
      show={true}
      isCapabilitiesLoading={false}
      effectiveOrganizationId=""
      authProfile={null}
      organizations={[]}
      orgMembers={[]}
      selectedOrganizationId=""
      activeChannelScope="organization"
      workspaceId=""
      loginEmail=""
      loginPassword=""
      registerMode={false}
      registerOrgName=""
      isAuthBusy={false}
      newOrgName=""
      inviteMemberEmail=""
      inviteOrgRole="member"
      organizationQuota={null}
      organizationUsage={null}
      quotaForm={{ requestLimit: '', storageLimitMb: '', concurrencyLimit: '' }}
      channelConfigs={[]}
      channelForms={{}}
      capabilities={null}
      onClose={onClose}
      onLoadCapabilities={noop}
      onRefreshChannelConfigs={noop}
      onSubmitAuth={noop}
      onToggleRegisterMode={noop}
      onLoginEmailChange={noop}
      onLoginPasswordChange={noop}
      onRegisterOrgNameChange={noop}
      onSelectedOrganizationChange={noop}
      onNewOrgNameChange={noop}
      onCreateOrganization={noop}
      onLogoutAuth={noop}
      onInviteMemberEmailChange={noop}
      onInviteOrgRoleChange={noop}
      onAddOrganizationMember={noop}
      onRefreshOrganizationMembers={noop}
      onActiveChannelScopeChange={noop}
      onQuotaFormChange={noop}
      onSaveOrganizationQuota={noop}
      onRefreshOrganizationQuota={noop}
      onExportOrganizationAudits={noop}
      onUpdateChannelForm={noop}
      onSaveChannelConfig={noop}
      onTestChannelConfig={noop}
      {...overrides}
    />
  )

describe('ChannelAccessPanel 键盘可访问性', () => {
  afterEach(() => cleanup())

  it('Esc 应关闭弹窗', async () => {
    const onClose = mock(() => {})
    const view = renderPanel(onClose)
    const panel = view.getByTestId('area-channel-panel')

    fireEvent.keyDown(panel, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Tab/Shift+Tab 应在弹窗内循环焦点', async () => {
    const view = renderPanel(noop)
    const panel = view.getByTestId('area-channel-panel')

    await waitFor(() => {
      expect(document.activeElement).not.toBe(document.body)
    })

    const focusables = Array.from(
      panel.querySelectorAll<HTMLElement>(
        [
          'button:not([disabled])',
          'input:not([disabled])',
          'select:not([disabled])',
          'textarea:not([disabled])',
          '[tabindex]:not([tabindex="-1"])'
        ].join(',')
      )
    )
    expect(focusables.length).toBeGreaterThan(1)

    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    first.focus()
    fireEvent.keyDown(panel, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)

    last.focus()
    fireEvent.keyDown(panel, { key: 'Tab' })
    expect(document.activeElement).toBe(first)
  })

  it('已登录态应明确渠道作用域、配置来源、校验语义与 OpenAI 协议提示', () => {
    const view = renderPanel(noop, {
      effectiveOrganizationId: 'org_1',
      authProfile: { id: 'user_1', email: 'owner@veomuse.local' },
      organizations: [{ id: 'org_1', name: '组织一' }],
      selectedOrganizationId: 'org_1',
      workspaceId: 'ws_1',
      activeChannelScope: 'workspace',
      channelConfigs: [
        {
          id: 'chn_1',
          organizationId: 'org_1',
          workspaceId: null,
          providerId: 'openai-compatible',
          baseUrl: 'https://api.example.com',
          enabled: true,
          extra: {
            model: 'gpt-4.1',
            path: '/v1/responses',
            protocol: 'responses'
          },
          createdBy: 'user_1',
          updatedBy: 'user_1',
          createdAt: '2026-05-19T00:00:00.000Z',
          updatedAt: '2026-05-19T00:00:00.000Z',
          hasSecret: true,
          secretMasked: 'sk_***abc'
        }
      ],
      channelForms: {
        'openai-compatible': {
          providerId: 'openai-compatible',
          baseUrl: 'https://api.example.com',
          apiKey: '',
          model: 'gpt-4.1',
          path: '/v1/responses',
          protocol: 'responses',
          temperature: '',
          enabled: true,
          scope: 'organization'
        }
      },
      capabilities: {
        models: { 'openai-compatible': true },
        services: {},
        timestamp: '2026-05-19T00:00:00.000Z'
      }
    })

    expect(view.getByTestId('channel-scope-summary').textContent).toContain('工作区覆写')
    expect(view.getByTestId('channel-scope-summary').textContent).toContain('ws_1')
    expect(view.getByTestId('channel-source-openai-compatible').textContent).toContain('继承组织级')
    expect(view.getAllByText('校验配置').length).toBeGreaterThan(0)
    expect(document.getElementById('btn-test-channel-openai-compatible')?.textContent).toContain(
      '校验配置'
    )
    expect(document.getElementById('btn-save-channel-openai-compatible')?.textContent).toContain(
      '保存'
    )
    expect(view.getByTestId('channel-openai-protocol-hint').textContent).toContain(
      'Responses 使用 input'
    )
  })

  it('无工作区时应禁用工作区作用域并提示不会静默保存', () => {
    const view = renderPanel(noop, {
      effectiveOrganizationId: 'org_1',
      authProfile: { id: 'user_1', email: 'owner@veomuse.local' },
      organizations: [{ id: 'org_1', name: '组织一' }],
      selectedOrganizationId: 'org_1',
      activeChannelScope: 'workspace',
      workspaceId: ''
    })

    const scopeSelect = view.getByLabelText('渠道作用域') as HTMLSelectElement
    const workspaceOption = Array.from(scopeSelect.options).find(
      (option) => option.value === 'workspace'
    )

    expect(workspaceOption?.disabled).toBe(true)
    expect(view.getByTestId('channel-scope-summary').textContent).toContain('未选择工作区')
    expect(view.getByTestId('channel-scope-summary').textContent).toContain('不会降级保存到组织级')
  })

  it('切换 OpenAI 兼容协议时应同步默认 endpoint，避免可见路径与协议冲突', () => {
    const updateChannelForm = mock()
    const view = renderPanel(noop, {
      effectiveOrganizationId: 'org_1',
      authProfile: { id: 'user_1', email: 'owner@veomuse.local' },
      organizations: [{ id: 'org_1', name: '组织一' }],
      selectedOrganizationId: 'org_1',
      activeChannelScope: 'organization',
      channelForms: {
        'openai-compatible': {
          providerId: 'openai-compatible',
          baseUrl: 'https://api.example.com',
          apiKey: '',
          model: 'gpt-4.1',
          path: '/v1/chat/completions',
          protocol: 'chat',
          temperature: '',
          enabled: true,
          scope: 'organization'
        }
      },
      onUpdateChannelForm: updateChannelForm
    })

    fireEvent.change(view.getByLabelText('OpenAI 兼容（自定义） 协议'), {
      target: { value: 'responses' }
    })

    expect(updateChannelForm).toHaveBeenCalledWith('openai-compatible', {
      protocol: 'responses',
      path: '/v1/responses'
    })
  })

  it('切换 OpenAI 兼容协议时应同步绝对 URL endpoint 并保留 host', () => {
    const updateChannelForm = mock()
    const view = renderPanel(noop, {
      effectiveOrganizationId: 'org_1',
      authProfile: { id: 'user_1', email: 'owner@veomuse.local' },
      organizations: [{ id: 'org_1', name: '组织一' }],
      selectedOrganizationId: 'org_1',
      activeChannelScope: 'organization',
      channelForms: {
        'openai-compatible': {
          providerId: 'openai-compatible',
          baseUrl: 'https://api.example.com',
          apiKey: '',
          model: 'gpt-4.1',
          path: 'https://api.example.com/v1/chat/completions/',
          protocol: 'chat',
          temperature: '',
          enabled: true,
          scope: 'organization'
        }
      },
      onUpdateChannelForm: updateChannelForm
    })

    fireEvent.change(view.getByLabelText('OpenAI 兼容（自定义） 协议'), {
      target: { value: 'responses' }
    })

    expect(updateChannelForm).toHaveBeenCalledWith('openai-compatible', {
      protocol: 'responses',
      path: 'https://api.example.com/v1/responses'
    })
  })
})
