import { getLocalDb } from './LocalDatabaseService'

export type OrganizationRole = 'owner' | 'admin' | 'member'

export interface Organization {
  id: string
  name: string
  ownerUserId: string
  createdAt: string
  updatedAt: string
}

export interface OrganizationMember {
  id: string
  organizationId: string
  userId: string
  role: OrganizationRole
  email: string
  createdAt: string
}

const now = () => new Date().toISOString()

interface OrganizationRow {
  id: string
  name: string
  owner_user_id: string
  created_at: string
  updated_at: string
}

interface OrganizationMemberRow {
  id: string
  organization_id: string
  user_id: string
  role?: string
  email: string
  created_at: string
}

const toOrganization = (row: unknown): Organization => {
  const value = row as OrganizationRow
  return {
    id: value.id,
    name: value.name,
    ownerUserId: value.owner_user_id,
    createdAt: value.created_at,
    updatedAt: value.updated_at
  }
}

const toMember = (row: unknown): OrganizationMember => {
  const value = row as OrganizationMemberRow
  return {
    id: value.id,
    organizationId: value.organization_id,
    userId: value.user_id,
    role: value.role === 'owner' ? 'owner' : value.role === 'admin' ? 'admin' : 'member',
    email: value.email,
    createdAt: value.created_at
  }
}

const ROLE_ORDER: Record<OrganizationRole, number> = {
  member: 1,
  admin: 2,
  owner: 3
}

export class OrganizationService {
  static ensureDefaultOrganization() {
    const db = getLocalDb()
    const existing = db
      .prepare(`SELECT * FROM organizations WHERE id = 'org_default' LIMIT 1`)
      .get()
    if (existing) return toOrganization(existing)
    const createdAt = now()
    db.prepare(
      `
      INSERT INTO organizations (id, name, owner_user_id, created_at, updated_at)
      VALUES ('org_default', '默认组织', 'system', ?, ?)
    `
    ).run(createdAt, createdAt)
    return {
      id: 'org_default',
      name: '默认组织',
      ownerUserId: 'system',
      createdAt,
      updatedAt: createdAt
    }
  }

  static createOrganization(name: string, ownerUserId: string): Organization {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('组织名称不能为空')
    const createdAt = now()
    const orgId = `org_${crypto.randomUUID()}`
    const db = getLocalDb()
    db.prepare(
      `
      INSERT INTO organizations (id, name, owner_user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `
    ).run(orgId, trimmed, ownerUserId, createdAt, createdAt)
    db.prepare(
      `
      INSERT INTO organization_members (id, organization_id, user_id, role, created_at)
      VALUES (?, ?, ?, 'owner', ?)
    `
    ).run(`orgm_${crypto.randomUUID()}`, orgId, ownerUserId, createdAt)
    const row = db.prepare(`SELECT * FROM organizations WHERE id = ?`).get(orgId)
    return toOrganization(row)
  }

  static listOrganizationsForUser(userId: string): Organization[] {
    const rows = getLocalDb()
      .prepare(
        `
      SELECT o.*
      FROM organizations o
      INNER JOIN organization_members om ON om.organization_id = o.id
      WHERE om.user_id = ?
      ORDER BY o.created_at ASC
    `
      )
      .all(userId)
    return rows.map(toOrganization)
  }

  static getOrganization(orgId: string): Organization | null {
    const row = getLocalDb().prepare(`SELECT * FROM organizations WHERE id = ? LIMIT 1`).get(orgId)
    return row ? toOrganization(row) : null
  }

  static getMemberRole(organizationId: string, userId: string): OrganizationRole | null {
    const row = getLocalDb()
      .prepare(
        `
      SELECT role
      FROM organization_members
      WHERE organization_id = ? AND user_id = ?
      LIMIT 1
    `
      )
      .get(organizationId, userId) as { role?: string } | null
    if (!row?.role) return null
    return row.role === 'owner' ? 'owner' : row.role === 'admin' ? 'admin' : 'member'
  }

  static requireRole(
    organizationId: string,
    userId: string,
    role: OrganizationRole
  ): OrganizationRole {
    const actual = this.getMemberRole(organizationId, userId)
    if (!actual || ROLE_ORDER[actual] < ROLE_ORDER[role]) {
      throw new Error('无组织权限')
    }
    return actual
  }

  static listMembers(organizationId: string): OrganizationMember[] {
    const rows = getLocalDb()
      .prepare(
        `
      SELECT om.*, u.email
      FROM organization_members om
      INNER JOIN users u ON u.id = om.user_id
      WHERE om.organization_id = ?
      ORDER BY om.created_at ASC
    `
      )
      .all(organizationId)
    return rows.map(toMember)
  }

  static addMemberByEmail(
    organizationId: string,
    email: string,
    role: OrganizationRole
  ): OrganizationMember {
    const normalizedEmail = (email || '').trim().toLowerCase()
    const db = getLocalDb()
    const userRow = db
      .prepare(`SELECT id, email FROM users WHERE email = ? LIMIT 1`)
      .get(normalizedEmail) as { id: string; email: string } | null
    if (!userRow) throw new Error('用户不存在，请先注册')
    const existing = db
      .prepare(
        `
      SELECT * FROM organization_members
      WHERE organization_id = ? AND user_id = ?
      LIMIT 1
    `
      )
      .get(organizationId, userRow.id)
    if (existing) throw new Error('该用户已在组织内')

    const createdAt = now()
    const memberId = `orgm_${crypto.randomUUID()}`
    db.prepare(
      `
      INSERT INTO organization_members (id, organization_id, user_id, role, created_at)
      VALUES (?, ?, ?, ?, ?)
    `
    ).run(memberId, organizationId, userRow.id, role, createdAt)

    const row = db
      .prepare(
        `
      SELECT om.*, u.email
      FROM organization_members om
      INNER JOIN users u ON u.id = om.user_id
      WHERE om.id = ?
      LIMIT 1
    `
      )
      .get(memberId)
    return toMember(row)
  }
}
