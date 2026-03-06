import { getLocalDb } from '../LocalDatabaseService'
import {
  decodeStableCursor,
  encodeStableCursor,
  toNullableString,
  toVideoGenerationJob,
  type DbRow,
  type VideoGenerationJob,
  type VideoGenerationListQuery,
  type VideoGenerationListResult
} from '../videoGenerationShared'

export const getVideoGenerationJobById = (
  id: string,
  organizationId: string
): VideoGenerationJob | null => {
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

export const listVideoGenerationJobs = (
  query: VideoGenerationListQuery
): VideoGenerationListResult => {
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
  } else if (visibleWorkspaceIds.length) {
    const placeholders = visibleWorkspaceIds.map(() => '?').join(', ')
    whereParts.push(`(workspace_id IS NULL OR workspace_id IN (${placeholders}))`)
    params.push(...visibleWorkspaceIds)
  } else {
    whereParts.push('workspace_id IS NULL')
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
