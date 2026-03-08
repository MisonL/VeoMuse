import path from 'node:path'
import { mkdir, readFile } from 'node:fs/promises'
import { runRealE2EPrecheck } from './real_e2e_precheck'
import { buildReleaseGateFailureReport, runReleaseGate } from './release_gate'
import { QUALITY_SUMMARY_RELATIVE_PATH, type QualitySummary } from './release-gate/contracts'

interface CliOptions {
  outputDir: string
}

interface ParseResult {
  showHelp: boolean
  options: CliOptions
}

interface RealAcceptanceSummary {
  schemaVersion: '1.0'
  startedAt: string
  finishedAt?: string
  outputDir: string
  status: 'passed' | 'failed'
  precheck: {
    status: 'passed' | 'failed'
    message: string
    missingEnv: string[]
  }
  releaseGate: {
    status: 'passed' | 'failed'
    message: string
  }
  qualitySummaryPath?: string
  realE2EStatus?: string
  realE2EFailureType?: string | null
  failedSteps: string[]
}

export const DEFAULT_OUTPUT_ROOT = path.join('artifacts', 'real-acceptance')

export const HELP_TEXT = `
Real Acceptance

Usage:
  bun run scripts/real_acceptance.ts [options]

Flags:
  --output-dir <path>   output directory (default: ${DEFAULT_OUTPUT_ROOT}/<timestamp>)
  -h, --help            show help

Flow:
  1. bun run release:real:precheck
  2. bun run release:gate:real
  3. verify artifacts/quality-summary.json realE2E.status=passed
`.trim()

const createTimestampLabel = (now = new Date()) => now.toISOString().replace(/[:.]/g, '-')

export const resolveDefaultOutputDir = (now = new Date()) =>
  path.resolve(process.cwd(), DEFAULT_OUTPUT_ROOT, createTimestampLabel(now))

export const createDefaultOutputDir = resolveDefaultOutputDir

const readFlagValue = (
  args: string[],
  index: number,
  flagName: string
): { value: string; nextIndex: number } => {
  const current = args[index] || ''
  const eqPrefix = `${flagName}=`
  if (current.startsWith(eqPrefix)) {
    const value = current.slice(eqPrefix.length).trim()
    if (!value) throw new Error(`${flagName} 缺少参数值`)
    return { value, nextIndex: index }
  }

  const value = args[index + 1]
  if (!value || value.startsWith('-')) {
    throw new Error(`${flagName} 缺少参数值`)
  }
  return { value, nextIndex: index + 1 }
}

export const parseArgs = (args: string[], now = new Date()): ParseResult => {
  const options: CliOptions = {
    outputDir: resolveDefaultOutputDir(now)
  }
  let showHelp = false

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '-h' || arg === '--help') {
      showHelp = true
      continue
    }
    if (arg === '--output-dir' || arg.startsWith('--output-dir=')) {
      const parsed = readFlagValue(args, index, '--output-dir')
      options.outputDir = path.resolve(process.cwd(), parsed.value.trim())
      index = parsed.nextIndex
      continue
    }

    throw new Error(`未知参数: ${arg}`)
  }

  return { showHelp, options }
}

const buildOutputPaths = (outputDir: string) => ({
  json: path.join(outputDir, 'summary.json'),
  markdown: path.join(outputDir, 'summary.md'),
  qualitySummary: path.join(outputDir, 'quality-summary.json')
})

const readQualitySummary = async (): Promise<QualitySummary | null> => {
  try {
    const text = await readFile(QUALITY_SUMMARY_RELATIVE_PATH, 'utf8')
    return JSON.parse(text) as QualitySummary
  } catch {
    return null
  }
}

export const validateRealAcceptanceSummary = (qualitySummary: Pick<QualitySummary, 'realE2E'>) => {
  const realE2EStatus = String(qualitySummary.realE2E?.status || '').trim()
  if (realE2EStatus !== 'passed') {
    throw new Error(`realE2E.status 校验失败: expected=passed actual=${realE2EStatus || '(empty)'}`)
  }
  return {
    realE2EStatus,
    realE2EFailureType: qualitySummary.realE2E?.failureType || null
  }
}

export const buildRealAcceptanceMarkdown = (summary: RealAcceptanceSummary) => {
  const lines = [
    '# VeoMuse 实网回归验收摘要',
    '',
    `- 状态：\`${summary.status}\``,
    `- 开始时间：\`${summary.startedAt}\``,
    `- 结束时间：\`${summary.finishedAt || ''}\``,
    `- 预检：\`${summary.precheck.status}\``,
    `- 发布门禁：\`${summary.releaseGate.status}\``,
    `- realE2E.status：\`${summary.realE2EStatus || 'missing'}\``,
    `- realE2E.failureType：\`${summary.realE2EFailureType || 'null'}\``,
    ''
  ]

  if (summary.failedSteps.length > 0) {
    lines.push('## 失败步骤', '')
    for (const step of summary.failedSteps) {
      lines.push(`- ${step}`)
    }
    lines.push('')
  }

  lines.push('## 结果摘要', '')
  lines.push(`- precheck: ${summary.precheck.message}`)
  lines.push(`- release gate: ${summary.releaseGate.message}`)

  return lines.join('\n')
}

export const runRealAcceptance = async (options: CliOptions) => {
  const outputDir = options.outputDir.trim() || resolveDefaultOutputDir()
  await mkdir(outputDir, { recursive: true })
  const env = {
    ...process.env,
    E2E_REAL_CHANNELS: 'true'
  }
  const summary: RealAcceptanceSummary = {
    schemaVersion: '1.0',
    startedAt: new Date().toISOString(),
    outputDir,
    status: 'failed',
    precheck: {
      status: 'failed',
      message: 'not-run',
      missingEnv: []
    },
    releaseGate: {
      status: 'failed',
      message: 'not-run'
    },
    failedSteps: []
  }

  try {
    const precheck = runRealE2EPrecheck(env)
    summary.precheck = {
      status: precheck.ok ? 'passed' : 'failed',
      message: precheck.message,
      missingEnv: [...precheck.missingEnv]
    }
    if (!precheck.ok) {
      summary.failedSteps.push('release:real:precheck')
      throw new Error(precheck.message)
    }

    try {
      await runReleaseGate(['--with-real-e2e'], env)
      summary.releaseGate = {
        status: 'passed',
        message: 'release:gate:real passed'
      }
    } catch (error: unknown) {
      summary.releaseGate = {
        status: 'failed',
        message: error instanceof Error && error.message ? error.message : String(error)
      }
    }

    const qualitySummary = await readQualitySummary()
    if (qualitySummary) {
      summary.qualitySummaryPath = QUALITY_SUMMARY_RELATIVE_PATH
      const validated = validateRealAcceptanceSummary(qualitySummary)
      summary.realE2EStatus = validated.realE2EStatus
      summary.realE2EFailureType = validated.realE2EFailureType
      summary.failedSteps = qualitySummary.steps
        .filter((step) => step.status === 'failed')
        .map((step) => step.name)
      await Bun.write(
        buildOutputPaths(outputDir).qualitySummary,
        JSON.stringify(qualitySummary, null, 2)
      )

      if (summary.realE2EStatus !== 'passed') {
        const failureReport = buildReleaseGateFailureReport(qualitySummary)
        summary.releaseGate.message =
          summary.releaseGate.status === 'failed' ? summary.releaseGate.message : failureReport
        throw new Error(
          `realE2E.status=${summary.realE2EStatus}, failureType=${summary.realE2EFailureType || 'null'}`
        )
      }
    } else {
      summary.failedSteps.push('quality-summary.json')
      throw new Error('缺少 artifacts/quality-summary.json')
    }

    if (summary.releaseGate.status !== 'passed') {
      throw new Error(summary.releaseGate.message)
    }

    summary.status = 'passed'
  } finally {
    summary.finishedAt = new Date().toISOString()
    await Bun.write(buildOutputPaths(outputDir).json, JSON.stringify(summary, null, 2))
    await Bun.write(buildOutputPaths(outputDir).markdown, buildRealAcceptanceMarkdown(summary))
    console.log(`[real-acceptance] summary: ${buildOutputPaths(outputDir).json}`)
    console.log(`[real-acceptance] markdown: ${buildOutputPaths(outputDir).markdown}`)
  }

  return summary
}

const main = async () => {
  const parsed = parseArgs(process.argv.slice(2))
  if (parsed.showHelp) {
    console.log(HELP_TEXT)
    return
  }

  const result = await runRealAcceptance(parsed.options)
  if (result.status !== 'passed') {
    throw new Error(result.releaseGate.message || result.precheck.message || '实网回归验收失败')
  }
}

if (import.meta.main) {
  await main().catch((error: unknown) => {
    const message = error instanceof Error && error.message ? error.message : String(error)
    console.error(`[real-acceptance] ${message}`)
    console.log(HELP_TEXT)
    process.exit(1)
  })
}
