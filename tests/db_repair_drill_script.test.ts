import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import path from 'path'

describe('数据库损坏演练脚本接入', () => {
  it('根脚本应提供 drill:db-repair 命令', () => {
    const pkg = JSON.parse(readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'))
    expect(pkg?.scripts?.['drill:db-repair']).toBe('bun run scripts/db_repair_drill.ts')
  })

  it('演练脚本应执行故障注入并调用修复能力', () => {
    const content = readFileSync(path.resolve(process.cwd(), 'scripts/db_repair_drill.ts'), 'utf8')
    expect(content).toContain('injectCorruption')
    expect(content).toContain('LocalDatabaseService.repairDatabaseFile')
    expect(content).toContain("reason: 'drill-corruption-injection'")
    expect(content).toContain('DB REPAIR DRILL SUMMARY')
  })
})
