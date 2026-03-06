import type { AuditLog, CollabEvent } from '@veomuse/shared'
import { getLocalDb } from '../LocalDatabaseService'
import {
  resolveOrganizationIdByWorkspace,
  toAudit,
  toCollabEvent
} from '../workspaceShared'
import { nowIso } from './contracts'

export const logWorkspaceCollabEvent = (
  workspaceId: string,
  actorName: string,
  eventType: CollabEvent['eventType'],
  payload: Record<string, unknown>,
  options?: { projectId?: string | null; sessionId?: string | null }
) => {
  const id = `ce_${crypto.randomUUID()}`
  const createdAt = nowIso()
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

export const listWorkspaceCollabEvents = (workspaceId: string, limit = 50): CollabEvent[] => {
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

export const listProjectAuditLogs = (projectId: string): AuditLog[] =>
  getLocalDb()
    .prepare(
      `
      SELECT * FROM audit_logs WHERE project_id = ? ORDER BY created_at DESC LIMIT 100
    `
    )
    .all(projectId)
    .map(toAudit)
