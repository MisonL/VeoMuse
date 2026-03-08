import path from 'node:path'
import { mkdir } from 'node:fs/promises'
import {
  buildDeployAcceptanceMarkdown,
  DEFAULT_DEPLOY_ACCEPTANCE_BASE_URL,
  resolveAbsoluteUrl,
  runDeploymentAcceptanceProbes,
  toErrorMessage,
  validateBaseUrl,
  waitForEndpoint,
  type DeployAcceptanceSummary
} from './deploy_acceptance_core'

interface CliOptions {
  baseUrl: string
  outputDir: string
  timeoutSec: number
  adminTokenEnv: string
}

interface ParseResult {
  showHelp: boolean
  options: CliOptions
}

export const DEFAULT_OUTPUT_ROOT = path.join('artifacts', 'deploy-acceptance')
export const DEFAULT_TIMEOUT_SEC = 240
export const DEFAULT_ADMIN_TOKEN_ENV = 'ADMIN_TOKEN'

export const HELP_TEXT = `
Deploy Acceptance

Usage:
  bun run scripts/deploy_acceptance.ts [options]

Flags:
  --base-url <url>           deployed gateway base URL (default: ${DEFAULT_DEPLOY_ACCEPTANCE_BASE_URL})
  --output-dir <path>        output directory (default: ${DEFAULT_OUTPUT_ROOT}/<timestamp>)
  --timeout <sec>            health wait timeout seconds (default: ${DEFAULT_TIMEOUT_SEC})
  --admin-token-env <name>   admin token env name to record in summary (default: ${DEFAULT_ADMIN_TOKEN_ENV})
  -h, --help                 show help

Checks:
  - GET /
  - /api/health
  - /api/capabilities
  - /ws/generation handshake
  - security headers
  - /assets/* immutable cache
  - register -> workspace -> upload flow
`.trim()

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

const createTimestampLabel = (now = new Date()) => now.toISOString().replace(/[:.]/g, '-')

export const resolveDefaultOutputDir = (now = new Date()) =>
  path.resolve(process.cwd(), DEFAULT_OUTPUT_ROOT, createTimestampLabel(now))

export const createDefaultOutputDir = resolveDefaultOutputDir

export const parseArgs = (args: string[], now = new Date()): ParseResult => {
  const options: CliOptions = {
    baseUrl: DEFAULT_DEPLOY_ACCEPTANCE_BASE_URL,
    outputDir: resolveDefaultOutputDir(now),
    timeoutSec: DEFAULT_TIMEOUT_SEC,
    adminTokenEnv: DEFAULT_ADMIN_TOKEN_ENV
  }

  let showHelp = false

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '-h' || arg === '--help') {
      showHelp = true
      continue
    }

    if (arg === '--base-url' || arg.startsWith('--base-url=')) {
      const parsed = readFlagValue(args, index, '--base-url')
      options.baseUrl = validateBaseUrl(parsed.value)
      index = parsed.nextIndex
      continue
    }

    if (arg === '--output-dir' || arg.startsWith('--output-dir=')) {
      const parsed = readFlagValue(args, index, '--output-dir')
      options.outputDir = path.resolve(process.cwd(), parsed.value.trim())
      index = parsed.nextIndex
      continue
    }

    if (arg === '--timeout' || arg.startsWith('--timeout=')) {
      const parsed = readFlagValue(args, index, '--timeout')
      options.timeoutSec = parsePositiveInt(parsed.value, '--timeout')
      index = parsed.nextIndex
      continue
    }

    if (arg === '--admin-token-env' || arg.startsWith('--admin-token-env=')) {
      const parsed = readFlagValue(args, index, '--admin-token-env')
      options.adminTokenEnv = parsed.value.trim()
      index = parsed.nextIndex
      continue
    }

    throw new Error(`未知参数: ${arg}`)
  }

  return { showHelp, options }
}

export const buildAcceptanceOutputPaths = (outputDir: string) => ({
  json: path.join(outputDir, 'summary.json'),
  markdown: path.join(outputDir, 'summary.md')
})

export const buildDeployAcceptanceArtifact = (
  summary: DeployAcceptanceSummary,
  options: Pick<CliOptions, 'adminTokenEnv' | 'outputDir' | 'timeoutSec'>
) => {
  return {
    ...summary,
    outputDir: options.outputDir,
    timeoutSec: options.timeoutSec,
    adminTokenEnv: options.adminTokenEnv
  }
}

export const runDeployAcceptance = async (options: CliOptions) => {
  const baseUrl = validateBaseUrl(options.baseUrl)
  const timeoutMs = options.timeoutSec * 1_000
  const outputDir = options.outputDir.trim() || resolveDefaultOutputDir()
  await mkdir(outputDir, { recursive: true })

  await waitForEndpoint(resolveAbsoluteUrl(baseUrl, '/api/health'), timeoutMs, '[deploy-acceptance]')
  const summary = await runDeploymentAcceptanceProbes({
    baseUrl,
    loggerPrefix: '[deploy-acceptance]'
  })
  const artifact = buildDeployAcceptanceArtifact(summary, {
    outputDir,
    timeoutSec: options.timeoutSec,
    adminTokenEnv: options.adminTokenEnv
  })

  await Bun.write(
    buildAcceptanceOutputPaths(outputDir).json,
    JSON.stringify(artifact, null, 2)
  )
  await Bun.write(buildAcceptanceOutputPaths(outputDir).markdown, buildDeployAcceptanceMarkdown(summary))

  console.log(`[deploy-acceptance] summary: ${buildAcceptanceOutputPaths(outputDir).json}`)
  console.log(`[deploy-acceptance] markdown: ${buildAcceptanceOutputPaths(outputDir).markdown}`)
  console.log(
    `[deploy-acceptance] status=${summary.status} baseUrl=${summary.baseUrl} steps=${summary.steps.length}`
  )

  if (summary.status !== 'passed') {
    throw new Error(summary.error || '部署验收失败')
  }

  return artifact
}

const main = async () => {
  const parsed = parseArgs(process.argv.slice(2))
  if (parsed.showHelp) {
    console.log(HELP_TEXT)
    return
  }

  await runDeployAcceptance(parsed.options)
}

if (import.meta.main) {
  await main().catch((error: unknown) => {
    console.error(`[deploy-acceptance] ${toErrorMessage(error)}`)
    console.log(HELP_TEXT)
    process.exit(1)
  })
}
