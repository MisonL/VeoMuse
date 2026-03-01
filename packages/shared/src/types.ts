export interface Clip {
  id: string;
  start: number;
  end: number;
  src: string;
  name: string;
  type: 'video' | 'audio' | 'text' | 'mask';
  data?: any;
}

export interface Track {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'text' | 'mask';
  clips: Clip[];
}

export interface Asset {
  id: string;
  name: string;
  src: string;
  exportSrc?: string;
  type: 'video' | 'audio' | 'image';
  thumbnail?: string;
}

export interface Marker {
  id: string;
  time: number;
  label: string;
}

export interface Scene {
  title: string;
  videoPrompt: string;
  audioPrompt: string;
  voiceoverText: string;
  duration: number;
}

export interface DirectorResponse {
  success: boolean;
  storyTitle: string;
  worldId: string;
  scenes: Scene[];
}

export interface TimelineData {
  tracks: Track[];
  exportConfig?: {
    quality: 'standard' | '4k-hdr' | 'spatial-vr';
  };
}

export type ModelRoutingPriority = 'quality' | 'speed' | 'cost';

export interface RoutingWeightConfig {
  quality: number;
  speed: number;
  cost: number;
  reliability: number;
}

export interface ModelProfile {
  id: string;
  name: string;
  provider: string;
  capabilities: string[];
  costPerSecond: number;
  maxDurationSec: number;
  supports4k: boolean;
  supportsAudio: boolean;
  supportsStylization: boolean;
  region: string;
  enabled: boolean;
  updatedAt: string;
}

export interface ModelRuntimeMetrics {
  modelId: string;
  windowMinutes: number;
  totalRequests: number;
  successRate: number;
  p95LatencyMs: number;
  avgCostUsd: number;
  updatedAt: string;
}

export interface MarketplaceModel {
  profile: ModelProfile;
  metrics: ModelRuntimeMetrics;
}

export interface RoutingDecision {
  recommendedModelId: string;
  estimatedCostUsd: number;
  estimatedLatencyMs: number;
  confidence: number;
  reason: string;
  priority: ModelRoutingPriority;
  policyId?: string;
  fallbackUsed?: boolean;
  scoreBreakdown?: Array<{
    modelId: string;
    quality: number;
    speed: number;
    cost: number;
    reliability: number;
    finalScore: number;
  }>;
  candidates: Array<{
    modelId: string;
    score: number;
    estimatedCostUsd: number;
    estimatedLatencyMs: number;
  }>;
}

export interface RoutingPolicy {
  id: string;
  name: string;
  description: string;
  priority: ModelRoutingPriority;
  maxBudgetUsd: number;
  enabled: boolean;
  allowedModels: string[];
  weights: RoutingWeightConfig;
  fallbackPolicyId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoutingExecution {
  id: string;
  policyId: string;
  prompt: string;
  priority: ModelRoutingPriority;
  recommendedModelId: string;
  estimatedCostUsd: number;
  estimatedLatencyMs: number;
  confidence: number;
  reason: string;
  fallbackUsed: boolean;
  candidates: RoutingDecision['candidates'];
  scoreBreakdown: NonNullable<RoutingDecision['scoreBreakdown']>;
  createdAt: string;
}

export interface CreativeScene {
  id: string;
  runId: string;
  order: number;
  title: string;
  videoPrompt: string;
  audioPrompt: string;
  voiceoverText: string;
  duration: number;
  status: 'draft' | 'generated' | 'regenerated';
  revision?: number;
  lastFeedback?: string;
  generationMeta?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreativeRun {
  id: string;
  script: string;
  style: string;
  status: 'draft' | 'generated' | 'completed';
  version?: number;
  parentRunId?: string | null;
  qualityScore?: number;
  notes?: Record<string, unknown>;
  scenes: CreativeScene[];
  createdAt: string;
  updatedAt: string;
}

export interface CreativeFeedbackPayload {
  runFeedback?: string;
  sceneFeedbacks?: Array<{
    sceneId: string;
    feedback: string;
  }>;
}

export type WorkspaceRole = 'owner' | 'editor' | 'viewer';

export interface Workspace {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  name: string;
  role: WorkspaceRole;
  createdAt: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  workspaceId: string | null;
  projectId: string | null;
  actorName: string;
  action: string;
  detail: Record<string, unknown>;
  traceId?: string | null;
  createdAt: string;
}

export interface WorkspaceInvite {
  id: string;
  workspaceId: string;
  code: string;
  role: WorkspaceRole;
  inviter: string;
  status: 'pending' | 'accepted' | 'expired';
  expiresAt: string;
  acceptedBy: string | null;
  acceptedAt: string | null;
  createdAt: string;
}

export interface CollabPresence {
  workspaceId: string;
  sessionId: string;
  memberName: string;
  role: WorkspaceRole;
  status: 'online' | 'offline';
  lastSeenAt: string;
}

export interface ProjectSnapshot {
  id: string;
  projectId: string;
  actorName: string;
  content: Record<string, unknown>;
  createdAt: string;
}

export type StorageProviderType = 'local' | 's3';

export interface CollabEvent {
  id: string;
  workspaceId: string;
  projectId: string | null;
  actorName: string;
  sessionId: string | null;
  eventType: 'presence.join' | 'presence.leave' | 'project.patch' | 'timeline.patch' | 'cursor.update';
  payload: Record<string, unknown>;
  createdAt: string;
}
