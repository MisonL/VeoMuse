export interface Clip {
  id: string
  start: number
  end: number
  src: string
  name: string
  type: 'video' | 'audio' | 'text' | 'mask'
  data?: any
}

export interface Track {
  id: string
  name: string
  type: 'video' | 'audio' | 'text' | 'mask'
  clips: Clip[]
}

export interface Asset {
  id: string
  name: string
  src: string
  exportSrc?: string
  type: 'video' | 'audio' | 'image'
  thumbnail?: string
}

export interface Marker {
  id: string
  time: number
  label: string
}

export interface Scene {
  title: string
  videoPrompt: string
  audioPrompt: string
  voiceoverText: string
  duration: number
}

export interface DirectorResponse {
  success: boolean
  storyTitle: string
  worldId: string
  scenes: Scene[]
}

export interface TimelineData {
  tracks: Track[]
  exportConfig?: {
    quality: 'standard' | '4k-hdr' | 'spatial-vr'
  }
}

export type ModelRoutingPriority = 'quality' | 'speed' | 'cost'

export interface RoutingWeightConfig {
  quality: number
  speed: number
  cost: number
  reliability: number
}

export interface ModelProfile {
  id: string
  name: string
  provider: string
  capabilities: string[]
  costPerSecond: number
  maxDurationSec: number
  supports4k: boolean
  supportsAudio: boolean
  supportsStylization: boolean
  region: string
  enabled: boolean
  updatedAt: string
}

export interface ModelRuntimeMetrics {
  modelId: string
  windowMinutes: number
  totalRequests: number
  successRate: number
  p95LatencyMs: number
  avgCostUsd: number
  updatedAt: string
}

export interface MarketplaceModel {
  profile: ModelProfile
  metrics: ModelRuntimeMetrics
}

export interface RoutingDecision {
  recommendedModelId: string
  estimatedCostUsd: number
  estimatedLatencyMs: number
  confidence: number
  reason: string
  priority: ModelRoutingPriority
  policyId?: string
  fallbackUsed?: boolean
  budgetGuard?: {
    budgetUsd: number
    alertThresholdRatio: number
    status: 'ok' | 'warning' | 'critical' | 'degraded'
    message: string
    autoDegraded: boolean
  }
  scoreBreakdown?: Array<{
    modelId: string
    quality: number
    speed: number
    cost: number
    reliability: number
    finalScore: number
  }>
  candidates: Array<{
    modelId: string
    score: number
    estimatedCostUsd: number
    estimatedLatencyMs: number
  }>
}

export interface RoutingPolicy {
  id: string
  name: string
  description: string
  priority: ModelRoutingPriority
  maxBudgetUsd: number
  enabled: boolean
  allowedModels: string[]
  weights: RoutingWeightConfig
  fallbackPolicyId: string | null
  createdAt: string
  updatedAt: string
}

export interface RoutingExecution {
  id: string
  policyId: string
  prompt: string
  priority: ModelRoutingPriority
  recommendedModelId: string
  estimatedCostUsd: number
  estimatedLatencyMs: number
  confidence: number
  reason: string
  fallbackUsed: boolean
  candidates: RoutingDecision['candidates']
  scoreBreakdown: NonNullable<RoutingDecision['scoreBreakdown']>
  createdAt: string
}

export interface CreativeScene {
  id: string
  runId: string
  order: number
  title: string
  videoPrompt: string
  audioPrompt: string
  voiceoverText: string
  duration: number
  status: 'draft' | 'generated' | 'regenerated'
  revision?: number
  lastFeedback?: string
  generationMeta?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface CreativeRun {
  id: string
  script: string
  style: string
  status: 'draft' | 'generated' | 'completed'
  version?: number
  parentRunId?: string | null
  qualityScore?: number
  notes?: Record<string, unknown>
  scenes: CreativeScene[]
  createdAt: string
  updatedAt: string
}

export interface CreativeFeedbackPayload {
  runFeedback?: string
  sceneFeedbacks?: Array<{
    sceneId: string
    feedback: string
  }>
}

export type WorkspaceRole = 'owner' | 'editor' | 'viewer'

export interface Workspace {
  id: string
  organizationId: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface WorkspaceMember {
  id: string
  workspaceId: string
  userId?: string | null
  name: string
  role: WorkspaceRole
  createdAt: string
}

export interface Project {
  id: string
  organizationId: string
  workspaceId: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface AuditLog {
  id: string
  organizationId: string | null
  workspaceId: string | null
  projectId: string | null
  actorName: string
  action: string
  detail: Record<string, unknown>
  traceId?: string | null
  createdAt: string
}

export interface WorkspaceInvite {
  id: string
  organizationId: string
  workspaceId: string
  code: string
  role: WorkspaceRole
  inviter: string
  status: 'pending' | 'accepted' | 'expired'
  expiresAt: string
  acceptedBy: string | null
  acceptedAt: string | null
  createdAt: string
}

export interface CollabPresence {
  organizationId: string
  workspaceId: string
  sessionId: string
  memberName: string
  role: WorkspaceRole
  status: 'online' | 'offline'
  lastSeenAt: string
}

export interface ProjectSnapshot {
  id: string
  organizationId: string
  projectId: string
  actorName: string
  content: Record<string, unknown>
  createdAt: string
}

export interface ProjectComment {
  id: string
  organizationId: string
  projectId: string
  actorName: string
  anchor: string | null
  content: string
  mentions: string[]
  status: 'open' | 'resolved'
  resolvedBy: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ProjectReview {
  id: string
  organizationId: string
  projectId: string
  actorName: string
  decision: 'approved' | 'changes_requested'
  summary: string
  score: number | null
  createdAt: string
}

export interface ProjectTemplate {
  id: string
  organizationId: string
  projectId: string
  name: string
  description: string
  template: Record<string, unknown>
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface TemplateApplyResult {
  projectId: string
  templateId: string
  templateName: string
  actorName: string
  organizationId: string
  workspaceId: string | null
  options: Record<string, unknown>
  traceId: string
  appliedAt: string
}

export interface ClipBatchUpdateResult {
  projectId: string
  actorName: string
  organizationId: string
  workspaceId: string | null
  requested: number
  accepted: number
  skipped: number
  rejected: number
  updated: number
  traceId: string
  processedAt: string
}

export interface CursorPageMeta {
  limit: number
  hasMore: boolean
  nextCursor: string | null
}

export interface CommentThread {
  id: string
  organizationId: string
  projectId: string
  actorName: string
  anchor: string | null
  content: string
  mentions: string[]
  status: 'open' | 'resolved'
  resolvedBy: string | null
  resolvedAt: string | null
  replyCount: number
  createdAt: string
  updatedAt: string
}

export interface CommentReply {
  id: string
  organizationId: string
  projectId: string
  threadId: string
  actorName: string
  content: string
  mentions: string[]
  createdAt: string
  updatedAt: string
}

export interface WorkspaceRolePermissionProfile {
  workspaceId: string
  organizationId: string
  role: WorkspaceRole
  permissions: Record<string, boolean>
  updatedBy: string
  updatedAt: string
}

export interface TimelineMergeRecord {
  id: string
  organizationId: string
  workspaceId: string | null
  projectId: string
  actorName: string
  sourceRevision: string
  targetRevision: string
  status: 'merged' | 'conflict'
  conflicts: Array<Record<string, unknown>>
  result: Record<string, unknown>
  createdAt: string
}

export interface ReliabilityPolicy {
  id: string
  scope: string
  targetSlo: number
  windowDays: number
  warningThresholdRatio: number
  alertThresholdRatio: number
  freezeDeployOnBreach: boolean
  updatedBy: string
  meta: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface ErrorBudgetEvaluation {
  policy: ReliabilityPolicy
  windowStart: string
  windowEnd: string
  totalRequests: number
  failedRequests: number
  observedAvailability: number
  allowedFailures: number
  budgetRemaining: number
  budgetRemainingRatio: number
  burnRate: number
  status: 'healthy' | 'warning' | 'critical'
}

export interface RollbackDrill {
  id: string
  policyId: string | null
  environment: string
  status: 'scheduled' | 'running' | 'completed' | 'failed'
  triggerType: string
  initiatedBy: string
  summary: string
  plan: Record<string, unknown>
  result: Record<string, unknown>
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export type ReliabilityAlertLevel = 'info' | 'warning' | 'critical'

export interface ReliabilityAlert {
  id: string
  policyId: string | null
  level: ReliabilityAlertLevel
  source: string
  title: string
  message: string
  status: 'open' | 'acknowledged'
  payload: Record<string, unknown>
  triggeredAt: string
  acknowledgedAt: string | null
  createdAt: string
}

export interface PromptWorkflow {
  id: string
  organizationId: string
  name: string
  description: string
  definition: Record<string, unknown>
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface PromptWorkflowRun {
  id: string
  workflowId: string
  organizationId: string
  triggerType: string
  status: 'queued' | 'completed' | 'failed'
  input: Record<string, unknown>
  output: Record<string, unknown>
  errorMessage: string | null
  startedAt: string
  completedAt: string | null
  createdBy: string
  createdAt: string
}

export interface BatchJobItem {
  id: string
  jobId: string
  organizationId: string
  itemKey: string
  status: 'queued' | 'completed' | 'failed'
  input: Record<string, unknown>
  output: Record<string, unknown>
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

export interface BatchJob {
  id: string
  organizationId: string
  workflowRunId: string | null
  jobType: string
  status: 'queued' | 'completed' | 'failed'
  totalItems: number
  completedItems: number
  failedItems: number
  payload: Record<string, unknown>
  createdBy: string
  createdAt: string
  updatedAt: string
  items: BatchJobItem[]
}

export interface AssetReuseRecord {
  id: string
  organizationId: string
  assetId: string
  sourceProjectId: string | null
  targetProjectId: string | null
  reusedBy: string
  context: Record<string, unknown>
  createdAt: string
}

export type ProviderHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'not_configured'

export interface ProviderHealthReport {
  providerId: string
  label: string
  status: ProviderHealthStatus
  configured: boolean
  source: 'channel' | 'env' | 'none'
  checkedAt: string
  traceId: string
  latencyMs: number | null
  httpStatus: number | null
  message: string
  retries: number
  endpoint: string
}

export interface ProviderHealthSummary {
  total: number
  healthy: number
  degraded: number
  unhealthy: number
  notConfigured: number
}

export interface ProviderHealthOverview {
  checkedAt: string
  summary: ProviderHealthSummary
  providers: ProviderHealthReport[]
}

export interface PolicyAlertConfig {
  policyId: string
  organizationId: string
  enabled: boolean
  channels: string[]
  warningThresholdRatio: number
  criticalThresholdRatio: number
  createdAt: string
  updatedAt: string
}

export interface PolicyAlertEvent {
  id: string
  policyId: string
  organizationId: string
  status: 'warning' | 'critical' | 'degraded'
  message: string
  prompt: string
  recommendedModelId: string
  estimatedCostUsd: number
  budgetUsd: number
  meta: Record<string, unknown>
  createdAt: string
}

export interface PolicyBatchSimulationScenario {
  prompt: string
  budgetUsd?: number
  priority?: ModelRoutingPriority
}

export interface PolicyBatchSimulationResult {
  policyId: string
  total: number
  summary: {
    ok: number
    warning: number
    critical: number
    degraded: number
  }
  results: Array<{
    scenario: PolicyBatchSimulationScenario
    decision: RoutingDecision
  }>
}

export type StorageProviderType = 'local' | 's3'

export interface CollabEvent {
  id: string
  organizationId: string
  workspaceId: string
  projectId: string | null
  actorName: string
  sessionId: string | null
  eventType:
    | 'presence.join'
    | 'presence.leave'
    | 'project.patch'
    | 'timeline.patch'
    | 'cursor.update'
  payload: Record<string, unknown>
  createdAt: string
}

export type OrganizationRole = 'owner' | 'admin' | 'member'

export interface User {
  id: string
  email: string
  status: 'active' | 'disabled'
  createdAt: string
  updatedAt: string
}

export interface Organization {
  id: string
  name: string
  ownerUserId: string
  createdAt: string
  updatedAt: string
}

export interface OrganizationMember {
  id: string
  organizationId: string
  userId: string
  role: OrganizationRole
  email: string
  createdAt: string
}

export interface OrganizationQuota {
  organizationId: string
  requestLimit: number
  storageLimitBytes: number
  concurrencyLimit: number
  updatedBy: string
  updatedAt: string
}

export interface OrganizationUsage {
  organizationId: string
  requestCount: number
  storageBytes: number
  lastRequestAt: string | null
  updatedAt: string
  activeRequests: number
}

export interface OrganizationAuditRecord {
  id: string
  source: 'channel' | 'workspace'
  organizationId: string
  workspaceId: string | null
  actor: string
  action: string
  providerId: string | null
  traceId: string | null
  createdAt: string
  detail: Record<string, unknown>
}

export interface AuthSession {
  accessToken: string
  refreshToken: string
  expiresAt: string
  user: User
}

export type AiChannelScope = 'organization' | 'workspace'

export interface AiChannelProvider {
  id: string
  label: string
  category: 'model' | 'service'
  defaultBaseUrl?: string
}

export interface AiChannelConfig {
  id: string
  organizationId: string
  workspaceId: string | null
  providerId: string
  baseUrl: string
  enabled: boolean
  extra: Record<string, unknown>
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
  hasSecret: boolean
  secretMasked: string
}

export type DbIntegrityMode = 'quick' | 'full'
export type DbRepairCheckMode = DbIntegrityMode

export interface DbIntegrityReport {
  dbPath: string
  mode: DbIntegrityMode
  status: 'ok' | 'corrupted' | 'error'
  messages: string[]
  checkedAt: string
}

export interface DbRepairSalvageDetail {
  table: string
  copiedRows: number
  status: 'copied' | 'skipped' | 'failed'
  reason?: string
}

export interface DbRepairReport {
  dbPath: string
  status: 'ok' | 'repaired' | 'failed'
  repaired: boolean
  forced: boolean
  checkMode: DbRepairCheckMode
  reason: string
  timestamp: string
  actions: string[]
  before: DbIntegrityReport
  after?: DbIntegrityReport
  backupPath?: string
  quarantinePath?: string
  salvage: {
    attempted: boolean
    copiedRows: number
    tableDetails: DbRepairSalvageDetail[]
  }
  error?: string
}

export interface DbRepairRequestPayload {
  force?: boolean
  reason?: string
  checkMode?: DbRepairCheckMode
}
