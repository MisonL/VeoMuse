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
  const row = getLocalDb().prepare(`SELECT workspace_id FROM projects WHERE id = ?`).get(projectId) as { workspace_id?: string } | null
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

export class WorkspaceService {
  private static writeAudit(
    action: string,
    actorName: string,
    detail: Record<string, unknown>,
    organizationId?: string,
    workspaceId?: string,
    projectId?: string,
    traceId?: string
  ) {
    getLocalDb().prepare(`
      INSERT INTO audit_logs (id, organization_id, workspace_id, project_id, actor_name, action, detail_json, trace_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
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
    ownerUserId?: string
  ) {
    const workspaceId = `ws_${crypto.randomUUID()}`
    const projectId = `prj_${crypto.randomUUID()}`
    const ownerId = `member_${crypto.randomUUID()}`
    const createdAt = now()
    const traceId = `trace_${crypto.randomUUID()}`

    getLocalDb().prepare(`
      INSERT INTO workspaces (id, organization_id, name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(workspaceId, organizationId, name, createdAt, createdAt)

    getLocalDb().prepare(`
      INSERT INTO workspace_members (id, workspace_id, user_id, name, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(ownerId, workspaceId, ownerUserId || null, ownerName, 'owner', createdAt)

    getLocalDb().prepare(`
      INSERT INTO projects (id, organization_id, workspace_id, name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(projectId, organizationId, workspaceId, `${name} 默认项目`, createdAt, createdAt)

    this.writeAudit('workspace.created', ownerName, { workspaceId, name }, organizationId, workspaceId, projectId, traceId)

    return {
      workspace: this.getWorkspace(workspaceId),
      defaultProject: this.getProject(projectId),
      owner: this.getMembers(workspaceId).find(member => member.id === ownerId) || null
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
    return getLocalDb().prepare(`
      SELECT * FROM workspace_members WHERE workspace_id = ? ORDER BY created_at ASC
    `).all(workspaceId).map(toMember)
  }

  static getMember(workspaceId: string, name: string): WorkspaceMember | null {
    const normalizedName = name.trim()
    if (!normalizedName) return null
    const row = getLocalDb().prepare(`
      SELECT * FROM workspace_members
      WHERE workspace_id = ? AND name = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(workspaceId, normalizedName)
    return row ? toMember(row) : null
  }

  static getMemberByUserId(workspaceId: string, userId: string): WorkspaceMember | null {
    const normalizedUserId = userId.trim()
    if (!normalizedUserId) return null
    const row = getLocalDb().prepare(`
      SELECT * FROM workspace_members
      WHERE workspace_id = ? AND user_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(workspaceId, normalizedUserId)
    return row ? toMember(row) : null
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
    const row = getLocalDb().prepare(`
      SELECT id FROM projects WHERE id = ? AND workspace_id = ? LIMIT 1
    `).get(projectId, workspaceId)
    return Boolean(row)
  }

  static getDefaultProject(workspaceId: string): Project | null {
    const row = getLocalDb().prepare(`
      SELECT * FROM projects WHERE workspace_id = ? ORDER BY created_at ASC LIMIT 1
    `).get(workspaceId)
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
    getLocalDb().prepare(`
      INSERT INTO workspace_members (id, workspace_id, user_id, name, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, workspaceId, normalizedUserId, name, role, createdAt)
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

  static createInvite(workspaceId: string, role: WorkspaceRole, inviter: string, expiresInHours: number = 24) {
    const inviteId = `invite_${crypto.randomUUID()}`
    const code = generateInviteCode()
    const createdAt = now()
    const expiresAt = new Date(Date.now() + Math.max(1, expiresInHours) * 60 * 60 * 1000).toISOString()
    getLocalDb().prepare(`
      INSERT INTO workspace_invites (
        id, organization_id, workspace_id, code, role, inviter, status, expires_at, accepted_by, accepted_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(inviteId, resolveOrganizationIdByWorkspace(workspaceId), workspaceId, code, role, inviter, 'pending', expiresAt, null, null, createdAt)
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

  static acceptInvite(code: string, memberName: string, userId?: string) {
    const normalizedCode = code.trim()
    if (!normalizedCode) return null
    const normalizedUserId = userId?.trim() || null

    const tx = getLocalDb().transaction(() => {
      const row = getLocalDb().prepare(`
        SELECT * FROM workspace_invites WHERE code = ? LIMIT 1
      `).get(normalizedCode) as any
      if (!row) return null
      if (row.status !== 'pending') return null

      const nowTs = Date.now()
      if (new Date(row.expires_at).getTime() < nowTs) {
        getLocalDb().prepare(`UPDATE workspace_invites SET status = ? WHERE id = ?`).run('expired', row.id)
        return null
      }

      if (normalizedUserId) {
        const existingMember = this.getMemberByUserId(row.workspace_id, normalizedUserId)
        if (existingMember) {
          getLocalDb().prepare(`
            UPDATE workspace_invites
            SET status = ?, accepted_by = ?, accepted_at = ?
            WHERE id = ?
          `).run('accepted', existingMember.name, now(), row.id)
          const inviteRow = getLocalDb().prepare(`SELECT * FROM workspace_invites WHERE id = ?`).get(row.id)
          return {
            invite: toInvite(inviteRow),
            member: existingMember,
            workspaceId: row.workspace_id,
            role: existingMember.role
          }
        }
      }

      const memberId = `member_${crypto.randomUUID()}`
      const createdAt = now()
      getLocalDb().prepare(`
        INSERT INTO workspace_members (id, workspace_id, user_id, name, role, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(memberId, row.workspace_id, normalizedUserId, memberName, row.role, createdAt)

      getLocalDb().prepare(`
        UPDATE workspace_invites
        SET status = ?, accepted_by = ?, accepted_at = ?
        WHERE id = ?
      `).run('accepted', memberName, createdAt, row.id)

      this.writeAudit(
        'workspace.invite_accepted',
        memberName,
        { workspaceId: row.workspace_id, role: row.role, inviteCode: normalizedCode, userId: normalizedUserId },
        row.organization_id || resolveOrganizationIdByWorkspace(row.workspace_id),
        row.workspace_id
      )

      const inviteRow = getLocalDb().prepare(`SELECT * FROM workspace_invites WHERE id = ?`).get(row.id)
      const member = getLocalDb().prepare(`SELECT * FROM workspace_members WHERE id = ? LIMIT 1`).get(memberId)
      return {
        invite: toInvite(inviteRow),
        member: member ? toMember(member) : null,
        workspaceId: row.workspace_id,
        role: row.role as WorkspaceRole
      }
    })

    const result = tx()
    if (!result) return null
    return {
      invite: result.invite,
      member: result.member,
      workspace: this.getWorkspace(result.workspaceId),
      defaultProject: this.getDefaultProject(result.workspaceId)
    }
  }

  static listInvites(workspaceId: string) {
    return getLocalDb()
      .prepare(`SELECT * FROM workspace_invites WHERE workspace_id = ? ORDER BY created_at DESC`)
      .all(workspaceId)
      .map(toInvite)
  }

  static upsertPresence(workspaceId: string, sessionId: string, memberName: string, role: WorkspaceRole = 'viewer') {
    const lastSeenAt = now()
    const expiresAt = new Date(Date.now() + 30_000).toISOString()
    const organizationId = resolveOrganizationIdByWorkspace(workspaceId)
    getLocalDb().prepare(`
      INSERT INTO workspace_presence (id, organization_id, workspace_id, session_id, member_name, role, status, last_seen_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(workspace_id, session_id) DO UPDATE SET
        organization_id = excluded.organization_id,
        member_name = excluded.member_name,
        role = excluded.role,
        status = excluded.status,
        last_seen_at = excluded.last_seen_at,
        expires_at = excluded.expires_at
    `).run(
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
    getLocalDb().prepare(`DELETE FROM workspace_presence WHERE workspace_id = ? AND session_id = ?`).run(workspaceId, sessionId)
  }

  static listPresence(workspaceId: string): CollabPresence[] {
    const nowIso = now()
    getLocalDb().prepare(`DELETE FROM workspace_presence WHERE expires_at < ?`).run(nowIso)
    return getLocalDb()
      .prepare(`
        SELECT * FROM workspace_presence
        WHERE workspace_id = ? AND expires_at >= ?
        ORDER BY last_seen_at DESC
      `)
      .all(workspaceId, nowIso)
      .map(toPresence)
  }

  static getPresenceBySession(workspaceId: string, sessionId: string): CollabPresence | null {
    const normalizedWorkspaceId = workspaceId.trim()
    const normalizedSessionId = sessionId.trim()
    if (!normalizedWorkspaceId || !normalizedSessionId) return null
    const nowIso = now()
    const row = getLocalDb().prepare(`
      SELECT * FROM workspace_presence
      WHERE workspace_id = ? AND session_id = ? AND expires_at >= ?
      ORDER BY last_seen_at DESC
      LIMIT 1
    `).get(normalizedWorkspaceId, normalizedSessionId, nowIso)
    return row ? toPresence(row) : null
  }

  static createProjectSnapshot(projectId: string, actorName: string, content: Record<string, unknown>) {
    const id = `snap_${crypto.randomUUID()}`
    const createdAt = now()
    const organizationId = resolveOrganizationIdByProject(projectId)
    getLocalDb().prepare(`
      INSERT INTO project_snapshots (id, organization_id, project_id, actor_name, content_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, organizationId, projectId, actorName, JSON.stringify(content || {}), createdAt)
    const workspaceId = resolveWorkspaceIdByProject(projectId) || undefined
    this.writeAudit('project.snapshot_created', actorName, { projectId, snapshotId: id }, organizationId, workspaceId, projectId)
    const row = getLocalDb().prepare(`SELECT * FROM project_snapshots WHERE id = ?`).get(id)
    return toSnapshot(row)
  }

  static listProjectSnapshots(projectId: string, limit: number = 20): ProjectSnapshot[] {
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(100, Math.floor(limit)) : 20
    return getLocalDb()
      .prepare(`
        SELECT * FROM project_snapshots
        WHERE project_id = ?
        ORDER BY created_at DESC
        LIMIT ${safeLimit}
      `)
      .all(projectId)
      .map(toSnapshot)
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
    getLocalDb().prepare(`
      INSERT INTO collab_events (
        id, organization_id, workspace_id, project_id, actor_name, session_id, event_type, payload_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
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
      .prepare(`
        SELECT * FROM collab_events
        WHERE workspace_id = ?
        ORDER BY created_at DESC
        LIMIT ${safeLimit}
      `)
      .all(workspaceId)
      .map(toCollabEvent)
  }

  static listAuditsByProject(projectId: string): AuditLog[] {
    return getLocalDb().prepare(`
      SELECT * FROM audit_logs WHERE project_id = ? ORDER BY created_at DESC LIMIT 100
    `).all(projectId).map(toAudit)
  }

  static listWorkspaceProjects(workspaceId: string): Project[] {
    return getLocalDb().prepare(`
      SELECT * FROM projects WHERE workspace_id = ? ORDER BY created_at ASC
    `).all(workspaceId).map(toProject)
  }
}
