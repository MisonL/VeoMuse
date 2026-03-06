import type { CursorPageMeta } from '@veomuse/shared'
import type {
  CancelOperationResult,
  GenerateParams,
  GenerateResult,
  QueryOperationResult,
  VideoGenerationInputSource,
  VideoGenerationInputs,
  VideoGenerationMode,
  VideoGenerationOperationState,
  VideoInputSourceType
} from './ModelDriver'

export const now = () => new Date().toISOString()

const OBJECT_KEY_SEGMENT = /^[a-zA-Z0-9._-]+$/
export const DEFAULT_MODEL_ID = 'veo-3.1'

export type DbRow = Record<string, unknown>

const asRecord = (value: unknown): DbRow => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as DbRow
}

export type DriverOptions = NonNullable<GenerateParams['options']>

export class VideoGenerationValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VideoGenerationValidationError'
  }
}

export const throwValidationError = (message: string): never => {
  throw new VideoGenerationValidationError(message)
}

export interface StableCursorPayload {
  createdAt: string
  id: string | null
}

export const encodeStableCursor = (
  createdAt: string | null | undefined,
  id: string | null | undefined
) => {
  const normalizedCreatedAt = String(createdAt || '').trim()
  if (!normalizedCreatedAt) return null
  const normalizedId = String(id || '').trim()
  if (!normalizedId) return normalizedCreatedAt
  return `${normalizedCreatedAt}|${normalizedId}`
}

export const decodeStableCursor = (
  cursor: string | null | undefined
): StableCursorPayload | null => {
  const normalized = String(cursor || '').trim()
  if (!normalized) return null
  const delimiterIndex = normalized.indexOf('|')
  if (delimiterIndex < 0) {
    return {
      createdAt: normalized,
      id: null
    }
  }
  const createdAt = normalized.slice(0, delimiterIndex).trim()
  const id = normalized.slice(delimiterIndex + 1).trim()
  if (!createdAt) return null
  return {
    createdAt,
    id: id || null
  }
}

export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export const parseRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'string' || !value) return {}
  try {
    const parsed = JSON.parse(value)
    return isPlainObject(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export const toNullableString = (value: unknown) => {
  const normalized = String(value || '').trim()
  return normalized ? normalized : null
}

export const resolveErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

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

export interface VideoGenerationCreateInput {
  organizationId: string
  workspaceId?: string
  createdBy: string
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
  inputs?: VideoGenerationInputsInput
}

export const toRetryInputs = (value: unknown): VideoGenerationCreateInput['inputs'] =>
  isPlainObject(value) ? (value as VideoGenerationCreateInput['inputs']) : undefined

export const normalizeObjectKey = (value: string) => {
  const segments = String(value || '')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
  if (!segments.length) {
    throwValidationError('objectKey 不能为空')
  }
  if (!segments.every((segment) => OBJECT_KEY_SEGMENT.test(segment))) {
    throwValidationError('objectKey 包含非法路径片段')
  }
  return segments.join('/')
}

export const resolveAssetPublicUrl = (sourceType: VideoInputSourceType, value: string) => {
  const assetBaseUrl = String(
    process.env.PUBLIC_ASSET_BASE_URL || process.env.APP_BASE_URL || ''
  ).trim()
  const baseUrl = assetBaseUrl.replace(/\/+$/, '')

  if (sourceType === 'url') {
    if (!baseUrl || /^https?:\/\//i.test(value)) return value
    if (!value.startsWith('/')) return value
    return `${baseUrl}${value}`
  }

  const pathValue = `/uploads/workspace/${value}`
  if (!baseUrl) return pathValue
  return `${baseUrl}${pathValue}`
}

export const normalizeSourceInput = (
  value: unknown,
  workspaceId?: string
): VideoGenerationInputSource | undefined => {
  if (!value) return undefined
  if (!isPlainObject(value)) {
    throwValidationError('输入源格式错误，必须为对象')
  }
  const sourceInput = value as Record<string, unknown>

  const rawValue = String(sourceInput.value || '').trim()
  if (!rawValue) return undefined

  const sourceTypeRaw = String(sourceInput.sourceType || '')
    .trim()
    .toLowerCase()
  const sourceType =
    sourceTypeRaw === 'url' || sourceTypeRaw === 'objectkey'
      ? sourceTypeRaw === 'objectkey'
        ? 'objectKey'
        : sourceTypeRaw
      : /^https?:\/\//i.test(rawValue) || rawValue.startsWith('/')
        ? 'url'
        : 'objectKey'

  if (sourceType === 'url') {
    const resolvedUrl = resolveAssetPublicUrl(sourceType, rawValue)
    return {
      sourceType,
      value: rawValue,
      resolvedUrl,
      mimeType: toNullableString(sourceInput.mimeType) || undefined
    }
  }

  const normalizedObjectKey = normalizeObjectKey(rawValue)
  if (!workspaceId) {
    throwValidationError('使用 objectKey 输入时必须提供 workspaceId')
  }
  const keyWorkspace = normalizedObjectKey.split('/')[0]
  if (keyWorkspace !== workspaceId) {
    throwValidationError('objectKey 与 workspaceId 不匹配')
  }

  return {
    sourceType: 'objectKey',
    value: normalizedObjectKey,
    resolvedUrl: resolveAssetPublicUrl('objectKey', normalizedObjectKey),
    mimeType: toNullableString(sourceInput.mimeType) || undefined
  }
}

export const normalizeSourceArray = (value: unknown, workspaceId?: string) => {
  if (!Array.isArray(value)) return undefined
  const normalized = value
    .map((item) => normalizeSourceInput(item, workspaceId))
    .filter(Boolean) as VideoGenerationInputSource[]
  return normalized.length ? normalized : undefined
}

export const normalizeInputs = (
  value: unknown,
  workspaceId?: string
): VideoGenerationInputs | undefined => {
  if (!value) return undefined
  if (!isPlainObject(value)) {
    throwValidationError('inputs 必须为对象')
  }
  const inputsValue = value as Record<string, unknown>
  const inputs: VideoGenerationInputs = {
    image: normalizeSourceInput(inputsValue.image, workspaceId),
    referenceImages: normalizeSourceArray(inputsValue.referenceImages, workspaceId),
    firstFrame: normalizeSourceInput(inputsValue.firstFrame, workspaceId),
    lastFrame: normalizeSourceInput(inputsValue.lastFrame, workspaceId),
    video: normalizeSourceInput(inputsValue.video, workspaceId)
  }
  if (
    !inputs.image &&
    !inputs.video &&
    !inputs.firstFrame &&
    !inputs.lastFrame &&
    !(inputs.referenceImages && inputs.referenceImages.length)
  ) {
    return undefined
  }
  return inputs
}

export const normalizeGenerationMode = (value: unknown): VideoGenerationMode => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
  if (!normalized) return 'text_to_video'
  if (normalized === 'text_to_video') return 'text_to_video'
  if (normalized === 'image_to_video') return 'image_to_video'
  if (normalized === 'first_last_frame_transition') return 'first_last_frame_transition'
  if (normalized === 'video_extend') return 'video_extend'
  throwValidationError('generationMode 无效')
  return 'text_to_video'
}

export const normalizePrompt = (promptValue: unknown, textValue: unknown) => {
  const prompt = String(promptValue || '').trim()
  if (prompt) return prompt
  return String(textValue || '').trim()
}

export type VideoGenerationJobStatus =
  | 'queued'
  | 'submitted'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'cancel_requested'
  | 'canceled'

export const TERMINAL_JOB_STATUSES = new Set<VideoGenerationJobStatus>([
  'succeeded',
  'failed',
  'canceled'
])

export const ACTIVE_JOB_STATUSES = new Set<VideoGenerationJobStatus>([
  'queued',
  'submitted',
  'processing',
  'cancel_requested'
])

export const normalizeProviderStatus = (value: unknown): GenerateResult['status'] => {
  if (value === 'ok' || value === 'degraded' || value === 'not_implemented' || value === 'error') {
    return value
  }
  return 'error'
}

export const normalizeJobStatus = (value: unknown): VideoGenerationJobStatus => {
  if (value === 'queued') return 'queued'
  if (value === 'submitted') return 'submitted'
  if (value === 'processing') return 'processing'
  if (value === 'succeeded') return 'succeeded'
  if (value === 'failed') return 'failed'
  if (value === 'cancel_requested') return 'cancel_requested'
  if (value === 'canceled') return 'canceled'
  return 'queued'
}

export const toSubmitJobStatus = (result: GenerateResult): VideoGenerationJobStatus =>
  result.success && (result.status === 'ok' || result.status === 'degraded')
    ? 'submitted'
    : 'failed'

export const mapOperationStateToJobStatus = (
  state: VideoGenerationOperationState,
  currentStatus: VideoGenerationJobStatus
): VideoGenerationJobStatus => {
  if (state === 'queued') return 'queued'
  if (state === 'processing') return 'processing'
  if (state === 'succeeded') return 'succeeded'
  if (state === 'failed') return 'failed'
  if (state === 'cancel_requested') return 'cancel_requested'
  if (state === 'canceled') return 'canceled'
  return currentStatus
}

export const calculateDurationMs = (
  startedAt: string | null | undefined,
  finishedAt: string | null | undefined
): number | null => {
  const startedValue = Date.parse(String(startedAt || ''))
  const finishedValue = Date.parse(String(finishedAt || ''))
  if (!Number.isFinite(startedValue) || !Number.isFinite(finishedValue)) return null
  return Math.max(0, Math.round(finishedValue - startedValue))
}

export interface VideoGenerationJob {
  id: string
  organizationId: string
  workspaceId: string | null
  modelId: string
  generationMode: VideoGenerationMode
  request: Record<string, unknown>
  status: VideoGenerationJobStatus
  providerStatus: GenerateResult['status']
  operationName: string | null
  result: Record<string, unknown>
  errorMessage: string | null
  errorCode: string | null
  outputUrl: string | null
  startedAt: string | null
  finishedAt: string | null
  durationMs: number | null
  retryCount: number
  cancelRequestedAt: string | null
  lastSyncedAt: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

export const toVideoGenerationJob = (input: unknown): VideoGenerationJob => {
  const row = asRecord(input)
  const status = normalizeJobStatus(row.status)
  const startedAt = toNullableString(row.started_at) || null
  const finishedAt = toNullableString(row.finished_at) || null
  const durationFromRow =
    typeof row.duration_ms === 'number' && Number.isFinite(row.duration_ms)
      ? Math.max(0, Math.round(row.duration_ms))
      : null
  const durationMs = durationFromRow ?? calculateDurationMs(startedAt, finishedAt)

  return {
    id: String(row.id || ''),
    organizationId: String(row.organization_id || 'org_default'),
    workspaceId: row.workspace_id ? String(row.workspace_id) : null,
    modelId: String(row.model_id || DEFAULT_MODEL_ID),
    generationMode: normalizeGenerationMode(row.generation_mode),
    request: parseRecord(row.request_json),
    status,
    providerStatus: normalizeProviderStatus(row.provider_status),
    operationName: row.operation_name ? String(row.operation_name) : null,
    result: parseRecord(row.result_json),
    errorMessage: row.error_message ? String(row.error_message) : null,
    errorCode: row.error_code ? String(row.error_code) : null,
    outputUrl: row.output_url ? String(row.output_url) : null,
    startedAt,
    finishedAt,
    durationMs,
    retryCount:
      typeof row.retry_count === 'number' && Number.isFinite(row.retry_count)
        ? Math.max(0, Math.floor(row.retry_count))
        : 0,
    cancelRequestedAt: row.cancel_requested_at ? String(row.cancel_requested_at) : null,
    lastSyncedAt: row.last_synced_at ? String(row.last_synced_at) : null,
    createdBy: String(row.created_by || 'system'),
    createdAt: String(row.created_at || now()),
    updatedAt: String(row.updated_at || row.created_at || now())
  }
}

export interface VideoGenerationSubmitResult {
  job: VideoGenerationJob
  providerResult: GenerateResult
}

export interface VideoGenerationSyncResult {
  job: VideoGenerationJob
  queryResult: QueryOperationResult
}

export interface VideoGenerationCancelResult {
  job: VideoGenerationJob
  cancelResult: CancelOperationResult
}

export interface VideoGenerationRetryResult {
  job: VideoGenerationJob
  providerResult: GenerateResult
}

export interface VideoGenerationListQuery {
  organizationId: string
  workspaceId?: string
  visibleWorkspaceIds?: string[]
  status?: VideoGenerationJob['status']
  modelId?: string
  cursor?: string
  limit?: number
}

export interface VideoGenerationListResult {
  jobs: VideoGenerationJob[]
  page: CursorPageMeta
}

export interface VideoGenerationSyncBatchOptions {
  limit?: number
  olderThanMs?: number
  organizationId?: string
  workspaceId?: string | null
}

export interface VideoGenerationSyncBatchResult {
  scannedCount: number
  syncedCount: number
  skippedCount: number
  failedCount: number
  syncedJobIds: string[]
  failedJobs: Array<{
    jobId: string
    error: string
  }>
}

export const buildProviderResultPayload = (
  providerResult: GenerateResult,
  fallbackProvider: string
): Record<string, unknown> => ({
  success: providerResult.success,
  status: providerResult.status,
  provider: providerResult.provider || fallbackProvider,
  message: providerResult.message,
  operationName: providerResult.operationName,
  error: providerResult.error || null
})
