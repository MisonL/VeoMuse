import type {
  CreativeRun,
  Organization,
  OrganizationMember,
  OrganizationQuota,
  OrganizationRole,
  OrganizationUsage,
  RoutingDecision,
  RoutingExecution,
  RoutingPolicy,
  WorkspaceInvite,
  WorkspaceRole,
  AiChannelConfig,
  CollabEvent,
  CollabPresence
} from '@veomuse/shared'

export type LabMode = 'compare' | 'marketplace' | 'creative' | 'collab'
export type PolicyPriority = 'quality' | 'speed' | 'cost'

export interface ComparisonLabProps {
  onOpenAssets?: () => void
}

export interface CapabilityPayload {
  models?: Record<string, boolean>
  services?: Record<string, boolean | string>
  timestamp?: string
}

export interface AuthProfile {
  id: string
  email: string
}

export interface ChannelFormState {
  providerId: string
  baseUrl: string
  apiKey: string
  model: string
  path: string
  temperature: string
  enabled: boolean
  scope: 'organization' | 'workspace'
}

export interface QuotaFormState {
  requestLimit: string
  storageLimitMb: string
  concurrencyLimit: string
}

export interface ModelRecommendation {
  recommendedModelId?: string
}

export interface ModelOption {
  id: string
  name: string
}

export interface LabAssetOption {
  id: string
  name: string
  src?: string
}

export interface PolicyWeightState {
  quality: number
  speed: number
  cost: number
  reliability: number
}

export type {
  AiChannelConfig,
  CollabEvent,
  CollabPresence,
  CreativeRun,
  Organization,
  OrganizationMember,
  OrganizationQuota,
  OrganizationRole,
  OrganizationUsage,
  RoutingDecision,
  RoutingExecution,
  RoutingPolicy,
  WorkspaceInvite,
  WorkspaceRole
}
