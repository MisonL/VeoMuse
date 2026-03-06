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

interface WorkspaceRow {
  id: string
  organization_id?: string | null
  name: string
  created_at: string
  updated_at: string
}

interface WorkspaceMemberRow {
  id: string
  workspace_id: string
  user_id?: string | null
  name: string
  role: WorkspaceRole
  created_at: string
}

interface ProjectRow {
  id: string
  organization_id?: string | null
  workspace_id: string
  name: string
  created_at: string
  updated_at: string
}

interface AuditLogRow {
  id: string
  organization_id?: string | null
  workspace_id?: string | null
  project_id?: string | null
  actor_name: string
  action: string
  detail_json?: string | null
  trace_id?: string | null
  created_at: string
}

export interface WorkspaceInviteRow {
  id: string
  organization_id?: string | null
  workspace_id: string
  code: string
  role: WorkspaceRole
  inviter: string
  status: WorkspaceInvite['status']
  expires_at: string
  accepted_by?: string | null
  accepted_at?: string | null
  created_at: string
}

interface CollabPresenceRow {
  organization_id?: string | null
  workspace_id: string
  session_id: string
  member_name: string
  role: WorkspaceRole
  status: CollabPresence['status']
  last_seen_at: string
}

interface ProjectSnapshotRow {
  id: string
  organization_id?: string | null
  project_id: string
  actor_name: string
  content_json?: string | null
  created_at: string
}

export interface ProjectCommentRow {
  id: string
  organization_id?: string | null
  project_id: string
  actor_name: string
  anchor?: string | null
  content: string
  mentions_json?: string | null
  status?: string
  resolved_by?: string | null
  resolved_at?: string | null
  created_at: string
  updated_at: string
}

interface ProjectReviewRow {
  id: string
  organization_id?: string | null
  project_id: string
  actor_name: string
  decision?: string
  summary: string
  score?: number | string | null
  created_at: string
}

interface ProjectTemplateRow {
  id: string
  organization_id?: string | null
  project_id: string
  name: string
  description?: string | null
  template_json?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
}

interface CollabEventRow {
  id: string
  organization_id?: string | null
  workspace_id: string
  project_id?: string | null
  actor_name: string
  session_id?: string | null
  event_type: CollabEvent['eventType']
  payload_json?: string | null
  created_at: string
}

export interface StableCursorPayload {
  createdAt: string
  id: string | null
}

export interface ProjectComment {
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

export interface ProjectReview {
  id: string
  organizationId: string
  projectId: string
  actorName: string
  decision: 'approved' | 'changes_requested'
  summary: string
  score: number | null
  createdAt: string
}

export interface ProjectTemplate {
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

export interface ProjectTemplateApplyReceipt {
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

export interface ProjectClipBatchOperation {
  clipId: string
  patch: Record<string, unknown>
}

export interface ProjectClipBatchUpdateReceipt {
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

export interface WorkspaceCreateResult {
  workspace: Workspace | null
  defaultProject: Project | null
  owner: WorkspaceMember | null
}

export interface WorkspaceAcceptInviteResult {
  invite: WorkspaceInvite
  member: WorkspaceMember | null
  workspace: Workspace | null
  defaultProject: Project | null
}

export const toWorkspace = (row: unknown): Workspace => {
  const value = row as WorkspaceRow
  return {
    id: value.id,
    organizationId: value.organization_id || 'org_default',
    name: value.name,
    createdAt: value.created_at,
    updatedAt: value.updated_at
  }
}

export const toMember = (row: unknown): WorkspaceMember => {
  const value = row as WorkspaceMemberRow
  return {
    id: value.id,
    workspaceId: value.workspace_id,
    userId: value.user_id || null,
    name: value.name,
    role: value.role,
    createdAt: value.created_at
  }
}

export const toProject = (row: unknown): Project => {
  const value = row as ProjectRow
  return {
    id: value.id,
    organizationId: value.organization_id || 'org_default',
    workspaceId: value.workspace_id,
    name: value.name,
    createdAt: value.created_at,
    updatedAt: value.updated_at
  }
}

export const toAudit = (row: unknown): AuditLog => {
  const value = row as AuditLogRow
  return {
    id: value.id,
    organizationId: value.organization_id || null,
    workspaceId: value.workspace_id || null,
    projectId: value.project_id || null,
    actorName: value.actor_name,
    action: value.action,
    detail: JSON.parse(value.detail_json || '{}'),
    traceId: value.trace_id || null,
    createdAt: value.created_at
  }
}

export const toInvite = (row: unknown): WorkspaceInvite => {
  const value = row as WorkspaceInviteRow
  return {
    id: value.id,
    organizationId: value.organization_id || 'org_default',
    workspaceId: value.workspace_id,
    code: value.code,
    role: value.role,
    inviter: value.inviter,
    status: value.status,
    expiresAt: value.expires_at,
    acceptedBy: value.accepted_by || null,
    acceptedAt: value.accepted_at || null,
    createdAt: value.created_at
  }
}

export const toPresence = (row: unknown): CollabPresence => {
  const value = row as CollabPresenceRow
  return {
    organizationId: value.organization_id || 'org_default',
    workspaceId: value.workspace_id,
    sessionId: value.session_id,
    memberName: value.member_name,
    role: value.role,
    status: value.status,
    lastSeenAt: value.last_seen_at
  }
}

export const toSnapshot = (row: unknown): ProjectSnapshot => {
  const value = row as ProjectSnapshotRow
  return {
    id: value.id,
    organizationId: value.organization_id || 'org_default',
    projectId: value.project_id,
    actorName: value.actor_name,
    content: JSON.parse(value.content_json || '{}'),
    createdAt: value.created_at
  }
}

export const parseStringArray = (value: string | null | undefined): string[] => {
  try {
    const parsed = JSON.parse(value || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => String(item))
  } catch {
    return []
  }
}

export const parseRecord = (value: string | null | undefined): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(value || '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, unknown>
  } catch {
    return {}
  }
}

export const encodeStableCursor = (
  createdAt: string | null | undefined,
  id: string | null | undefined
) => {
  const normalizedCreatedAt = String(createdAt || '').trim()
  if (!normalizedCreatedAt) return null
  const normalizedId = String(id || '').trim()
  if (!normalizedId) return normalizedCreatedAt
  return `${normalizedCreatedAt}|${normalizedId}`
}

export const decodeStableCursor = (
  cursor: string | null | undefined
): StableCursorPayload | null => {
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

export const toProjectComment = (row: unknown): ProjectComment => {
  const value = row as ProjectCommentRow
  return {
    id: value.id,
    organizationId: value.organization_id || 'org_default',
    projectId: value.project_id,
    actorName: value.actor_name,
    anchor: value.anchor || null,
    content: value.content,
    mentions: parseStringArray(value.mentions_json),
    status: value.status === 'resolved' ? 'resolved' : 'open',
    resolvedBy: value.resolved_by || null,
    resolvedAt: value.resolved_at || null,
    createdAt: value.created_at,
    updatedAt: value.updated_at
  }
}

export const toProjectReview = (row: unknown): ProjectReview => {
  const value = row as ProjectReviewRow
  return {
    id: value.id,
    organizationId: value.organization_id || 'org_default',
    projectId: value.project_id,
    actorName: value.actor_name,
    decision: value.decision === 'changes_requested' ? 'changes_requested' : 'approved',
    summary: value.summary,
    score: value.score === null || value.score === undefined ? null : Number(value.score),
    createdAt: value.created_at
  }
}

export const toProjectTemplate = (row: unknown): ProjectTemplate => {
  const value = row as ProjectTemplateRow
  return {
    id: value.id,
    organizationId: value.organization_id || 'org_default',
    projectId: value.project_id,
    name: value.name,
    description: value.description || '',
    template: parseRecord(value.template_json),
    createdBy: value.created_by || 'system',
    createdAt: value.created_at,
    updatedAt: value.updated_at
  }
}

export const toCollabEvent = (row: unknown): CollabEvent => {
  const value = row as CollabEventRow
  return {
    id: value.id,
    organizationId: value.organization_id || 'org_default',
    workspaceId: value.workspace_id,
    projectId: value.project_id || null,
    actorName: value.actor_name,
    sessionId: value.session_id || null,
    eventType: value.event_type,
    payload: JSON.parse(value.payload_json || '{}'),
    createdAt: value.created_at
  }
}

export const generateInviteCode = () => {
  const source = crypto.randomUUID().replace(/-/g, '')
  return source.slice(0, 10)
}

export const resolveWorkspaceIdByProject = (projectId: string): string | null => {
  const row = getLocalDb()
    .prepare(`SELECT workspace_id FROM projects WHERE id = ?`)
    .get(projectId) as { workspace_id?: string } | null
  return row?.workspace_id || null
}

export const resolveOrganizationIdByWorkspace = (workspaceId: string): string => {
  const row = getLocalDb()
    .prepare(`SELECT organization_id FROM workspaces WHERE id = ? LIMIT 1`)
    .get(workspaceId) as { organization_id?: string } | null
  return row?.organization_id || 'org_default'
}

export const resolveOrganizationIdByProject = (projectId: string): string => {
  const row = getLocalDb()
    .prepare(`SELECT organization_id FROM projects WHERE id = ? LIMIT 1`)
    .get(projectId) as { organization_id?: string } | null
  return row?.organization_id || 'org_default'
}
