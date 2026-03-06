import { Database } from 'bun:sqlite'
export type {
  DbIntegrityMode,
  DbRepairCheckMode,
  DbIntegrityReport,
  DbRepairReport,
  DbRuntimeConfig
} from './local-database/types'
import {
  closeQuietly,
  ensureDbDirectory,
  escapeLikePattern,
  isCorruptionMessage,
  logNonBlockingDatabaseWarning,
  parsePositiveInt,
  resolveDbPath,
  resolveErrorMessage
} from './local-database/common'
import { createDbConnection, migrate } from './local-database/schema'
import {
  checkIntegrityOnDb,
  normalizeRepairReport,
  repairDatabaseFile,
  shouldAutoRepairFromReport
} from './local-database/repair'
import type {
  DbIntegrityMode,
  DbIntegrityReport,
  DbRepairCheckMode,
  DbRepairHistoryQuery,
  DbRepairHistoryResult,
  DbRepairReport,
  DbRuntimeConfig
} from './local-database/types'

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
          throw new Error(
            `SQLite check failed but not corruption-like: ${health.messages.join('; ')}`
          )
        }
        this.lastRepairReport = repairDatabaseFile(this.dbPath, {
          force: true,
          reason: 'startup-auto'
        })
        startupReports.push(this.lastRepairReport)
        if (this.lastRepairReport.status === 'failed') {
          throw new Error(this.lastRepairReport.error || 'Auto repair failed')
        }
        startupDb = createDbConnection(this.dbPath)
        migrate(startupDb)
      }
      this.db = startupDb
    } catch (error: unknown) {
      closeQuietly(startupDb)
      const errorMessage = resolveErrorMessage(error, '')
      if (autoRepairEnabled && isCorruptionMessage(errorMessage)) {
        this.lastRepairReport = repairDatabaseFile(this.dbPath, {
          force: true,
          reason: 'startup-corruption'
        })
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

  static repairDatabaseFile(
    dbPath: string,
    options?: { force?: boolean; reason?: string; checkMode?: DbRepairCheckMode }
  ) {
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
    const safeLimit =
      Number.isFinite(query.limit) && (query.limit || 0) > 0
        ? Math.min(100, Math.floor(query.limit as number))
        : 20
    const safeOffset =
      Number.isFinite(query.offset) && (query.offset || 0) > 0
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
        } catch (error: unknown) {
          logNonBlockingDatabaseWarning(
            'parse repair history row',
            error,
            'invalid repair history row'
          )
          return null
        }
      })
      .filter(Boolean) as DbRepairReport[]
  }

  private persistRepairToStorage(report: DbRepairReport) {
    try {
      this.db
        .prepare(
          `
        INSERT INTO db_repair_logs (
          id, status, reason, forced, repaired, db_path, copied_rows, created_at, report_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
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
    } catch (error: unknown) {
      logNonBlockingDatabaseWarning('persist repair history', error, 'persist failed')
    }
  }
}

export const getLocalDb = () => LocalDatabaseService.getDatabase()
