import type {
  CancelOperationResult,
  GenerateParams,
  GenerateRuntimeContext,
  VideoGenerationInputs,
  VideoGenerationMode
} from './ModelDriver'
import { getLocalDb } from './LocalDatabaseService'
import { VideoOrchestrator } from './VideoOrchestrator'
import {
  ACTIVE_JOB_STATUSES,
  DEFAULT_MODEL_ID,
  TERMINAL_JOB_STATUSES,
  VideoGenerationValidationError,
  buildProviderResultPayload,
  calculateDurationMs,
  decodeStableCursor,
  encodeStableCursor,
  isPlainObject,
  mapOperationStateToJobStatus,
  normalizeGenerationMode,
  normalizeInputs,
  normalizePrompt,
  now,
  resolveErrorMessage,
  throwValidationError,
  toNullableString,
  toRetryInputs,
  toSubmitJobStatus,
  toVideoGenerationJob,
  type DbRow,
  type DriverOptions,
  type VideoGenerationCancelResult,
  type VideoGenerationCreateInput,
  type VideoGenerationJob,
  type VideoGenerationJobStatus,
  type VideoGenerationListQuery,
  type VideoGenerationListResult,
  type VideoGenerationRetryResult,
  type VideoGenerationSubmitResult,
  type VideoGenerationSyncBatchOptions,
  type VideoGenerationSyncBatchResult,
  type VideoGenerationSyncResult
} from './videoGenerationShared'

export {
  VideoGenerationValidationError,
  type VideoGenerationInputsInput,
  type VideoGenerationJob,
  type VideoGenerationJobStatus,
  type VideoGenerationListQuery,
  type VideoGenerationListResult,
  type VideoGenerationCreateInput
} from './videoGenerationShared'

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
      inputs: toRetryInputs(storedRequest.inputs)
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
      .all(...params) as DbRow[]

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
      .all(...params) as DbRow[]

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
      } catch (error: unknown) {
        result.failedCount += 1
        result.failedJobs.push({
          jobId: job.id,
          error: resolveErrorMessage(error, 'unknown sync error')
        })
      }
    }

    return result
  }
}
