import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditorStore } from '../../../../store/editorStore'
import { useToastStore } from '../../../../store/toastStore'
import { useJourneyTelemetryStore } from '../../../../store/journeyTelemetryStore'
import type { ComparisonLabProps, LabMode, QuotaFormState, WorkspaceRole } from '../types'
import { api } from '../../../../utils/eden'
import { useAuthOrganizationChannelManager } from './useAuthOrganizationChannelManager'
import { useCompareModeManager } from './useCompareModeManager'
import { useMarketplacePolicy } from './useMarketplacePolicy'
import { useSyncedPlayback } from './useSyncedPlayback'

interface UseComparisonLabControllerOptions {
  onOpenAssets?: ComparisonLabProps['onOpenAssets']
  channelPanelRequestNonce?: number
}

export const useComparisonLabController = ({
  onOpenAssets,
  channelPanelRequestNonce
}: UseComparisonLabControllerOptions) => {
  const allAssets = useEditorStore((state) => state.assets)
  const { showToast } = useToastStore()
  const markJourneyStep = useJourneyTelemetryStore((state) => state.markStep)
  const reportJourney = useJourneyTelemetryStore((state) => state.reportJourney)
  const resetJourney = useJourneyTelemetryStore((state) => state.resetJourney)

  const [labMode, setLabMode] = useState<LabMode>(() =>
    channelPanelRequestNonce && channelPanelRequestNonce > 0 ? 'marketplace' : 'compare'
  )
  const [syncPlayback, setSyncPlayback] = useState(true)
  const [workspaceName, setWorkspaceName] = useState('VeoMuse 协作空间')
  const [workspaceOwner, setWorkspaceOwner] = useState('Owner')
  const [workspaceId, setWorkspaceId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [memberName, setMemberName] = useState('Editor A')
  const [collabRole, setCollabRole] = useState<WorkspaceRole>('editor')
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('editor')
  const [inviteCode, setInviteCode] = useState('')
  const [uploadFileName, setUploadFileName] = useState('demo.mp4')
  const [showChannelPanel, setShowChannelPanel] = useState(() =>
    Boolean(channelPanelRequestNonce && channelPanelRequestNonce > 0)
  )

  const channelPanelTriggerRef = useRef<HTMLElement | null>(null)
  const handledChannelPanelRequestRef = useRef(0)

  const captureChannelPanelTrigger = useCallback(() => {
    const activeElement = document.activeElement
    channelPanelTriggerRef.current = activeElement instanceof HTMLElement ? activeElement : null
  }, [])

  const openChannelPanel = useCallback(() => {
    captureChannelPanelTrigger()
    setShowChannelPanel(true)
  }, [captureChannelPanelTrigger])

  const openMarketplaceChannelPanel = useCallback(() => {
    setLabMode('marketplace')
    captureChannelPanelTrigger()
    setShowChannelPanel(true)
  }, [captureChannelPanelTrigger])

  const {
    leftAssetId,
    rightAssetId,
    leftModel,
    rightModel,
    availableModels,
    assets,
    leftAsset,
    rightAsset,
    leftVideoRef,
    rightVideoRef,
    setLeftAssetId,
    setRightAssetId,
    setLeftModel,
    setRightModel,
    setAvailableModels,
    exportReport,
    requestRecommendation
  } = useCompareModeManager({
    allAssets,
    labMode,
    syncPlayback,
    showToast
  })

  const {
    marketplace,
    isMarketplaceLoading,
    marketplaceError,
    policies,
    selectedPolicy,
    selectedPolicyId,
    setSelectedPolicyId,
    isPolicyLoading,
    isPolicyCreating,
    isPolicyUpdating,
    isPolicySimulating,
    policyCreateName,
    setPolicyCreateName,
    policyCreatePriority,
    setPolicyCreatePriority,
    policyCreateBudget,
    setPolicyCreateBudget,
    policyAllowedModels,
    setPolicyAllowedModels,
    policyWeights,
    setPolicyWeights,
    policyPrompt,
    setPolicyPrompt,
    policyBudget,
    setPolicyBudget,
    policyPriority,
    setPolicyPriority,
    policyDecision,
    policyExecutions,
    policyExecHasMore,
    policyExecLoading,
    toggleAllowedModel,
    refreshMarketplace,
    loadPolicies,
    loadPolicyExecutions,
    createPolicy,
    updateSelectedPolicy,
    simulatePolicy
  } = useMarketplacePolicy({
    showToast,
    onRecommendModel: (modelId) => setLeftModel(modelId)
  })

  const {
    isCapabilitiesLoading,
    capabilities,
    authProfile,
    organizations,
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
  } = useAuthOrganizationChannelManager({
    workspaceId,
    showChannelPanel,
    loadPolicies,
    showToast,
    markJourneyStep,
    reportJourney,
    resetJourney
  })

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
  }, [refreshMarketplace, setPolicyAllowedModels, setAvailableModels, setLeftModel, setRightModel])

  useEffect(() => {
    if (!selectedPolicyId) return
    void loadPolicyExecutions(true, selectedPolicyId)
  }, [selectedPolicyId, loadPolicyExecutions])

  useSyncedPlayback({
    syncPlayback,
    leftAssetId,
    rightAssetId,
    leftVideoRef,
    rightVideoRef
  })

  useEffect(() => {
    const nextRequestNonce = channelPanelRequestNonce || 0
    if (nextRequestNonce <= 0 || handledChannelPanelRequestRef.current === nextRequestNonce) {
      return
    }

    handledChannelPanelRequestRef.current = nextRequestNonce
    const timerId = window.setTimeout(() => {
      openMarketplaceChannelPanel()
    }, 0)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [channelPanelRequestNonce, openMarketplaceChannelPanel])

  useEffect(() => {
    window.addEventListener(
      'veomuse:open-channel-panel',
      openMarketplaceChannelPanel as EventListener
    )
    return () => {
      window.removeEventListener(
        'veomuse:open-channel-panel',
        openMarketplaceChannelPanel as EventListener
      )
    }
  }, [openMarketplaceChannelPanel])

  return {
    labMode,
    toolbarProps: {
      labMode,
      syncPlayback,
      onSyncPlaybackChange: setSyncPlayback,
      onModeChange: setLabMode,
      onExportReport: () => void exportReport(),
      onRefreshMarketplace: () => void refreshMarketplace(true),
      onOpenChannelPanel: openChannelPanel
    },
    comparePanelProps: {
      availableModels,
      assets,
      leftModel,
      rightModel,
      leftAssetId,
      rightAssetId,
      leftAsset,
      rightAsset,
      leftVideoRef,
      rightVideoRef,
      onLeftModelChange: setLeftModel,
      onRightModelChange: setRightModel,
      onLeftAssetChange: setLeftAssetId,
      onRightAssetChange: setRightAssetId,
      onRequestRecommendation: requestRecommendation,
      onOpenAssets
    },
    marketplacePanelProps: {
      selectedPolicyId,
      policies,
      selectedPolicy,
      availableModels,
      marketplace,
      isMarketplaceLoading,
      marketplaceError,
      policyCreateName,
      policyCreatePriority,
      policyCreateBudget,
      policyAllowedModels,
      policyWeights,
      policyPrompt,
      policyBudget,
      policyPriority,
      policyDecision,
      policyExecutions,
      policyExecHasMore,
      isPolicyLoading,
      isPolicyCreating,
      isPolicyUpdating,
      isPolicySimulating,
      policyExecLoading,
      onSelectedPolicyChange: setSelectedPolicyId,
      onPolicyCreateNameChange: setPolicyCreateName,
      onPolicyCreatePriorityChange: setPolicyCreatePriority,
      onPolicyCreateBudgetChange: setPolicyCreateBudget,
      onPolicyWeightChange: (key: string, value: number) =>
        setPolicyWeights((prev) => ({ ...prev, [key]: value })),
      onToggleAllowedModel: toggleAllowedModel,
      onCreatePolicy: () => void createPolicy(),
      onLoadPolicies: (notify: boolean) => void loadPolicies(notify),
      onUpdateSelectedPolicy: () => void updateSelectedPolicy(),
      onRefreshMarketplace: () => void refreshMarketplace(true),
      onPolicyPromptChange: setPolicyPrompt,
      onPolicyBudgetChange: setPolicyBudget,
      onPolicyPriorityChange: setPolicyPriority,
      onSimulatePolicy: () => void simulatePolicy(),
      onLoadPolicyExecutions: (reset: boolean) => void loadPolicyExecutions(reset)
    },
    creativeContainerProps: {
      selectedPolicyId,
      policyDecision,
      simulatePolicy,
      showToast,
      capabilities,
      labMode,
      authProfile,
      isCapabilitiesLoading,
      workspaceId,
      loadCapabilities,
      projectId,
      memberName,
      workspaceOwner,
      openChannelPanel
    },
    collabContainerProps: {
      authProfile,
      workspaceName,
      setWorkspaceName,
      workspaceOwner,
      setWorkspaceOwner,
      workspaceId,
      setWorkspaceId,
      projectId,
      setProjectId,
      memberName,
      setMemberName,
      collabRole,
      setCollabRole,
      inviteRole,
      setInviteRole,
      inviteCode,
      setInviteCode,
      uploadFileName,
      setUploadFileName,
      effectiveOrganizationId,
      selectOrganization,
      labMode,
      openChannelPanel,
      showToast,
      markJourneyStep,
      reportJourney
    },
    channelAccessPanelProps: {
      show: showChannelPanel,
      isCapabilitiesLoading,
      effectiveOrganizationId,
      authProfile,
      organizations,
      orgMembers,
      selectedOrganizationId: effectiveOrganizationId,
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
      onClose: () => {
        setShowChannelPanel(false)
        window.setTimeout(() => {
          channelPanelTriggerRef.current?.focus()
        }, 0)
      },
      onLoadCapabilities: () => void loadCapabilities(),
      onRefreshChannelConfigs: () => void refreshChannelConfigs(),
      onSubmitAuth: () => void submitAuth(),
      onToggleRegisterMode: () => setRegisterMode((prev) => !prev),
      onLoginEmailChange: setLoginEmail,
      onLoginPasswordChange: setLoginPassword,
      onRegisterOrgNameChange: setRegisterOrgName,
      onSelectedOrganizationChange: selectOrganization,
      onNewOrgNameChange: setNewOrgName,
      onCreateOrganization: () => void createOrganization(),
      onLogoutAuth: () => void logoutAuth(),
      onInviteMemberEmailChange: setInviteMemberEmail,
      onInviteOrgRoleChange: setInviteOrgRole,
      onAddOrganizationMember: () => void addOrganizationMember(),
      onRefreshOrganizationMembers: () => void refreshOrganizationMembers(),
      onActiveChannelScopeChange: setActiveChannelScope,
      onQuotaFormChange: (next: Partial<QuotaFormState>) =>
        setQuotaForm((prev) => ({ ...prev, ...next })),
      onSaveOrganizationQuota: () => void saveOrganizationQuota(),
      onRefreshOrganizationQuota: () => void refreshOrganizationQuota(),
      onExportOrganizationAudits: (format: 'json' | 'csv') => void exportOrganizationAudits(format),
      onUpdateChannelForm: updateChannelForm,
      onSaveChannelConfig: (providerId: string) => void saveChannelConfig(providerId),
      onTestChannelConfig: (providerId: string) => void testChannelConfig(providerId)
    }
  }
}
