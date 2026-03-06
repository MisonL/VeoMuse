import fs from 'fs/promises'
import path from 'path'

export interface TargetCoverageRule {
  file: string
  minLineRate: number
}

export interface FileLineCoverage {
  file: string
  totalLines: number
  coveredLines: number
  lineRate: number
}

export interface TargetCoverageGuardResult {
  passed: boolean
  failures: string[]
  details: Array<{
    file: string
    minLineRate: number
    actualLineRate: number | null
    coveredLines: number
    totalLines: number
  }>
}

export const TARGET_COVERAGE_RULES: TargetCoverageRule[] = [
  { file: 'apps/frontend/src/App.tsx', minLineRate: 0.7 },
  { file: 'apps/frontend/src/store/adminMetricsStore.ts', minLineRate: 0.6 },
  { file: 'apps/frontend/src/store/journeyTelemetryStore.ts', minLineRate: 0.6 },
  {
    file: 'apps/frontend/src/components/Editor/comparison-lab/modes/CreativeModePanel.tsx',
    minLineRate: 0.35
  },
  {
    file: 'apps/frontend/src/components/Editor/comparison-lab/modes/CollabModePanel.tsx',
    minLineRate: 0.35
  },
  {
    file: 'apps/frontend/src/components/Editor/TelemetryDashboard.tsx',
    minLineRate: 0.4
  }
]

const normalizePath = (value: string) => value.replace(/\\/g, '/')

export const parseLcovLineCoverageByFile = (lcovContent: string): FileLineCoverage[] => {
  const lines = lcovContent.split(/\r?\n/)
  const result: FileLineCoverage[] = []
  let currentFile = ''
  let totalLines = 0
  let coveredLines = 0

  for (const line of lines) {
    if (line.startsWith('SF:')) {
      currentFile = line.slice(3).trim()
      totalLines = 0
      coveredLines = 0
      continue
    }
    if (line.startsWith('LF:')) {
      totalLines = Number.parseInt(line.slice(3), 10) || 0
      continue
    }
    if (line.startsWith('LH:')) {
      coveredLines = Number.parseInt(line.slice(3), 10) || 0
      continue
    }
    if (line === 'end_of_record') {
      if (!currentFile) continue
      result.push({
        file: normalizePath(currentFile),
        totalLines,
        coveredLines,
        lineRate: totalLines > 0 ? coveredLines / totalLines : 1
      })
      currentFile = ''
      totalLines = 0
      coveredLines = 0
    }
  }

  return result
}

const formatRate = (value: number) => `${(value * 100).toFixed(2)}%`

const findFileCoverage = (
  records: FileLineCoverage[],
  file: string,
  repoRoot: string
): FileLineCoverage | null => {
  const normalizedTarget = normalizePath(file)
  const absoluteTarget = normalizePath(path.resolve(repoRoot, file))

  for (const record of records) {
    const absoluteRecord = normalizePath(path.resolve(repoRoot, record.file))
    const relativeRecord = normalizePath(path.relative(repoRoot, absoluteRecord))
    if (
      absoluteRecord === absoluteTarget ||
      relativeRecord === normalizedTarget ||
      absoluteRecord.endsWith(`/${normalizedTarget}`)
    ) {
      return record
    }
  }
  return null
}

export const evaluateTargetLineCoverage = (
  records: FileLineCoverage[],
  options: {
    repoRoot?: string
    rules?: TargetCoverageRule[]
  } = {}
): TargetCoverageGuardResult => {
  const repoRoot = path.resolve(options.repoRoot || process.cwd())
  const rules = options.rules || TARGET_COVERAGE_RULES
  const failures: string[] = []
  const details: TargetCoverageGuardResult['details'] = []

  for (const rule of rules) {
    const matched = findFileCoverage(records, rule.file, repoRoot)
    if (!matched) {
      failures.push(`缺失覆盖项: ${rule.file} (要求 >= ${formatRate(rule.minLineRate)})`)
      details.push({
        file: rule.file,
        minLineRate: rule.minLineRate,
        actualLineRate: null,
        coveredLines: 0,
        totalLines: 0
      })
      continue
    }

    const actual = matched.lineRate
    details.push({
      file: rule.file,
      minLineRate: rule.minLineRate,
      actualLineRate: actual,
      coveredLines: matched.coveredLines,
      totalLines: matched.totalLines
    })
    if (actual < rule.minLineRate) {
      failures.push(
        [
          `覆盖率未达标: ${rule.file}`,
          `实际 ${formatRate(actual)} (${matched.coveredLines}/${matched.totalLines})`,
          `要求 >= ${formatRate(rule.minLineRate)}`
        ].join(' | ')
      )
    }
  }

  return {
    passed: failures.length === 0,
    failures,
    details
  }
}

export const runTargetCoverageGuard = async (options?: {
  repoRoot?: string
  coverageFile?: string
  rules?: TargetCoverageRule[]
}) => {
  const repoRoot = path.resolve(options?.repoRoot || process.cwd())
  const coverageFile = path.resolve(
    repoRoot,
    options?.coverageFile || path.join('coverage', 'lcov.info')
  )
  const lcovContent = await fs.readFile(coverageFile, 'utf8')
  const records = parseLcovLineCoverageByFile(lcovContent)
  return evaluateTargetLineCoverage(records, { repoRoot, rules: options?.rules })
}

const parseCliCoverageFile = (argv: string[]) => {
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] !== '--coverage-file') continue
    const value = argv[i + 1]
    return value ? value.trim() : ''
  }
  return ''
}

if (import.meta.main) {
  const coverageFileArg = parseCliCoverageFile(Bun.argv.slice(2))
  const coverageFile = coverageFileArg || path.join('coverage', 'lcov.info')
  try {
    const result = await runTargetCoverageGuard({ coverageFile })
    if (result.passed) {
      console.log('target coverage guard passed')
      for (const item of result.details) {
        console.log(
          `${item.file}: ${formatRate(item.actualLineRate || 0)} (${item.coveredLines}/${item.totalLines})`
        )
      }
      process.exit(0)
    }

    console.error('target coverage guard failed')
    for (const failure of result.failures) {
      console.error(`- ${failure}`)
    }
    process.exit(1)
  } catch (error: any) {
    console.error('target coverage guard failed')
    console.error(`- 无法读取覆盖率文件: ${coverageFile}`)
    console.error(`- ${error?.message || 'unknown error'}`)
    process.exit(1)
  }
}
