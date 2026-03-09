import './helpers/dom-test-setup'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { useEditorStore } from '../apps/frontend/src/store/editorStore'
import { useComparisonLabController } from '../apps/frontend/src/components/Editor/comparison-lab/hooks/useComparisonLabController'
import * as compareModule from '../apps/frontend/src/components/Editor/comparison-lab/hooks/useCompareModeManager'
import * as marketplaceModule from '../apps/frontend/src/components/Editor/comparison-lab/hooks/useMarketplacePolicy'
import * as authModule from '../apps/frontend/src/components/Editor/comparison-lab/hooks/useAuthOrganizationChannelManager'
import * as syncedPlaybackModule from '../apps/frontend/src/components/Editor/comparison-lab/hooks/useSyncedPlayback'

describe('useComparisonLabController contract', () => {
  let compareSpy: ReturnType<typeof spyOn>
  let marketplaceSpy: ReturnType<typeof spyOn>
  let authSpy: ReturnType<typeof spyOn>
  let syncedPlaybackSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    useEditorStore.setState({
      assets: [
        { id: 'asset_left', name: 'left.mp4', type: 'video', src: 'file:///left.mp4' } as any,
        { id: 'asset_right', name: 'right.mp4', type: 'video', src: 'file:///right.mp4' } as any
      ]
    })

    compareSpy = spyOn(compareModule, 'useCompareModeManager').mockReturnValue({
      leftAssetId: 'asset_left',
      rightAssetId: 'asset_right',
      leftModel: 'veo-3.1',
      rightModel: 'kling-v1',
      availableModels: [],
      assets: [],
      leftAsset: { id: 'asset_left', name: 'left.mp4', type: 'video' },
      rightAsset: { id: 'asset_right', name: 'right.mp4', type: 'video' },
      leftVideoRef: { current: null },
      rightVideoRef: { current: null },
      setLeftAssetId: mock(() => {}),
      setRightAssetId: mock(() => {}),
      setLeftModel: mock(() => {}),
      setRightModel: mock(() => {}),
      setAvailableModels: mock(() => {}),
      exportReport: mock(() => Promise.resolve()),
      requestRecommendation: mock((_side: 'left' | 'right') => Promise.resolve())
    } as any)

    marketplaceSpy = spyOn(marketplaceModule, 'useMarketplacePolicy').mockReturnValue({
      marketplace: [],
      isMarketplaceLoading: false,
      marketplaceError: '',
      policies: [],
      selectedPolicy: null,
      selectedPolicyId: 'policy_1',
      setSelectedPolicyId: mock(() => {}),
      isPolicyLoading: false,
      isPolicyCreating: false,
      isPolicyUpdating: false,
      isPolicySimulating: false,
      policyCreateName: '策略 A',
      setPolicyCreateName: mock(() => {}),
      policyCreatePriority: 'quality',
      setPolicyCreatePriority: mock(() => {}),
      policyCreateBudget: '1.2',
      setPolicyCreateBudget: mock(() => {}),
      policyAllowedModels: ['veo-3.1'],
      setPolicyAllowedModels: mock(() => {}),
      policyWeights: { quality: 0.5, speed: 0.2, cost: 0.1, reliability: 0.2 },
      setPolicyWeights: mock(() => {}),
      policyPrompt: 'prompt',
      setPolicyPrompt: mock(() => {}),
      policyBudget: '1.2',
      setPolicyBudget: mock(() => {}),
      policyPriority: 'quality',
      setPolicyPriority: mock(() => {}),
      policyDecision: null,
      policyExecutions: [],
      policyExecHasMore: false,
      policyExecLoading: false,
      toggleAllowedModel: mock(() => {}),
      refreshMarketplace: mock((_notify?: boolean) => Promise.resolve()),
      loadPolicies: mock((_notify: boolean) => Promise.resolve()),
      loadPolicyExecutions: mock((_reset: boolean, _policyId?: string) => Promise.resolve()),
      createPolicy: mock(() => Promise.resolve()),
      updateSelectedPolicy: mock(() => Promise.resolve()),
      simulatePolicy: mock(() => Promise.resolve(null))
    } as any)

    authSpy = spyOn(authModule, 'useAuthOrganizationChannelManager').mockReturnValue({
      isCapabilitiesLoading: false,
      capabilities: { models: {}, services: {} },
      authProfile: { id: 'user_1', email: 'boss@example.com' },
      organizations: [{ id: 'org_1', name: '组织一' }],
      orgMembers: [],
      selectedOrganizationId: 'org_1',
      loginEmail: 'boss@example.com',
      loginPassword: 'secret',
      registerMode: false,
      registerOrgName: '我的组织',
      newOrgName: '',
      inviteMemberEmail: '',
      inviteOrgRole: 'member',
      isAuthBusy: false,
      channelConfigs: [],
      channelForms: {},
      activeChannelScope: 'organization',
      organizationQuota: null,
      organizationUsage: null,
      quotaForm: { requestLimit: '0', storageLimitMb: '0', concurrencyLimit: '0' },
      effectiveOrganizationId: 'org_1',
      selectOrganization: mock(() => {}),
      setSelectedOrganizationId: mock(() => {}),
      setLoginEmail: mock(() => {}),
      setLoginPassword: mock(() => {}),
      setRegisterMode: mock(() => {}),
      setRegisterOrgName: mock(() => {}),
      setNewOrgName: mock(() => {}),
      setInviteMemberEmail: mock(() => {}),
      setInviteOrgRole: mock(() => {}),
      setActiveChannelScope: mock(() => {}),
      setQuotaForm: mock(() => {}),
      loadCapabilities: mock(() => Promise.resolve()),
      submitAuth: mock(() => Promise.resolve()),
      logoutAuth: mock(() => Promise.resolve()),
      createOrganization: mock(() => Promise.resolve()),
      refreshOrganizationMembers: mock(() => Promise.resolve()),
      addOrganizationMember: mock(() => Promise.resolve()),
      refreshOrganizationQuota: mock(() => Promise.resolve()),
      saveOrganizationQuota: mock(() => Promise.resolve()),
      exportOrganizationAudits: mock((_format: 'json' | 'csv') => Promise.resolve()),
      updateChannelForm: mock(() => {}),
      refreshChannelConfigs: mock(() => Promise.resolve()),
      saveChannelConfig: mock((_providerId: string) => Promise.resolve()),
      testChannelConfig: mock((_providerId: string) => Promise.resolve())
    } as any)

    syncedPlaybackSpy = spyOn(syncedPlaybackModule, 'useSyncedPlayback').mockImplementation(
      () => {}
    )
  })

  afterEach(() => {
    cleanup()
    compareSpy.mockRestore()
    marketplaceSpy.mockRestore()
    authSpy.mockRestore()
    syncedPlaybackSpy.mockRestore()
  })

  it('应保持 grouped props contract 与关键 wrapper 接线', async () => {
    let controller: ReturnType<typeof useComparisonLabController> | null = null
    const onOpenAssets = mock(() => {})

    const Harness = () => {
      controller = useComparisonLabController({ onOpenAssets })
      return null
    }

    render(<Harness />)

    await waitFor(() => {
      const marketplaceReturn = marketplaceSpy.mock.results[0]?.value as any
      expect(marketplaceReturn.refreshMarketplace).toHaveBeenCalledWith(false)
    })

    expect(controller?.labMode).toBe('compare')
    expect(controller?.toolbarProps.labMode).toBe('compare')
    expect(controller?.comparePanelProps.leftAssetId).toBe('asset_left')
    expect(controller?.marketplacePanelProps.selectedPolicyId).toBe('policy_1')
    expect(controller?.creativeContainerProps.workspaceId).toBe('')
    expect(controller?.collabContainerProps.workspaceOwner).toBe('空间管理员')
    expect(controller?.channelAccessPanelProps.show).toBe(false)
    expect(controller?.channelAccessPanelProps.selectedOrganizationId).toBe('org_1')

    await act(async () => {
      controller?.toolbarProps.onExportReport()
      controller?.comparePanelProps.onRequestRecommendation('left')
      controller?.marketplacePanelProps.onCreatePolicy()
      controller?.marketplacePanelProps.onLoadPolicies(true)
      controller?.channelAccessPanelProps.onSaveChannelConfig('openai-compatible')
      controller?.channelAccessPanelProps.onTestChannelConfig('openai-compatible')
      controller?.channelAccessPanelProps.onLoadCapabilities()
    })

    const compareReturn = compareSpy.mock.results[0]?.value as any
    const marketplaceReturn = marketplaceSpy.mock.results[0]?.value as any
    const authReturn = authSpy.mock.results[0]?.value as any

    expect(compareReturn.exportReport).toHaveBeenCalledTimes(1)
    expect(compareReturn.requestRecommendation).toHaveBeenCalledWith('left')
    expect(marketplaceReturn.createPolicy).toHaveBeenCalledTimes(1)
    expect(marketplaceReturn.loadPolicies).toHaveBeenCalledWith(true)
    expect(authReturn.saveChannelConfig).toHaveBeenCalledWith('openai-compatible')
    expect(authReturn.testChannelConfig).toHaveBeenCalledWith('openai-compatible')
    expect(authReturn.loadCapabilities).toHaveBeenCalledTimes(1)
    expect(syncedPlaybackSpy).toHaveBeenCalledTimes(1)
  })

  it('外部打开渠道面板事件应切到 marketplace 并打开 channel panel', async () => {
    let controller: ReturnType<typeof useComparisonLabController> | null = null

    const Harness = () => {
      controller = useComparisonLabController({ onOpenAssets: mock(() => {}) })
      return null
    }

    render(<Harness />)

    await act(async () => {
      window.dispatchEvent(new Event('veomuse:open-channel-panel'))
    })

    await waitFor(() => {
      expect(controller?.toolbarProps.labMode).toBe('marketplace')
      expect(controller?.channelAccessPanelProps.show).toBe(true)
    })
  })
})
