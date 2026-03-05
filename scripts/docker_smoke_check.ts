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

const DEFAULT_COMPOSE_FILE = 'config/docker/docker-compose.yml'
const DEFAULT_BASE_URL = 'http://127.0.0.1:18081'
const DEFAULT_WAIT_TIMEOUT_SEC = 180
const REQUEST_TIMEOUT_MS = 15_000

const HELP_TEXT = `
Docker Smoke Check

用法:
  bun run scripts/docker_smoke_check.ts [options]

参数:
  --compose-file <path>   docker compose 文件路径（默认: ${DEFAULT_COMPOSE_FILE}）
  --base-url <url>        健康探测基础地址（默认: ${DEFAULT_BASE_URL}）
  --wait-timeout <sec>    compose --wait 超时秒数（默认: ${DEFAULT_WAIT_TIMEOUT_SEC}）
  --keep-up               成功/失败后保留容器，不执行 down
  --no-build              up 时跳过 --build
  -h, --help              显示帮助
`.trim()

const normalizeBaseUrl = (input: string) => {
  if (!input.endsWith('/')) return input
  return input.slice(0, -1)
}

const toErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message
  return String(error || 'unknown error')
}

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

const parseArgs = (args: string[]): ParseResult => {
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
      options.baseUrl = normalizeBaseUrl(parsed.value)
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

const probeEndpoint = async (url: string) => {
  const abortController = new AbortController()
  const timer = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      signal: abortController.signal
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    console.log(`[docker-smoke] 探测通过: ${url} -> ${response.status}`)
  } catch (error: unknown) {
    throw new Error(`探测失败: ${url} (${toErrorMessage(error)})`)
  } finally {
    clearTimeout(timer)
  }
}

const collectDiagnostics = async (composePrefix: string[]) => {
  console.error('[docker-smoke] 开始采集容器状态与日志...')
  await runCommand([...composePrefix, 'ps'], true)
  await runCommand([...composePrefix, 'logs', '--tail', '200'], true)
}

const runSmokeCheck = async (options: CliOptions) => {
  const composePrefix = ['docker', 'compose', '-f', options.composeFile]
  let hasFailure = false
  let needDiagnostics = false

  try {
    const upCommand = [...composePrefix, 'up', '-d']
    if (!options.noBuild) {
      upCommand.push('--build')
    }
    upCommand.push('--wait', '--wait-timeout', String(options.waitTimeoutSec))
    await runCommand(upCommand)

    await probeEndpoint(`${options.baseUrl}/api/health`)
    await probeEndpoint(`${options.baseUrl}/api/capabilities`)

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
    const downExitCode = await runCommand(
      [...composePrefix, 'down', '--volumes', '--remove-orphans'],
      true
    )
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
