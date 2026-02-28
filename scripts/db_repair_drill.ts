import fs from 'fs'
import path from 'path'
import { LocalDatabaseService } from '../apps/backend/src/services/LocalDatabaseService'

interface DrillSummary {
  timestamp: string
  sourceDbPath: string
  drillDbPath: string
  reportPath: string
  repairStatus: 'ok' | 'repaired' | 'failed'
  repaired: boolean
  copiedRows: number
  actions: string[]
  backupPath?: string
  quarantinePath?: string
  beforeStatus: 'ok' | 'corrupted' | 'error'
  afterStatus: 'ok' | 'corrupted' | 'error' | 'missing'
  error?: string
}

const nowIso = () => new Date().toISOString()
const stamp = () => nowIso().replace(/[:.]/g, '-')

const resolveSourceDbPath = () => {
  const fromEnv = process.env.DB_DRILL_SOURCE?.trim()
  if (fromEnv) return path.resolve(fromEnv)
  return path.resolve(process.cwd(), 'data/veomuse.sqlite')
}

const resolveOutputDir = () => {
  const fromEnv = process.env.DB_DRILL_OUTPUT_DIR?.trim()
  if (fromEnv) return path.resolve(fromEnv)
  return path.resolve(process.cwd(), 'data/drills')
}

const ensureDir = (target: string) => {
  if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true })
}

const copyIfExists = (source: string, target: string) => {
  if (!fs.existsSync(source)) return
  fs.copyFileSync(source, target)
}

const injectCorruption = (dbPath: string) => {
  const fd = fs.openSync(dbPath, 'r+')
  try {
    const marker = Buffer.from(`CORRUPT-DRILL-${Date.now()}`)
    fs.writeSync(fd, marker, 0, marker.length, 0)
    fs.fsyncSync(fd)
  } finally {
    fs.closeSync(fd)
  }
}

const run = async () => {
  const sourceDbPath = resolveSourceDbPath()
  if (!fs.existsSync(sourceDbPath)) {
    throw new Error(`源数据库不存在: ${sourceDbPath}`)
  }

  const outputDir = resolveOutputDir()
  ensureDir(outputDir)

  const runId = stamp()
  const drillDbPath = path.join(outputDir, `veomuse-drill-${runId}.sqlite`)
  copyIfExists(sourceDbPath, drillDbPath)
  copyIfExists(`${sourceDbPath}-wal`, `${drillDbPath}-wal`)
  copyIfExists(`${sourceDbPath}-shm`, `${drillDbPath}-shm`)

  injectCorruption(drillDbPath)

  const repair = LocalDatabaseService.repairDatabaseFile(drillDbPath, {
    force: true,
    reason: 'drill-corruption-injection'
  })

  const summary: DrillSummary = {
    timestamp: nowIso(),
    sourceDbPath,
    drillDbPath,
    reportPath: path.join(outputDir, `db-repair-drill-${runId}.json`),
    repairStatus: repair.status,
    repaired: repair.repaired,
    copiedRows: repair.salvage.copiedRows,
    actions: repair.actions,
    backupPath: repair.backupPath,
    quarantinePath: repair.quarantinePath,
    beforeStatus: repair.before.status,
    afterStatus: repair.after?.status || 'missing',
    error: repair.error
  }

  fs.writeFileSync(summary.reportPath, JSON.stringify({ summary, repair }, null, 2), 'utf8')

  console.log('--- DB REPAIR DRILL SUMMARY ---')
  console.log(JSON.stringify(summary, null, 2))

  if (repair.status === 'failed') {
    process.exitCode = 1
  }
}

run().catch((error: any) => {
  console.error('[db-repair-drill] failed:', error?.message || error)
  process.exitCode = 1
})
