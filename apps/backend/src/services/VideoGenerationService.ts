import type { CursorPageMeta } from '@veomuse/shared'
import type {
  CancelOperationResult,
  GenerateParams,
  GenerateResult,
  GenerateRuntimeContext,
  QueryOperationResult,
  VideoGenerationOperationState,
  VideoGenerationInputSource,
  VideoGenerationInputs,
  VideoGenerationMode,
  VideoInputSourceType
} from './ModelDriver'
import { getLocalDb } from './LocalDatabaseService'
import { VideoOrchestrator } from './VideoOrchestrator'

const now = () => new Date().toISOString()

const OBJECT_KEY_SEGMENT = /^[a-zA-Z0-9._-]+$/
const DEFAULT_MODEL_ID = 'veo-3.1'

type DriverOptions = NonNullable<GenerateParams['options']>

export class VideoGenerationValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VideoGenerationValidationError'
  }
}

const throwValidationError = (message: string): never => {
  throw new VideoGenerationValidationError(message)
}

interface StableCursorPayload {
  createdAt: string
  id: string | null
}

const encodeStableCursor = (
  createdAt: string | null | undefined,
  id: string | null | undefined
) => {
  const normalizedCreatedAt = String(createdAt || '').trim()
  if (!normalizedCreatedAt) return null
  const normalizedId = String(id || '').trim()
  if (!normalizedId) return normalizedCreatedAt
  return `${normalizedCreatedAt}|${normalizedId}`
}

const decodeStableCursor = (cursor: string | null | undefined): StableCursorPayload | null => {
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

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const parseRecord = (value: string | null | undefined): Record<string, unknown> => {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    return isPlainObject(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

const toNullableString = (value: unknown) => {
  const normalized = String(value || '').trim()
  return normalized ? normalized : null
}

const normalizeObjectKey = (value: string) => {
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

const resolveAssetPublicUrl = (sourceType: VideoInputSourceType, value: string) => {
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

const normalizeSourceInput = (
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

const normalizeSourceArray = (value: unknown, workspaceId?: string) => {
  if (!Array.isArray(value)) return undefined
  const normalized = value
    .map((item) => normalizeSourceInput(item, workspaceId))
    .filter(Boolean) as VideoGenerationInputSource[]
  return normalized.length ? normalized : undefined
}

const normalizeInputs = (
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

const normalizeGenerationMode = (value: unknown): VideoGenerationMode => {
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

const normalizePrompt = (promptValue: unknown, textValue: unknown) => {
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

const TERMINAL_JOB_STATUSES = new Set<VideoGenerationJobStatus>(['succeeded', 'failed', 'canceled'])
const ACTIVE_JOB_STATUSES = new Set<VideoGenerationJobStatus>([
  'queued',
  'submitted',
  'processing',
  'cancel_requested'
])

const normalizeProviderStatus = (value: unknown): GenerateResult['status'] => {
  if (value === 'ok' || value === 'degraded' || value === 'not_implemented' || value === 'error') {
    return value
  }
  return 'error'
}

const normalizeJobStatus = (value: unknown): VideoGenerationJobStatus => {
  if (value === 'queued') return 'queued'
  if (value === 'submitted') return 'submitted'
  if (value === 'processing') return 'processing'
  if (value === 'succeeded') return 'succeeded'
  if (value === 'failed') return 'failed'
  if (value === 'cancel_requested') return 'cancel_requested'
  if (value === 'canceled') return 'canceled'
  return 'queued'
}

const toSubmitJobStatus = (result: GenerateResult): VideoGenerationJobStatus =>
  result.success && (result.status === 'ok' || result.status === 'degraded')
    ? 'submitted'
    : 'failed'

const mapOperationStateToJobStatus = (
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

const calculateDurationMs = (
  startedAt: string | null | undefined,
  finishedAt: string | null | undefined
): number | null => {
  const startedValue = Date.parse(String(startedAt || ''))
  const finishedValue = Date.parse(String(finishedAt || ''))
  if (!Number.isFinite(startedValue) || !Number.isFinite(finishedValue)) return null
  return Math.max(0, Math.round(finishedValue - startedValue))
}

const toVideoGenerationJob = (row: any): VideoGenerationJob => {
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

interface NormalizedGenerationRequest {
  modelId: string
  generationMode: VideoGenerationMode
  text: string
  negativePrompt?: string
  options: DriverOptions
  inputs?: VideoGenerationInputs
}

interface StoredGenerationRequestPayload {
  modelId?: string
  generationMode?: VideoGenerationMode
  prompt?: string
  text?: string
  negativePrompt?: string | null
  inputs?: VideoGenerationInputs | null
  options?: DriverOptions
}

const buildProviderResultPayload = (
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

export class VideoGenerationService {
  static normalizeRequest(input: VideoGenerationCreateInput): NormalizedGenerationRequest {
    const workspaceId = String(input.workspaceId || '').trim() || undefined
    const modelId = String(input.modelId || DEFAULT_MODEL_ID).trim() || DEFAULT_MODEL_ID
    const generationMode = normalizeGenerationMode(input.generationMode)
    const text = normalizePrompt(input.prompt, input.text)
    const negativePrompt = toNullableString(input.negativePrompt) || undefined
    const inputs = normalizeInputs(input.inputs, workspaceId)
    const rawOptions = isPlainObject(input.options) ? input.options : {}
    const options: DriverOptions = {
      ...rawOptions,
      actorId: toNullableString(input.actorId) || undefined,
      consistencyStrength:
        typeof input.consistencyStrength === 'number' && Number.isFinite(input.consistencyStrength)
          ? input.consistencyStrength
          : undefined,
      syncLip: input.syncLip ?? input.sync_lip ?? undefined,
      worldLink: typeof input.worldLink === 'boolean' ? input.worldLink : undefined,
      worldId: toNullableString(input.worldId) || undefined
    }

    if (generationMode === 'text_to_video' && !text) {
      throwValidationError('text_to_video 模式需要 text/prompt')
    }

    if (generationMode === 'image_to_video') {
      if (!inputs?.image && !(inputs?.referenceImages && inputs.referenceImages.length)) {
        throwValidationError('image_to_video 模式需要 inputs.image 或 inputs.referenceImages')
      }
    }

    if (generationMode === 'first_last_frame_transition') {
      if (!inputs?.firstFrame || !inputs?.lastFrame) {
        throwValidationError(
          'first_last_frame_transition 模式需要 inputs.firstFrame 与 inputs.lastFrame'
        )
      }
    }

    if (generationMode === 'video_extend' && !inputs?.video) {
      throwValidationError('video_extend 模式需要 inputs.video')
    }

    return {
      modelId,
      generationMode,
      text,
      negativePrompt,
      options,
      inputs
    }
  }

  static toDriverParams(input: VideoGenerationCreateInput): GenerateParams {
    const normalized = this.normalizeRequest(input)
    return {
      text: normalized.text,
      generationMode: normalized.generationMode,
      negativePrompt: normalized.negativePrompt,
      inputs: normalized.inputs,
      options: normalized.options
    }
  }

  static async submit(
    input: VideoGenerationCreateInput,
    runtimeContext?: GenerateRuntimeContext
  ): Promise<VideoGenerationSubmitResult> {
    const normalized = this.normalizeRequest(input)
    const providerResult = await VideoOrchestrator.generate(
      normalized.modelId,
      {
        text: normalized.text,
        generationMode: normalized.generationMode,
        negativePrompt: normalized.negativePrompt,
        inputs: normalized.inputs,
        options: normalized.options
      },
      runtimeContext
    )

    const jobId = `vgj_${crypto.randomUUID()}`
    const timestamp = now()
    const status = toSubmitJobStatus(providerResult)
    const startedAt = timestamp
    const finishedAt = TERMINAL_JOB_STATUSES.has(status) ? timestamp : null
    const durationMs = finishedAt ? calculateDurationMs(startedAt, finishedAt) : null
    const requestPayload = {
      modelId: normalized.modelId,
      generationMode: normalized.generationMode,
      prompt: normalized.text,
      negativePrompt: normalized.negativePrompt || null,
      inputs: normalized.inputs || null,
      options: normalized.options || {}
    }
    const resultPayload = buildProviderResultPayload(providerResult, normalized.modelId)

    getLocalDb()
      .prepare(
        `
      INSERT INTO video_generation_jobs (
        id, organization_id, workspace_id, model_id, generation_mode, request_json,
        status, provider_status, operation_name, result_json, error_message,
        error_code, output_url, started_at, finished_at, duration_ms,
        retry_count, cancel_requested_at, last_synced_at,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        jobId,
        String(input.organizationId || '').trim() || 'org_default',
        toNullableString(input.workspaceId),
        normalized.modelId,
        normalized.generationMode,
        JSON.stringify(requestPayload),
        status,
        providerResult.status,
        toNullableString(providerResult.operationName),
        JSON.stringify(resultPayload),
        toNullableString(
          providerResult.error || (providerResult.success ? null : providerResult.message)
        ),
        null,
        null,
        startedAt,
        finishedAt,
        durationMs,
        0,
        null,
        null,
        toNullableString(input.createdBy) || 'system',
        timestamp,
        timestamp
      )

    const created = this.getById(jobId, String(input.organizationId || '').trim() || 'org_default')
    if (!created) {
      throw new Error('生成任务写入失败')
    }

    return {
      job: created,
      providerResult
    }
  }

  static async syncByJobId(
    jobId: string,
    organizationId: string,
    runtimeContext?: GenerateRuntimeContext
  ): Promise<VideoGenerationSyncResult> {
    const existingJob = this.getById(jobId, organizationId)
    if (!existingJob) {
      throw new VideoGenerationValidationError('Generation job not found')
    }
    const operationName = existingJob.operationName
    if (!operationName) {
      throw new VideoGenerationValidationError('任务缺少 operationName，无法同步状态')
    }
    const job = existingJob

    const queryResult = await VideoOrchestrator.queryOperation(
      job.modelId,
      operationName,
      runtimeContext
    )
    const timestamp = now()
    const nextStatus = mapOperationStateToJobStatus(queryResult.state, job.status)
    const nextOutputUrl = toNullableString(queryResult.outputUrl) || job.outputUrl
    const shouldClearError = nextStatus === 'succeeded' || nextStatus === 'canceled'
    const nextErrorMessage = shouldClearError
      ? null
      : toNullableString(queryResult.error || (queryResult.success ? null : queryResult.message)) ||
        job.errorMessage
    const nextErrorCode = shouldClearError
      ? null
      : toNullableString(queryResult.errorCode) || job.errorCode
    const finishedAt = TERMINAL_JOB_STATUSES.has(nextStatus) ? job.finishedAt || timestamp : null
    const durationMs = finishedAt
      ? calculateDurationMs(job.startedAt || job.createdAt, finishedAt)
      : null
    const cancelRequestedAt =
      nextStatus === 'cancel_requested'
        ? job.cancelRequestedAt || timestamp
        : nextStatus === 'canceled'
          ? job.cancelRequestedAt || timestamp
          : null
    const resultPayload = {
      ...job.result,
      latestQuery: {
        state: queryResult.state,
        status: queryResult.status,
        message: queryResult.message,
        outputUrl: queryResult.outputUrl || null,
        error: queryResult.error || null,
        errorCode: queryResult.errorCode || null,
        queriedAt: timestamp
      }
    }

    getLocalDb()
      .prepare(
        `
      UPDATE video_generation_jobs
      SET status = ?, provider_status = ?, result_json = ?, error_message = ?,
          error_code = ?, output_url = ?, finished_at = ?, duration_ms = ?,
          cancel_requested_at = ?, last_synced_at = ?, updated_at = ?
      WHERE id = ? AND organization_id = ?
    `
      )
      .run(
        nextStatus,
        queryResult.status,
        JSON.stringify(resultPayload),
        nextErrorMessage,
        nextErrorCode,
        nextOutputUrl,
        finishedAt,
        durationMs,
        cancelRequestedAt,
        timestamp,
        timestamp,
        job.id,
        job.organizationId
      )

    const updated = this.getById(job.id, job.organizationId)
    if (!updated) {
      throw new Error('同步后任务读取失败')
    }
    return {
      job: updated,
      queryResult
    }
  }

  static async retry(
    jobId: string,
    organizationId: string,
    runtimeContext?: GenerateRuntimeContext
  ): Promise<VideoGenerationRetryResult> {
    const existingJob = this.getById(jobId, organizationId)
    if (!existingJob) {
      throw new VideoGenerationValidationError('Generation job not found')
    }
    const job = existingJob
    if (ACTIVE_JOB_STATUSES.has(job.status)) {
      throwValidationError('任务仍在处理中，暂不支持重试')
    }

    const storedRequest = (job.request || {}) as StoredGenerationRequestPayload
    const retryInput: VideoGenerationCreateInput = {
      organizationId: job.organizationId,
      workspaceId: job.workspaceId || undefined,
      createdBy: job.createdBy,
      modelId: toNullableString(storedRequest.modelId) || job.modelId,
      generationMode: storedRequest.generationMode || job.generationMode,
      prompt: toNullableString(storedRequest.prompt) || toNullableString(storedRequest.text) || '',
      negativePrompt: toNullableString(storedRequest.negativePrompt) || undefined,
      options: isPlainObject(storedRequest.options) ? storedRequest.options : {},
      inputs: isPlainObject(storedRequest.inputs) ? (storedRequest.inputs as any) : undefined
    }
    const driverParams = this.toDriverParams(retryInput)
    const providerResult = await VideoOrchestrator.generate(
      retryInput.modelId || job.modelId,
      driverParams,
      runtimeContext
    )

    const timestamp = now()
    const nextStatus = toSubmitJobStatus(providerResult)
    const startedAt = timestamp
    const finishedAt = TERMINAL_JOB_STATUSES.has(nextStatus) ? timestamp : null
    const durationMs = finishedAt ? calculateDurationMs(startedAt, finishedAt) : null
    const resultPayload = buildProviderResultPayload(
      providerResult,
      retryInput.modelId || job.modelId
    )

    getLocalDb()
      .prepare(
        `
      UPDATE video_generation_jobs
      SET status = ?, provider_status = ?, operation_name = ?, result_json = ?,
          error_message = ?, error_code = NULL, output_url = NULL,
          started_at = ?, finished_at = ?, duration_ms = ?,
          retry_count = COALESCE(retry_count, 0) + 1,
          cancel_requested_at = NULL, last_synced_at = NULL, updated_at = ?
      WHERE id = ? AND organization_id = ?
    `
      )
      .run(
        nextStatus,
        providerResult.status,
        toNullableString(providerResult.operationName),
        JSON.stringify(resultPayload),
        toNullableString(
          providerResult.error || (providerResult.success ? null : providerResult.message)
        ),
        startedAt,
        finishedAt,
        durationMs,
        timestamp,
        job.id,
        job.organizationId
      )

    const updated = this.getById(job.id, job.organizationId)
    if (!updated) {
      throw new Error('重试后任务读取失败')
    }
    return {
      job: updated,
      providerResult
    }
  }

  static async cancel(
    jobId: string,
    organizationId: string,
    runtimeContext?: GenerateRuntimeContext
  ): Promise<VideoGenerationCancelResult> {
    const existingJob = this.getById(jobId, organizationId)
    if (!existingJob) {
      throw new VideoGenerationValidationError('Generation job not found')
    }
    const job = existingJob

    if (job.status === 'succeeded' || job.status === 'failed' || job.status === 'canceled') {
      throwValidationError(`当前状态 ${job.status} 不支持取消`)
    }

    let cancelResult: CancelOperationResult
    if (!job.operationName) {
      cancelResult = {
        success: true,
        status: 'ok',
        operationName: '',
        state: 'canceled',
        message: '任务尚未提交到 provider，已在本地取消',
        provider: job.modelId
      }
    } else {
      cancelResult = await VideoOrchestrator.cancelOperation(
        job.modelId,
        job.operationName,
        runtimeContext
      )
    }

    let nextStatus: VideoGenerationJobStatus
    if (cancelResult.state === 'canceled') {
      nextStatus = 'canceled'
    } else if (
      cancelResult.state === 'cancel_requested' ||
      cancelResult.state === 'not_supported'
    ) {
      nextStatus = 'cancel_requested'
    } else {
      nextStatus = job.status
    }

    const timestamp = now()
    const finishedAt = TERMINAL_JOB_STATUSES.has(nextStatus) ? job.finishedAt || timestamp : null
    const durationMs = finishedAt
      ? calculateDurationMs(job.startedAt || job.createdAt, finishedAt)
      : null
    const shouldClearError = nextStatus === 'canceled'
    const nextErrorMessage = shouldClearError
      ? null
      : cancelResult.state === 'failed'
        ? toNullableString(cancelResult.error || cancelResult.message) || job.errorMessage
        : job.errorMessage
    const nextErrorCode = shouldClearError
      ? null
      : cancelResult.state === 'failed'
        ? toNullableString(cancelResult.errorCode) || job.errorCode
        : job.errorCode
    const cancelRequestedAt =
      nextStatus === 'cancel_requested' || nextStatus === 'canceled'
        ? job.cancelRequestedAt || timestamp
        : null
    const resultPayload = {
      ...job.result,
      latestCancel: {
        state: cancelResult.state,
        status: cancelResult.status,
        message: cancelResult.message,
        error: cancelResult.error || null,
        errorCode: cancelResult.errorCode || null,
        canceledAt: timestamp
      }
    }

    getLocalDb()
      .prepare(
        `
      UPDATE video_generation_jobs
      SET status = ?, provider_status = ?, result_json = ?, error_message = ?,
          error_code = ?, finished_at = ?, duration_ms = ?,
          cancel_requested_at = ?, last_synced_at = ?, updated_at = ?
      WHERE id = ? AND organization_id = ?
    `
      )
      .run(
        nextStatus,
        cancelResult.status,
        JSON.stringify(resultPayload),
        nextErrorMessage,
        nextErrorCode,
        finishedAt,
        durationMs,
        cancelRequestedAt,
        timestamp,
        timestamp,
        job.id,
        job.organizationId
      )

    const updated = this.getById(job.id, job.organizationId)
    if (!updated) {
      throw new Error('取消后任务读取失败')
    }
    return {
      job: updated,
      cancelResult
    }
  }

  static getById(id: string, organizationId: string): VideoGenerationJob | null {
    const normalizedId = String(id || '').trim()
    if (!normalizedId) return null
    const row = getLocalDb()
      .prepare(
        `
      SELECT * FROM video_generation_jobs
      WHERE id = ? AND organization_id = ?
      LIMIT 1
    `
      )
      .get(normalizedId, String(organizationId || '').trim() || 'org_default')
    if (!row) return null
    return toVideoGenerationJob(row)
  }

  static list(query: VideoGenerationListQuery): VideoGenerationListResult {
    const organizationId = String(query.organizationId || '').trim() || 'org_default'
    const workspaceId = toNullableString(query.workspaceId)
    const visibleWorkspaceIds = Array.from(
      new Set(
        (query.visibleWorkspaceIds || []).map((item) => String(item || '').trim()).filter(Boolean)
      )
    )
    const modelId = toNullableString(query.modelId)
    const statusFilter = toNullableString(query.status) as VideoGenerationJob['status'] | null
    const safeLimit =
      Number.isFinite(query.limit) && (query.limit || 0) > 0
        ? Math.min(100, Math.floor(query.limit as number))
        : 20
    const queryLimit = safeLimit + 1
    const decodedCursor = decodeStableCursor(query.cursor)

    const whereParts: string[] = ['organization_id = ?']
    const params: Array<string | number> = [organizationId]

    if (workspaceId) {
      whereParts.push('workspace_id = ?')
      params.push(workspaceId)
    } else {
      if (visibleWorkspaceIds.length) {
        const placeholders = visibleWorkspaceIds.map(() => '?').join(', ')
        whereParts.push(`(workspace_id IS NULL OR workspace_id IN (${placeholders}))`)
        params.push(...visibleWorkspaceIds)
      } else {
        whereParts.push('workspace_id IS NULL')
      }
    }
    if (modelId) {
      whereParts.push('model_id = ?')
      params.push(modelId)
    }
    if (statusFilter) {
      whereParts.push('status = ?')
      params.push(statusFilter)
    }

    if (decodedCursor && decodedCursor.id) {
      whereParts.push('(created_at < ? OR (created_at = ? AND id < ?))')
      params.push(decodedCursor.createdAt, decodedCursor.createdAt, decodedCursor.id)
    } else if (decodedCursor) {
      whereParts.push('created_at < ?')
      params.push(decodedCursor.createdAt)
    }

    const rows = getLocalDb()
      .prepare(
        `
      SELECT * FROM video_generation_jobs
      WHERE ${whereParts.join(' AND ')}
      ORDER BY created_at DESC, id DESC
      LIMIT ${queryLimit}
    `
      )
      .all(...params) as any[]

    const hasMore = rows.length > safeLimit
    const slicedRows = hasMore ? rows.slice(0, safeLimit) : rows
    const jobs = slicedRows.map((row) => toVideoGenerationJob(row))
    const lastRow = jobs[jobs.length - 1]
    const nextCursor = hasMore ? encodeStableCursor(lastRow?.createdAt, lastRow?.id) : null

    return {
      jobs,
      page: {
        limit: safeLimit,
        hasMore,
        nextCursor
      }
    }
  }

  static async syncPendingJobsBatch(
    options: VideoGenerationSyncBatchOptions = {}
  ): Promise<VideoGenerationSyncBatchResult> {
    const safeLimit =
      Number.isFinite(options.limit) && (options.limit || 0) > 0
        ? Math.min(100, Math.floor(options.limit as number))
        : 10
    const olderThanMs =
      Number.isFinite(options.olderThanMs) && (options.olderThanMs || 0) >= 0
        ? Math.floor(options.olderThanMs as number)
        : 0
    const activeStatuses = Array.from(ACTIVE_JOB_STATUSES.values())
    const placeholders = activeStatuses.map(() => '?').join(', ')
    const whereParts: string[] = [`status IN (${placeholders})`, `operation_name IS NOT NULL`]
    const params: Array<string | number> = [...activeStatuses]
    const organizationId = toNullableString(options.organizationId)
    const workspaceIdInput = String(options.workspaceId || '').trim()

    if (organizationId) {
      whereParts.push(`organization_id = ?`)
      params.push(organizationId)
    }
    if (workspaceIdInput) {
      whereParts.push(`workspace_id = ?`)
      params.push(workspaceIdInput)
    } else if (options.workspaceId === null) {
      whereParts.push(`workspace_id IS NULL`)
    }

    if (olderThanMs > 0) {
      whereParts.push(`COALESCE(last_synced_at, updated_at, created_at) <= ?`)
      params.push(new Date(Date.now() - olderThanMs).toISOString())
    }

    params.push(safeLimit)
    const rows = getLocalDb()
      .prepare(
        `
      SELECT * FROM video_generation_jobs
      WHERE ${whereParts.join(' AND ')}
      ORDER BY COALESCE(last_synced_at, updated_at, created_at) ASC, updated_at ASC, id ASC
      LIMIT ?
    `
      )
      .all(...params) as any[]

    const result: VideoGenerationSyncBatchResult = {
      scannedCount: rows.length,
      syncedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      syncedJobIds: [],
      failedJobs: []
    }

    for (const row of rows) {
      const job = toVideoGenerationJob(row)
      if (!ACTIVE_JOB_STATUSES.has(job.status) || !String(job.operationName || '').trim()) {
        result.skippedCount += 1
        continue
      }
      try {
        const synced = await this.syncByJobId(job.id, job.organizationId, {
          organizationId: job.organizationId,
          workspaceId: job.workspaceId || undefined
        })
        result.syncedCount += 1
        result.syncedJobIds.push(synced.job.id)
      } catch (error: any) {
        result.failedCount += 1
        result.failedJobs.push({
          jobId: job.id,
          error: String(error?.message || 'unknown sync error')
        })
      }
    }

    return result
  }
}
