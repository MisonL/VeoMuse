import fs from 'fs'
import os from 'os'
import path from 'path'
import { Database } from 'bun:sqlite'
import { afterEach, describe, expect, it } from 'bun:test'
import { LocalDatabaseService } from '../apps/backend/src/services/LocalDatabaseService'

describe('SQLite 修复数据回收', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs) {
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('强制重建时应回收备份库可读数据', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'veomuse-db-salvage-'))
    tempDirs.push(tempDir)
    const dbPath = path.join(tempDir, 'salvage.sqlite')

    const initReport = LocalDatabaseService.repairDatabaseFile(dbPath, {
      force: true,
      reason: 'init-empty'
    })
    expect(initReport.status).toBe('repaired')

    const seedDb = new Database(dbPath)
    seedDb.prepare(`
      INSERT INTO workspaces (id, name, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run('ws_salvage', '回收验证空间', new Date().toISOString(), new Date().toISOString())
    seedDb.close(false)

    const repairReport = LocalDatabaseService.repairDatabaseFile(dbPath, {
      force: true,
      reason: 'force-rebuild-with-salvage'
    })

    expect(repairReport.status).toBe('repaired')
    expect(repairReport.salvage.attempted).toBe(true)
    expect(repairReport.salvage.copiedRows).toBeGreaterThanOrEqual(1)
    expect(
      repairReport.salvage.tableDetails.some((item) => item.table === 'workspaces' && item.status === 'copied')
    ).toBe(true)

    const verifyDb = new Database(dbPath, { readonly: true })
    const workspace = verifyDb
      .prepare(`SELECT id, name FROM workspaces WHERE id = ?`)
      .get('ws_salvage') as { id: string; name: string } | undefined
    verifyDb.close(false)

    expect(workspace?.id).toBe('ws_salvage')
    expect(workspace?.name).toBe('回收验证空间')
  })
})
