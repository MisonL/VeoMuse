import fs from 'fs'
import os from 'os'
import path from 'path'
import type { Database } from 'bun:sqlite'

export const CORRUPTION_KEYWORDS = [
  'database disk image is malformed',
  'file is not a database',
  'sqlite_corrupt',
  'sqlite_notadb',
  'not a database',
  'malformed'
]

export const RECOVERY_TABLES = [
  'users',
  'organizations',
  'organization_members',
  'organization_quotas',
  'organization_usage_counters',
  'auth_refresh_tokens',
  'ai_channel_configs',
  'ai_channel_audits',
  'model_profiles',
  'model_runtime_metrics',
  'request_metrics',
  'routing_policies',
  'routing_executions',
  'policy_alert_configs',
  'policy_alert_events',
  'creative_runs',
  'creative_feedback_events',
  'storyboard_scenes',
  'workspaces',
  'workspace_members',
  'workspace_invites',
  'workspace_action_idempotency',
  'workspace_presence',
  'projects',
  'project_comments',
  'comment_replies',
  'project_reviews',
  'project_templates',
  'project_snapshots',
  'collab_events',
  'workspace_role_permissions',
  'timeline_merge_records',
  'reliability_policies',
  'rollback_drills',
  'reliability_alerts',
  'prompt_workflows',
  'prompt_workflow_runs',
  'video_generation_jobs',
  'batch_jobs',
  'batch_job_items',
  'asset_reuse_records',
  'journey_runs',
  'audit_logs'
] as const

export const nowIso = () => new Date().toISOString()
export const nowStamp = () => nowIso().replace(/[:.]/g, '-')

export const parsePositiveInt = (value: string | undefined, fallback = 0) => {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

export const resolveErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

export const logNonBlockingDatabaseWarning = (
  scope: string,
  error: unknown,
  fallback = 'unknown error'
) => {
  console.warn(`[LocalDatabaseService] ${scope}: ${resolveErrorMessage(error, fallback)}`)
}

export const resolveDbPath = () => {
  const fromEnv = process.env.VEOMUSE_DB_PATH?.trim()
  if (fromEnv) return fromEnv
  const nodeEnv = String(process.env.NODE_ENV || '')
    .trim()
    .toLowerCase()
  const isTestRuntime = nodeEnv === 'test' || process.env.VEOMUSE_TEST_RUNTIME === '1'
  if (isTestRuntime) {
    return path.join(os.tmpdir(), `veomuse-test-${process.pid}.sqlite`)
  }
  return path.resolve(process.cwd(), '../../data/veomuse.sqlite')
}

export const ensureDbDirectory = (dbPath: string) => {
  if (dbPath === ':memory:') return
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

export const isCorruptionMessage = (text: string) => {
  const value = text.toLowerCase()
  return CORRUPTION_KEYWORDS.some((keyword) => value.includes(keyword))
}

export const escapeLikePattern = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')

export const closeQuietly = (db: Database | null | undefined) => {
  if (!db) return
  try {
    db.close(false)
  } catch (error: unknown) {
    logNonBlockingDatabaseWarning('close database', error, 'close failed')
  }
}
