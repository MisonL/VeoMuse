import fs from 'fs'
import path from 'path'
import { Database } from 'bun:sqlite'

export type DbIntegrityMode = 'quick' | 'full'
export type DbRepairCheckMode = DbIntegrityMode

export interface DbIntegrityReport {
  dbPath: string
  mode: DbIntegrityMode
  status: 'ok' | 'corrupted' | 'error'
  messages: string[]
  checkedAt: string
}

export interface DbRepairReport {
  dbPath: string
  status: 'ok' | 'repaired' | 'failed'
  repaired: boolean
  forced: boolean
  checkMode: DbRepairCheckMode
  reason: string
  timestamp: string
  actions: string[]
  before: DbIntegrityReport
  after?: DbIntegrityReport
  backupPath?: string
  quarantinePath?: string
  salvage: {
    attempted: boolean
    copiedRows: number
    tableDetails: Array<{
      table: string
      copiedRows: number
      status: 'copied' | 'skipped' | 'failed'
      reason?: string
    }>
  }
  error?: string
}

export interface DbRuntimeConfig {
  dbPath: string
  autoRepairEnabled: boolean
  runtimeHealthcheckIntervalMs: number
  runtimeHealthcheckEnabled: boolean
}

interface DbRepairHistoryQuery {
  limit?: number
  offset?: number
  from?: string
  to?: string
  status?: string
  reason?: string
}

interface DbRepairHistoryResult {
  repairs: DbRepairReport[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

const CORRUPTION_KEYWORDS = [
  'database disk image is malformed',
  'file is not a database',
  'sqlite_corrupt',
  'sqlite_notadb',
  'not a database',
  'malformed'
]

const nowIso = () => new Date().toISOString()
const nowStamp = () => nowIso().replace(/[:.]/g, '-')
const parsePositiveInt = (value: string | undefined, fallback = 0) => {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
const RECOVERY_TABLES = [
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
  'routing_policies',
  'routing_executions',
  'creative_runs',
  'creative_feedback_events',
  'storyboard_scenes',
  'workspaces',
  'workspace_members',
  'workspace_invites',
  'workspace_presence',
  'projects',
  'project_snapshots',
  'collab_events',
  'audit_logs'
] as const

const resolveDbPath = () => {
  const fromEnv = process.env.VEOMUSE_DB_PATH?.trim()
  if (fromEnv) return fromEnv
  return path.resolve(process.cwd(), '../../data/veomuse.sqlite')
}

const ensureDbDirectory = (dbPath: string) => {
  if (dbPath === ':memory:') return
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

const isCorruptionMessage = (text: string) => {
  const value = text.toLowerCase()
  return CORRUPTION_KEYWORDS.some(keyword => value.includes(keyword))
}

const escapeLikePattern = (value: string) => value
  .replace(/\\/g, '\\\\')
  .replace(/%/g, '\\%')
  .replace(/_/g, '\\_')

const readIntegrityRows = (db: Database, mode: DbIntegrityMode) => {
  const pragma = mode === 'full' ? 'integrity_check' : 'quick_check'
  const rows = db.query(`PRAGMA ${pragma};`).all() as Array<Record<string, unknown>>
  return rows
    .map((row) => String(Object.values(row)[0] ?? '').trim())
    .filter(Boolean)
}

const buildIntegrityReport = (dbPath: string, mode: DbIntegrityMode, status: DbIntegrityReport['status'], messages: string[]): DbIntegrityReport => ({
  dbPath,
  mode,
  status,
  messages,
  checkedAt: nowIso()
})

const shouldAutoRepairFromReport = (report: Pick<DbIntegrityReport, 'status' | 'messages'>) => (
  report.status === 'corrupted' ||
  report.messages.some(isCorruptionMessage)
)

const emptySalvage = (): DbRepairReport['salvage'] => ({
  attempted: false,
  copiedRows: 0,
  tableDetails: []
})

const normalizeIntegrityReport = (
  raw: any,
  fallbackDbPath: string,
  fallbackTimestamp: string,
  defaultStatus: DbIntegrityReport['status']
): DbIntegrityReport => ({
  dbPath: String(raw?.dbPath || fallbackDbPath),
  mode: raw?.mode === 'full' ? 'full' : 'quick',
  status: raw?.status === 'corrupted' ? 'corrupted' : raw?.status === 'error' ? 'error' : defaultStatus,
  messages: Array.isArray(raw?.messages) ? raw.messages.map(String) : [],
  checkedAt: String(raw?.checkedAt || fallbackTimestamp)
})

const normalizeRepairReport = (raw: any): DbRepairReport => {
  const salvage = raw?.salvage && typeof raw.salvage === 'object'
    ? {
      attempted: Boolean(raw.salvage.attempted),
      copiedRows: Number(raw.salvage.copiedRows || 0),
      tableDetails: Array.isArray(raw.salvage.tableDetails)
        ? raw.salvage.tableDetails.map((item: any) => ({
          table: String(item?.table || 'unknown'),
          copiedRows: Number(item?.copiedRows || 0),
          status: item?.status === 'failed' ? 'failed' : item?.status === 'skipped' ? 'skipped' : 'copied',
          reason: item?.reason ? String(item.reason) : undefined
        }))
        : []
    }
    : emptySalvage()

  const fallbackDbPath = String(raw?.dbPath || '')
  const fallbackTimestamp = String(raw?.timestamp || nowIso())
  const before = raw?.before
    ? normalizeIntegrityReport(raw.before, fallbackDbPath, fallbackTimestamp, 'ok')
    : normalizeIntegrityReport(
      {
        dbPath: fallbackDbPath,
        mode: 'quick',
        status: 'error',
        messages: ['missing-before-report'],
        checkedAt: fallbackTimestamp
      },
      fallbackDbPath,
      fallbackTimestamp,
      'error'
    )

  const after = raw?.after
    ? normalizeIntegrityReport(raw.after, fallbackDbPath, fallbackTimestamp, 'ok')
    : undefined

  return {
    dbPath: String(raw?.dbPath || ''),
    status: raw?.status === 'failed' ? 'failed' : raw?.status === 'ok' ? 'ok' : 'repaired',
    repaired: Boolean(raw?.repaired),
    forced: Boolean(raw?.forced),
    checkMode: raw?.checkMode === 'quick' ? 'quick' : 'full',
    reason: String(raw?.reason || 'unknown'),
    timestamp: String(raw?.timestamp || nowIso()),
    actions: Array.isArray(raw?.actions) ? raw.actions.map(String) : [],
    before,
    after,
    backupPath: raw?.backupPath ? String(raw.backupPath) : undefined,
    quarantinePath: raw?.quarantinePath ? String(raw.quarantinePath) : undefined,
    salvage,
    error: raw?.error ? String(raw.error) : undefined
  }
}

const checkIntegrityOnDb = (db: Database, dbPath: string, mode: DbIntegrityMode): DbIntegrityReport => {
  try {
    const messages = readIntegrityRows(db, mode)
    const ok = messages.length === 1 && messages[0]?.toLowerCase() === 'ok'
    return buildIntegrityReport(dbPath, mode, ok ? 'ok' : 'corrupted', messages.length ? messages : ['No integrity output'])
  } catch (error: any) {
    return buildIntegrityReport(dbPath, mode, 'error', [error?.message || 'Integrity check failed'])
  }
}

const createDbConnection = (dbPath: string) => {
  const db = new Database(dbPath, { create: true })
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec('PRAGMA foreign_keys = ON;')
  db.exec('PRAGMA synchronous = NORMAL;')
  return db
}

const hasColumn = (db: Database, table: string, column: string) => {
  const rows = db.prepare(`PRAGMA table_info(${table});`).all() as Array<{ name: string }>
  return rows.some(row => row.name === column)
}

const ensureColumn = (db: Database, table: string, column: string, ddl: string) => {
  if (hasColumn(db, table, column)) return
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl};`)
}

const migrate = (db: Database) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS organization_members (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      created_at TEXT NOT NULL,
      FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS organization_quotas (
      organization_id TEXT PRIMARY KEY,
      request_limit INTEGER NOT NULL DEFAULT 0,
      storage_limit_bytes INTEGER NOT NULL DEFAULT 0,
      concurrency_limit INTEGER NOT NULL DEFAULT 0,
      updated_by TEXT NOT NULL DEFAULT 'system',
      updated_at TEXT NOT NULL,
      FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS organization_usage_counters (
      organization_id TEXT PRIMARY KEY,
      request_count INTEGER NOT NULL DEFAULT 0,
      storage_bytes INTEGER NOT NULL DEFAULT 0,
      last_request_at TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_channel_configs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      workspace_id TEXT,
      provider_id TEXT NOT NULL,
      base_url TEXT NOT NULL DEFAULT '',
      secret_encrypted TEXT NOT NULL DEFAULT '',
      extra_json TEXT NOT NULL DEFAULT '{}',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_channel_audits (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      workspace_id TEXT,
      actor_user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      detail_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS model_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      capabilities_json TEXT NOT NULL,
      cost_per_second REAL NOT NULL DEFAULT 0,
      max_duration_sec INTEGER NOT NULL DEFAULT 8,
      supports_4k INTEGER NOT NULL DEFAULT 0,
      supports_audio INTEGER NOT NULL DEFAULT 0,
      supports_stylization INTEGER NOT NULL DEFAULT 0,
      region TEXT NOT NULL DEFAULT 'global',
      enabled INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS model_runtime_metrics (
      model_id TEXT PRIMARY KEY,
      window_minutes INTEGER NOT NULL DEFAULT 1440,
      total_requests INTEGER NOT NULL DEFAULT 0,
      success_rate REAL NOT NULL DEFAULT 1,
      p95_latency_ms INTEGER NOT NULL DEFAULT 0,
      avg_cost_usd REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS routing_policies (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      priority TEXT NOT NULL,
      max_budget_usd REAL NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      allowed_models_json TEXT NOT NULL DEFAULT '[]',
      weights_json TEXT NOT NULL DEFAULT '{}',
      fallback_policy_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)
  ensureColumn(db, 'routing_policies', 'organization_id', `TEXT NOT NULL DEFAULT 'org_default'`)
  ensureColumn(db, 'routing_policies', 'enabled', 'INTEGER NOT NULL DEFAULT 1')
  ensureColumn(db, 'routing_policies', 'allowed_models_json', `TEXT NOT NULL DEFAULT '[]'`)
  ensureColumn(db, 'routing_policies', 'weights_json', `TEXT NOT NULL DEFAULT '{}'`)
  ensureColumn(db, 'routing_policies', 'fallback_policy_id', 'TEXT')

  db.exec(`
    CREATE TABLE IF NOT EXISTS routing_executions (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      policy_id TEXT NOT NULL,
      prompt TEXT NOT NULL,
      priority TEXT NOT NULL,
      recommended_model_id TEXT NOT NULL,
      estimated_cost_usd REAL NOT NULL DEFAULT 0,
      estimated_latency_ms INTEGER NOT NULL DEFAULT 0,
      confidence REAL NOT NULL DEFAULT 0,
      reason TEXT NOT NULL,
      candidates_json TEXT NOT NULL DEFAULT '[]',
      score_breakdown_json TEXT NOT NULL DEFAULT '[]',
      fallback_used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY(policy_id) REFERENCES routing_policies(id) ON DELETE CASCADE
    );
  `)
  ensureColumn(db, 'routing_executions', 'organization_id', `TEXT NOT NULL DEFAULT 'org_default'`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS creative_runs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      script TEXT NOT NULL,
      style TEXT NOT NULL DEFAULT 'cinematic',
      status TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      parent_run_id TEXT,
      quality_score REAL NOT NULL DEFAULT 0,
      notes_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(parent_run_id) REFERENCES creative_runs(id) ON DELETE SET NULL
    );
  `)
  ensureColumn(db, 'creative_runs', 'organization_id', `TEXT NOT NULL DEFAULT 'org_default'`)
  ensureColumn(db, 'creative_runs', 'version', 'INTEGER NOT NULL DEFAULT 1')
  ensureColumn(db, 'creative_runs', 'parent_run_id', 'TEXT')
  ensureColumn(db, 'creative_runs', 'quality_score', 'REAL NOT NULL DEFAULT 0')
  ensureColumn(db, 'creative_runs', 'notes_json', `TEXT NOT NULL DEFAULT '{}'`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS storyboard_scenes (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      run_id TEXT NOT NULL,
      order_idx INTEGER NOT NULL,
      title TEXT NOT NULL,
      video_prompt TEXT NOT NULL,
      audio_prompt TEXT NOT NULL,
      voiceover_text TEXT NOT NULL,
      duration REAL NOT NULL DEFAULT 5,
      status TEXT NOT NULL DEFAULT 'draft',
      revision INTEGER NOT NULL DEFAULT 1,
      last_feedback TEXT NOT NULL DEFAULT '',
      generation_meta_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(run_id) REFERENCES creative_runs(id) ON DELETE CASCADE
    );
  `)
  ensureColumn(db, 'storyboard_scenes', 'organization_id', `TEXT NOT NULL DEFAULT 'org_default'`)
  ensureColumn(db, 'storyboard_scenes', 'revision', 'INTEGER NOT NULL DEFAULT 1')
  ensureColumn(db, 'storyboard_scenes', 'last_feedback', `TEXT NOT NULL DEFAULT ''`)
  ensureColumn(db, 'storyboard_scenes', 'generation_meta_json', `TEXT NOT NULL DEFAULT '{}'`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS creative_feedback_events (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      run_id TEXT NOT NULL,
      scene_id TEXT,
      scope TEXT NOT NULL,
      feedback_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(run_id) REFERENCES creative_runs(id) ON DELETE CASCADE
    );
  `)
  ensureColumn(db, 'creative_feedback_events', 'organization_id', `TEXT NOT NULL DEFAULT 'org_default'`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)
  ensureColumn(db, 'workspaces', 'organization_id', `TEXT NOT NULL DEFAULT 'org_default'`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS workspace_members (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      user_id TEXT,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );
  `)
  ensureColumn(db, 'workspace_members', 'user_id', 'TEXT')

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );
  `)
  ensureColumn(db, 'projects', 'organization_id', `TEXT NOT NULL DEFAULT 'org_default'`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      workspace_id TEXT,
      project_id TEXT,
      actor_name TEXT NOT NULL,
      action TEXT NOT NULL,
      detail_json TEXT NOT NULL,
      trace_id TEXT,
      created_at TEXT NOT NULL
    );
  `)
  ensureColumn(db, 'audit_logs', 'organization_id', 'TEXT')
  ensureColumn(db, 'audit_logs', 'trace_id', 'TEXT')

  db.exec(`
    CREATE TABLE IF NOT EXISTS workspace_invites (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      workspace_id TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      inviter TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      expires_at TEXT NOT NULL,
      accepted_by TEXT,
      accepted_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );
  `)
  ensureColumn(db, 'workspace_invites', 'organization_id', `TEXT NOT NULL DEFAULT 'org_default'`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS workspace_presence (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      workspace_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      member_name TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );
  `)
  ensureColumn(db, 'workspace_presence', 'organization_id', `TEXT NOT NULL DEFAULT 'org_default'`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS project_snapshots (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      project_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      content_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `)
  ensureColumn(db, 'project_snapshots', 'organization_id', `TEXT NOT NULL DEFAULT 'org_default'`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS collab_events (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'org_default',
      workspace_id TEXT NOT NULL,
      project_id TEXT,
      actor_name TEXT NOT NULL,
      session_id TEXT,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );
  `)
  ensureColumn(db, 'collab_events', 'organization_id', `TEXT NOT NULL DEFAULT 'org_default'`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS db_repair_logs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      reason TEXT NOT NULL,
      forced INTEGER NOT NULL DEFAULT 0,
      repaired INTEGER NOT NULL DEFAULT 0,
      db_path TEXT NOT NULL,
      copied_rows INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      report_json TEXT NOT NULL
    );
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_db_repair_logs_created_at
    ON db_repair_logs(created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_db_repair_logs_status
    ON db_repair_logs(status);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_db_repair_logs_reason
    ON db_repair_logs(reason);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_routing_executions_policy_created
    ON routing_executions(policy_id, created_at DESC);
  `)

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_members_unique_user
    ON organization_members(organization_id, user_id);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_organization_members_user
    ON organization_members(user_id, created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_organization_quotas_updated
    ON organization_quotas(updated_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_organization_usage_updated
    ON organization_usage_counters(updated_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_user
    ON auth_refresh_tokens(user_id, created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_expires
    ON auth_refresh_tokens(expires_at DESC);
  `)

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_channel_configs_unique_scope
    ON ai_channel_configs(organization_id, IFNULL(workspace_id, ''), provider_id);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ai_channel_configs_org_provider
    ON ai_channel_configs(organization_id, provider_id, workspace_id);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ai_channel_audits_org_created
    ON ai_channel_audits(organization_id, created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_creative_feedback_events_run_created
    ON creative_feedback_events(run_id, created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace_status
    ON workspace_invites(workspace_id, status, created_at DESC);
  `)

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_presence_unique_session
    ON workspace_presence(workspace_id, session_id);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_user
    ON workspace_members(workspace_id, user_id, created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_name
    ON workspace_members(workspace_id, name, created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_workspace_presence_workspace_expires
    ON workspace_presence(workspace_id, expires_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_project_snapshots_project_created
    ON project_snapshots(project_id, created_at DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_collab_events_workspace_created
    ON collab_events(workspace_id, created_at DESC);
  `)

  db.exec(`
    INSERT OR IGNORE INTO organizations (id, name, owner_user_id, created_at, updated_at)
    VALUES ('org_default', '默认组织', 'system', datetime('now'), datetime('now'));
  `)
}

const closeQuietly = (db: Database | null | undefined) => {
  if (!db) return
  try {
    db.close(false)
  } catch {
    // noop
  }
}

const quarantineCorruptedFiles = (dbPath: string) => {
  if (dbPath === ':memory:') return undefined
  if (!fs.existsSync(dbPath)) return undefined

  const ext = path.extname(dbPath) || '.sqlite'
  const base = ext ? dbPath.slice(0, -ext.length) : dbPath
  const quarantinePath = `${base}.corrupt-${nowStamp()}${ext}`
  fs.renameSync(dbPath, quarantinePath)

  for (const suffix of ['-wal', '-shm']) {
    const source = `${dbPath}${suffix}`
    const target = `${quarantinePath}${suffix}`
    if (fs.existsSync(source)) fs.renameSync(source, target)
  }

  return quarantinePath
}

const backupDatabaseFile = (dbPath: string) => {
  if (dbPath === ':memory:') return undefined
  if (!fs.existsSync(dbPath)) return undefined
  const ext = path.extname(dbPath) || '.sqlite'
  const base = ext ? dbPath.slice(0, -ext.length) : dbPath
  const backupPath = `${base}.backup-${nowStamp()}${ext}`
  fs.copyFileSync(dbPath, backupPath)
  for (const suffix of ['-wal', '-shm']) {
    const source = `${dbPath}${suffix}`
    const target = `${backupPath}${suffix}`
    if (fs.existsSync(source)) fs.copyFileSync(source, target)
  }
  return backupPath
}

const salvageFromBackup = (db: Database, backupPath: string | undefined) => {
  const summary: DbRepairReport['salvage'] = {
    attempted: false,
    copiedRows: 0,
    tableDetails: []
  }

  if (!backupPath || !fs.existsSync(backupPath)) return summary
  summary.attempted = true

  let attached = false
  try {
    db.prepare('ATTACH DATABASE ? AS recover_source').run(backupPath)
    attached = true
    db.exec('PRAGMA foreign_keys = OFF;')

    const sourceTableRows = db
      .prepare(`SELECT name FROM recover_source.sqlite_master WHERE type = 'table'`)
      .all() as Array<{ name: string }>
    const sourceTables = new Set(sourceTableRows.map(row => row.name))

    for (const table of RECOVERY_TABLES) {
      if (!sourceTables.has(table)) {
        summary.tableDetails.push({
          table,
          copiedRows: 0,
          status: 'skipped',
          reason: 'source-table-missing'
        })
        continue
      }

      try {
        const result = db
          .prepare(`INSERT OR IGNORE INTO ${table} SELECT * FROM recover_source.${table}`)
          .run()
        const copied = result.changes || 0
        summary.copiedRows += copied
        summary.tableDetails.push({
          table,
          copiedRows: copied,
          status: 'copied'
        })
      } catch (error: any) {
        summary.tableDetails.push({
          table,
          copiedRows: 0,
          status: 'failed',
          reason: error?.message || 'copy-failed'
        })
      }
    }
  } catch (error: any) {
    summary.tableDetails.push({
      table: '__attach__',
      copiedRows: 0,
      status: 'failed',
      reason: error?.message || 'attach-failed'
    })
  } finally {
    try {
      db.exec('PRAGMA foreign_keys = ON;')
    } catch {
      // noop
    }
    if (attached) {
      try {
        db.exec('DETACH DATABASE recover_source;')
      } catch {
        // noop
      }
    }
  }

  return summary
}

const repairDatabaseFile = (
  dbPath: string,
  options?: { force?: boolean; reason?: string; checkMode?: DbRepairCheckMode }
): DbRepairReport => {
  ensureDbDirectory(dbPath)

  const forced = Boolean(options?.force)
  const checkMode: DbRepairCheckMode = options?.checkMode === 'quick' || options?.checkMode === 'full'
    ? options.checkMode
    : forced
      ? 'full'
      : 'quick'
  const reason = options?.reason || 'manual'
  const actions: string[] = [`integrity-check-mode:${checkMode}`]

  let probeDb: Database | null = null
  let before: DbIntegrityReport

  try {
    probeDb = createDbConnection(dbPath)
    before = checkIntegrityOnDb(probeDb, dbPath, checkMode)
  } catch (error: any) {
    before = buildIntegrityReport(dbPath, checkMode, 'error', [error?.message || 'Failed to open database'])
  } finally {
    closeQuietly(probeDb)
  }

  const corruptionLikely = before.status === 'corrupted' || before.messages.some(isCorruptionMessage)

  if (before.status === 'ok' && !forced) {
    return {
      dbPath,
      status: 'ok',
      repaired: false,
      forced,
      checkMode,
      reason,
      timestamp: nowIso(),
      actions: ['integrity-check:ok'],
      before,
      after: before,
      salvage: emptySalvage()
    }
  }

  if (!forced && !corruptionLikely) {
    return {
      dbPath,
      status: 'failed',
      repaired: false,
      forced,
      checkMode,
      reason,
      timestamp: nowIso(),
      actions: ['integrity-check:unknown-error'],
      before,
      salvage: emptySalvage(),
      error: 'Database is unhealthy but does not look like corruption; pass force=true to rebuild'
    }
  }

  let backupPath: string | undefined
  let quarantinePath: string | undefined
  let rebuildDb: Database | null = null
  try {
    backupPath = backupDatabaseFile(dbPath)
    if (backupPath) actions.push(`backup:${backupPath}`)

    quarantinePath = quarantineCorruptedFiles(dbPath)
    if (quarantinePath) actions.push(`quarantine:${quarantinePath}`)

    rebuildDb = createDbConnection(dbPath)
    migrate(rebuildDb)
    const salvage = salvageFromBackup(rebuildDb, backupPath)
    if (salvage.attempted) {
      actions.push(`salvage:copied_rows:${salvage.copiedRows}`)
    }
    const after = checkIntegrityOnDb(rebuildDb, dbPath, 'quick')
    actions.push(`rebuild:${after.status}`)

    if (after.status !== 'ok') {
      return {
        dbPath,
        status: 'failed',
        repaired: false,
        forced,
        checkMode,
        reason,
        timestamp: nowIso(),
        actions,
        before,
        after,
        backupPath,
        quarantinePath,
        salvage,
        error: after.messages.join('; ')
      }
    }

    return {
      dbPath,
      status: 'repaired',
      repaired: true,
      forced,
      checkMode,
      reason,
      timestamp: nowIso(),
      actions,
      before,
      after,
      backupPath,
      quarantinePath,
      salvage
    }
  } catch (error: any) {
    actions.push('rebuild:exception')
    return {
      dbPath,
      status: 'failed',
      repaired: false,
      forced,
      checkMode,
      reason,
      timestamp: nowIso(),
      actions,
      before,
      backupPath,
      quarantinePath,
      salvage: emptySalvage(),
      error: error?.message || 'Repair failed'
    }
  } finally {
    closeQuietly(rebuildDb)
  }
}

export class LocalDatabaseService {
  private static instance: LocalDatabaseService | null = null
  private dbPath: string
  private db: Database
  private lastRepairReport: DbRepairReport | null = null
  private repairHistory: DbRepairReport[] = []

  private constructor() {
    this.dbPath = resolveDbPath()
    ensureDbDirectory(this.dbPath)
    const startupReports: DbRepairReport[] = []

    const autoRepairEnabled = process.env.DB_AUTO_REPAIR !== 'false'
    let startupDb: Database | null = null

    try {
      startupDb = createDbConnection(this.dbPath)
      migrate(startupDb)
      const health = checkIntegrityOnDb(startupDb, this.dbPath, 'quick')
      if (health.status !== 'ok') {
        closeQuietly(startupDb)
        startupDb = null
        if (!autoRepairEnabled) {
          throw new Error(`SQLite integrity check failed: ${health.messages.join('; ')}`)
        }
        if (!shouldAutoRepairFromReport(health)) {
          throw new Error(`SQLite check failed but not corruption-like: ${health.messages.join('; ')}`)
        }
        this.lastRepairReport = repairDatabaseFile(this.dbPath, { force: true, reason: 'startup-auto' })
        startupReports.push(this.lastRepairReport)
        if (this.lastRepairReport.status === 'failed') {
          throw new Error(this.lastRepairReport.error || 'Auto repair failed')
        }
        startupDb = createDbConnection(this.dbPath)
        migrate(startupDb)
      }
      this.db = startupDb
    } catch (error: any) {
      closeQuietly(startupDb)
      if (autoRepairEnabled && isCorruptionMessage(error?.message || '')) {
        this.lastRepairReport = repairDatabaseFile(this.dbPath, { force: true, reason: 'startup-corruption' })
        startupReports.push(this.lastRepairReport)
        if (this.lastRepairReport.status === 'failed') {
          throw error
        }
        this.db = createDbConnection(this.dbPath)
        migrate(this.db)
      } else {
        throw error
      }
    }

    this.loadRepairHistoryFromStorage()
    startupReports.forEach((report) => this.recordRepair(report))
  }

  static getInstance() {
    if (!this.instance) this.instance = new LocalDatabaseService()
    return this.instance
  }

  static getDatabase() {
    return this.getInstance().db
  }

  static getDbPath() {
    return this.getInstance().dbPath
  }

  static getLastRepairReport() {
    return this.getInstance().lastRepairReport
  }

  static getRuntimeConfig(): DbRuntimeConfig {
    const instance = this.getInstance()
    const runtimeHealthcheckIntervalMs = parsePositiveInt(process.env.DB_HEALTHCHECK_INTERVAL_MS, 0)
    return {
      dbPath: instance.dbPath,
      autoRepairEnabled: process.env.DB_AUTO_REPAIR !== 'false',
      runtimeHealthcheckIntervalMs,
      runtimeHealthcheckEnabled: runtimeHealthcheckIntervalMs > 0
    }
  }

  static shouldAutoRepair(report: Pick<DbIntegrityReport, 'status' | 'messages'>) {
    return shouldAutoRepairFromReport(report)
  }

  static getRepairHistory(query: DbRepairHistoryQuery = {}) {
    const instance = this.getInstance()
    return instance.queryRepairHistory(query)
  }

  static checkIntegrity(mode: DbIntegrityMode = 'quick') {
    const instance = this.getInstance()
    return checkIntegrityOnDb(instance.db, instance.dbPath, mode)
  }

  static repair(options?: { force?: boolean; reason?: string; checkMode?: DbRepairCheckMode }) {
    const instance = this.getInstance()
    const report = repairDatabaseFile(instance.dbPath, options)
    if (report.status === 'repaired') {
      closeQuietly(instance.db)
      instance.db = createDbConnection(instance.dbPath)
      migrate(instance.db)
    }
    instance.lastRepairReport = report
    instance.recordRepair(report)
    return report
  }

  static repairDatabaseFile(dbPath: string, options?: { force?: boolean; reason?: string; checkMode?: DbRepairCheckMode }) {
    return repairDatabaseFile(dbPath, options)
  }

  private recordRepair(report: DbRepairReport) {
    const normalized = normalizeRepairReport(report)
    this.repairHistory.unshift(normalized)
    if (this.repairHistory.length > 100) {
      this.repairHistory = this.repairHistory.slice(0, 100)
    }
    this.persistRepairToStorage(normalized)
  }

  private queryRepairHistory(query: DbRepairHistoryQuery): DbRepairHistoryResult {
    const safeLimit = Number.isFinite(query.limit) && (query.limit || 0) > 0
      ? Math.min(100, Math.floor(query.limit as number))
      : 20
    const safeOffset = Number.isFinite(query.offset) && (query.offset || 0) > 0
      ? Math.max(0, Math.floor(query.offset as number))
      : 0
    const whereParts: string[] = []
    const params: string[] = []

    if (query.from && query.from.trim()) {
      whereParts.push('created_at >= ?')
      params.push(query.from.trim())
    }
    if (query.to && query.to.trim()) {
      whereParts.push('created_at <= ?')
      params.push(query.to.trim())
    }
    if (query.status && query.status.trim()) {
      whereParts.push('status = ?')
      params.push(query.status.trim().toLowerCase())
    }
    if (query.reason && query.reason.trim()) {
      whereParts.push(`reason LIKE ? ESCAPE '\\'`)
      params.push(`%${escapeLikePattern(query.reason.trim())}%`)
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : ''
    const countStatement = this.db.prepare(`
      SELECT COUNT(1) AS total FROM db_repair_logs
      ${whereClause}
    `)
    const totalRow = countStatement.get(...params) as { total?: number } | null
    const total = Number(totalRow?.total || 0)

    const statement = this.db.prepare(`
      SELECT report_json FROM db_repair_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${safeLimit}
      OFFSET ${safeOffset}
    `)
    const rows = statement.all(...params) as Array<{ report_json: string }>
    const repairs = rows
      .map((row) => {
        try {
          return normalizeRepairReport(JSON.parse(row.report_json))
        } catch {
          return null
        }
      })
      .filter(Boolean) as DbRepairReport[]

    return {
      repairs,
      total,
      limit: safeLimit,
      offset: safeOffset,
      hasMore: safeOffset + repairs.length < total
    }
  }

  private loadRepairHistoryFromStorage() {
    const rows = this.db
      .prepare(`SELECT report_json FROM db_repair_logs ORDER BY created_at DESC LIMIT 100`)
      .all() as Array<{ report_json: string }>
    this.repairHistory = rows
      .map((row) => {
        try {
          return normalizeRepairReport(JSON.parse(row.report_json))
        } catch {
          return null
        }
      })
      .filter(Boolean) as DbRepairReport[]
  }

  private persistRepairToStorage(report: DbRepairReport) {
    try {
      this.db.prepare(`
        INSERT INTO db_repair_logs (
          id, status, reason, forced, repaired, db_path, copied_rows, created_at, report_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        `dbr_${crypto.randomUUID()}`,
        report.status,
        report.reason,
        report.forced ? 1 : 0,
        report.repaired ? 1 : 0,
        report.dbPath,
        report.salvage.copiedRows,
        report.timestamp,
        JSON.stringify(report)
      )
    } catch {
      // noop
    }
  }
}

export const getLocalDb = () => LocalDatabaseService.getDatabase()
