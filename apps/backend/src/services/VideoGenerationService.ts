import type { CursorPageMeta } from '@veomuse/shared'
import type {
  GenerateParams,
  GenerateResult,
  GenerateRuntimeContext,
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

const toJobStatus = (result: GenerateResult): 'submitted' | 'failed' | 'queued' =>
  result.success && (result.status === 'ok' || result.status === 'degraded')
    ? 'submitted'
    : 'failed'

const toVideoGenerationJob = (row: any): VideoGenerationJob => ({
  id: String(row.id || ''),
  organizationId: String(row.organization_id || 'org_default'),
  workspaceId: row.workspace_id ? String(row.workspace_id) : null,
  modelId: String(row.model_id || DEFAULT_MODEL_ID),
  generationMode: normalizeGenerationMode(row.generation_mode),
  request: parseRecord(row.request_json),
  status: row.status === 'failed' ? 'failed' : row.status === 'submitted' ? 'submitted' : 'queued',
  providerStatus:
    row.provider_status === 'ok'
      ? 'ok'
      : row.provider_status === 'degraded'
        ? 'degraded'
        : row.provider_status === 'not_implemented'
          ? 'not_implemented'
          : row.provider_status === 'error'
            ? 'error'
            : 'error',
  operationName: row.operation_name ? String(row.operation_name) : null,
  result: parseRecord(row.result_json),
  errorMessage: row.error_message ? String(row.error_message) : null,
  createdBy: String(row.created_by || 'system'),
  createdAt: String(row.created_at || now()),
  updatedAt: String(row.updated_at || row.created_at || now())
})

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
  status: 'queued' | 'submitted' | 'failed'
  providerStatus: GenerateResult['status']
  operationName: string | null
  result: Record<string, unknown>
  errorMessage: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface VideoGenerationSubmitResult {
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

interface NormalizedGenerationRequest {
  modelId: string
  generationMode: VideoGenerationMode
  text: string
  negativePrompt?: string
  options: DriverOptions
  inputs?: VideoGenerationInputs
}

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
    const status = toJobStatus(providerResult)
    const requestPayload = {
      modelId: normalized.modelId,
      generationMode: normalized.generationMode,
      prompt: normalized.text,
      negativePrompt: normalized.negativePrompt || null,
      inputs: normalized.inputs || null,
      options: normalized.options || {}
    }
    const resultPayload = {
      success: providerResult.success,
      status: providerResult.status,
      provider: providerResult.provider || normalized.modelId,
      message: providerResult.message,
      operationName: providerResult.operationName,
      error: providerResult.error || null
    }

    getLocalDb()
      .prepare(
        `
      INSERT INTO video_generation_jobs (
        id, organization_id, workspace_id, model_id, generation_mode, request_json,
        status, provider_status, operation_name, result_json, error_message,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
}
