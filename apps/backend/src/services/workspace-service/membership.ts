import type {
  CollabPresence,
  WorkspaceInvite,
  WorkspaceMember,
  WorkspaceRole
} from '@veomuse/shared'
import { getLocalDb } from '../LocalDatabaseService'
import {
  generateInviteCode,
  resolveOrganizationIdByWorkspace,
  toInvite,
  toMember,
  toPresence,
  type WorkspaceAcceptInviteResult,
  type WorkspaceInviteRow
} from '../workspaceShared'
import type {
  FindIdempotentActionResultFn,
  IsConstraintErrorFn,
  WriteAuditFn,
  WriteIdempotentActionResultFn
} from './contracts'
import { nowIso } from './contracts'
import {
  getDefaultProjectForWorkspace,
  getMemberByUserIdForWorkspace,
  getWorkspaceById,
  listMembersByWorkspaceId
} from './core'

export const addWorkspaceMember = (
  workspaceId: string,
  name: string,
  role: WorkspaceRole,
  actorName: string,
  writeAudit: WriteAuditFn,
  userId?: string
): WorkspaceMember[] => {
  const id = `member_${crypto.randomUUID()}`
  const createdAt = nowIso()
  const traceId = `trace_${crypto.randomUUID()}`
  const normalizedUserId = userId?.trim() || null
  if (normalizedUserId) {
    const existing = getMemberByUserIdForWorkspace(workspaceId, normalizedUserId)
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
  writeAudit(
    'workspace.member_added',
    actorName,
    { workspaceId, memberName: name, role },
    resolveOrganizationIdByWorkspace(workspaceId),
    workspaceId,
    undefined,
    traceId
  )
  return listMembersByWorkspaceId(workspaceId)
}

export const createWorkspaceInvite = (
  workspaceId: string,
  role: WorkspaceRole,
  inviter: string,
  writeAudit: WriteAuditFn,
  expiresInHours = 24
): WorkspaceInvite => {
  const inviteId = `invite_${crypto.randomUUID()}`
  const code = generateInviteCode()
  const createdAt = nowIso()
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
  writeAudit(
    'workspace.invite_created',
    inviter,
    { workspaceId, role, code },
    resolveOrganizationIdByWorkspace(workspaceId),
    workspaceId
  )
  const row = getLocalDb().prepare(`SELECT * FROM workspace_invites WHERE id = ?`).get(inviteId)
  return toInvite(row)
}

interface AcceptInviteOptions {
  code: string
  memberName: string
  writeAudit: WriteAuditFn
  findIdempotentActionResult: FindIdempotentActionResultFn
  writeIdempotentActionResult: WriteIdempotentActionResultFn
  isConstraintError: IsConstraintErrorFn
  userId?: string
  idempotencyKey?: string | null
}

export const acceptWorkspaceInvite = ({
  code,
  memberName,
  writeAudit,
  findIdempotentActionResult,
  writeIdempotentActionResult,
  isConstraintError,
  userId,
  idempotencyKey
}: AcceptInviteOptions): WorkspaceAcceptInviteResult | null => {
  const normalizedCode = code.trim()
  if (!normalizedCode) return null
  const normalizedUserId = userId?.trim() || null
  const normalizedIdempotencyKey = (idempotencyKey || '').trim()
  const existing = findIdempotentActionResult<WorkspaceAcceptInviteResult>(
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
      .get(normalizedCode) as WorkspaceInviteRow | null
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
      const existingMember = getMemberByUserIdForWorkspace(row.workspace_id, normalizedUserId)
      if (existingMember) {
        getLocalDb()
          .prepare(
            `
            UPDATE workspace_invites
            SET status = ?, accepted_by = ?, accepted_at = ?
            WHERE id = ?
          `
          )
          .run('accepted', existingMember.name, nowIso(), row.id)
        const inviteRow = getLocalDb()
          .prepare(`SELECT * FROM workspace_invites WHERE id = ?`)
          .get(row.id)
        const result: WorkspaceAcceptInviteResult = {
          invite: toInvite(inviteRow),
          member: existingMember,
          workspace: getWorkspaceById(row.workspace_id),
          defaultProject: getDefaultProjectForWorkspace(row.workspace_id)
        }
        if (normalizedUserId && normalizedIdempotencyKey) {
          writeIdempotentActionResult(
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
    const createdAt = nowIso()
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

    writeAudit(
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
      workspace: getWorkspaceById(row.workspace_id),
      defaultProject: getDefaultProjectForWorkspace(row.workspace_id)
    }

    if (normalizedUserId && normalizedIdempotencyKey) {
      writeIdempotentActionResult(
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
      const duplicated = findIdempotentActionResult<WorkspaceAcceptInviteResult>(
        normalizedUserId || undefined,
        'workspace.invite.accept',
        normalizedIdempotencyKey
      )
      if (duplicated) return duplicated
      return null
    }
    return result
  } catch (error) {
    if (isConstraintError(error)) {
      const duplicated = findIdempotentActionResult<WorkspaceAcceptInviteResult>(
        normalizedUserId || undefined,
        'workspace.invite.accept',
        normalizedIdempotencyKey
      )
      if (duplicated) return duplicated
    }
    throw error
  }
}

export const listWorkspaceInvites = (workspaceId: string): WorkspaceInvite[] =>
  getLocalDb()
    .prepare(`SELECT * FROM workspace_invites WHERE workspace_id = ? ORDER BY created_at DESC`)
    .all(workspaceId)
    .map(toInvite)

export const upsertWorkspacePresence = (
  workspaceId: string,
  sessionId: string,
  memberName: string,
  role: WorkspaceRole = 'viewer'
) => {
  const lastSeenAt = nowIso()
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

export const removeWorkspacePresence = (workspaceId: string, sessionId: string) => {
  getLocalDb()
    .prepare(`DELETE FROM workspace_presence WHERE workspace_id = ? AND session_id = ?`)
    .run(workspaceId, sessionId)
}

export const listWorkspacePresence = (workspaceId: string): CollabPresence[] => {
  const currentTime = nowIso()
  getLocalDb().prepare(`DELETE FROM workspace_presence WHERE expires_at < ?`).run(currentTime)
  return getLocalDb()
    .prepare(
      `
        SELECT * FROM workspace_presence
        WHERE workspace_id = ? AND expires_at >= ?
        ORDER BY last_seen_at DESC
      `
    )
    .all(workspaceId, currentTime)
    .map(toPresence)
}

export const getWorkspacePresenceBySession = (
  workspaceId: string,
  sessionId: string
): CollabPresence | null => {
  const normalizedWorkspaceId = workspaceId.trim()
  const normalizedSessionId = sessionId.trim()
  if (!normalizedWorkspaceId || !normalizedSessionId) return null
  const currentTime = nowIso()
  const row = getLocalDb()
    .prepare(
      `
      SELECT * FROM workspace_presence
      WHERE workspace_id = ? AND session_id = ? AND expires_at >= ?
      ORDER BY last_seen_at DESC
      LIMIT 1
    `
    )
    .get(normalizedWorkspaceId, normalizedSessionId, currentTime)
  return row ? toPresence(row) : null
}
