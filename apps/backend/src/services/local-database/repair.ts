import fs from 'fs'
import path from 'path'
import type { Database } from 'bun:sqlite'
import {
  RECOVERY_TABLES,
  asRecord,
  closeQuietly,
  ensureDbDirectory,
  isCorruptionMessage,
  logNonBlockingDatabaseWarning,
  nowIso,
  nowStamp,
  resolveErrorMessage
} from './common'
import type {
  DbIntegrityMode,
  DbIntegrityReport,
  DbRepairCheckMode,
  DbRepairReport
} from './types'
import { createDbConnection, migrate } from './schema'

const readIntegrityRows = (db: Database, mode: DbIntegrityMode) => {
  const pragma = mode === 'full' ? 'integrity_check' : 'quick_check'
  const rows = db.query(`PRAGMA ${pragma};`).all() as Array<Record<string, unknown>>
  return rows.map((row) => String(Object.values(row)[0] ?? '').trim()).filter(Boolean)
}

const buildIntegrityReport = (
  dbPath: string,
  mode: DbIntegrityMode,
  status: DbIntegrityReport['status'],
  messages: string[]
): DbIntegrityReport => ({
  dbPath,
  mode,
  status,
  messages,
  checkedAt: nowIso()
})

export const shouldAutoRepairFromReport = (report: Pick<DbIntegrityReport, 'status' | 'messages'>) =>
  report.status === 'corrupted' || report.messages.some(isCorruptionMessage)

const emptySalvage = (): DbRepairReport['salvage'] => ({
  attempted: false,
  copiedRows: 0,
  tableDetails: []
})

const normalizeIntegrityReport = (
  raw: unknown,
  fallbackDbPath: string,
  fallbackTimestamp: string,
  defaultStatus: DbIntegrityReport['status']
): DbIntegrityReport => {
  const rawRecord = asRecord(raw)
  return {
    dbPath: String(rawRecord.dbPath || fallbackDbPath),
    mode: rawRecord.mode === 'full' ? 'full' : 'quick',
    status:
      rawRecord.status === 'corrupted'
        ? 'corrupted'
        : rawRecord.status === 'error'
          ? 'error'
          : defaultStatus,
    messages: Array.isArray(rawRecord.messages) ? rawRecord.messages.map(String) : [],
    checkedAt: String(rawRecord.checkedAt || fallbackTimestamp)
  }
}

export const normalizeRepairReport = (raw: unknown): DbRepairReport => {
  const rawRecord = asRecord(raw)
  const salvageRecord = asRecord(rawRecord.salvage)
  const salvage =
    rawRecord.salvage && typeof rawRecord.salvage === 'object'
      ? {
          attempted: Boolean(salvageRecord.attempted),
          copiedRows: Number(salvageRecord.copiedRows || 0),
          tableDetails: Array.isArray(salvageRecord.tableDetails)
            ? salvageRecord.tableDetails.map((item) => {
                const itemRecord = asRecord(item)
                const status: DbRepairReport['salvage']['tableDetails'][number]['status'] =
                  itemRecord.status === 'failed'
                    ? 'failed'
                    : itemRecord.status === 'skipped'
                      ? 'skipped'
                      : 'copied'
                return {
                  table: String(itemRecord.table || 'unknown'),
                  copiedRows: Number(itemRecord.copiedRows || 0),
                  status,
                  reason: itemRecord.reason ? String(itemRecord.reason) : undefined
                }
              })
            : []
        }
      : emptySalvage()

  const fallbackDbPath = String(rawRecord.dbPath || '')
  const fallbackTimestamp = String(rawRecord.timestamp || nowIso())
  const before = rawRecord.before
    ? normalizeIntegrityReport(rawRecord.before, fallbackDbPath, fallbackTimestamp, 'ok')
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

  const after = rawRecord.after
    ? normalizeIntegrityReport(rawRecord.after, fallbackDbPath, fallbackTimestamp, 'ok')
    : undefined

  return {
    dbPath: String(rawRecord.dbPath || ''),
    status:
      rawRecord.status === 'failed' ? 'failed' : rawRecord.status === 'ok' ? 'ok' : 'repaired',
    repaired: Boolean(rawRecord.repaired),
    forced: Boolean(rawRecord.forced),
    checkMode: rawRecord.checkMode === 'quick' ? 'quick' : 'full',
    reason: String(rawRecord.reason || 'unknown'),
    timestamp: String(rawRecord.timestamp || nowIso()),
    actions: Array.isArray(rawRecord.actions) ? rawRecord.actions.map(String) : [],
    before,
    after,
    backupPath: rawRecord.backupPath ? String(rawRecord.backupPath) : undefined,
    quarantinePath: rawRecord.quarantinePath ? String(rawRecord.quarantinePath) : undefined,
    salvage,
    error: rawRecord.error ? String(rawRecord.error) : undefined
  }
}

export const checkIntegrityOnDb = (
  db: Database,
  dbPath: string,
  mode: DbIntegrityMode
): DbIntegrityReport => {
  try {
    const messages = readIntegrityRows(db, mode)
    const ok = messages.length === 1 && messages[0]?.toLowerCase() === 'ok'
    return buildIntegrityReport(
      dbPath,
      mode,
      ok ? 'ok' : 'corrupted',
      messages.length ? messages : ['No integrity output']
    )
  } catch (error: unknown) {
    return buildIntegrityReport(dbPath, mode, 'error', [
      resolveErrorMessage(error, 'Integrity check failed')
    ])
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
    const sourceTables = new Set(sourceTableRows.map((row) => row.name))

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
      } catch (error: unknown) {
        summary.tableDetails.push({
          table,
          copiedRows: 0,
          status: 'failed',
          reason: resolveErrorMessage(error, 'copy-failed')
        })
      }
    }
  } catch (error: unknown) {
    summary.tableDetails.push({
      table: '__attach__',
      copiedRows: 0,
      status: 'failed',
      reason: resolveErrorMessage(error, 'attach-failed')
    })
  } finally {
    try {
      db.exec('PRAGMA foreign_keys = ON;')
    } catch (error: unknown) {
      logNonBlockingDatabaseWarning('restore foreign_keys pragma', error, 'pragma restore failed')
    }
    if (attached) {
      try {
        db.exec('DETACH DATABASE recover_source;')
      } catch (error: unknown) {
        logNonBlockingDatabaseWarning('detach recovery source', error, 'detach failed')
      }
    }
  }

  return summary
}

export const repairDatabaseFile = (
  dbPath: string,
  options?: { force?: boolean; reason?: string; checkMode?: DbRepairCheckMode }
): DbRepairReport => {
  ensureDbDirectory(dbPath)

  const forced = Boolean(options?.force)
  const checkMode: DbRepairCheckMode =
    options?.checkMode === 'quick' || options?.checkMode === 'full'
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
  } catch (error: unknown) {
    before = buildIntegrityReport(dbPath, checkMode, 'error', [
      resolveErrorMessage(error, 'Failed to open database')
    ])
  } finally {
    closeQuietly(probeDb)
  }

  const corruptionLikely =
    before.status === 'corrupted' || before.messages.some(isCorruptionMessage)

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
  } catch (error: unknown) {
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
      error: resolveErrorMessage(error, 'Repair failed')
    }
  } finally {
    closeQuietly(rebuildDb)
  }
}
