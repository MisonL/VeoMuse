import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'bun:test'
import { runCoverageGate } from '../scripts/coverage_gate'

const createdRepos: string[] = []

const createRepo = async (params: {
  bunfig?: string
  sourceCode?: string
  testCode?: string
  createTestsDir?: boolean
}) => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'veomuse-coverage-gate-runtime-'))
  createdRepos.push(repoRoot)

  const srcDir = path.join(repoRoot, 'src')
  await fs.mkdir(srcDir, { recursive: true })
  await fs.writeFile(
    path.join(srcDir, 'math.ts'),
    params.sourceCode ||
      [
        'export const add = (a: number, b: number) => a + b',
        'export const multiply = (a: number, b: number) => a * b'
      ].join('\n'),
    'utf8'
  )

  if (params.createTestsDir !== false) {
    const testsDir = path.join(repoRoot, 'tests')
    await fs.mkdir(testsDir, { recursive: true })
    if (typeof params.testCode === 'string') {
      await fs.writeFile(path.join(testsDir, 'sample.test.ts'), params.testCode, 'utf8')
    } else {
      await fs.writeFile(
        path.join(testsDir, 'sample.test.ts'),
        [
          "import { describe, expect, it } from 'bun:test'",
          "import { add } from '../src/math'",
          "describe('coverage fixture', () => {",
          "  it('should pass', () => {",
          '    expect(add(1, 2)).toBe(3)',
          '  })',
          '})'
        ].join('\n'),
        'utf8'
      )
    }
  }

  if (typeof params.bunfig === 'string') {
    await fs.writeFile(path.join(repoRoot, 'bunfig.toml'), params.bunfig, 'utf8')
  }

  return repoRoot
}

afterEach(async () => {
  while (createdRepos.length > 0) {
    const repoRoot = createdRepos.pop()
    if (!repoRoot) continue
    await fs.rm(repoRoot, { recursive: true, force: true }).catch(() => {})
  }
})

describe('Coverage 门禁 runtime 核心流程', () => {
  it('应在阈值满足时生成覆盖率产物并返回 passed 结果', async () => {
    const repoRoot = await createRepo({
      bunfig: `
[test]
coverageThreshold = { lines = 0.4, functions = 0.4 }
coverageReporter = ["text", "lcov"]
coverageSkipTestFiles = true
`
    })

    const result = await runCoverageGate({ repoRoot })

    expect(result.evaluation.passed).toBe(true)
    expect(result.summary.totalLines).toBeGreaterThan(0)
    expect(result.summary.totalFunctions).toBeGreaterThan(0)
    await expect(fs.stat(path.join(repoRoot, 'coverage', 'lcov.info'))).resolves.toBeDefined()
    await expect(fs.stat(path.join(repoRoot, 'coverage', 'summary.json'))).resolves.toBeDefined()
  })

  it('应在阈值不满足时抛出覆盖率未达标错误', async () => {
    const repoRoot = await createRepo({
      bunfig: `
[test]
coverageThreshold = { lines = 0.95, functions = 0.95 }
coverageReporter = ["text", "lcov"]
coverageSkipTestFiles = true
`
    })

    await expect(runCoverageGate({ repoRoot })).rejects.toThrow('覆盖率未达标')
  })

  it('应在测试执行失败时抛出 exit code 错误', async () => {
    const repoRoot = await createRepo({
      bunfig: `
[test]
coverageThreshold = { lines = 0, functions = 0 }
`,
      testCode: [
        "import { describe, expect, it } from 'bun:test'",
        "describe('runtime failure fixture', () => {",
        "  it('should fail', () => {",
        '    expect(1).toBe(2)',
        '  })',
        '})'
      ].join('\n')
    })

    await expect(runCoverageGate({ repoRoot })).rejects.toThrow('覆盖率测试执行失败')
  })

  it('应在 tests 目录为空时提示未发现测试文件', async () => {
    const repoRoot = await createRepo({
      bunfig: `
[test]
coverageThreshold = { lines = 0, functions = 0 }
`,
      createTestsDir: true,
      testCode: ''
    })
    await fs.rm(path.join(repoRoot, 'tests', 'sample.test.ts'), { force: true })

    await expect(runCoverageGate({ repoRoot })).rejects.toThrow('未发现 tests/*.test.ts(x)')
  })

  it('应在 tests 目录缺失时透传 ENOENT', async () => {
    const repoRoot = await createRepo({
      createTestsDir: false
    })

    await expect(runCoverageGate({ repoRoot })).rejects.toThrow('ENOENT')
  })

  it('bunfig 缺失时应回退默认阈值并仍可通过', async () => {
    const repoRoot = await createRepo({
      sourceCode: 'export const id = (v: string) => v',
      testCode: [
        "import { describe, expect, it } from 'bun:test'",
        "import { id } from '../src/math'",
        "describe('default threshold fixture', () => {",
        "  it('covers all source lines', () => {",
        "    expect(id('ok')).toBe('ok')",
        '  })',
        '})'
      ].join('\n')
    })

    const result = await runCoverageGate({ repoRoot })
    expect(result.evaluation.passed).toBe(true)
    expect(result.threshold).toEqual({ lines: 0.8, functions: 0.7 })
  })
})
