import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { useToastStore } from '../../store/toastStore'
import { useJourneyTelemetryStore } from '../../store/journeyTelemetryStore'
import type {
  ComparisonLabProps,
  LabMode,
  WorkspaceRole
} from './comparison-lab/types'
import { api } from '../../utils/eden'
import { useAuthOrganizationChannelManager } from './comparison-lab/hooks/useAuthOrganizationChannelManager'
import { useCompareModeManager } from './comparison-lab/hooks/useCompareModeManager'
import { useMarketplacePolicy } from './comparison-lab/hooks/useMarketplacePolicy'
import { useSyncedPlayback } from './comparison-lab/hooks/useSyncedPlayback'
import LabToolbar from './comparison-lab/LabToolbar'
import CompareModePanel from './comparison-lab/modes/CompareModePanel'
import MarketplaceModePanel from './comparison-lab/modes/MarketplaceModePanel'
import CreativeModeContainer from './comparison-lab/modes/creative/CreativeModeContainer'
import CollabModeContainer from './comparison-lab/modes/collab/CollabModeContainer'
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

  const [workspaceName, setWorkspaceName] = useState('VeoMuse 协作空间')
  const [workspaceOwner, setWorkspaceOwner] = useState('Owner')
  const [workspaceId, setWorkspaceId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [memberName, setMemberName] = useState('Editor A')
  const [collabRole, setCollabRole] = useState<WorkspaceRole>('editor')
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('editor')
  const [inviteCode, setInviteCode] = useState('')
  const [uploadFileName, setUploadFileName] = useState('demo.mp4')
  const [showChannelPanel, setShowChannelPanel] = useState(false)

  const channelPanelTriggerRef = useRef<HTMLElement | null>(null)

  const openChannelPanel = useCallback(() => {
    const activeElement = document.activeElement
    channelPanelTriggerRef.current = activeElement instanceof HTMLElement ? activeElement : null
    setShowChannelPanel(true)
  }, [])

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
    const handleOpenChannelPanel = () => {
      setLabMode('marketplace')
      const activeElement = document.activeElement
      channelPanelTriggerRef.current = activeElement instanceof HTMLElement ? activeElement : null
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
        <section id="lab-panel-compare" role="tabpanel" aria-labelledby="lab-tab-compare">
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
        </section>
      ) : null}

      {labMode === 'marketplace' ? (
        <section id="lab-panel-marketplace" role="tabpanel" aria-labelledby="lab-tab-marketplace">
          <MarketplaceModePanel
            selectedPolicyId={selectedPolicyId}
            policies={policies}
            selectedPolicy={selectedPolicy}
            availableModels={availableModels}
            marketplace={marketplace}
            isMarketplaceLoading={isMarketplaceLoading}
            marketplaceError={marketplaceError}
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
            isPolicyCreating={isPolicyCreating}
            isPolicyUpdating={isPolicyUpdating}
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
            onRefreshMarketplace={() => void refreshMarketplace(true)}
            onPolicyPromptChange={setPolicyPrompt}
            onPolicyBudgetChange={setPolicyBudget}
            onPolicyPriorityChange={setPolicyPriority}
            onSimulatePolicy={() => void simulatePolicy()}
            onLoadPolicyExecutions={(reset) => void loadPolicyExecutions(reset)}
          />
        </section>
      ) : null}

      {labMode === 'creative' ? (
        <section id="lab-panel-creative" role="tabpanel" aria-labelledby="lab-tab-creative">
          <CreativeModeContainer
            selectedPolicyId={selectedPolicyId}
            policyDecision={policyDecision}
            simulatePolicy={simulatePolicy}
            showToast={showToast}
            capabilities={capabilities}
            labMode={labMode}
            authProfile={authProfile}
            isCapabilitiesLoading={isCapabilitiesLoading}
            workspaceId={workspaceId}
            loadCapabilities={loadCapabilities}
            projectId={projectId}
            memberName={memberName}
            workspaceOwner={workspaceOwner}
            openChannelPanel={openChannelPanel}
          />
        </section>
      ) : null}

      {labMode === 'collab' ? (
        <section id="lab-panel-collab" role="tabpanel" aria-labelledby="lab-tab-collab">
          <CollabModeContainer
            authProfile={authProfile}
            workspaceName={workspaceName}
            setWorkspaceName={setWorkspaceName}
            workspaceOwner={workspaceOwner}
            setWorkspaceOwner={setWorkspaceOwner}
            workspaceId={workspaceId}
            setWorkspaceId={setWorkspaceId}
            projectId={projectId}
            setProjectId={setProjectId}
            memberName={memberName}
            setMemberName={setMemberName}
            collabRole={collabRole}
            setCollabRole={setCollabRole}
            inviteRole={inviteRole}
            setInviteRole={setInviteRole}
            inviteCode={inviteCode}
            setInviteCode={setInviteCode}
            uploadFileName={uploadFileName}
            setUploadFileName={setUploadFileName}
            effectiveOrganizationId={effectiveOrganizationId}
            selectOrganization={selectOrganization}
            labMode={labMode}
            openChannelPanel={openChannelPanel}
            showToast={showToast}
            markJourneyStep={markJourneyStep}
            reportJourney={reportJourney}
          />
        </section>
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
        onClose={() => {
          setShowChannelPanel(false)
          window.setTimeout(() => {
            channelPanelTriggerRef.current?.focus()
          }, 0)
        }}
        onLoadCapabilities={() => void loadCapabilities()}
        onRefreshChannelConfigs={() => void refreshChannelConfigs()}
        onSubmitAuth={() => void submitAuth()}
        onToggleRegisterMode={() => setRegisterMode((prev) => !prev)}
        onLoginEmailChange={setLoginEmail}
        onLoginPasswordChange={setLoginPassword}
        onRegisterOrgNameChange={setRegisterOrgName}
        onSelectedOrganizationChange={selectOrganization}
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
