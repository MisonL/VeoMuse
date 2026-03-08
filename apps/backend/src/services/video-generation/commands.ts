import type { CancelOperationResult, GenerateRuntimeContext } from '../ModelDriver'
import { getLocalDb } from '../LocalDatabaseService'
import { VideoOrchestrator } from '../VideoOrchestrator'
import {
  ACTIVE_JOB_STATUSES,
  TERMINAL_JOB_STATUSES,
  VideoGenerationValidationError,
  buildProviderResultPayload,
  calculateDurationMs,
  isPlainObject,
  now,
  throwValidationError,
  toNullableString,
  toRetryInputs,
  toSubmitJobStatus,
  type VideoGenerationCancelResult,
  type VideoGenerationCreateInput,
  type VideoGenerationRetryResult,
  type VideoGenerationSubmitResult
} from '../videoGenerationShared'
import {
  normalizeGenerationRequest,
  toVideoGenerationDriverParams,
  type StoredGenerationRequestPayload
} from './request'
import { getVideoGenerationJobById } from './queries'

export const submitVideoGenerationJob = async (
  input: VideoGenerationCreateInput,
  runtimeContext?: GenerateRuntimeContext
): Promise<VideoGenerationSubmitResult> => {
  const normalized = normalizeGenerationRequest(input)
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

  const created = getVideoGenerationJobById(
    jobId,
    String(input.organizationId || '').trim() || 'org_default'
  )
  if (!created) {
    throw new Error('生成任务写入失败')
  }

  return {
    job: created,
    providerResult
  }
}

export const retryVideoGenerationJob = async (
  jobId: string,
  organizationId: string,
  runtimeContext?: GenerateRuntimeContext
): Promise<VideoGenerationRetryResult> => {
  const existingJob = getVideoGenerationJobById(jobId, organizationId)
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
  const driverParams = toVideoGenerationDriverParams(retryInput)
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

  const updated = getVideoGenerationJobById(job.id, job.organizationId)
  if (!updated) {
    throw new Error('重试后任务读取失败')
  }
  return {
    job: updated,
    providerResult
  }
}

export const cancelVideoGenerationJob = async (
  jobId: string,
  organizationId: string,
  runtimeContext?: GenerateRuntimeContext
): Promise<VideoGenerationCancelResult> => {
  const existingJob = getVideoGenerationJobById(jobId, organizationId)
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

  const nextStatus =
    cancelResult.state === 'canceled'
      ? 'canceled'
      : cancelResult.state === 'cancel_requested' || cancelResult.state === 'not_supported'
        ? 'cancel_requested'
        : job.status

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

  const updated = getVideoGenerationJobById(job.id, job.organizationId)
  if (!updated) {
    throw new Error('取消后任务读取失败')
  }
  return {
    job: updated,
    cancelResult
  }
}
