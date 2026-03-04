import type {
  AuditLog,
  CollabEvent,
  CollabPresence,
  Project,
  ProjectSnapshot,
  Workspace,
  WorkspaceInvite,
  WorkspaceMember,
  WorkspaceRole
} from '@veomuse/shared'
import { getLocalDb } from './LocalDatabaseService'

const now = () => new Date().toISOString()

const toWorkspace = (row: any): Workspace => ({
  id: row.id,
  organizationId: row.organization_id || 'org_default',
  name: row.name,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

const toMember = (row: any): WorkspaceMember => ({
  id: row.id,
  workspaceId: row.workspace_id,
  userId: row.user_id || null,
  name: row.name,
  role: row.role,
  createdAt: row.created_at
})

const toProject = (row: any): Project => ({
  id: row.id,
  organizationId: row.organization_id || 'org_default',
  workspaceId: row.workspace_id,
  name: row.name,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

const toAudit = (row: any): AuditLog => ({
  id: row.id,
  organizationId: row.organization_id || null,
  workspaceId: row.workspace_id || null,
  projectId: row.project_id || null,
  actorName: row.actor_name,
  action: row.action,
  detail: JSON.parse(row.detail_json || '{}'),
  traceId: row.trace_id || null,
  createdAt: row.created_at
})

const toInvite = (row: any): WorkspaceInvite => ({
  id: row.id,
  organizationId: row.organization_id || 'org_default',
  workspaceId: row.workspace_id,
  code: row.code,
  role: row.role,
  inviter: row.inviter,
  status: row.status,
  expiresAt: row.expires_at,
  acceptedBy: row.accepted_by || null,
  acceptedAt: row.accepted_at || null,
  createdAt: row.created_at
})

const toPresence = (row: any): CollabPresence => ({
  organizationId: row.organization_id || 'org_default',
  workspaceId: row.workspace_id,
  sessionId: row.session_id,
  memberName: row.member_name,
  role: row.role,
  status: row.status,
  lastSeenAt: row.last_seen_at
})

const toSnapshot = (row: any): ProjectSnapshot => ({
  id: row.id,
  organizationId: row.organization_id || 'org_default',
  projectId: row.project_id,
  actorName: row.actor_name,
  content: JSON.parse(row.content_json || '{}'),
  createdAt: row.created_at
})

const parseStringArray = (value: string | null | undefined): string[] => {
  try {
    const parsed = JSON.parse(value || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => String(item))
  } catch {
    return []
  }
}

const parseRecord = (value: string | null | undefined): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(value || '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, unknown>
  } catch {
    return {}
  }
}

interface ProjectComment {
  id: string
  organizationId: string
  projectId: string
  actorName: string
  anchor: string | null
  content: string
  mentions: string[]
  status: 'open' | 'resolved'
  resolvedBy: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
}

const toProjectComment = (row: any): ProjectComment => ({
  id: row.id,
  organizationId: row.organization_id || 'org_default',
  projectId: row.project_id,
  actorName: row.actor_name,
  anchor: row.anchor || null,
  content: row.content,
  mentions: parseStringArray(row.mentions_json),
  status: row.status === 'resolved' ? 'resolved' : 'open',
  resolvedBy: row.resolved_by || null,
  resolvedAt: row.resolved_at || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

interface ProjectReview {
  id: string
  organizationId: string
  projectId: string
  actorName: string
  decision: 'approved' | 'changes_requested'
  summary: string
  score: number | null
  createdAt: string
}

const toProjectReview = (row: any): ProjectReview => ({
  id: row.id,
  organizationId: row.organization_id || 'org_default',
  projectId: row.project_id,
  actorName: row.actor_name,
  decision: row.decision === 'changes_requested' ? 'changes_requested' : 'approved',
  summary: row.summary,
  score: row.score === null || row.score === undefined ? null : Number(row.score),
  createdAt: row.created_at
})

interface ProjectTemplate {
  id: string
  organizationId: string
  projectId: string
  name: string
  description: string
  template: Record<string, unknown>
  createdBy: string
  createdAt: string
  updatedAt: string
}

const toProjectTemplate = (row: any): ProjectTemplate => ({
  id: row.id,
  organizationId: row.organization_id || 'org_default',
  projectId: row.project_id,
  name: row.name,
  description: row.description || '',
  template: parseRecord(row.template_json),
  createdBy: row.created_by || 'system',
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

interface ProjectTemplateApplyReceipt {
  projectId: string
  templateId: string
  templateName: string
  actorName: string
  options: Record<string, unknown>
  organizationId: string
  workspaceId: string | null
  traceId: string
  appliedAt: string
}

interface ProjectClipBatchOperation {
  clipId: string
  patch: Record<string, unknown>
}

interface ProjectClipBatchUpdateReceipt {
  projectId: string
  actorName: string
  organizationId: string
  workspaceId: string | null
  requested: number
  accepted: number
  skipped: number
  rejected: number
  updated: number
  traceId: string
  processedAt: string
}

const toCollabEvent = (row: any): CollabEvent => ({
  id: row.id,
  organizationId: row.organization_id || 'org_default',
  workspaceId: row.workspace_id,
  projectId: row.project_id || null,
  actorName: row.actor_name,
  sessionId: row.session_id || null,
  eventType: row.event_type,
  payload: JSON.parse(row.payload_json || '{}'),
  createdAt: row.created_at
})

const generateInviteCode = () => {
  const source = crypto.randomUUID().replace(/-/g, '')
  return source.slice(0, 10)
}

const resolveWorkspaceIdByProject = (projectId: string): string | null => {
  const row = getLocalDb()
    .prepare(`SELECT workspace_id FROM projects WHERE id = ?`)
    .get(projectId) as { workspace_id?: string } | null
  return row?.workspace_id || null
}

const resolveOrganizationIdByWorkspace = (workspaceId: string): string => {
  const row = getLocalDb()
    .prepare(`SELECT organization_id FROM workspaces WHERE id = ? LIMIT 1`)
    .get(workspaceId) as { organization_id?: string } | null
  return row?.organization_id || 'org_default'
}

const resolveOrganizationIdByProject = (projectId: string): string => {
  const row = getLocalDb()
    .prepare(`SELECT organization_id FROM projects WHERE id = ? LIMIT 1`)
    .get(projectId) as { organization_id?: string } | null
  return row?.organization_id || 'org_default'
}

type WorkspaceActionIdempotencyAction = 'workspace.create' | 'workspace.invite.accept'

interface WorkspaceCreateResult {
  workspace: Workspace | null
  defaultProject: Project | null
  owner: WorkspaceMember | null
}

interface WorkspaceAcceptInviteResult {
  invite: WorkspaceInvite
  member: WorkspaceMember | null
  workspace: Workspace | null
  defaultProject: Project | null
}

export class WorkspaceService {
  private static isConstraintError(error: unknown) {
    const message = String((error as { message?: string } | null)?.message || '').toLowerCase()
    return message.includes('constraint') || message.includes('unique')
  }

  private static findIdempotentActionResult<T>(
    userId: string | undefined,
    action: WorkspaceActionIdempotencyAction,
    idempotencyKey: string | null | undefined
  ): T | null {
    const normalizedUserId = userId?.trim() || ''
    const normalizedIdempotencyKey = (idempotencyKey || '').trim()
    if (!normalizedUserId || !normalizedIdempotencyKey) return null
    const row = getLocalDb()
      .prepare(
        `
      SELECT response_json
      FROM workspace_action_idempotency
      WHERE user_id = ? AND action = ? AND idempotency_key = ?
      ORDER BY created_at DESC
      LIMIT 1
    `
      )
      .get(normalizedUserId, action, normalizedIdempotencyKey) as { response_json?: string } | null
    if (!row?.response_json) return null
    try {
      return JSON.parse(row.response_json) as T
    } catch {
      return null
    }
  }

  private static writeIdempotentActionResult(
    userId: string,
    action: WorkspaceActionIdempotencyAction,
    idempotencyKey: string,
    response: unknown,
    organizationId?: string | null,
    workspaceId?: string | null
  ) {
    const normalizedUserId = userId.trim()
    const normalizedIdempotencyKey = idempotencyKey.trim()
    if (!normalizedUserId || !normalizedIdempotencyKey) return
    getLocalDb()
      .prepare(
        `
      INSERT INTO workspace_action_idempotency (
        id, organization_id, workspace_id, user_id, action, idempotency_key, response_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        `ws_action_idem_${crypto.randomUUID()}`,
        (organizationId || '').trim() || 'org_default',
        (workspaceId || '').trim() || null,
        normalizedUserId,
        action,
        normalizedIdempotencyKey,
        JSON.stringify(response || null),
        now()
      )
  }

  private static writeAudit(
    action: string,
    actorName: string,
    detail: Record<string, unknown>,
    organizationId?: string,
    workspaceId?: string,
    projectId?: string,
    traceId?: string
  ) {
    getLocalDb()
      .prepare(
        `
      INSERT INTO audit_logs (id, organization_id, workspace_id, project_id, actor_name, action, detail_json, trace_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        `audit_${crypto.randomUUID()}`,
        organizationId || null,
        workspaceId || null,
        projectId || null,
        actorName,
        action,
        JSON.stringify(detail),
        traceId || null,
        now()
      )
  }

  static createWorkspace(
    name: string,
    ownerName: string = 'Owner',
    organizationId: string = 'org_default',
    ownerUserId?: string,
    idempotencyKey?: string | null
  ) {
    const normalizedOwnerUserId = ownerUserId?.trim() || ''
    const normalizedIdempotencyKey = (idempotencyKey || '').trim()
    const existing = this.findIdempotentActionResult<WorkspaceCreateResult>(
      normalizedOwnerUserId,
      'workspace.create',
      normalizedIdempotencyKey
    )
    if (existing) return existing

    const tx = getLocalDb().transaction(() => {
      const workspaceId = `ws_${crypto.randomUUID()}`
      const projectId = `prj_${crypto.randomUUID()}`
      const ownerId = `member_${crypto.randomUUID()}`
      const createdAt = now()
      const traceId = `trace_${crypto.randomUUID()}`

      getLocalDb()
        .prepare(
          `
        INSERT INTO workspaces (id, organization_id, name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `
        )
        .run(workspaceId, organizationId, name, createdAt, createdAt)

      getLocalDb()
        .prepare(
          `
        INSERT INTO workspace_members (id, workspace_id, user_id, name, role, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `
        )
        .run(ownerId, workspaceId, normalizedOwnerUserId || null, ownerName, 'owner', createdAt)

      getLocalDb()
        .prepare(
          `
        INSERT INTO projects (id, organization_id, workspace_id, name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `
        )
        .run(projectId, organizationId, workspaceId, `${name} 默认项目`, createdAt, createdAt)

      this.writeAudit(
        'workspace.created',
        ownerName,
        { workspaceId, name },
        organizationId,
        workspaceId,
        projectId,
        traceId
      )

      const result: WorkspaceCreateResult = {
        workspace: this.getWorkspace(workspaceId),
        defaultProject: this.getProject(projectId),
        owner: this.getMembers(workspaceId).find((member) => member.id === ownerId) || null
      }

      if (normalizedOwnerUserId && normalizedIdempotencyKey) {
        this.writeIdempotentActionResult(
          normalizedOwnerUserId,
          'workspace.create',
          normalizedIdempotencyKey,
          result,
          organizationId,
          workspaceId
        )
      }

      return result
    })

    try {
      return tx()
    } catch (error) {
      if (this.isConstraintError(error)) {
        const duplicated = this.findIdempotentActionResult<WorkspaceCreateResult>(
          normalizedOwnerUserId,
          'workspace.create',
          normalizedIdempotencyKey
        )
        if (duplicated) return duplicated
      }
      throw error
    }
  }

  static getWorkspace(workspaceId: string): Workspace | null {
    const row = getLocalDb().prepare(`SELECT * FROM workspaces WHERE id = ?`).get(workspaceId)
    return row ? toWorkspace(row) : null
  }

  static getProject(projectId: string): Project | null {
    const row = getLocalDb().prepare(`SELECT * FROM projects WHERE id = ?`).get(projectId)
    return row ? toProject(row) : null
  }

  static getMembers(workspaceId: string): WorkspaceMember[] {
    return getLocalDb()
      .prepare(
        `
      SELECT * FROM workspace_members WHERE workspace_id = ? ORDER BY created_at ASC
    `
      )
      .all(workspaceId)
      .map(toMember)
  }

  static getMember(workspaceId: string, name: string): WorkspaceMember | null {
    const normalizedName = name.trim()
    if (!normalizedName) return null
    const row = getLocalDb()
      .prepare(
        `
      SELECT * FROM workspace_members
      WHERE workspace_id = ? AND name = ?
      ORDER BY created_at DESC
      LIMIT 1
    `
      )
      .get(workspaceId, normalizedName)
    return row ? toMember(row) : null
  }

  static getMemberByUserId(workspaceId: string, userId: string): WorkspaceMember | null {
    const normalizedUserId = userId.trim()
    if (!normalizedUserId) return null
    const row = getLocalDb()
      .prepare(
        `
      SELECT * FROM workspace_members
      WHERE workspace_id = ? AND user_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `
      )
      .get(workspaceId, normalizedUserId)
    return row ? toMember(row) : null
  }

  static listWorkspaceIdsByUser(organizationId: string, userId: string): string[] {
    const normalizedOrganizationId = organizationId.trim()
    const normalizedUserId = userId.trim()
    if (!normalizedOrganizationId || !normalizedUserId) return []
    const rows = getLocalDb()
      .prepare(
        `
      SELECT DISTINCT wm.workspace_id
      FROM workspace_members wm
      INNER JOIN workspaces ws ON ws.id = wm.workspace_id
      WHERE wm.user_id = ? AND ws.organization_id = ?
      ORDER BY wm.workspace_id ASC
    `
      )
      .all(normalizedUserId, normalizedOrganizationId) as Array<{ workspace_id?: string }>
    return rows.map((row) => String(row.workspace_id || '').trim()).filter(Boolean)
  }

  static getMemberRole(workspaceId: string, name: string): WorkspaceRole | null {
    return this.getMember(workspaceId, name)?.role || null
  }

  static getMemberRoleByUserId(workspaceId: string, userId: string): WorkspaceRole | null {
    return this.getMemberByUserId(workspaceId, userId)?.role || null
  }

  static resolveActorNameByUserId(workspaceId: string, userId: string): string | null {
    return this.getMemberByUserId(workspaceId, userId)?.name || null
  }

  static isMember(workspaceId: string, name: string): boolean {
    return Boolean(this.getMember(workspaceId, name))
  }

  static isMemberByUserId(workspaceId: string, userId: string): boolean {
    return Boolean(this.getMemberByUserId(workspaceId, userId))
  }

  static projectBelongsToWorkspace(workspaceId: string, projectId: string): boolean {
    const row = getLocalDb()
      .prepare(
        `
      SELECT id FROM projects WHERE id = ? AND workspace_id = ? LIMIT 1
    `
      )
      .get(projectId, workspaceId)
    return Boolean(row)
  }

  static getDefaultProject(workspaceId: string): Project | null {
    const row = getLocalDb()
      .prepare(
        `
      SELECT * FROM projects WHERE workspace_id = ? ORDER BY created_at ASC LIMIT 1
    `
      )
      .get(workspaceId)
    return row ? toProject(row) : null
  }

  static addMember(
    workspaceId: string,
    name: string,
    role: WorkspaceRole,
    actorName: string,
    userId?: string
  ) {
    const id = `member_${crypto.randomUUID()}`
    const createdAt = now()
    const traceId = `trace_${crypto.randomUUID()}`
    const normalizedUserId = userId?.trim() || null
    if (normalizedUserId) {
      const existing = this.getMemberByUserId(workspaceId, normalizedUserId)
      if (existing) {
        throw new Error('该用户已是工作区成员')
      }
    }
    getLocalDb()
      .prepare(
        `
      INSERT INTO workspace_members (id, workspace_id, user_id, name, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `
      )
      .run(id, workspaceId, normalizedUserId, name, role, createdAt)
    this.writeAudit(
      'workspace.member_added',
      actorName,
      { workspaceId, memberName: name, role },
      resolveOrganizationIdByWorkspace(workspaceId),
      workspaceId,
      undefined,
      traceId
    )
    return this.getMembers(workspaceId)
  }

  static createInvite(
    workspaceId: string,
    role: WorkspaceRole,
    inviter: string,
    expiresInHours: number = 24
  ) {
    const inviteId = `invite_${crypto.randomUUID()}`
    const code = generateInviteCode()
    const createdAt = now()
    const expiresAt = new Date(
      Date.now() + Math.max(1, expiresInHours) * 60 * 60 * 1000
    ).toISOString()
    getLocalDb()
      .prepare(
        `
      INSERT INTO workspace_invites (
        id, organization_id, workspace_id, code, role, inviter, status, expires_at, accepted_by, accepted_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        inviteId,
        resolveOrganizationIdByWorkspace(workspaceId),
        workspaceId,
        code,
        role,
        inviter,
        'pending',
        expiresAt,
        null,
        null,
        createdAt
      )
    this.writeAudit(
      'workspace.invite_created',
      inviter,
      { workspaceId, role, code },
      resolveOrganizationIdByWorkspace(workspaceId),
      workspaceId
    )
    const row = getLocalDb().prepare(`SELECT * FROM workspace_invites WHERE id = ?`).get(inviteId)
    return toInvite(row)
  }

  static acceptInvite(
    code: string,
    memberName: string,
    userId?: string,
    idempotencyKey?: string | null
  ) {
    const normalizedCode = code.trim()
    if (!normalizedCode) return null
    const normalizedUserId = userId?.trim() || null
    const normalizedIdempotencyKey = (idempotencyKey || '').trim()
    const existing = this.findIdempotentActionResult<WorkspaceAcceptInviteResult>(
      normalizedUserId || undefined,
      'workspace.invite.accept',
      normalizedIdempotencyKey
    )
    if (existing) return existing

    const tx = getLocalDb().transaction((): WorkspaceAcceptInviteResult | null => {
      const row = getLocalDb()
        .prepare(
          `
        SELECT * FROM workspace_invites WHERE code = ? LIMIT 1
      `
        )
        .get(normalizedCode) as any
      if (!row) return null
      if (row.status !== 'pending') return null

      const nowTs = Date.now()
      if (new Date(row.expires_at).getTime() < nowTs) {
        getLocalDb()
          .prepare(`UPDATE workspace_invites SET status = ? WHERE id = ?`)
          .run('expired', row.id)
        return null
      }

      if (normalizedUserId) {
        const existingMember = this.getMemberByUserId(row.workspace_id, normalizedUserId)
        if (existingMember) {
          getLocalDb()
            .prepare(
              `
            UPDATE workspace_invites
            SET status = ?, accepted_by = ?, accepted_at = ?
            WHERE id = ?
          `
            )
            .run('accepted', existingMember.name, now(), row.id)
          const inviteRow = getLocalDb()
            .prepare(`SELECT * FROM workspace_invites WHERE id = ?`)
            .get(row.id)
          const result: WorkspaceAcceptInviteResult = {
            invite: toInvite(inviteRow),
            member: existingMember,
            workspace: this.getWorkspace(row.workspace_id),
            defaultProject: this.getDefaultProject(row.workspace_id)
          }
          if (normalizedUserId && normalizedIdempotencyKey) {
            this.writeIdempotentActionResult(
              normalizedUserId,
              'workspace.invite.accept',
              normalizedIdempotencyKey,
              result,
              row.organization_id || resolveOrganizationIdByWorkspace(row.workspace_id),
              row.workspace_id
            )
          }
          return result
        }
      }

      const memberId = `member_${crypto.randomUUID()}`
      const createdAt = now()
      getLocalDb()
        .prepare(
          `
        INSERT INTO workspace_members (id, workspace_id, user_id, name, role, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `
        )
        .run(memberId, row.workspace_id, normalizedUserId, memberName, row.role, createdAt)

      getLocalDb()
        .prepare(
          `
        UPDATE workspace_invites
        SET status = ?, accepted_by = ?, accepted_at = ?
        WHERE id = ?
      `
        )
        .run('accepted', memberName, createdAt, row.id)

      this.writeAudit(
        'workspace.invite_accepted',
        memberName,
        {
          workspaceId: row.workspace_id,
          role: row.role,
          inviteCode: normalizedCode,
          userId: normalizedUserId
        },
        row.organization_id || resolveOrganizationIdByWorkspace(row.workspace_id),
        row.workspace_id
      )

      const inviteRow = getLocalDb()
        .prepare(`SELECT * FROM workspace_invites WHERE id = ?`)
        .get(row.id)
      const member = getLocalDb()
        .prepare(`SELECT * FROM workspace_members WHERE id = ? LIMIT 1`)
        .get(memberId)
      const result: WorkspaceAcceptInviteResult = {
        invite: toInvite(inviteRow),
        member: member ? toMember(member) : null,
        workspace: this.getWorkspace(row.workspace_id),
        defaultProject: this.getDefaultProject(row.workspace_id)
      }

      if (normalizedUserId && normalizedIdempotencyKey) {
        this.writeIdempotentActionResult(
          normalizedUserId,
          'workspace.invite.accept',
          normalizedIdempotencyKey,
          result,
          row.organization_id || resolveOrganizationIdByWorkspace(row.workspace_id),
          row.workspace_id
        )
      }

      return result
    })

    try {
      const result = tx()
      if (!result) {
        const duplicated = this.findIdempotentActionResult<WorkspaceAcceptInviteResult>(
          normalizedUserId || undefined,
          'workspace.invite.accept',
          normalizedIdempotencyKey
        )
        if (duplicated) return duplicated
        return null
      }
      return result
    } catch (error) {
      if (this.isConstraintError(error)) {
        const duplicated = this.findIdempotentActionResult<WorkspaceAcceptInviteResult>(
          normalizedUserId || undefined,
          'workspace.invite.accept',
          normalizedIdempotencyKey
        )
        if (duplicated) return duplicated
      }
      throw error
    }
  }

  static listInvites(workspaceId: string) {
    return getLocalDb()
      .prepare(`SELECT * FROM workspace_invites WHERE workspace_id = ? ORDER BY created_at DESC`)
      .all(workspaceId)
      .map(toInvite)
  }

  static upsertPresence(
    workspaceId: string,
    sessionId: string,
    memberName: string,
    role: WorkspaceRole = 'viewer'
  ) {
    const lastSeenAt = now()
    const expiresAt = new Date(Date.now() + 30_000).toISOString()
    const organizationId = resolveOrganizationIdByWorkspace(workspaceId)
    getLocalDb()
      .prepare(
        `
      INSERT INTO workspace_presence (id, organization_id, workspace_id, session_id, member_name, role, status, last_seen_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(workspace_id, session_id) DO UPDATE SET
        organization_id = excluded.organization_id,
        member_name = excluded.member_name,
        role = excluded.role,
        status = excluded.status,
        last_seen_at = excluded.last_seen_at,
        expires_at = excluded.expires_at
    `
      )
      .run(
        `presence_${workspaceId}_${sessionId}`,
        organizationId,
        workspaceId,
        sessionId,
        memberName,
        role,
        'online',
        lastSeenAt,
        expiresAt
      )
  }

  static removePresence(workspaceId: string, sessionId: string) {
    getLocalDb()
      .prepare(`DELETE FROM workspace_presence WHERE workspace_id = ? AND session_id = ?`)
      .run(workspaceId, sessionId)
  }

  static listPresence(workspaceId: string): CollabPresence[] {
    const nowIso = now()
    getLocalDb().prepare(`DELETE FROM workspace_presence WHERE expires_at < ?`).run(nowIso)
    return getLocalDb()
      .prepare(
        `
        SELECT * FROM workspace_presence
        WHERE workspace_id = ? AND expires_at >= ?
        ORDER BY last_seen_at DESC
      `
      )
      .all(workspaceId, nowIso)
      .map(toPresence)
  }

  static getPresenceBySession(workspaceId: string, sessionId: string): CollabPresence | null {
    const normalizedWorkspaceId = workspaceId.trim()
    const normalizedSessionId = sessionId.trim()
    if (!normalizedWorkspaceId || !normalizedSessionId) return null
    const nowIso = now()
    const row = getLocalDb()
      .prepare(
        `
      SELECT * FROM workspace_presence
      WHERE workspace_id = ? AND session_id = ? AND expires_at >= ?
      ORDER BY last_seen_at DESC
      LIMIT 1
    `
      )
      .get(normalizedWorkspaceId, normalizedSessionId, nowIso)
    return row ? toPresence(row) : null
  }

  static createProjectSnapshot(
    projectId: string,
    actorName: string,
    content: Record<string, unknown>
  ) {
    const id = `snap_${crypto.randomUUID()}`
    const createdAt = now()
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
    this.writeAudit(
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

  static listProjectSnapshots(projectId: string, limit: number = 20): ProjectSnapshot[] {
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

  static listProjectComments(
    projectId: string,
    cursor?: string,
    limit: number = 20
  ): ProjectComment[] {
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(100, Math.floor(limit)) : 20
    const normalizedCursor = (cursor || '').trim()
    if (!normalizedCursor) {
      return getLocalDb()
        .prepare(
          `
          SELECT * FROM project_comments
          WHERE project_id = ?
          ORDER BY created_at DESC
          LIMIT ${safeLimit}
        `
        )
        .all(projectId)
        .map(toProjectComment)
    }
    return getLocalDb()
      .prepare(
        `
        SELECT * FROM project_comments
        WHERE project_id = ? AND created_at < ?
        ORDER BY created_at DESC
        LIMIT ${safeLimit}
      `
      )
      .all(projectId, normalizedCursor)
      .map(toProjectComment)
  }

  static createProjectComment(
    projectId: string,
    actorName: string,
    payload: { anchor?: string; content: string; mentions?: string[] }
  ): ProjectComment {
    const id = `pc_${crypto.randomUUID()}`
    const createdAt = now()
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
    this.writeAudit(
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

  static resolveProjectComment(
    projectId: string,
    commentId: string,
    actorName: string
  ): ProjectComment | null {
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
      const resolvedAt = now()
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
      this.writeAudit(
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

  static listProjectReviews(projectId: string, limit: number = 20): ProjectReview[] {
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

  static createProjectReview(
    projectId: string,
    actorName: string,
    payload: { decision: 'approved' | 'changes_requested'; summary: string; score?: number }
  ): ProjectReview {
    const decision = payload?.decision === 'changes_requested' ? 'changes_requested' : 'approved'
    const summary = String(payload?.summary || '').trim()
    if (!summary) {
      throw new Error('评审摘要不能为空')
    }
    const score = Number.isFinite(payload?.score) ? Number(payload?.score) : null
    const id = `prv_${crypto.randomUUID()}`
    const createdAt = now()
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
    this.writeAudit(
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

  static listProjectTemplates(projectId: string): ProjectTemplate[] {
    return getLocalDb()
      .prepare(
        `
        SELECT * FROM project_templates
        WHERE project_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `
      )
      .all(projectId)
      .map(toProjectTemplate)
  }

  static applyProjectTemplate(
    projectId: string,
    actorName: string,
    templateId: string,
    options?: Record<string, unknown>
  ): ProjectTemplateApplyReceipt | null {
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
    const appliedAt = now()
    const traceId = `trace_${crypto.randomUUID()}`
    this.writeAudit(
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

  static batchUpdateProjectClips(
    projectId: string,
    actorName: string,
    operations: Array<{ clipId: string; patch: Record<string, unknown> }>
  ): ProjectClipBatchUpdateReceipt {
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
    const processedAt = now()
    this.writeAudit(
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

  static logCollabEvent(
    workspaceId: string,
    actorName: string,
    eventType: CollabEvent['eventType'],
    payload: Record<string, unknown>,
    options?: { projectId?: string | null; sessionId?: string | null }
  ) {
    const id = `ce_${crypto.randomUUID()}`
    const createdAt = now()
    const organizationId = resolveOrganizationIdByWorkspace(workspaceId)
    getLocalDb()
      .prepare(
        `
      INSERT INTO collab_events (
        id, organization_id, workspace_id, project_id, actor_name, session_id, event_type, payload_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        id,
        organizationId,
        workspaceId,
        options?.projectId || null,
        actorName,
        options?.sessionId || null,
        eventType,
        JSON.stringify(payload || {}),
        createdAt
      )
    const row = getLocalDb().prepare(`SELECT * FROM collab_events WHERE id = ?`).get(id)
    return toCollabEvent(row)
  }

  static listCollabEvents(workspaceId: string, limit: number = 50): CollabEvent[] {
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(200, Math.floor(limit)) : 50
    return getLocalDb()
      .prepare(
        `
        SELECT * FROM collab_events
        WHERE workspace_id = ?
        ORDER BY created_at DESC
        LIMIT ${safeLimit}
      `
      )
      .all(workspaceId)
      .map(toCollabEvent)
  }

  static listAuditsByProject(projectId: string): AuditLog[] {
    return getLocalDb()
      .prepare(
        `
      SELECT * FROM audit_logs WHERE project_id = ? ORDER BY created_at DESC LIMIT 100
    `
      )
      .all(projectId)
      .map(toAudit)
  }

  static createProject(workspaceId: string, name: string, actorName: string): Project | null {
    const normalizedWorkspaceId = workspaceId.trim()
    const normalizedName = name.trim()
    if (!normalizedWorkspaceId) {
      throw new Error('工作区 ID 不能为空')
    }
    if (!normalizedName) {
      throw new Error('项目名称不能为空')
    }

    const workspace = this.getWorkspace(normalizedWorkspaceId)
    if (!workspace) {
      throw new Error('Workspace not found')
    }

    const projectId = `prj_${crypto.randomUUID()}`
    const createdAt = now()
    const traceId = `trace_${crypto.randomUUID()}`

    getLocalDb()
      .prepare(
        `
      INSERT INTO projects (id, organization_id, workspace_id, name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        projectId,
        workspace.organizationId || resolveOrganizationIdByWorkspace(normalizedWorkspaceId),
        normalizedWorkspaceId,
        normalizedName,
        createdAt,
        createdAt
      )

    this.writeAudit(
      'project.created',
      actorName,
      { workspaceId: normalizedWorkspaceId, projectId, name: normalizedName },
      workspace.organizationId || resolveOrganizationIdByWorkspace(normalizedWorkspaceId),
      normalizedWorkspaceId,
      projectId,
      traceId
    )

    return this.getProject(projectId)
  }

  static listWorkspaceProjects(workspaceId: string): Project[] {
    return getLocalDb()
      .prepare(
        `
      SELECT * FROM projects WHERE workspace_id = ? ORDER BY created_at ASC
    `
      )
      .all(workspaceId)
      .map(toProject)
  }
}
