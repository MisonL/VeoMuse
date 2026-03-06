import type { ProjectSnapshot } from '@veomuse/shared'
import { getLocalDb } from '../LocalDatabaseService'
import {
  decodeStableCursor,
  encodeStableCursor,
  resolveOrganizationIdByProject,
  resolveWorkspaceIdByProject,
  toProjectComment,
  toProjectReview,
  toProjectTemplate,
  toSnapshot,
  type ProjectClipBatchOperation,
  type ProjectClipBatchUpdateReceipt,
  type ProjectComment,
  type ProjectCommentRow,
  type ProjectReview,
  type ProjectTemplate,
  type ProjectTemplateApplyReceipt
} from '../workspaceShared'
import type { WriteAuditFn } from './contracts'
import { nowIso } from './contracts'

export const createProjectSnapshotRecord = (
  projectId: string,
  actorName: string,
  content: Record<string, unknown>,
  writeAudit: WriteAuditFn
) => {
  const id = `snap_${crypto.randomUUID()}`
  const createdAt = nowIso()
  const organizationId = resolveOrganizationIdByProject(projectId)
  getLocalDb()
    .prepare(
      `
      INSERT INTO project_snapshots (id, organization_id, project_id, actor_name, content_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `
    )
    .run(id, organizationId, projectId, actorName, JSON.stringify(content || {}), createdAt)
  const workspaceId = resolveWorkspaceIdByProject(projectId) || undefined
  writeAudit(
    'project.snapshot_created',
    actorName,
    { projectId, snapshotId: id },
    organizationId,
    workspaceId,
    projectId
  )
  const row = getLocalDb().prepare(`SELECT * FROM project_snapshots WHERE id = ?`).get(id)
  return toSnapshot(row)
}

export const listProjectSnapshotsByProject = (
  projectId: string,
  limit = 20
): ProjectSnapshot[] => {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(100, Math.floor(limit)) : 20
  return getLocalDb()
    .prepare(
      `
        SELECT * FROM project_snapshots
        WHERE project_id = ?
        ORDER BY created_at DESC
        LIMIT ${safeLimit}
      `
    )
    .all(projectId)
    .map(toSnapshot)
}

export const listProjectCommentsPageByProject = (
  projectId: string,
  cursor?: string,
  limit = 20
) => {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(100, Math.floor(limit)) : 20
  const queryLimit = safeLimit + 1
  const decodedCursor = decodeStableCursor(cursor)
  const rows: ProjectCommentRow[] =
    decodedCursor && decodedCursor.id
      ? (getLocalDb()
          .prepare(
            `
          SELECT * FROM project_comments
          WHERE project_id = ?
            AND (
              created_at < ?
              OR (created_at = ? AND id < ?)
            )
          ORDER BY created_at DESC, id DESC
          LIMIT ${queryLimit}
        `
          )
          .all(projectId, decodedCursor.createdAt, decodedCursor.createdAt, decodedCursor.id) as ProjectCommentRow[])
      : decodedCursor
        ? (getLocalDb()
            .prepare(
              `
          SELECT * FROM project_comments
          WHERE project_id = ? AND created_at < ?
          ORDER BY created_at DESC, id DESC
          LIMIT ${queryLimit}
        `
            )
            .all(projectId, decodedCursor.createdAt) as ProjectCommentRow[])
        : (getLocalDb()
            .prepare(
              `
          SELECT * FROM project_comments
          WHERE project_id = ?
          ORDER BY created_at DESC, id DESC
          LIMIT ${queryLimit}
        `
            )
            .all(projectId) as ProjectCommentRow[])
  const hasMore = rows.length > safeLimit
  const pageRows = hasMore ? rows.slice(0, safeLimit) : rows
  const comments = pageRows.map(toProjectComment)
  const nextCursor = hasMore
    ? encodeStableCursor(pageRows[pageRows.length - 1]?.created_at, pageRows[pageRows.length - 1]?.id)
    : null
  return {
    comments,
    page: {
      limit: safeLimit,
      hasMore,
      nextCursor: nextCursor || null
    }
  }
}

export const listProjectCommentsByProject = (
  projectId: string,
  cursor?: string,
  limit = 20
): ProjectComment[] => listProjectCommentsPageByProject(projectId, cursor, limit).comments

export const createProjectCommentRecord = (
  projectId: string,
  actorName: string,
  payload: { anchor?: string; content: string; mentions?: string[] },
  writeAudit: WriteAuditFn
): ProjectComment => {
  const id = `pc_${crypto.randomUUID()}`
  const createdAt = nowIso()
  const updatedAt = createdAt
  const organizationId = resolveOrganizationIdByProject(projectId)
  const workspaceId = resolveWorkspaceIdByProject(projectId) || undefined
  const traceId = `trace_${crypto.randomUUID()}`
  const content = String(payload?.content || '').trim()
  if (!content) {
    throw new Error('评论内容不能为空')
  }
  const anchor =
    typeof payload?.anchor === 'string' && payload.anchor.trim() ? payload.anchor.trim() : null
  const mentions = Array.from(
    new Set(
      Array.isArray(payload?.mentions)
        ? payload.mentions.map((item) => String(item).trim()).filter(Boolean)
        : []
    )
  )
  getLocalDb()
    .prepare(
      `
      INSERT INTO project_comments (
        id, organization_id, project_id, actor_name, anchor, content, mentions_json, status, resolved_by, resolved_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
    .run(
      id,
      organizationId,
      projectId,
      actorName,
      anchor,
      content,
      JSON.stringify(mentions),
      'open',
      null,
      null,
      createdAt,
      updatedAt
    )
  writeAudit(
    'project.comment_created',
    actorName,
    {
      projectId,
      commentId: id,
      hasAnchor: Boolean(anchor),
      mentionsCount: mentions.length
    },
    organizationId,
    workspaceId,
    projectId,
    traceId
  )
  const row = getLocalDb().prepare(`SELECT * FROM project_comments WHERE id = ?`).get(id)
  return toProjectComment(row)
}

export const resolveProjectCommentRecord = (
  projectId: string,
  commentId: string,
  actorName: string,
  writeAudit: WriteAuditFn
): ProjectComment | null => {
  const normalizedCommentId = commentId.trim()
  if (!normalizedCommentId) return null
  const existing = getLocalDb()
    .prepare(
      `
      SELECT * FROM project_comments
      WHERE project_id = ? AND id = ?
      LIMIT 1
    `
    )
    .get(projectId, normalizedCommentId) as { status?: string } | null
  if (!existing) return null
  if (existing.status !== 'resolved') {
    const resolvedAt = nowIso()
    const organizationId = resolveOrganizationIdByProject(projectId)
    const workspaceId = resolveWorkspaceIdByProject(projectId) || undefined
    const traceId = `trace_${crypto.randomUUID()}`
    getLocalDb()
      .prepare(
        `
        UPDATE project_comments
        SET status = ?, resolved_by = ?, resolved_at = ?, updated_at = ?
        WHERE project_id = ? AND id = ?
      `
      )
      .run('resolved', actorName, resolvedAt, resolvedAt, projectId, normalizedCommentId)
    writeAudit(
      'project.comment_resolved',
      actorName,
      {
        projectId,
        commentId: normalizedCommentId
      },
      organizationId,
      workspaceId,
      projectId,
      traceId
    )
  }
  const row = getLocalDb()
    .prepare(
      `
      SELECT * FROM project_comments
      WHERE project_id = ? AND id = ?
      LIMIT 1
    `
    )
    .get(projectId, normalizedCommentId)
  return row ? toProjectComment(row) : null
}

export const listProjectReviewsByProject = (projectId: string, limit = 20): ProjectReview[] => {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(100, Math.floor(limit)) : 20
  return getLocalDb()
    .prepare(
      `
        SELECT * FROM project_reviews
        WHERE project_id = ?
        ORDER BY created_at DESC
        LIMIT ${safeLimit}
      `
    )
    .all(projectId)
    .map(toProjectReview)
}

export const createProjectReviewRecord = (
  projectId: string,
  actorName: string,
  payload: { decision: 'approved' | 'changes_requested'; summary: string; score?: number },
  writeAudit: WriteAuditFn
): ProjectReview => {
  const decision = payload?.decision === 'changes_requested' ? 'changes_requested' : 'approved'
  const summary = String(payload?.summary || '').trim()
  if (!summary) {
    throw new Error('评审摘要不能为空')
  }
  const score = Number.isFinite(payload?.score) ? Number(payload?.score) : null
  const id = `prv_${crypto.randomUUID()}`
  const createdAt = nowIso()
  const organizationId = resolveOrganizationIdByProject(projectId)
  const workspaceId = resolveWorkspaceIdByProject(projectId) || undefined
  const traceId = `trace_${crypto.randomUUID()}`
  getLocalDb()
    .prepare(
      `
      INSERT INTO project_reviews (
        id, organization_id, project_id, actor_name, decision, summary, score, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
    .run(id, organizationId, projectId, actorName, decision, summary, score, createdAt)
  writeAudit(
    'project.review_created',
    actorName,
    {
      projectId,
      reviewId: id,
      decision,
      hasScore: score !== null
    },
    organizationId,
    workspaceId,
    projectId,
    traceId
  )
  const row = getLocalDb().prepare(`SELECT * FROM project_reviews WHERE id = ?`).get(id)
  return toProjectReview(row)
}

export const listProjectTemplatesByProject = (projectId: string): ProjectTemplate[] =>
  getLocalDb()
    .prepare(
      `
        SELECT * FROM project_templates
        WHERE project_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `
    )
    .all(projectId)
    .map(toProjectTemplate)

export const applyProjectTemplateRecord = (
  projectId: string,
  actorName: string,
  templateId: string,
  writeAudit: WriteAuditFn,
  options?: Record<string, unknown>
): ProjectTemplateApplyReceipt | null => {
  const normalizedTemplateId = templateId.trim()
  if (!normalizedTemplateId) return null
  const row = getLocalDb()
    .prepare(
      `
      SELECT * FROM project_templates
      WHERE project_id = ? AND id = ?
      LIMIT 1
    `
    )
    .get(projectId, normalizedTemplateId) as { name?: string } | null
  if (!row) return null
  const organizationId = resolveOrganizationIdByProject(projectId)
  const workspaceId = resolveWorkspaceIdByProject(projectId)
  const normalizedOptions =
    options && typeof options === 'object' && !Array.isArray(options) ? options : {}
  const templateName = String(row.name || '未命名模板')
  const appliedAt = nowIso()
  const traceId = `trace_${crypto.randomUUID()}`
  writeAudit(
    'project.template_applied',
    actorName,
    {
      projectId,
      templateId: normalizedTemplateId,
      templateName,
      options: normalizedOptions
    },
    organizationId,
    workspaceId || undefined,
    projectId,
    traceId
  )
  return {
    projectId,
    templateId: normalizedTemplateId,
    templateName,
    actorName,
    options: normalizedOptions,
    organizationId,
    workspaceId,
    traceId,
    appliedAt
  }
}

export const batchUpdateProjectClipsRecord = (
  projectId: string,
  actorName: string,
  operations: Array<{ clipId: string; patch: Record<string, unknown> }>,
  writeAudit: WriteAuditFn
): ProjectClipBatchUpdateReceipt => {
  const safeOperations = Array.isArray(operations) ? operations : []
  const normalizedOperations: ProjectClipBatchOperation[] = []
  let rejected = 0
  let skipped = 0
  for (const operation of safeOperations) {
    const clipId = String(operation?.clipId || '').trim()
    const rawPatch = operation?.patch
    const patch =
      rawPatch && typeof rawPatch === 'object' && !Array.isArray(rawPatch) ? rawPatch : null
    if (!clipId || !patch) {
      rejected += 1
      continue
    }
    if (Object.keys(patch).length === 0) {
      skipped += 1
      continue
    }
    normalizedOperations.push({ clipId, patch })
  }
  const requested = safeOperations.length
  const accepted = normalizedOperations.length
  const updated = accepted
  const organizationId = resolveOrganizationIdByProject(projectId)
  const workspaceId = resolveWorkspaceIdByProject(projectId)
  const traceId = `trace_${crypto.randomUUID()}`
  const processedAt = nowIso()
  writeAudit(
    'project.clips_batch_updated',
    actorName,
    {
      projectId,
      requested,
      accepted,
      rejected,
      skipped,
      updated,
      clipIds: normalizedOperations.map((item) => item.clipId)
    },
    organizationId,
    workspaceId || undefined,
    projectId,
    traceId
  )
  return {
    projectId,
    actorName,
    organizationId,
    workspaceId,
    requested,
    accepted,
    skipped,
    rejected,
    updated,
    traceId,
    processedAt
  }
}
