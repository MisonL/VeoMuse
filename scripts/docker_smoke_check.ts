export {
  buildWebSocketUpgradeRequest,
  extractReferencedJavaScriptAssetPaths,
  extractStaticAssetPaths,
  filterJavaScriptAssetPaths,
  hasImmutableCacheControl,
  LAB_ENTRY_MARKERS,
  normalizeBaseUrl,
  parseHttpStatusCode,
  REQUIRED_SECURITY_HEADERS,
  resolveWebSocketProbeScheme,
  resolveJavaScriptAssetUrl,
  resolveMissingLabEntryMarkers,
  resolveMissingSecurityHeaders,
  resolveMissingTelemetryEntryMarkers,
  TELEMETRY_ENTRY_MARKERS,
  validateBaseUrl
} from './deploy_acceptance_core'

import {
  buildDeployAcceptanceMarkdown,
  DEFAULT_DEPLOY_ACCEPTANCE_BASE_URL as DEFAULT_BASE_URL,
  normalizeBaseUrl,
  resolveAbsoluteUrl,
  runDeploymentAcceptanceProbes,
  toErrorMessage,
  validateBaseUrl,
  waitForEndpoint
} from './deploy_acceptance_core'

interface CliOptions {
  composeFile: string
  baseUrl: string
  waitTimeoutSec: number
  keepUp: boolean
  noBuild: boolean
}

interface ParseResult {
  showHelp: boolean
  options: CliOptions
}

interface ComposeRuntime {
  prefix: string[]
  supportsWait: boolean
}

export const DEFAULT_COMPOSE_FILE = 'config/docker/docker-compose.yml'
export const DEFAULT_WAIT_TIMEOUT_SEC = 180
export const REQUEST_TIMEOUT_MS = 15_000
export const REQUIRED_COMPOSE_SERVICES = [
  'veomuse-redis',
  'veomuse-backend',
  'veomuse-frontend'
] as const

export const HELP_TEXT = `
Docker Smoke Check

Usage:
  bun run scripts/docker_smoke_check.ts [options]

Flags:
  --compose-file <path>   docker compose file path (default: ${DEFAULT_COMPOSE_FILE})
  --base-url <url>        base URL for smoke probes (default: ${DEFAULT_BASE_URL})
  --wait-timeout <sec>    compose wait timeout seconds (default: ${DEFAULT_WAIT_TIMEOUT_SEC})
  --keep-up               keep containers running after checks
  --no-build              skip --build during compose up
  -h, --help              show help

Coverage:
  - GET /
  - /assets/* cache headers
  - 前端实验室/系统监控入口 bundle 标识
  - GET /api/health
  - GET /api/capabilities
  - /ws/generation websocket handshake
  - optional /api/admin/metrics read-only probe (when ADMIN_TOKEN is configured)
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
    if (!value) {
      throw new Error(`${flagName} 缺少参数值`)
    }
    return { value, nextIndex: index }
  }

  const value = args[index + 1]
  if (!value || value.startsWith('-')) {
    throw new Error(`${flagName} 缺少参数值`)
  }
  return { value, nextIndex: index + 1 }
}

export const parseArgs = (args: string[]): ParseResult => {
  const options: CliOptions = {
    composeFile: DEFAULT_COMPOSE_FILE,
    baseUrl: DEFAULT_BASE_URL,
    waitTimeoutSec: DEFAULT_WAIT_TIMEOUT_SEC,
    keepUp: false,
    noBuild: false
  }

  let showHelp = false

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '-h' || arg === '--help') {
      showHelp = true
      continue
    }

    if (arg === '--keep-up') {
      options.keepUp = true
      continue
    }

    if (arg === '--no-build') {
      options.noBuild = true
      continue
    }

    if (arg === '--compose-file' || arg.startsWith('--compose-file=')) {
      const parsed = readFlagValue(args, index, '--compose-file')
      options.composeFile = parsed.value
      index = parsed.nextIndex
      continue
    }

    if (arg === '--base-url' || arg.startsWith('--base-url=')) {
      const parsed = readFlagValue(args, index, '--base-url')
      options.baseUrl = validateBaseUrl(parsed.value)
      index = parsed.nextIndex
      continue
    }

    if (arg === '--wait-timeout' || arg.startsWith('--wait-timeout=')) {
      const parsed = readFlagValue(args, index, '--wait-timeout')
      options.waitTimeoutSec = parsePositiveInt(parsed.value, '--wait-timeout')
      index = parsed.nextIndex
      continue
    }

    throw new Error(`未知参数: ${arg}`)
  }

  return { showHelp, options }
}

export const buildComposeUpCommand = (
  composePrefix: string[],
  options: Pick<CliOptions, 'noBuild' | 'waitTimeoutSec'>,
  supportsWait: boolean
) => {
  const upCommand = [...composePrefix, 'up', '-d']
  if (!options.noBuild) {
    upCommand.push('--build')
  }
  if (supportsWait) {
    upCommand.push('--wait', '--wait-timeout', String(options.waitTimeoutSec))
  }
  return upCommand
}

export const buildComposeDownCommand = (composePrefix: string[]) => [
  ...composePrefix,
  'down',
  '--volumes',
  '--remove-orphans'
]

const runCommand = async (command: string[], allowFailure = false) => {
  console.log(`[docker-smoke] $ ${command.join(' ')}`)
  const proc = Bun.spawn(command, {
    stdout: 'inherit',
    stderr: 'inherit'
  })
  const exitCode = await proc.exited
  if (exitCode !== 0 && !allowFailure) {
    throw new Error(`命令执行失败（exit=${exitCode}）: ${command.join(' ')}`)
  }
  return exitCode
}

const captureCommand = async (command: string[]) => {
  console.log(`[docker-smoke] $ ${command.join(' ')}`)
  const proc = Bun.spawn(command, {
    stdout: 'pipe',
    stderr: 'pipe'
  })
  const [stdoutText, stderrText, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited
  ])
  if (exitCode !== 0) {
    throw new Error(
      `命令执行失败（exit=${exitCode}）: ${command.join(' ')}\n${stderrText.trim() || stdoutText.trim()}`
    )
  }
  return stdoutText.trim()
}

const canRunCommand = async (command: string[]) => {
  const proc = Bun.spawn(command, {
    stdout: 'ignore',
    stderr: 'ignore'
  })
  const exitCode = await proc.exited
  return exitCode === 0
}

const resolveComposeRuntime = async (composeFile: string): Promise<ComposeRuntime> => {
  if (await canRunCommand(['docker', 'compose', 'version'])) {
    return {
      prefix: ['docker', 'compose', '-f', composeFile],
      supportsWait: true
    }
  }

  if (await canRunCommand(['docker-compose', 'version'])) {
    return {
      prefix: ['docker-compose', '-f', composeFile],
      supportsWait: false
    }
  }

  throw new Error('未检测到 docker compose / docker-compose，请先安装可用的 Compose 环境')
}

const collectDiagnostics = async (composePrefix: string[]) => {
  console.error('[docker-smoke] 开始采集容器状态与日志...')
  await runCommand([...composePrefix, 'ps'], true)
  await runCommand([...composePrefix, 'logs', '--tail', '200'], true)
}

const verifyComposeServiceHealth = async (
  composePrefix: string[],
  service: (typeof REQUIRED_COMPOSE_SERVICES)[number]
) => {
  const containerId = await captureCommand([...composePrefix, 'ps', '-q', service])
  if (!containerId) {
    throw new Error(`未找到 compose 服务容器: ${service}`)
  }
  const health = await captureCommand([
    'docker',
    'inspect',
    '-f',
    '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}',
    containerId
  ])
  if (health.trim() !== 'healthy') {
    throw new Error(`服务未处于 healthy: ${service} -> ${health}`)
  }
  console.log(`[docker-smoke] 服务健康通过: ${service}`)
}

export const runSmokeCheck = async (options: CliOptions) => {
  const composeRuntime = await resolveComposeRuntime(options.composeFile)
  const composePrefix = composeRuntime.prefix
  let hasFailure = false
  let needDiagnostics = false

  try {
    await runCommand(buildComposeUpCommand(composePrefix, options, composeRuntime.supportsWait))

    for (const service of REQUIRED_COMPOSE_SERVICES) {
      await verifyComposeServiceHealth(composePrefix, service)
    }

    const baseUrl = normalizeBaseUrl(options.baseUrl)
    if (!composeRuntime.supportsWait) {
      await waitForEndpoint(
        `${baseUrl}/api/health`,
        options.waitTimeoutSec * 1_000,
        '[docker-smoke]'
      )
    }

    const summary = await runDeploymentAcceptanceProbes({
      baseUrl,
      loggerPrefix: '[docker-smoke]'
    })
    if (summary.status !== 'passed') {
      throw new Error(summary.error || 'Smoke 检查失败')
    }

    console.log('[docker-smoke] Smoke 检查通过。')
  } catch (error: unknown) {
    hasFailure = true
    needDiagnostics = true
    console.error(`[docker-smoke] Smoke 检查失败: ${toErrorMessage(error)}`)
  }

  if (needDiagnostics) {
    await collectDiagnostics(composePrefix)
  }

  if (options.keepUp) {
    console.log('[docker-smoke] --keep-up 已启用，跳过 down 清理。')
  } else {
    const downExitCode = await runCommand(buildComposeDownCommand(composePrefix), true)
    if (downExitCode !== 0) {
      hasFailure = true
      console.error(`[docker-smoke] 清理失败，退出码: ${downExitCode}`)
    }
  }

  if (hasFailure) {
    process.exit(1)
  }
}

const main = async () => {
  const parsed = parseArgs(process.argv.slice(2))
  if (parsed.showHelp) {
    console.log(HELP_TEXT)
    return
  }
  await runSmokeCheck(parsed.options)
}

if (import.meta.main) {
  await main().catch((error: unknown) => {
    console.error(`[docker-smoke] ${toErrorMessage(error)}`)
    console.log(HELP_TEXT)
    process.exit(1)
  })
}
