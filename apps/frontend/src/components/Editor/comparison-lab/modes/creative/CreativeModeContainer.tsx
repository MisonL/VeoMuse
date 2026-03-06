import React from 'react'
import type {
  AuthProfile,
  CapabilityPayload,
  LabMode,
  RoutingDecision
} from '../../types'
import CreativeModePanel from '../CreativeModePanel'
import { useCreativeModeController } from '../../hooks/useCreativeModeController'

type ShowToast = (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void

export interface CreativeModeContainerProps {
  selectedPolicyId: string
  policyDecision: RoutingDecision | null
  simulatePolicy: (overridePrompt?: string) => Promise<RoutingDecision | null>
  showToast: ShowToast
  capabilities: CapabilityPayload | null
  labMode: LabMode
  authProfile: AuthProfile | null
  isCapabilitiesLoading: boolean
  workspaceId: string
  loadCapabilities: () => Promise<void>
  projectId: string
  memberName: string
  workspaceOwner: string
  openChannelPanel: () => void
}

const CreativeModeContainer: React.FC<CreativeModeContainerProps> = (props) => {
  const panelProps = useCreativeModeController(props)

  return <CreativeModePanel {...panelProps} />
}

export default CreativeModeContainer
