import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { describe, expect, it } from 'bun:test'
import {
  createCoverageIgnoreMatcher,
  evaluateCoverage,
  listRootUnitTestFiles,
  parseCoveragePathIgnorePatterns,
  parseCoverageThreshold,
  parseLcovSummary
} from '../scripts/coverage_gate'

describe('Coverage 门禁脚本', () => {
  it('parseCoverageThreshold 应解析对象形式阈值', () => {
    const threshold = parseCoverageThreshold(`
[test]
coverageThreshold = { lines = 0.82, functions = 0.73 }
`)
    expect(threshold).toEqual({ lines: 0.82, functions: 0.73 })
  })

  it('parseCoverageThreshold 应兼容标量形式阈值', () => {
    const threshold = parseCoverageThreshold(`
[test]
coverageThreshold = 0.91
`)
    expect(threshold).toEqual({ lines: 0.91, functions: 0.91 })
  })

  it('parseCoverageThreshold 应将越界值截断到 [0,1]', () => {
    const threshold = parseCoverageThreshold(`
[test]
coverageThreshold = { lines = 1.5, functions = -0.25 }
`)
    expect(threshold).toEqual({ lines: 1, functions: 0 })
  })

  it('parseLcovSummary 应汇总 LCOV 行与函数覆盖', () => {
    const summary = parseLcovSummary(
      [
        'TN:',
        'SF:/repo/a.ts',
        'FNF:2',
        'FNH:1',
        'LF:10',
        'LH:7',
        'end_of_record',
        'SF:/repo/b.ts',
        'FNF:1',
        'FNH:1',
        'LF:4',
        'LH:4',
        'end_of_record'
      ].join('\n')
    )

    expect(summary.totalLines).toBe(14)
    expect(summary.coveredLines).toBe(11)
    expect(summary.totalFunctions).toBe(3)
    expect(summary.coveredFunctions).toBe(2)
    expect(summary.lineRate).toBeCloseTo(11 / 14, 6)
    expect(summary.functionRate).toBeCloseTo(2 / 3, 6)
  })

  it('parseCoveragePathIgnorePatterns 应支持字符串与数组两种配置', () => {
    const fromArray = parseCoveragePathIgnorePatterns(`
[test]
coveragePathIgnorePatterns = ["src/a.ts", "src/b.ts"]
`)
    expect(fromArray).toEqual(['src/a.ts', 'src/b.ts'])

    const fromSingle = parseCoveragePathIgnorePatterns(`
[test]
coveragePathIgnorePatterns = "src/c.ts"
`)
    expect(fromSingle).toEqual(['src/c.ts'])
  })

  it('createCoverageIgnoreMatcher 应匹配相对路径与通配符', () => {
    const shouldIgnore = createCoverageIgnoreMatcher(
      ['apps/frontend/src/components/Editor/*.tsx', 'packages/shared/src/**'],
      '/repo'
    )
    expect(shouldIgnore('/repo/apps/frontend/src/components/Editor/AssetPanel.tsx')).toBe(true)
    expect(shouldIgnore('/repo/packages/shared/src/types.ts')).toBe(true)
    expect(shouldIgnore('/repo/apps/frontend/src/store/editorStore.ts')).toBe(false)
  })

  it('parseLcovSummary 应按 ignore matcher 过滤文件', () => {
    const shouldIgnore = createCoverageIgnoreMatcher(
      ['apps/frontend/src/components/Editor/**'],
      '/repo'
    )
    const summary = parseLcovSummary(
      [
        'TN:',
        'SF:/repo/apps/frontend/src/components/Editor/TelemetryDashboard.tsx',
        'FNF:2',
        'FNH:0',
        'LF:100',
        'LH:0',
        'end_of_record',
        'SF:/repo/apps/frontend/src/store/actorsStore.ts',
        'FNF:2',
        'FNH:1',
        'LF:10',
        'LH:8',
        'end_of_record'
      ].join('\n'),
      { shouldIgnoreFile: shouldIgnore }
    )

    expect(summary.totalLines).toBe(10)
    expect(summary.coveredLines).toBe(8)
    expect(summary.totalFunctions).toBe(2)
    expect(summary.coveredFunctions).toBe(1)
  })

  it('evaluateCoverage 应在未达标时返回失败原因', () => {
    const result = evaluateCoverage(
      {
        totalLines: 10,
        coveredLines: 7,
        totalFunctions: 10,
        coveredFunctions: 6,
        lineRate: 0.7,
        functionRate: 0.6
      },
      {
        lines: 0.8,
        functions: 0.7
      }
    )

    expect(result.passed).toBe(false)
    expect(result.failures.length).toBe(2)
    expect(result.failures[0]).toContain('line coverage')
    expect(result.failures[1]).toContain('function coverage')
  })

  it('parseLcovSummary 在空输入时应返回 100%（无样本）', () => {
    const summary = parseLcovSummary('')
    expect(summary.totalLines).toBe(0)
    expect(summary.coveredLines).toBe(0)
    expect(summary.totalFunctions).toBe(0)
    expect(summary.coveredFunctions).toBe(0)
    expect(summary.lineRate).toBe(1)
    expect(summary.functionRate).toBe(1)
  })

  it('listRootUnitTestFiles 应返回 tests 根目录下 .test.ts/.test.tsx 且按名称排序', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'veomuse-coverage-tests-'))
    try {
      await fs.mkdir(path.join(tempDir, 'nested'), { recursive: true })
      await Promise.all([
        fs.writeFile(path.join(tempDir, 'b.test.ts'), '// b', 'utf8'),
        fs.writeFile(path.join(tempDir, 'a.test.ts'), '// a', 'utf8'),
        fs.writeFile(path.join(tempDir, 'c.test.tsx'), '// c', 'utf8'),
        fs.writeFile(path.join(tempDir, 'note.md'), '# note', 'utf8'),
        fs.writeFile(path.join(tempDir, 'nested', 'd.test.tsx'), '// d', 'utf8')
      ])

      const files = await listRootUnitTestFiles(tempDir, { excludeNames: [] })
      expect(files).toEqual([
        path.resolve(tempDir, 'a.test.ts'),
        path.resolve(tempDir, 'b.test.ts'),
        path.resolve(tempDir, 'c.test.tsx')
      ])
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
    }
  })
})
