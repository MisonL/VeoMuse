import './helpers/dom-test-setup'
import React from 'react'
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import ChannelAccessPanel from '../apps/frontend/src/components/Editor/comparison-lab/ChannelAccessPanel'

const noop = () => {}

const renderPanel = (onClose: () => void) =>
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
})
