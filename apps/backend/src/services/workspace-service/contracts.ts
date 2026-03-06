export type WorkspaceActionIdempotencyAction = 'workspace.create' | 'workspace.invite.accept'

export type FindIdempotentActionResultFn = <T>(
  userId: string | undefined,
  action: WorkspaceActionIdempotencyAction,
  idempotencyKey: string | null | undefined
) => T | null

export type WriteIdempotentActionResultFn = (
  userId: string,
  action: WorkspaceActionIdempotencyAction,
  idempotencyKey: string,
  response: unknown,
  organizationId?: string | null,
  workspaceId?: string | null
) => void

export type IsConstraintErrorFn = (error: unknown) => boolean

export type WriteAuditFn = (
  action: string,
  actorName: string,
  detail: Record<string, unknown>,
  organizationId?: string,
  workspaceId?: string,
  projectId?: string,
  traceId?: string
) => void

export const nowIso = () => new Date().toISOString()
