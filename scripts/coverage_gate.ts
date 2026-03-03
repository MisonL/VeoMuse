import fs from 'fs/promises'
import os from 'os'
import path from 'path'

export interface CoverageSummary {
  totalLines: number
  coveredLines: number
  totalFunctions: number
  coveredFunctions: number
  lineRate: number
  functionRate: number
}

export interface CoverageThreshold {
  lines: number
  functions: number
}

export interface CoverageEvaluation {
  passed: boolean
  failures: string[]
}

const DEFAULT_THRESHOLD: CoverageThreshold = {
  lines: 0.8,
  functions: 0.7
}

const DEFAULT_TESTS_DIRNAME = 'tests'
const DEFAULT_BUNFIG_FILENAME = 'bunfig.toml'
const DEFAULT_OUTPUT_DIRNAME = 'coverage'
const ROOT_TEST_FILE_PATTERN = /\.test\.tsx?$/i
const DEFAULT_COVERAGE_TEST_EXCLUDES = new Set([
  // 这些数据库修复集成用例在覆盖率插桩模式下极慢，保留在常规 `bun run test` 中执行。
  'sqlite_db_repair_api.test.ts',
  'sqlite_db_repairs_api.test.ts'
])

const normalizePath = (value: string) => value.replace(/\\/g, '/')

const parseRateValue = (raw: string | undefined) => {
  const value = Number.parseFloat(String(raw || '').trim())
  if (!Number.isFinite(value)) return null
  return value
}

const parseThresholdValue = (raw: string | undefined) => {
  const value = parseRateValue(raw)
  if (value === null) return null
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

const COVERAGE_THRESHOLD_NUMBER_PATTERN = '([-+]?[0-9]*\\.?[0-9]+)'

export const parseCoverageThreshold = (bunfigContent: string): CoverageThreshold => {
  if (!bunfigContent.trim()) return { ...DEFAULT_THRESHOLD }

  const objectMatch = bunfigContent.match(/coverageThreshold\s*=\s*\{([^}]*)\}/m)
  if (objectMatch) {
    const objectBody = objectMatch[1]
    const linesMatch = objectBody.match(
      new RegExp(`\\blines?\\s*=\\s*${COVERAGE_THRESHOLD_NUMBER_PATTERN}`, 'i')
    )
    const functionsMatch = objectBody.match(
      new RegExp(`\\bfunctions?\\s*=\\s*${COVERAGE_THRESHOLD_NUMBER_PATTERN}`, 'i')
    )
    const lines = parseThresholdValue(linesMatch?.[1]) ?? DEFAULT_THRESHOLD.lines
    const functions = parseThresholdValue(functionsMatch?.[1]) ?? DEFAULT_THRESHOLD.functions
    return { lines, functions }
  }

  const scalarMatch = bunfigContent.match(
    new RegExp(`coverageThreshold\\s*=\\s*${COVERAGE_THRESHOLD_NUMBER_PATTERN}`)
  )
  if (scalarMatch) {
    const threshold = parseThresholdValue(scalarMatch[1]) ?? DEFAULT_THRESHOLD.lines
    return { lines: threshold, functions: threshold }
  }

  return { ...DEFAULT_THRESHOLD }
}

export const parseCoveragePathIgnorePatterns = (bunfigContent: string): string[] => {
  if (!bunfigContent.trim()) return []

  const extracted = new Set<string>()
  const arrayMatch = bunfigContent.match(/coveragePathIgnorePatterns\s*=\s*\[([\s\S]*?)\]/m)
  if (arrayMatch) {
    const body = arrayMatch[1]
    const quoteRegex = /"([^"\\]*(?:\\.[^"\\]*)*)"/g
    let match: RegExpExecArray | null = quoteRegex.exec(body)
    while (match) {
      const value = String(match[1] || '').trim()
      if (value) extracted.add(value)
      match = quoteRegex.exec(body)
    }
  } else {
    const singleMatch = bunfigContent.match(/coveragePathIgnorePatterns\s*=\s*"([^"]+)"/m)
    const value = String(singleMatch?.[1] || '').trim()
    if (value) extracted.add(value)
  }

  return [...extracted]
}

const toGlobRegex = (pattern: string) => {
  const escaped = normalizePath(pattern)
    .trim()
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '__DOUBLE_STAR__')
    .replace(/\*/g, '[^/]*')
    .replace(/__DOUBLE_STAR__/g, '.*')
    .replace(/\?/g, '[^/]')
  return new RegExp(`^${escaped}$`)
}

export const createCoverageIgnoreMatcher = (patterns: string[], repoRoot = process.cwd()) => {
  const cleaned = patterns.map((item) => item.trim()).filter(Boolean)
  if (!cleaned.length) return (_path: string) => false
  const rules = cleaned.map((pattern) => toGlobRegex(pattern))

  return (filePath: string) => {
    const normalized = normalizePath(filePath)
    const relative = normalizePath(path.relative(repoRoot, filePath))
    const candidates = [normalized, relative, relative.replace(/^\.\//, '')]
    return rules.some((rule) => candidates.some((candidate) => rule.test(candidate)))
  }
}

export const parseLcovSummary = (
  lcovContent: string,
  options?: { shouldIgnoreFile?: (filePath: string) => boolean }
): CoverageSummary => {
  const lines = lcovContent.split(/\r?\n/)
  let totalLines = 0
  let coveredLines = 0
  let totalFunctions = 0
  let coveredFunctions = 0
  let currentFile = ''
  let currentIgnore = false
  let fileLines = 0
  let fileCoveredLines = 0
  let fileFunctions = 0
  let fileCoveredFunctions = 0

  for (const line of lines) {
    if (line.startsWith('SF:')) {
      currentFile = line.slice(3).trim()
      currentIgnore = options?.shouldIgnoreFile?.(currentFile) === true
      fileLines = 0
      fileCoveredLines = 0
      fileFunctions = 0
      fileCoveredFunctions = 0
      continue
    }

    if (line.startsWith('LF:')) {
      fileLines = Number.parseInt(line.slice(3), 10) || 0
      continue
    }
    if (line.startsWith('LH:')) {
      fileCoveredLines = Number.parseInt(line.slice(3), 10) || 0
      continue
    }
    if (line.startsWith('FNF:')) {
      fileFunctions = Number.parseInt(line.slice(4), 10) || 0
      continue
    }
    if (line.startsWith('FNH:')) {
      fileCoveredFunctions = Number.parseInt(line.slice(4), 10) || 0
      continue
    }
    if (line === 'end_of_record') {
      if (!currentIgnore && currentFile) {
        totalLines += fileLines
        coveredLines += fileCoveredLines
        totalFunctions += fileFunctions
        coveredFunctions += fileCoveredFunctions
      }
      currentFile = ''
      currentIgnore = false
      fileLines = 0
      fileCoveredLines = 0
      fileFunctions = 0
      fileCoveredFunctions = 0
    }
  }

  const lineRate = totalLines > 0 ? coveredLines / totalLines : 1
  const functionRate = totalFunctions > 0 ? coveredFunctions / totalFunctions : 1

  return {
    totalLines,
    coveredLines,
    totalFunctions,
    coveredFunctions,
    lineRate,
    functionRate
  }
}

export const evaluateCoverage = (
  summary: CoverageSummary,
  threshold: CoverageThreshold
): CoverageEvaluation => {
  const failures: string[] = []
  if (summary.lineRate < threshold.lines) {
    failures.push(
      `line coverage ${Math.round(summary.lineRate * 10000) / 100}% < ${Math.round(threshold.lines * 10000) / 100}%`
    )
  }
  if (summary.functionRate < threshold.functions) {
    failures.push(
      `function coverage ${Math.round(summary.functionRate * 10000) / 100}% < ${Math.round(threshold.functions * 10000) / 100}%`
    )
  }
  return {
    passed: failures.length === 0,
    failures
  }
}

export const listRootUnitTestFiles = async (
  testsDir = DEFAULT_TESTS_DIRNAME,
  options: { excludeNames?: Iterable<string> } = {}
) => {
  const excludes = new Set(
    Array.from(options.excludeNames || DEFAULT_COVERAGE_TEST_EXCLUDES).map((item) => item.trim())
  )
  const entries = await fs.readdir(testsDir, { withFileTypes: true })
  return entries
    .filter(
      (entry) =>
        entry.isFile() && ROOT_TEST_FILE_PATTERN.test(entry.name) && !excludes.has(entry.name)
    )
    .map((entry) => path.resolve(testsDir, entry.name))
    .sort((left, right) => left.localeCompare(right))
}

const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`

export interface CoverageGateRuntimeOptions {
  repoRoot?: string
  testsDir?: string
  bunfigPath?: string
  outputDir?: string
  spawn?: typeof Bun.spawn
}

export interface CoverageGateRuntimeResult {
  output: string
  lineRate: number
  functionRate: number
  threshold: CoverageThreshold
  ignorePatterns: string[]
  summary: CoverageSummary
  evaluation: CoverageEvaluation
}

export const runCoverageGate = async (
  options: CoverageGateRuntimeOptions = {}
): Promise<CoverageGateRuntimeResult> => {
  const repoRoot = path.resolve(options.repoRoot || process.cwd())
  const testsDir = options.testsDir || path.resolve(repoRoot, DEFAULT_TESTS_DIRNAME)
  const bunfigPath = options.bunfigPath || path.resolve(repoRoot, DEFAULT_BUNFIG_FILENAME)
  const outputDir = options.outputDir || path.resolve(repoRoot, DEFAULT_OUTPUT_DIRNAME)
  const spawn = options.spawn || Bun.spawn

  const testFiles = await listRootUnitTestFiles(testsDir)
  if (testFiles.length === 0) {
    throw new Error('未发现 tests/*.test.ts(x)，无法执行覆盖率门禁。')
  }

  const thresholdContent = await fs.readFile(bunfigPath, 'utf8').catch(() => '')
  const threshold = parseCoverageThreshold(thresholdContent)
  const ignorePatterns = parseCoveragePathIgnorePatterns(thresholdContent)
  const shouldIgnoreFile = createCoverageIgnoreMatcher(ignorePatterns, repoRoot)

  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'veomuse-coverage-gate-'))
  const tmpCoverageDir = path.join(tmpRoot, 'coverage')
  const preloadChdirFile = path.join(tmpRoot, 'chdir-preload.ts')
  const targetCoverageFile = path.join(outputDir, 'lcov.info')

  try {
    await fs.writeFile(preloadChdirFile, `process.chdir(${JSON.stringify(repoRoot)})\n`, 'utf8')

    const command = [
      'bun',
      'test',
      '--preload',
      preloadChdirFile,
      ...testFiles,
      '--coverage',
      '--coverage-reporter=text',
      '--coverage-reporter=lcov',
      '--coverage-dir',
      tmpCoverageDir,
      '--timeout',
      '600000',
      '--max-concurrency',
      '1'
    ]

    const child = spawn(command, {
      cwd: os.tmpdir(),
      env: {
        ...process.env,
        NODE_ENV: 'development',
        VEOMUSE_TEST_RUNTIME: '1'
      },
      stdout: 'inherit',
      stderr: 'inherit'
    })
    const exitCode = await child.exited
    if (exitCode !== 0) {
      throw new Error(`覆盖率测试执行失败，exit code=${exitCode}`)
    }

    const lcovFile = path.join(tmpCoverageDir, 'lcov.info')
    const lcovContent = await fs.readFile(lcovFile, 'utf8').catch(() => '')
    if (!lcovContent.trim()) {
      throw new Error(
        [
          '未生成覆盖率文件 lcov.info。',
          `临时目录: ${tmpCoverageDir}`,
          '请确认 Bun 版本与运行目录是否支持 coverage 落盘。'
        ].join(' ')
      )
    }

    const summary = parseLcovSummary(lcovContent, { shouldIgnoreFile })
    const evaluation = evaluateCoverage(summary, threshold)

    await fs.mkdir(outputDir, { recursive: true })
    await fs.writeFile(targetCoverageFile, lcovContent, 'utf8')

    const summaryPath = path.join(outputDir, 'summary.json')
    await fs.writeFile(
      summaryPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          ignoredPatterns: ignorePatterns,
          thresholds: threshold,
          summary,
          evaluation
        },
        null,
        2
      ),
      'utf8'
    )

    if (!evaluation.passed) {
      throw new Error(`覆盖率未达标: ${evaluation.failures.join('; ')}`)
    }

    return {
      output: targetCoverageFile,
      lineRate: summary.lineRate,
      functionRate: summary.functionRate,
      threshold,
      ignorePatterns,
      summary,
      evaluation
    }
  } finally {
    await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {})
  }
}

const run = async () => {
  const result = await runCoverageGate()
  console.log(
    JSON.stringify(
      {
        status: 'passed',
        output: result.output,
        lineRate: formatPercent(result.lineRate),
        functionRate: formatPercent(result.functionRate),
        threshold: result.threshold,
        ignoredPatterns: result.ignorePatterns
      },
      null,
      2
    )
  )
}

if (import.meta.main) {
  run().catch((error) => {
    const message = error instanceof Error ? error.message : String(error || 'unknown error')
    console.error(
      JSON.stringify(
        {
          status: 'failed',
          error: message
        },
        null,
        2
      )
    )
    process.exit(1)
  })
}
