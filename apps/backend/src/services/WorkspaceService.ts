import type {
  AuditLog,
  CollabEvent,
  CollabPresence,
  Project,
  ProjectSnapshot,
  Workspace,
  WorkspaceMember,
  WorkspaceRole
} from '@veomuse/shared'
import { getLocalDb } from './LocalDatabaseService'
import {
  type ProjectClipBatchUpdateReceipt,
  type ProjectComment,
  type ProjectReview,
  type ProjectTemplate,
  type ProjectTemplateApplyReceipt
} from './workspaceShared'
import {
  createProjectForWorkspace,
  createWorkspaceRecord,
  doesProjectBelongToWorkspace,
  getDefaultProjectForWorkspace,
  getMemberByName,
  getMemberByUserIdForWorkspace,
  getProjectById,
  getWorkspaceById,
  listMembersByWorkspaceId,
  listProjectsByWorkspaceId,
  listWorkspaceIdsByUserId
} from './workspace-service/core'
import {
  acceptWorkspaceInvite,
  addWorkspaceMember,
  createWorkspaceInvite,
  getWorkspacePresenceBySession,
  listWorkspaceInvites,
  listWorkspacePresence,
  removeWorkspacePresence,
  upsertWorkspacePresence
} from './workspace-service/membership'
import {
  applyProjectTemplateRecord,
  batchUpdateProjectClipsRecord,
  createProjectCommentRecord,
  createProjectReviewRecord,
  createProjectSnapshotRecord,
  listProjectCommentsByProject,
  listProjectCommentsPageByProject,
  listProjectReviewsByProject,
  listProjectSnapshotsByProject,
  listProjectTemplatesByProject,
  resolveProjectCommentRecord
} from './workspace-service/governance'
import {
  listProjectAuditLogs,
  listWorkspaceCollabEvents,
  logWorkspaceCollabEvent
} from './workspace-service/collab'
import type { WorkspaceActionIdempotencyAction } from './workspace-service/contracts'
import { nowIso } from './workspace-service/contracts'

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
        nowIso()
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
        nowIso()
      )
  }

  static createWorkspace(
    name: string,
    ownerName: string = 'Owner',
    organizationId: string = 'org_default',
    ownerUserId?: string,
    idempotencyKey?: string | null
  ) {
    return createWorkspaceRecord({
      name,
      ownerName,
      organizationId,
      ownerUserId,
      idempotencyKey,
      findIdempotentActionResult: this.findIdempotentActionResult.bind(this),
      writeIdempotentActionResult: this.writeIdempotentActionResult.bind(this),
      isConstraintError: this.isConstraintError.bind(this),
      writeAudit: this.writeAudit.bind(this)
    })
  }

  static getWorkspace(workspaceId: string): Workspace | null {
    return getWorkspaceById(workspaceId)
  }

  static getProject(projectId: string): Project | null {
    return getProjectById(projectId)
  }

  static getMembers(workspaceId: string): WorkspaceMember[] {
    return listMembersByWorkspaceId(workspaceId)
  }

  static getMember(workspaceId: string, name: string): WorkspaceMember | null {
    return getMemberByName(workspaceId, name)
  }

  static getMemberByUserId(workspaceId: string, userId: string): WorkspaceMember | null {
    return getMemberByUserIdForWorkspace(workspaceId, userId)
  }

  static listWorkspaceIdsByUser(organizationId: string, userId: string): string[] {
    return listWorkspaceIdsByUserId(organizationId, userId)
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
    return doesProjectBelongToWorkspace(workspaceId, projectId)
  }

  static getDefaultProject(workspaceId: string): Project | null {
    return getDefaultProjectForWorkspace(workspaceId)
  }

  static addMember(
    workspaceId: string,
    name: string,
    role: WorkspaceRole,
    actorName: string,
    userId?: string
  ) {
    return addWorkspaceMember(
      workspaceId,
      name,
      role,
      actorName,
      this.writeAudit.bind(this),
      userId
    )
  }

  static createInvite(
    workspaceId: string,
    role: WorkspaceRole,
    inviter: string,
    expiresInHours: number = 24
  ) {
    return createWorkspaceInvite(
      workspaceId,
      role,
      inviter,
      this.writeAudit.bind(this),
      expiresInHours
    )
  }

  static acceptInvite(
    code: string,
    memberName: string,
    userId?: string,
    idempotencyKey?: string | null
  ) {
    return acceptWorkspaceInvite({
      code,
      memberName,
      userId,
      idempotencyKey,
      writeAudit: this.writeAudit.bind(this),
      findIdempotentActionResult: this.findIdempotentActionResult.bind(this),
      writeIdempotentActionResult: this.writeIdempotentActionResult.bind(this),
      isConstraintError: this.isConstraintError.bind(this)
    })
  }

  static listInvites(workspaceId: string) {
    return listWorkspaceInvites(workspaceId)
  }

  static upsertPresence(
    workspaceId: string,
    sessionId: string,
    memberName: string,
    role: WorkspaceRole = 'viewer'
  ) {
    upsertWorkspacePresence(workspaceId, sessionId, memberName, role)
  }

  static removePresence(workspaceId: string, sessionId: string) {
    removeWorkspacePresence(workspaceId, sessionId)
  }

  static listPresence(workspaceId: string): CollabPresence[] {
    return listWorkspacePresence(workspaceId)
  }

  static getPresenceBySession(workspaceId: string, sessionId: string): CollabPresence | null {
    return getWorkspacePresenceBySession(workspaceId, sessionId)
  }

  static createProjectSnapshot(
    projectId: string,
    actorName: string,
    content: Record<string, unknown>
  ) {
    return createProjectSnapshotRecord(projectId, actorName, content, this.writeAudit.bind(this))
  }

  static listProjectSnapshots(projectId: string, limit: number = 20): ProjectSnapshot[] {
    return listProjectSnapshotsByProject(projectId, limit)
  }

  static listProjectComments(
    projectId: string,
    cursor?: string,
    limit: number = 20
  ): ProjectComment[] {
    return listProjectCommentsByProject(projectId, cursor, limit)
  }

  static listProjectCommentsPage(
    projectId: string,
    cursor?: string,
    limit: number = 20
  ): {
    comments: ProjectComment[]
    page: {
      limit: number
      hasMore: boolean
      nextCursor: string | null
    }
  } {
    return listProjectCommentsPageByProject(projectId, cursor, limit)
  }

  static createProjectComment(
    projectId: string,
    actorName: string,
    payload: { anchor?: string; content: string; mentions?: string[] }
  ): ProjectComment {
    return createProjectCommentRecord(projectId, actorName, payload, this.writeAudit.bind(this))
  }

  static resolveProjectComment(
    projectId: string,
    commentId: string,
    actorName: string
  ): ProjectComment | null {
    return resolveProjectCommentRecord(projectId, commentId, actorName, this.writeAudit.bind(this))
  }

  static listProjectReviews(projectId: string, limit: number = 20): ProjectReview[] {
    return listProjectReviewsByProject(projectId, limit)
  }

  static createProjectReview(
    projectId: string,
    actorName: string,
    payload: { decision: 'approved' | 'changes_requested'; summary: string; score?: number }
  ): ProjectReview {
    return createProjectReviewRecord(projectId, actorName, payload, this.writeAudit.bind(this))
  }

  static listProjectTemplates(projectId: string): ProjectTemplate[] {
    return listProjectTemplatesByProject(projectId)
  }

  static applyProjectTemplate(
    projectId: string,
    actorName: string,
    templateId: string,
    options?: Record<string, unknown>
  ): ProjectTemplateApplyReceipt | null {
    return applyProjectTemplateRecord(
      projectId,
      actorName,
      templateId,
      this.writeAudit.bind(this),
      options
    )
  }

  static batchUpdateProjectClips(
    projectId: string,
    actorName: string,
    operations: Array<{ clipId: string; patch: Record<string, unknown> }>
  ): ProjectClipBatchUpdateReceipt {
    return batchUpdateProjectClipsRecord(
      projectId,
      actorName,
      operations,
      this.writeAudit.bind(this)
    )
  }

  static logCollabEvent(
    workspaceId: string,
    actorName: string,
    eventType: CollabEvent['eventType'],
    payload: Record<string, unknown>,
    options?: { projectId?: string | null; sessionId?: string | null }
  ) {
    return logWorkspaceCollabEvent(workspaceId, actorName, eventType, payload, options)
  }

  static listCollabEvents(workspaceId: string, limit: number = 50): CollabEvent[] {
    return listWorkspaceCollabEvents(workspaceId, limit)
  }

  static listAuditsByProject(projectId: string): AuditLog[] {
    return listProjectAuditLogs(projectId)
  }

  static createProject(workspaceId: string, name: string, actorName: string): Project | null {
    return createProjectForWorkspace(workspaceId, name, actorName, this.writeAudit.bind(this))
  }

  static listWorkspaceProjects(workspaceId: string): Project[] {
    return listProjectsByWorkspaceId(workspaceId)
  }
}
