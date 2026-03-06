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

export interface DbRepairHistoryQuery {
  limit?: number
  offset?: number
  from?: string
  to?: string
  status?: string
  reason?: string
}

export interface DbRepairHistoryResult {
  repairs: DbRepairReport[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}
