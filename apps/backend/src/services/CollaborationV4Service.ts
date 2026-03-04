import type {
  CommentReply,
  CommentThread,
  CursorPageMeta,
  TimelineMergeRecord,
  WorkspaceRole,
  WorkspaceRolePermissionProfile
} from '@veomuse/shared'
import { getLocalDb } from './LocalDatabaseService'
import { WorkspaceService } from './WorkspaceService'

const now = () => new Date().toISOString()

const parseStringArray = (value: string | null | undefined): string[] => {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => String(item)).filter(Boolean)
  } catch {
    return []
  }
}

const parseRecord = (value: string | null | undefined): Record<string, unknown> => {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, unknown>
  } catch {
    return {}
  }
}

const parseRecordArray = (value: string | null | undefined): Array<Record<string, unknown>> => {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
      .map((item) => item as Record<string, unknown>)
  } catch {
    return []
  }
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

const resolveWorkspaceMeta = (workspaceId: string) => {
  const row = getLocalDb()
    .prepare(
      `
    SELECT id, organization_id, updated_at
    FROM workspaces
    WHERE id = ?
    LIMIT 1
  `
    )
    .get(workspaceId) as {
    id?: string
    organization_id?: string
    updated_at?: string
  } | null

  if (!row?.id) return null
  return {
    workspaceId: row.id,
    organizationId: row.organization_id || 'org_default',
    updatedAt: row.updated_at || now()
  }
}

const resolveProjectMeta = (projectId: string) => {
  const row = getLocalDb()
    .prepare(
      `
    SELECT id, workspace_id, organization_id
    FROM projects
    WHERE id = ?
    LIMIT 1
  `
    )
    .get(projectId) as {
    id?: string
    workspace_id?: string
    organization_id?: string
  } | null

  if (!row?.id) return null
  return {
    projectId: row.id,
    workspaceId: row.workspace_id || '',
    organizationId: row.organization_id || 'org_default'
  }
}

const toCommentThread = (row: any, replyCount: number): CommentThread => ({
  id: String(row.id),
  organizationId: String(row.organization_id || 'org_default'),
  projectId: String(row.project_id),
  actorName: String(row.actor_name),
  anchor: row.anchor ? String(row.anchor) : null,
  content: String(row.content || ''),
  mentions: parseStringArray(row.mentions_json),
  status: row.status === 'resolved' ? 'resolved' : 'open',
  resolvedBy: row.resolved_by ? String(row.resolved_by) : null,
  resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
  replyCount,
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at)
})

const toCommentReply = (row: any): CommentReply => ({
  id: String(row.id),
  organizationId: String(row.organization_id || 'org_default'),
  projectId: String(row.project_id),
  threadId: String(row.thread_id),
  actorName: String(row.actor_name),
  content: String(row.content || ''),
  mentions: parseStringArray(row.mentions_json),
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at)
})

const toTimelineMergeRecord = (row: any): TimelineMergeRecord => ({
  id: String(row.id),
  organizationId: String(row.organization_id || 'org_default'),
  workspaceId: row.workspace_id ? String(row.workspace_id) : null,
  projectId: String(row.project_id),
  actorName: String(row.actor_name),
  sourceRevision: String(row.source_revision || ''),
  targetRevision: String(row.target_revision || ''),
  status: row.status === 'conflict' ? 'conflict' : 'merged',
  conflicts: parseRecordArray(row.conflict_json),
  result: parseRecord(row.result_json),
  createdAt: String(row.created_at)
})

const ROLE_ORDER: WorkspaceRole[] = ['owner', 'editor', 'viewer']

const DEFAULT_ROLE_PERMISSIONS: Record<WorkspaceRole, Record<string, boolean>> = {
  owner: {
    'workspace.permissions.manage': true,
    'project.comments.manage': true,
    'timeline.merge': true,
    'creative.workflow.manage': true,
    'creative.batch.manage': true,
    'asset.reuse': true
  },
  editor: {
    'project.comments.create': true,
    'project.comments.reply': true,
    'project.comments.resolve': true,
    'timeline.merge': true,
    'creative.workflow.run': true,
    'creative.batch.create': true,
    'asset.reuse': true
  },
  viewer: {
    'project.comments.view': true,
    'asset.reuse.view': true
  }
}

export interface CreateCommentThreadInput {
  anchor?: string
  content: string
  mentions?: string[]
}

export interface CreateCommentReplyInput {
  content: string
  mentions?: string[]
}

export interface SetWorkspaceRolePermissionsInput {
  permissions: Record<string, boolean>
  updatedBy: string
}

export interface TimelineMergeInput {
  sourceRevision?: string
  targetRevision?: string
  conflicts?: Array<Record<string, unknown> | string>
  result?: Record<string, unknown>
  status?: TimelineMergeRecord['status']
}

export interface CommentThreadPageResult {
  threads: CommentThread[]
  page: CursorPageMeta
}

export class CollaborationV4Service {
  static listCommentThreads(
    projectId: string,
    cursor?: string,
    limit: number = 20
  ): CommentThread[] {
    return this.listCommentThreadsPage(projectId, cursor, limit).threads
  }

  static listCommentThreadsPage(
    projectId: string,
    cursor?: string,
    limit: number = 20
  ): CommentThreadPageResult {
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(100, Math.floor(limit)) : 20
    const decodedCursor = decodeStableCursor(cursor)
    const queryLimit = safeLimit + 1

    const rows: any[] =
      decodedCursor && decodedCursor.id !== null
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
            .all(
              projectId,
              decodedCursor.createdAt,
              decodedCursor.createdAt,
              decodedCursor.id
            ) as any[])
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
              .all(projectId, decodedCursor.createdAt) as any[])
          : (getLocalDb()
              .prepare(
                `
          SELECT * FROM project_comments
          WHERE project_id = ?
          ORDER BY created_at DESC, id DESC
          LIMIT ${queryLimit}
        `
              )
              .all(projectId) as any[])

    const hasMore = rows.length > safeLimit
    const pageRows = hasMore ? rows.slice(0, safeLimit) : rows

    const threadIds = pageRows.map((row) => String(row.id)).filter(Boolean)
    const replyCountByThreadId = new Map<string, number>()

    if (threadIds.length > 0) {
      const placeholders = threadIds.map(() => '?').join(', ')
      const countRows = getLocalDb()
        .prepare(
          `
        SELECT thread_id, COUNT(1) AS total
        FROM comment_replies
        WHERE thread_id IN (${placeholders})
        GROUP BY thread_id
      `
        )
        .all(...threadIds) as Array<{ thread_id?: string; total?: number }>

      for (const countRow of countRows) {
        const threadId = String(countRow.thread_id || '').trim()
        if (!threadId) continue
        replyCountByThreadId.set(threadId, Number(countRow.total || 0))
      }
    }

    const threads = pageRows.map((row: any) =>
      toCommentThread(row, replyCountByThreadId.get(String(row.id)) ?? 0)
    )

    const nextCursor = hasMore
      ? encodeStableCursor(
          pageRows[pageRows.length - 1]?.created_at,
          pageRows[pageRows.length - 1]?.id
        )
      : null

    return {
      threads,
      page: {
        limit: safeLimit,
        hasMore,
        nextCursor: nextCursor || null
      }
    }
  }

  static createCommentThread(
    projectId: string,
    actorName: string,
    payload: CreateCommentThreadInput
  ): CommentThread {
    const comment = WorkspaceService.createProjectComment(projectId, actorName, payload)
    return {
      ...comment,
      replyCount: 0
    }
  }

  static createCommentReply(
    projectId: string,
    threadId: string,
    actorName: string,
    payload: CreateCommentReplyInput
  ): CommentReply {
    const normalizedThreadId = threadId.trim()
    if (!normalizedThreadId) {
      throw new Error('threadId 不能为空')
    }

    const existingThread = getLocalDb()
      .prepare(
        `
      SELECT id FROM project_comments
      WHERE project_id = ? AND id = ?
      LIMIT 1
    `
      )
      .get(projectId, normalizedThreadId)

    if (!existingThread) {
      throw new Error('评论线程不存在')
    }

    const content = String(payload.content || '').trim()
    if (!content) {
      throw new Error('回复内容不能为空')
    }

    const mentions = Array.from(
      new Set(
        Array.isArray(payload.mentions)
          ? payload.mentions.map((item) => String(item).trim()).filter(Boolean)
          : []
      )
    )

    const id = `reply_${crypto.randomUUID()}`
    const timestamp = now()
    const projectMeta = resolveProjectMeta(projectId)
    if (!projectMeta) {
      throw new Error('项目不存在')
    }

    getLocalDb()
      .prepare(
        `
      INSERT INTO comment_replies (
        id, organization_id, project_id, thread_id, actor_name,
        content, mentions_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        id,
        projectMeta.organizationId,
        projectId,
        normalizedThreadId,
        actorName,
        content,
        JSON.stringify(mentions),
        timestamp,
        timestamp
      )

    const row = getLocalDb().prepare(`SELECT * FROM comment_replies WHERE id = ? LIMIT 1`).get(id)
    if (!row) {
      throw new Error('评论回复创建失败')
    }
    return toCommentReply(row)
  }

  static resolveCommentThread(
    projectId: string,
    threadId: string,
    actorName: string
  ): CommentThread | null {
    const resolved = WorkspaceService.resolveProjectComment(projectId, threadId, actorName)
    if (!resolved) return null
    const countRow = getLocalDb()
      .prepare(
        `
      SELECT COUNT(1) AS total
      FROM comment_replies
      WHERE thread_id = ?
    `
      )
      .get(resolved.id) as { total?: number } | null

    return {
      ...resolved,
      replyCount: Number(countRow?.total || 0)
    }
  }

  static listWorkspaceRolePermissions(workspaceId: string): WorkspaceRolePermissionProfile[] {
    const workspaceMeta = resolveWorkspaceMeta(workspaceId)
    if (!workspaceMeta) {
      throw new Error('工作区不存在')
    }

    const rows = getLocalDb()
      .prepare(
        `
      SELECT * FROM workspace_role_permissions
      WHERE workspace_id = ?
      ORDER BY role ASC, updated_at DESC
    `
      )
      .all(workspaceId) as Array<{
      role: WorkspaceRole
      permission_key: string
      allowed: number
      updated_by: string
      updated_at: string
    }>

    const permissionsByRole: Record<WorkspaceRole, Record<string, boolean>> = {
      owner: { ...DEFAULT_ROLE_PERMISSIONS.owner },
      editor: { ...DEFAULT_ROLE_PERMISSIONS.editor },
      viewer: { ...DEFAULT_ROLE_PERMISSIONS.viewer }
    }

    const roleMeta: Record<WorkspaceRole, { updatedBy: string; updatedAt: string }> = {
      owner: { updatedBy: 'system', updatedAt: workspaceMeta.updatedAt },
      editor: { updatedBy: 'system', updatedAt: workspaceMeta.updatedAt },
      viewer: { updatedBy: 'system', updatedAt: workspaceMeta.updatedAt }
    }

    for (const row of rows) {
      const role =
        row.role === 'owner' || row.role === 'editor' || row.role === 'viewer' ? row.role : null
      if (!role) continue
      const key = String(row.permission_key || '').trim()
      if (!key) continue
      permissionsByRole[role][key] = Number(row.allowed) > 0
      if (row.updated_at > roleMeta[role].updatedAt) {
        roleMeta[role] = {
          updatedBy: String(row.updated_by || 'system'),
          updatedAt: row.updated_at
        }
      }
    }

    return ROLE_ORDER.map((role) => ({
      workspaceId: workspaceMeta.workspaceId,
      organizationId: workspaceMeta.organizationId,
      role,
      permissions: permissionsByRole[role],
      updatedBy: roleMeta[role].updatedBy,
      updatedAt: roleMeta[role].updatedAt
    }))
  }

  static setWorkspaceRolePermissions(
    workspaceId: string,
    role: WorkspaceRole,
    input: SetWorkspaceRolePermissionsInput
  ): WorkspaceRolePermissionProfile {
    const workspaceMeta = resolveWorkspaceMeta(workspaceId)
    if (!workspaceMeta) {
      throw new Error('工作区不存在')
    }

    const updatedBy = String(input.updatedBy || '').trim() || 'system'
    const timestamp = now()

    const normalizedEntries = Object.entries(input.permissions || {})
      .map(([key, value]) => [String(key).trim(), Boolean(value)] as const)
      .filter(([key]) => Boolean(key))

    const writeTx = getLocalDb().transaction(() => {
      getLocalDb()
        .prepare(
          `
        DELETE FROM workspace_role_permissions
        WHERE workspace_id = ? AND role = ?
      `
        )
        .run(workspaceId, role)

      const insert = getLocalDb().prepare(`
        INSERT INTO workspace_role_permissions (
          id, organization_id, workspace_id, role, permission_key,
          allowed, updated_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      for (const [permissionKey, allowed] of normalizedEntries) {
        insert.run(
          `wperm_${crypto.randomUUID()}`,
          workspaceMeta.organizationId,
          workspaceId,
          role,
          permissionKey,
          allowed ? 1 : 0,
          updatedBy,
          timestamp,
          timestamp
        )
      }
    })

    writeTx()

    const profile = this.listWorkspaceRolePermissions(workspaceId).find(
      (item) => item.role === role
    )
    if (!profile) {
      throw new Error('角色权限写入失败')
    }

    return {
      ...profile,
      permissions: normalizedEntries.reduce<Record<string, boolean>>((acc, [key, allowed]) => {
        acc[key] = allowed
        return acc
      }, {}),
      updatedBy,
      updatedAt: timestamp
    }
  }

  static mergeTimeline(
    projectId: string,
    actorName: string,
    payload: TimelineMergeInput
  ): TimelineMergeRecord {
    const projectMeta = resolveProjectMeta(projectId)
    if (!projectMeta) {
      throw new Error('项目不存在')
    }

    const id = `merge_${crypto.randomUUID()}`
    const timestamp = now()

    const conflicts = Array.isArray(payload.conflicts)
      ? (payload.conflicts
          .map((item) => {
            if (typeof item === 'string') return { message: item }
            if (!item || typeof item !== 'object' || Array.isArray(item)) return null
            return item as Record<string, unknown>
          })
          .filter(Boolean) as Array<Record<string, unknown>>)
      : []

    const result =
      payload.result && typeof payload.result === 'object' && !Array.isArray(payload.result)
        ? payload.result
        : {}

    const status: TimelineMergeRecord['status'] =
      payload.status === 'conflict' ? 'conflict' : conflicts.length > 0 ? 'conflict' : 'merged'

    getLocalDb()
      .prepare(
        `
      INSERT INTO timeline_merge_records (
        id, organization_id, workspace_id, project_id, actor_name,
        source_revision, target_revision, conflict_json, result_json, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        id,
        projectMeta.organizationId,
        projectMeta.workspaceId || null,
        projectId,
        actorName,
        String(payload.sourceRevision || ''),
        String(payload.targetRevision || ''),
        JSON.stringify(conflicts),
        JSON.stringify(result),
        status,
        timestamp
      )

    const row = getLocalDb()
      .prepare(`SELECT * FROM timeline_merge_records WHERE id = ? LIMIT 1`)
      .get(id)
    if (!row) {
      throw new Error('Timeline merge 记录创建失败')
    }

    return toTimelineMergeRecord(row)
  }
}
