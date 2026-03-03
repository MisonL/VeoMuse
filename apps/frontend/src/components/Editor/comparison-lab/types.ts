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
  let payload: any = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || `HTTP ${response.status}`)
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
  }>(projectId, `/comments?${query.toString()}`)
  const comments = Array.isArray(payload.comments) ? payload.comments : []
  const nextCursor = comments.length > 0 ? comments[comments.length - 1]?.createdAt || null : null
  return {
    comments,
    page: {
      limit,
      hasMore: comments.length >= limit,
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
