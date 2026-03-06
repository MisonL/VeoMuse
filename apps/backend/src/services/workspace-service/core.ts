import type { Project, Workspace, WorkspaceMember } from '@veomuse/shared'
import { getLocalDb } from '../LocalDatabaseService'
import {
  resolveOrganizationIdByWorkspace,
  toMember,
  toProject,
  toWorkspace,
  type WorkspaceCreateResult
} from '../workspaceShared'
import type {
  FindIdempotentActionResultFn,
  IsConstraintErrorFn,
  WriteAuditFn,
  WriteIdempotentActionResultFn
} from './contracts'
import { nowIso } from './contracts'

export const getWorkspaceById = (workspaceId: string): Workspace | null => {
  const row = getLocalDb().prepare(`SELECT * FROM workspaces WHERE id = ?`).get(workspaceId)
  return row ? toWorkspace(row) : null
}

export const getProjectById = (projectId: string): Project | null => {
  const row = getLocalDb().prepare(`SELECT * FROM projects WHERE id = ?`).get(projectId)
  return row ? toProject(row) : null
}

export const listMembersByWorkspaceId = (workspaceId: string): WorkspaceMember[] =>
  getLocalDb()
    .prepare(
      `
      SELECT * FROM workspace_members WHERE workspace_id = ? ORDER BY created_at ASC
    `
    )
    .all(workspaceId)
    .map(toMember)

export const getMemberByName = (workspaceId: string, name: string): WorkspaceMember | null => {
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

export const getMemberByUserIdForWorkspace = (
  workspaceId: string,
  userId: string
): WorkspaceMember | null => {
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

export const listWorkspaceIdsByUserId = (organizationId: string, userId: string): string[] => {
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

export const doesProjectBelongToWorkspace = (workspaceId: string, projectId: string): boolean => {
  const row = getLocalDb()
    .prepare(
      `
      SELECT id FROM projects WHERE id = ? AND workspace_id = ? LIMIT 1
    `
    )
    .get(projectId, workspaceId)
  return Boolean(row)
}

export const getDefaultProjectForWorkspace = (workspaceId: string): Project | null => {
  const row = getLocalDb()
    .prepare(
      `
      SELECT * FROM projects WHERE workspace_id = ? ORDER BY created_at ASC LIMIT 1
    `
    )
    .get(workspaceId)
  return row ? toProject(row) : null
}

interface CreateWorkspaceOptions {
  name: string
  ownerName: string
  organizationId: string
  ownerUserId?: string
  idempotencyKey?: string | null
  findIdempotentActionResult: FindIdempotentActionResultFn
  writeIdempotentActionResult: WriteIdempotentActionResultFn
  isConstraintError: IsConstraintErrorFn
  writeAudit: WriteAuditFn
}

export const createWorkspaceRecord = ({
  name,
  ownerName,
  organizationId,
  ownerUserId,
  idempotencyKey,
  findIdempotentActionResult,
  writeIdempotentActionResult,
  isConstraintError,
  writeAudit
}: CreateWorkspaceOptions): WorkspaceCreateResult => {
  const normalizedOwnerUserId = ownerUserId?.trim() || ''
  const normalizedIdempotencyKey = (idempotencyKey || '').trim()
  const existing = findIdempotentActionResult<WorkspaceCreateResult>(
    normalizedOwnerUserId,
    'workspace.create',
    normalizedIdempotencyKey
  )
  if (existing) return existing

  const tx = getLocalDb().transaction(() => {
    const workspaceId = `ws_${crypto.randomUUID()}`
    const projectId = `prj_${crypto.randomUUID()}`
    const ownerId = `member_${crypto.randomUUID()}`
    const createdAt = nowIso()
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

    writeAudit(
      'workspace.created',
      ownerName,
      { workspaceId, name },
      organizationId,
      workspaceId,
      projectId,
      traceId
    )

    const result: WorkspaceCreateResult = {
      workspace: getWorkspaceById(workspaceId),
      defaultProject: getProjectById(projectId),
      owner: listMembersByWorkspaceId(workspaceId).find((member) => member.id === ownerId) || null
    }

    if (normalizedOwnerUserId && normalizedIdempotencyKey) {
      writeIdempotentActionResult(
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
    if (isConstraintError(error)) {
      const duplicated = findIdempotentActionResult<WorkspaceCreateResult>(
        normalizedOwnerUserId,
        'workspace.create',
        normalizedIdempotencyKey
      )
      if (duplicated) return duplicated
    }
    throw error
  }
}

export const createProjectForWorkspace = (
  workspaceId: string,
  name: string,
  actorName: string,
  writeAudit: WriteAuditFn
): Project | null => {
  const normalizedWorkspaceId = workspaceId.trim()
  const normalizedName = name.trim()
  if (!normalizedWorkspaceId) {
    throw new Error('工作区 ID 不能为空')
  }
  if (!normalizedName) {
    throw new Error('项目名称不能为空')
  }

  const workspace = getWorkspaceById(normalizedWorkspaceId)
  if (!workspace) {
    throw new Error('Workspace not found')
  }

  const projectId = `prj_${crypto.randomUUID()}`
  const createdAt = nowIso()
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

  writeAudit(
    'project.created',
    actorName,
    { workspaceId: normalizedWorkspaceId, projectId, name: normalizedName },
    workspace.organizationId || resolveOrganizationIdByWorkspace(normalizedWorkspaceId),
    normalizedWorkspaceId,
    projectId,
    traceId
  )

  return getProjectById(projectId)
}

export const listProjectsByWorkspaceId = (workspaceId: string): Project[] =>
  getLocalDb()
    .prepare(
      `
      SELECT * FROM projects WHERE workspace_id = ? ORDER BY created_at ASC
    `
    )
    .all(workspaceId)
    .map(toProject)
