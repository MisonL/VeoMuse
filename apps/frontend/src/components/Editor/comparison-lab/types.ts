import type {
  AssetReuseRecord,
  CreativeRun,
  BatchJob,
  ClipBatchUpdateResult,
  CommentReply,
  CommentThread,
  CursorPageMeta,
  ErrorBudgetEvaluation,
  ProjectComment,
  ProjectReview,
  ProjectTemplate,
  ReliabilityAlert,
  ReliabilityAlertLevel,
  Organization,
  OrganizationMember,
  OrganizationQuota,
  OrganizationRole,
  OrganizationUsage,
  MarketplaceModel,
  PromptWorkflow,
  PromptWorkflowRun,
  ReliabilityPolicy,
  RollbackDrill,
  RoutingDecision,
  RoutingExecution,
  RoutingPolicy,
  TemplateApplyResult,
  TimelineMergeRecord,
  WorkspaceRolePermissionProfile,
  WorkspaceInvite,
  WorkspaceRole,
  AiChannelConfig,
  CollabEvent,
  CollabPresence
} from '@veomuse/shared'
import { buildAuthHeaders, resolveApiBase } from '../../../utils/eden'

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

export type VideoGenerationMode =
  | 'text_to_video'
  | 'image_to_video'
  | 'first_last_frame_transition'
  | 'video_extend'

export type VideoInputSourceType = 'url' | 'objectKey'

export type VideoGenerationJobStatus =
  | 'queued'
  | 'submitted'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'cancel_requested'
  | 'canceled'

export type VideoGenerationProviderStatus = 'ok' | 'degraded' | 'not_implemented' | 'error'

export interface VideoGenerationSourceInput {
  sourceType?: VideoInputSourceType
  value: string
  mimeType?: string
}

export interface VideoGenerationInputsInput {
  image?: VideoGenerationSourceInput
  referenceImages?: VideoGenerationSourceInput[]
  firstFrame?: VideoGenerationSourceInput
  lastFrame?: VideoGenerationSourceInput
  video?: VideoGenerationSourceInput
}

export interface VideoGenerationCreatePayload {
  modelId?: string
  generationMode?: VideoGenerationMode
  prompt?: string
  text?: string
  negativePrompt?: string
  options?: Record<string, unknown>
  actorId?: string
  consistencyStrength?: number
  syncLip?: boolean
  sync_lip?: boolean
  worldLink?: boolean
  worldId?: string
  workspaceId?: string
  inputs?: VideoGenerationInputsInput
}

export interface VideoGenerationJob {
  id: string
  organizationId: string
  workspaceId: string | null
  modelId: string
  generationMode: VideoGenerationMode
  request: Record<string, unknown>
  status: VideoGenerationJobStatus
  providerStatus: VideoGenerationProviderStatus
  operationName: string | null
  result: Record<string, unknown>
  errorMessage: string | null
  errorCode?: string | null
  outputUrl?: string | null
  startedAt?: string | null
  finishedAt?: string | null
  durationMs?: number | null
  retryCount?: number
  cancelRequestedAt?: string | null
  lastSyncedAt?: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface VideoGenerationPageResult {
  jobs: VideoGenerationJob[]
  page: CursorPageMeta
}

export interface GeminiQuickCheckState {
  status: 'ready' | 'missing' | 'unknown'
  title: string
  description: string
}

export const VIDEO_GENERATION_MODES: Array<{ value: VideoGenerationMode; label: string }> = [
  { value: 'text_to_video', label: '文生视频' },
  { value: 'image_to_video', label: '图生视频' },
  { value: 'video_extend', label: '视频扩展' },
  { value: 'first_last_frame_transition', label: '首末帧过渡' }
]

export const resolveVideoGenerationRequiredInputs = (mode: VideoGenerationMode) => {
  if (mode === 'image_to_video') {
    return ['image_or_referenceImages'] as const
  }
  if (mode === 'video_extend') {
    return ['video'] as const
  }
  if (mode === 'first_last_frame_transition') {
    return ['firstFrame', 'lastFrame'] as const
  }
  return [] as const
}

const VIDEO_GENERATION_STATUS_LABELS: Record<VideoGenerationJobStatus, string> = {
  queued: '排队中',
  submitted: '已提交',
  processing: '生成中',
  succeeded: '已成功',
  failed: '已失败',
  cancel_requested: '取消中',
  canceled: '已取消'
}

const VIDEO_GENERATION_STATUS_PRIORITY: Record<VideoGenerationJobStatus, number> = {
  processing: 0,
  submitted: 1,
  queued: 2,
  cancel_requested: 3,
  failed: 4,
  succeeded: 5,
  canceled: 6
}

const toTimestamp = (value: string | null | undefined) => {
  const parsed = Date.parse(String(value || ''))
  return Number.isFinite(parsed) ? parsed : 0
}

export const isVideoGenerationActiveStatus = (status: VideoGenerationJobStatus) => {
  return (
    status === 'queued' ||
    status === 'submitted' ||
    status === 'processing' ||
    status === 'cancel_requested'
  )
}

export const resolveVideoGenerationStatusText = (status: VideoGenerationJobStatus) => {
  return VIDEO_GENERATION_STATUS_LABELS[status] || status
}

export const sortVideoGenerationJobsForWorkbench = (jobs: VideoGenerationJob[]) => {
  return [...jobs].sort((left, right) => {
    const statusDelta =
      VIDEO_GENERATION_STATUS_PRIORITY[left.status] - VIDEO_GENERATION_STATUS_PRIORITY[right.status]
    if (statusDelta !== 0) return statusDelta
    const updatedDelta = toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt)
    if (updatedDelta !== 0) return updatedDelta
    return String(right.id).localeCompare(String(left.id))
  })
}

export const resolveGeminiQuickCheck = (
  capabilities?: CapabilityPayload | null
): GeminiQuickCheckState => {
  if (!capabilities || !capabilities.models) {
    return {
      status: 'unknown',
      title: 'Gemini 可用性未知',
      description: '先点击“Gemini 快速自检”刷新 /api/capabilities。'
    }
  }
  if (capabilities.models['veo-3.1']) {
    return {
      status: 'ready',
      title: 'Gemini Veo 3.1 已就绪',
      description: '可直接创建视频生成任务。'
    }
  }
  return {
    status: 'missing',
    title: 'Gemini Veo 3.1 未就绪',
    description: '请在渠道接入面板配置 Gemini Key/Endpoint 后重试。'
  }
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

export type V4CommentThread = CommentThread
export type V4CommentReply = CommentReply
export type V4PermissionGrant = WorkspaceRolePermissionProfile
export type V4TimelineMergeResult = TimelineMergeRecord
export type V4Workflow = PromptWorkflow
export type V4WorkflowRun = PromptWorkflowRun
export type V4BatchJob = BatchJob
export type V4AssetReuseResult = AssetReuseRecord
export type V4AssetReuseRecord = AssetReuseRecord
export type V4ReliabilityAlert = ReliabilityAlert
export type V4ReliabilityAlertLevel = ReliabilityAlertLevel

export interface V4ErrorBudget {
  policy: ReliabilityPolicy
  evaluation: ErrorBudgetEvaluation
}

export type V4RollbackDrillResult = RollbackDrill
export type ProjectGovernanceComment = ProjectComment
export type ProjectGovernanceReview = ProjectReview
export type ProjectGovernanceTemplate = ProjectTemplate
export type ProjectGovernanceTemplateApplyResult = TemplateApplyResult
export type ProjectGovernanceClipBatchUpdateResult = ClipBatchUpdateResult

export interface ProjectGovernanceCommentPageResult {
  comments: ProjectGovernanceComment[]
  page: CursorPageMeta
}

export interface ProjectGovernanceCommentInput {
  anchor?: string
  content: string
  mentions?: string[]
}

export interface ProjectGovernanceReviewInput {
  decision: ProjectGovernanceReview['decision']
  summary: string
  score?: number
}

export interface ProjectGovernanceTemplateApplyInput {
  templateId: string
  options?: Record<string, unknown>
}

export interface ProjectGovernanceClipBatchOperationInput {
  clipId: string
  patch: Record<string, unknown>
}

const GOVERNANCE_DEFAULT_LIMIT = 20
const GOVERNANCE_MAX_LIMIT = 100

const toHeaderRecord = (headers?: HeadersInit): Record<string, string> => {
  if (!headers) return {}
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries())
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers)
  }
  return { ...headers }
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

const resolveErrorMessage = (payload: unknown, fallback: string) => {
  const record = asRecord(payload)
  const rawError = record?.error
  if (typeof rawError === 'string' && rawError.trim()) {
    return rawError
  }
  return fallback
}

const requestProjectGovernance = async <T>(
  projectId: string,
  path: string,
  init?: RequestInit
): Promise<T> => {
  const normalizedProjectId = projectId.trim()
  if (!normalizedProjectId) {
    throw new Error('请先提供项目 ID')
  }
  const customHeaders = toHeaderRecord(init?.headers)
  const mergedHeaders = buildAuthHeaders(customHeaders)
  if (
    init?.body &&
    !Object.keys(mergedHeaders).some((key) => key.toLowerCase() === 'content-type')
  ) {
    mergedHeaders['Content-Type'] = 'application/json'
  }
  const response = await fetch(
    `${resolveApiBase()}/api/projects/${encodeURIComponent(normalizedProjectId)}${path}`,
    {
      ...init,
      headers: mergedHeaders
    }
  )
  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  const payloadRecord = asRecord(payload)
  if (!response.ok || payloadRecord?.success === false) {
    throw new Error(resolveErrorMessage(payload, `HTTP ${response.status}`))
  }
  return payload as T
}

export const normalizeProjectGovernanceLimit = (
  raw: string | number,
  fallback = GOVERNANCE_DEFAULT_LIMIT
) => {
  const value =
    typeof raw === 'number' ? raw : Number.parseInt(String(raw).trim() || String(fallback), 10)
  if (!Number.isFinite(value) || value <= 0) return fallback
  return Math.min(GOVERNANCE_MAX_LIMIT, Math.floor(value))
}

export const listProjectGovernanceComments = async (
  projectId: string,
  params?: { cursor?: string; limit?: string | number }
): Promise<ProjectGovernanceCommentPageResult> => {
  const limit = normalizeProjectGovernanceLimit(params?.limit ?? GOVERNANCE_DEFAULT_LIMIT)
  const query = new URLSearchParams({
    limit: String(limit)
  })
  const cursor = (params?.cursor || '').trim()
  if (cursor) query.set('cursor', cursor)
  const payload = await requestProjectGovernance<{
    success: boolean
    comments: ProjectGovernanceComment[]
    page?: {
      limit?: number
      hasMore?: boolean
      nextCursor?: string | null
    }
  }>(projectId, `/comments?${query.toString()}`)
  const comments = Array.isArray(payload.comments) ? payload.comments : []
  const normalizedNextCursor =
    typeof payload.page?.nextCursor === 'string'
      ? payload.page.nextCursor.trim()
      : payload.page?.nextCursor === null
        ? ''
        : ''
  const fallbackCursor = comments.length > 0 ? comments[comments.length - 1]?.createdAt || '' : ''
  const nextCursor = normalizedNextCursor || fallbackCursor || null
  const normalizedHasMore =
    typeof payload.page?.hasMore === 'boolean' ? payload.page.hasMore : comments.length >= limit
  return {
    comments,
    page: {
      limit: typeof payload.page?.limit === 'number' ? payload.page.limit : limit,
      hasMore: normalizedHasMore,
      nextCursor
    }
  }
}

export const createProjectGovernanceComment = async (
  projectId: string,
  input: ProjectGovernanceCommentInput
) => {
  const payload = await requestProjectGovernance<{
    success: boolean
    comment: ProjectGovernanceComment
  }>(projectId, '/comments', {
    method: 'POST',
    body: JSON.stringify(input)
  })
  return payload.comment
}

export const resolveProjectGovernanceComment = async (projectId: string, commentId: string) => {
  const normalizedCommentId = commentId.trim()
  if (!normalizedCommentId) {
    throw new Error('请先选择评论')
  }
  const payload = await requestProjectGovernance<{
    success: boolean
    comment: ProjectGovernanceComment
  }>(projectId, `/comments/${encodeURIComponent(normalizedCommentId)}/resolve`, {
    method: 'POST',
    body: JSON.stringify({})
  })
  return payload.comment
}

export const listProjectGovernanceReviews = async (
  projectId: string,
  params?: { limit?: string | number }
) => {
  const limit = normalizeProjectGovernanceLimit(params?.limit ?? GOVERNANCE_DEFAULT_LIMIT)
  const query = new URLSearchParams({
    limit: String(limit)
  })
  const payload = await requestProjectGovernance<{
    success: boolean
    reviews: ProjectGovernanceReview[]
  }>(projectId, `/reviews?${query.toString()}`)
  return Array.isArray(payload.reviews) ? payload.reviews : []
}

export const createProjectGovernanceReview = async (
  projectId: string,
  input: ProjectGovernanceReviewInput
) => {
  const payload = await requestProjectGovernance<{
    success: boolean
    review: ProjectGovernanceReview
  }>(projectId, '/reviews', {
    method: 'POST',
    body: JSON.stringify(input)
  })
  return payload.review
}

export const listProjectGovernanceTemplates = async (projectId: string) => {
  const payload = await requestProjectGovernance<{
    success: boolean
    templates: ProjectGovernanceTemplate[]
  }>(projectId, '/templates')
  return Array.isArray(payload.templates) ? payload.templates : []
}

export const applyProjectGovernanceTemplate = async (
  projectId: string,
  input: ProjectGovernanceTemplateApplyInput
) => {
  const payload = await requestProjectGovernance<{
    success: boolean
    result: ProjectGovernanceTemplateApplyResult
  }>(projectId, '/templates/apply', {
    method: 'POST',
    body: JSON.stringify(input)
  })
  return payload.result
}

export const batchUpdateProjectGovernanceClips = async (
  projectId: string,
  operations: ProjectGovernanceClipBatchOperationInput[]
) => {
  const payload = await requestProjectGovernance<{
    success: boolean
    result: ProjectGovernanceClipBatchUpdateResult
  }>(projectId, '/clips/batch-update', {
    method: 'POST',
    body: JSON.stringify({ operations })
  })
  return payload.result
}

export type {
  AiChannelConfig,
  CollabEvent,
  CollabPresence,
  CreativeRun,
  MarketplaceModel,
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
