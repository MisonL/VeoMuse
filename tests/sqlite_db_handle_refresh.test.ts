import fs from 'fs'
import os from 'os'
import path from 'path'
import { Database } from 'bun:sqlite'
import { afterEach, describe, expect, it } from 'bun:test'
import { LocalDatabaseService } from '../apps/backend/src/services/LocalDatabaseService'

describe('SQLite 损坏修复能力', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs) {
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('应能识别并修复损坏数据库文件', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'veomuse-db-repair-'))
    tempDirs.push(tempDir)
    const dbPath = path.join(tempDir, 'corrupted.sqlite')

    fs.writeFileSync(dbPath, Buffer.from('not a sqlite database file'))

    const report = LocalDatabaseService.repairDatabaseFile(dbPath, {
      force: false,
      reason: 'unit-test-corruption'
    })

    expect(report.status).toBe('repaired')
    expect(report.repaired).toBe(true)
    expect(Boolean(report.quarantinePath)).toBe(true)
    expect(fs.existsSync(dbPath)).toBe(true)

    const db = new Database(dbPath, { readonly: true })
    const table = db
      .prepare(`
        SELECT name FROM sqlite_master
        WHERE type = 'table' AND name = 'model_profiles'
      `)
      .get() as { name: string } | undefined
    db.close(false)

    expect(table?.name).toBe('model_profiles')
  })
})
