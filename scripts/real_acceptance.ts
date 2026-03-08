import path from 'node:path'
import { mkdir } from 'node:fs/promises'
import { runRealE2EPrecheck } from './real_e2e_precheck'
import {
  DEFAULT_DEPLOY_ACCEPTANCE_BASE_URL,
  resolveAbsoluteUrl,
  toErrorMessage,
  validateBaseUrl,
  waitForEndpoint
} from './deploy_acceptance_core'

interface CliOptions {
  outputDir: string
  baseUrl: string
  apiBaseUrl: string
  timeoutSec: number
}

interface ParseResult {
  showHelp: boolean
  options: CliOptions
}

interface RealAcceptanceStep {
  status: 'passed' | 'failed' | 'not-run'
  message: string
}

interface RealAcceptanceSummary {
  schemaVersion: '1.0'
  startedAt: string
  finishedAt?: string
  outputDir: string
  baseUrl: string
  apiBaseUrl: string
  status: 'passed' | 'failed'
  precheck: RealAcceptanceStep & {
    missingEnv: string[]
  }
  readiness: RealAcceptanceStep
  realE2E: RealAcceptanceStep & {
    command: string
    stdoutPath?: string
    stderrPath?: string
  }
  failedSteps: string[]
}

interface RealAcceptanceCommand {
  cmd: string[]
  env: NodeJS.ProcessEnv
}

export const DEFAULT_OUTPUT_ROOT = path.join('artifacts', 'real-acceptance')
export const DEFAULT_TIMEOUT_SEC = 240
export const DEFAULT_REAL_ACCEPTANCE_BASE_URL = DEFAULT_DEPLOY_ACCEPTANCE_BASE_URL
export const DEFAULT_REAL_ACCEPTANCE_PLAYWRIGHT_CONFIG = 'playwright.acceptance.config.ts'

export const HELP_TEXT = `
Real Acceptance

Usage:
  bun run scripts/real_acceptance.ts [options]

Flags:
  --base-url <url>       deployed frontend base URL (default: ${DEFAULT_REAL_ACCEPTANCE_BASE_URL})
  --api-base-url <url>   deployed gateway/API base URL (default: same as --base-url)
  --output-dir <path>    output directory (default: ${DEFAULT_OUTPUT_ROOT}/<timestamp>)
  --timeout <sec>        readiness wait timeout seconds (default: ${DEFAULT_TIMEOUT_SEC})
  -h, --help             show help

Flow:
  1. validate release:real:precheck env contract
  2. wait for deployed frontend / and gateway /api/health
  3. run external Playwright @real suite against deployed instance
`.trim()

const createTimestampLabel = (now = new Date()) => now.toISOString().replace(/[:.]/g, '-')

export const resolveDefaultOutputDir = (now = new Date()) =>
  path.resolve(process.cwd(), DEFAULT_OUTPUT_ROOT, createTimestampLabel(now))

const parsePositiveInt = (value: string, flagName: string) => {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flagName} 需要正整数，收到: ${value}`)
  }
  return parsed
}

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
    outputDir: resolveDefaultOutputDir(now),
    baseUrl: DEFAULT_REAL_ACCEPTANCE_BASE_URL,
    apiBaseUrl: DEFAULT_REAL_ACCEPTANCE_BASE_URL,
    timeoutSec: DEFAULT_TIMEOUT_SEC
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
    if (arg === '--base-url' || arg.startsWith('--base-url=')) {
      const parsed = readFlagValue(args, index, '--base-url')
      const validated = validateBaseUrl(parsed.value)
      options.baseUrl = validated
      if (options.apiBaseUrl === DEFAULT_REAL_ACCEPTANCE_BASE_URL) {
        options.apiBaseUrl = validated
      }
      index = parsed.nextIndex
      continue
    }
    if (arg === '--api-base-url' || arg.startsWith('--api-base-url=')) {
      const parsed = readFlagValue(args, index, '--api-base-url')
      options.apiBaseUrl = validateBaseUrl(parsed.value)
      index = parsed.nextIndex
      continue
    }
    if (arg === '--timeout' || arg.startsWith('--timeout=')) {
      const parsed = readFlagValue(args, index, '--timeout')
      options.timeoutSec = parsePositiveInt(parsed.value, '--timeout')
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
  stdout: path.join(outputDir, 'playwright.stdout.log'),
  stderr: path.join(outputDir, 'playwright.stderr.log')
})

export const buildRealAcceptanceCommand = (options: {
  baseUrl: string
  apiBaseUrl: string
  outputDir: string
}): RealAcceptanceCommand => {
  const playwrightOutputDir = path.join(options.outputDir, 'playwright-results')
  const playwrightHtmlOutputDir = path.join(options.outputDir, 'playwright-report')
  return {
    cmd: [
      'bunx',
      'playwright',
      'test',
      '-c',
      DEFAULT_REAL_ACCEPTANCE_PLAYWRIGHT_CONFIG,
      '--project=external-regression-chromium',
      '--grep',
      '@real',
      '--workers=1'
    ],
    env: {
      ...process.env,
      PLAYWRIGHT_BASE_URL: options.baseUrl,
      PLAYWRIGHT_API_BASE_URL: options.apiBaseUrl,
      PLAYWRIGHT_OUTPUT_DIR: playwrightOutputDir,
      PLAYWRIGHT_HTML_OUTPUT_DIR: playwrightHtmlOutputDir
    }
  }
}

export const buildRealAcceptanceMarkdown = (summary: RealAcceptanceSummary) => {
  const lines = [
    '# VeoMuse 实网回归验收摘要',
    '',
    `- 状态：\`${summary.status}\``,
    `- 前端地址：\`${summary.baseUrl}\``,
    `- 网关地址：\`${summary.apiBaseUrl}\``,
    `- 开始时间：\`${summary.startedAt}\``,
    `- 结束时间：\`${summary.finishedAt || ''}\``,
    `- 预检：\`${summary.precheck.status}\``,
    `- 就绪探测：\`${summary.readiness.status}\``,
    `- 外部 @real 回归：\`${summary.realE2E.status}\``,
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
  lines.push(`- readiness: ${summary.readiness.message}`)
  lines.push(`- real e2e: ${summary.realE2E.message}`)
  lines.push(`- command: ${summary.realE2E.command}`)

  if (summary.realE2E.stdoutPath) {
    lines.push(`- stdout: ${summary.realE2E.stdoutPath}`)
  }
  if (summary.realE2E.stderrPath) {
    lines.push(`- stderr: ${summary.realE2E.stderrPath}`)
  }

  return lines.join('\n')
}

const readStreamText = async (stream?: ReadableStream<Uint8Array> | null) => {
  if (!stream) return ''
  return await new Response(stream).text()
}

const runExternalRealAcceptance = async (command: RealAcceptanceCommand) => {
  const childProcess = Bun.spawn(command.cmd, {
    cwd: process.cwd(),
    env: command.env,
    stdout: 'pipe',
    stderr: 'pipe'
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    readStreamText(childProcess.stdout),
    readStreamText(childProcess.stderr),
    childProcess.exited
  ])

  return {
    exitCode,
    stdout,
    stderr
  }
}

export const runRealAcceptance = async (options: CliOptions) => {
  const outputDir = options.outputDir.trim() || resolveDefaultOutputDir()
  const baseUrl = validateBaseUrl(options.baseUrl)
  const apiBaseUrl = validateBaseUrl(options.apiBaseUrl || options.baseUrl)
  const timeoutMs = options.timeoutSec * 1_000
  const outputPaths = buildOutputPaths(outputDir)
  const apiHealthUrl = resolveAbsoluteUrl(apiBaseUrl, '/api/health')
  await mkdir(outputDir, { recursive: true })

  const summary: RealAcceptanceSummary = {
    schemaVersion: '1.0',
    startedAt: new Date().toISOString(),
    outputDir,
    baseUrl,
    apiBaseUrl,
    status: 'failed',
    precheck: {
      status: 'failed',
      message: 'not-run',
      missingEnv: []
    },
    readiness: {
      status: 'not-run',
      message: 'not-run'
    },
    realE2E: {
      status: 'not-run',
      message: 'not-run',
      command: 'not-run'
    },
    failedSteps: []
  }

  const command = buildRealAcceptanceCommand({
    baseUrl,
    apiBaseUrl,
    outputDir
  })
  summary.realE2E.command = command.cmd.join(' ')

  try {
    const precheck = runRealE2EPrecheck(command.env)
    summary.precheck = {
      status: precheck.ok ? 'passed' : 'failed',
      message: precheck.message,
      missingEnv: [...precheck.missingEnv]
    }
    if (!precheck.ok) {
      summary.failedSteps.push('release:real:precheck')
      throw new Error(precheck.message)
    }

    await waitForEndpoint(resolveAbsoluteUrl(baseUrl, '/'), timeoutMs, '[real-acceptance]')
    await waitForEndpoint(apiHealthUrl, timeoutMs, '[real-acceptance]')
    summary.readiness = {
      status: 'passed',
      message: `已确认 ${baseUrl} 与 ${apiHealthUrl} 可访问`
    }

    const result = await runExternalRealAcceptance(command)
    await Bun.write(outputPaths.stdout, result.stdout)
    await Bun.write(outputPaths.stderr, result.stderr)
    summary.realE2E.stdoutPath = outputPaths.stdout
    summary.realE2E.stderrPath = outputPaths.stderr

    if (result.exitCode !== 0) {
      summary.realE2E = {
        ...summary.realE2E,
        status: 'failed',
        message: `外部 @real 回归失败，exitCode=${result.exitCode}`
      }
      summary.failedSteps.push('external-playwright-real')
      throw new Error(summary.realE2E.message)
    }

    summary.realE2E = {
      ...summary.realE2E,
      status: 'passed',
      message: '外部 @real 回归已通过'
    }
    summary.status = 'passed'
  } catch (error: unknown) {
    if (summary.readiness.status === 'not-run' && summary.precheck.status === 'passed') {
      summary.readiness = {
        status: 'failed',
        message: toErrorMessage(error)
      }
      if (!summary.failedSteps.includes('deployed-readiness')) {
        summary.failedSteps.push('deployed-readiness')
      }
    } else if (summary.realE2E.status === 'not-run') {
      summary.realE2E = {
        ...summary.realE2E,
        status: 'failed',
        message: toErrorMessage(error)
      }
    }
  } finally {
    summary.finishedAt = new Date().toISOString()
    await Bun.write(outputPaths.json, JSON.stringify(summary, null, 2))
    await Bun.write(outputPaths.markdown, buildRealAcceptanceMarkdown(summary))
    console.log(`[real-acceptance] summary: ${outputPaths.json}`)
    console.log(`[real-acceptance] markdown: ${outputPaths.markdown}`)
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
    throw new Error(
      result.realE2E.message !== 'not-run'
        ? result.realE2E.message
        : result.readiness.message || result.precheck.message || '实网回归验收失败'
    )
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
