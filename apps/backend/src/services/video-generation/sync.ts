import type { GenerateRuntimeContext } from '../ModelDriver'
import { getLocalDb } from '../LocalDatabaseService'
import { VideoOrchestrator } from '../VideoOrchestrator'
import {
  ACTIVE_JOB_STATUSES,
  TERMINAL_JOB_STATUSES,
  VideoGenerationValidationError,
  calculateDurationMs,
  mapOperationStateToJobStatus,
  now,
  resolveErrorMessage,
  toNullableString,
  toVideoGenerationJob,
  type DbRow,
  type VideoGenerationSyncBatchOptions,
  type VideoGenerationSyncBatchResult,
  type VideoGenerationSyncResult
} from '../videoGenerationShared'
import { getVideoGenerationJobById } from './queries'

export const syncVideoGenerationJobById = async (
  jobId: string,
  organizationId: string,
  runtimeContext?: GenerateRuntimeContext
): Promise<VideoGenerationSyncResult> => {
  const existingJob = getVideoGenerationJobById(jobId, organizationId)
  if (!existingJob) {
    throw new VideoGenerationValidationError('Generation job not found')
  }
  const job = existingJob
  const operationName = job.operationName
  if (!operationName) {
    throw new VideoGenerationValidationError('任务缺少 operationName，无法同步状态')
  }

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
    nextStatus === 'cancel_requested' || nextStatus === 'canceled'
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

  const updated = getVideoGenerationJobById(job.id, job.organizationId)
  if (!updated) {
    throw new Error('同步后任务读取失败')
  }
  return {
    job: updated,
    queryResult
  }
}

export const syncPendingVideoGenerationJobsBatch = async (
  options: VideoGenerationSyncBatchOptions = {}
): Promise<VideoGenerationSyncBatchResult> => {
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
    whereParts.push('organization_id = ?')
    params.push(organizationId)
  }
  if (workspaceIdInput) {
    whereParts.push('workspace_id = ?')
    params.push(workspaceIdInput)
  } else if (options.workspaceId === null) {
    whereParts.push('workspace_id IS NULL')
  }
  if (olderThanMs > 0) {
    whereParts.push('COALESCE(last_synced_at, updated_at, created_at) <= ?')
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
      const synced = await syncVideoGenerationJobById(job.id, job.organizationId, {
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
