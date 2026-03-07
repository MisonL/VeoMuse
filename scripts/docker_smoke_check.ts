import net from 'node:net'

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

interface RegisterResponse {
  session?: {
    accessToken?: string
  }
  organizations?: Array<{
    id?: string
  }>
}

interface CreateWorkspaceResponse {
  workspace?: {
    id?: string
  }
  defaultProject?: {
    id?: string
  }
}

interface UploadTokenResponse {
  token?: {
    uploadUrl?: string
  }
}

interface UploadPutResponse {
  uploaded?: {
    bytes?: number
  }
}

interface ComposeRuntime {
  prefix: string[]
  supportsWait: boolean
}

export const DEFAULT_COMPOSE_FILE = 'config/docker/docker-compose.yml'
export const DEFAULT_BASE_URL = 'http://127.0.0.1:18081'
export const DEFAULT_WAIT_TIMEOUT_SEC = 180
export const DEFAULT_WS_PATH = '/ws/generation'
export const REQUEST_TIMEOUT_MS = 15_000
export const REQUIRED_COMPOSE_SERVICES = [
  'veomuse-redis',
  'veomuse-backend',
  'veomuse-frontend'
] as const
export const REQUIRED_SECURITY_HEADERS = [
  'content-security-policy',
  'x-frame-options',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
  'cross-origin-opener-policy',
  'cross-origin-resource-policy'
] as const
export const STATIC_ASSET_PATH_PATTERN = /(?:src|href)=["'](\/assets\/[^"'?#]+\.(?:js|css))["']/gi
export const LAB_ENTRY_MARKERS = [
  'lab-tab-compare',
  'lab-tab-marketplace',
  'lab-tab-creative',
  'lab-tab-collab',
  '双通道比对',
  '策略治理',
  '创意闭环',
  '协作平台'
] as const

const HELP_TEXT = `
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
  - 前端实验室入口 bundle 标识
  - GET /api/health
  - GET /api/capabilities
  - /ws/generation websocket handshake
  - register -> workspace -> upload token -> PUT upload flow
`.trim()

export const normalizeBaseUrl = (input: string) => {
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

export const extractStaticAssetPaths = (html: string) => {
  const paths: string[] = []
  STATIC_ASSET_PATH_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null = null
  while ((match = STATIC_ASSET_PATH_PATTERN.exec(html))) {
    const assetPath = String(match[1] || '').trim()
    if (!assetPath || paths.includes(assetPath)) continue
    paths.push(assetPath)
  }
  return paths
}

export const filterJavaScriptAssetPaths = (assetPaths: string[]) =>
  assetPaths.filter((assetPath) => {
    const normalized = assetPath.split('#')[0]?.split('?')[0] || assetPath
    return normalized.endsWith('.js')
  })

export const resolveMissingLabEntryMarkers = (
  assetContents: string | string[],
  expectedMarkers: readonly string[] = LAB_ENTRY_MARKERS
) => {
  const combinedContent = Array.isArray(assetContents) ? assetContents.join('\n') : assetContents
  return expectedMarkers.filter((marker) => !combinedContent.includes(marker))
}

export const resolveMissingSecurityHeaders = (
  headers: Headers,
  requiredHeaders: readonly string[] = REQUIRED_SECURITY_HEADERS
) => {
  return requiredHeaders.filter((headerName) => !headers.get(headerName))
}

export const hasImmutableCacheControl = (headers: Headers) => {
  const value = String(headers.get('cache-control') || '').toLowerCase()
  return value.includes('public') && value.includes('immutable')
}

export const parseHttpStatusCode = (rawResponse: string) => {
  const match = rawResponse.match(/^HTTP\/1\.[01]\s+(\d{3})\b/m)
  if (!match) return null
  const status = Number.parseInt(match[1] || '', 10)
  return Number.isFinite(status) ? status : null
}

export const buildWebSocketUpgradeRequest = (url: URL) => {
  const port = url.port || (url.protocol === 'https:' ? '443' : '80')
  const hostHeader = `${url.hostname}:${port}`
  const requestTarget = `${url.pathname || '/'}${url.search || ''}`
  const wsKey = Buffer.from('veomuse-smoke-01').toString('base64')
  return [
    `GET ${requestTarget} HTTP/1.1`,
    `Host: ${hostHeader}`,
    'Connection: Upgrade',
    'Upgrade: websocket',
    `Sec-WebSocket-Key: ${wsKey}`,
    'Sec-WebSocket-Version: 13',
    '',
    ''
  ].join('\r\n')
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

const fetchWithTimeout = async (url: string, init?: RequestInit) => {
  const abortController = new AbortController()
  const timer = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, {
      ...init,
      signal: abortController.signal
    })
  } finally {
    clearTimeout(timer)
  }
}

const expectOkResponse = (response: Response, url: string) => {
  if (!response.ok) {
    throw new Error(`探测失败: ${url} (HTTP ${response.status})`)
  }
}

const resolveAbsoluteUrl = (baseUrl: string, pathOrUrl: string) =>
  new URL(pathOrUrl, `${normalizeBaseUrl(baseUrl)}/`).toString()

const parseJsonResponse = async <T>(response: Response, url: string): Promise<T> => {
  try {
    return (await response.json()) as T
  } catch (error: unknown) {
    throw new Error(`解析 JSON 失败: ${url} (${toErrorMessage(error)})`)
  }
}

const jsonRequest = async <T>(url: string, init?: RequestInit): Promise<T> => {
  try {
    const response = await fetchWithTimeout(url, init)
    expectOkResponse(response, url)
    return await parseJsonResponse<T>(response, url)
  } catch (error: unknown) {
    throw new Error(`请求失败: ${url} (${toErrorMessage(error)})`)
  }
}

const probeEndpoint = async (url: string) => {
  const response = await fetchWithTimeout(url)
  expectOkResponse(response, url)
  console.log(`[docker-smoke] 探测通过: ${url} -> ${response.status}`)
  return response
}

const waitForEndpoint = async (url: string, timeoutMs: number) => {
  const startedAt = Date.now()
  let lastError = 'unknown'

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await probeEndpoint(url)
      return
    } catch (error: unknown) {
      lastError = toErrorMessage(error)
      await Bun.sleep(1_000)
    }
  }

  throw new Error(`等待服务就绪超时: ${url} (${lastError})`)
}

const probeRootDocument = async (baseUrl: string) => {
  const url = resolveAbsoluteUrl(baseUrl, '/')
  const response = await fetchWithTimeout(url)
  expectOkResponse(response, url)
  const html = await response.text()
  if (!html.trim()) {
    throw new Error(`首页响应为空: ${url}`)
  }
  console.log(`[docker-smoke] 首页探测通过: ${url}`)
  return { response, html }
}

const probeSecurityHeaders = (response: Response) => {
  const missingHeaders = resolveMissingSecurityHeaders(response.headers)
  if (missingHeaders.length > 0) {
    throw new Error(`缺少安全响应头: ${missingHeaders.join(', ')}`)
  }
  console.log(`[docker-smoke] 安全响应头通过: ${REQUIRED_SECURITY_HEADERS.join(', ')}`)
}

const probeStaticAssetCache = async (baseUrl: string, assetPaths: string[]) => {
  if (assetPaths.length === 0) {
    throw new Error('首页未解析到任何 /assets/ 静态资源路径')
  }
  const assetUrl = resolveAbsoluteUrl(baseUrl, assetPaths[0]!)
  const response = await fetchWithTimeout(assetUrl)
  expectOkResponse(response, assetUrl)
  if (!hasImmutableCacheControl(response.headers)) {
    throw new Error(
      `静态资源缓存头缺失 public/immutable: ${assetUrl} -> ${response.headers.get('cache-control') || '(empty)'}`
    )
  }
  console.log(`[docker-smoke] 静态缓存通过: ${assetUrl}`)
}

const probeFrontendLabEntries = async (baseUrl: string, assetPaths: string[]) => {
  const scriptAssetPaths = filterJavaScriptAssetPaths(assetPaths)
  if (scriptAssetPaths.length === 0) {
    throw new Error('首页未解析到任何 JS 静态资源路径，无法校验实验室入口')
  }

  const checkedAssets: string[] = []
  const assetContents: string[] = []

  for (const assetPath of scriptAssetPaths) {
    const assetUrl = resolveAbsoluteUrl(baseUrl, assetPath)
    const response = await fetchWithTimeout(assetUrl)
    expectOkResponse(response, assetUrl)
    assetContents.push(await response.text())
    checkedAssets.push(assetUrl)

    const missingMarkers = resolveMissingLabEntryMarkers(assetContents)
    if (missingMarkers.length === 0) {
      console.log(`[docker-smoke] 实验室入口探测通过: ${checkedAssets.join(', ')}`)
      return
    }
  }

  throw new Error(
    `前端实验室入口探测失败: missing=${resolveMissingLabEntryMarkers(assetContents).join(', ')}; checked=${checkedAssets.join(', ')}`
  )
}

const createSmokePassword = (seed: string) => {
  const compact = seed
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-12)
    .padEnd(12, 'x')
  return `Vm${compact}#Q9a`
}

const createSmokeIdentity = () => {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  return {
    email: `docker_smoke_${suffix}@veomuse.test`,
    password: createSmokePassword(suffix),
    organizationName: `DockerSmokeOrg_${suffix}`,
    workspaceName: `docker-smoke-${suffix}`
  }
}

const createAuthenticatedWorkspace = async (baseUrl: string) => {
  const identity = createSmokeIdentity()
  const registerPayload = await jsonRequest<RegisterResponse>(
    resolveAbsoluteUrl(baseUrl, '/api/auth/register'),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: identity.email,
        password: identity.password,
        organizationName: identity.organizationName
      })
    }
  )

  const accessToken = String(registerPayload.session?.accessToken || '').trim()
  const organizationId = String(registerPayload.organizations?.[0]?.id || '').trim()
  if (!accessToken || !organizationId) {
    throw new Error('注册成功后未返回 accessToken 或 organizationId')
  }

  const workspacePayload = await jsonRequest<CreateWorkspaceResponse>(
    resolveAbsoluteUrl(baseUrl, '/api/workspaces'),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'x-organization-id': organizationId
      },
      body: JSON.stringify({
        name: identity.workspaceName,
        ownerName: 'DockerSmokeOwner',
        organizationId
      })
    }
  )

  const workspaceId = String(workspacePayload.workspace?.id || '').trim()
  const projectId = String(workspacePayload.defaultProject?.id || '').trim()
  if (!workspaceId || !projectId) {
    throw new Error('创建工作区成功后未返回 workspaceId 或 defaultProject.id')
  }

  return {
    accessToken,
    organizationId,
    workspaceId,
    projectId
  }
}

const probeUploadFlow = async (baseUrl: string) => {
  const workspaceSession = await createAuthenticatedWorkspace(baseUrl)
  const uploadTokenPayload = await jsonRequest<UploadTokenResponse>(
    resolveAbsoluteUrl(baseUrl, '/api/storage/upload-token'),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${workspaceSession.accessToken}`,
        'x-organization-id': workspaceSession.organizationId
      },
      body: JSON.stringify({
        workspaceId: workspaceSession.workspaceId,
        projectId: workspaceSession.projectId,
        fileName: 'docker-smoke.bin',
        contentType: 'application/octet-stream'
      })
    }
  )

  const uploadUrl = String(uploadTokenPayload.token?.uploadUrl || '').trim()
  if (!uploadUrl) {
    throw new Error('上传令牌响应缺少 token.uploadUrl')
  }

  const uploadBytes = new Uint8Array([0x56, 0x4d, 0x53, 0x4d, 0x4f, 0x4b, 0x45])
  const uploadResponse = await jsonRequest<UploadPutResponse>(
    resolveAbsoluteUrl(baseUrl, uploadUrl),
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${workspaceSession.accessToken}`,
        'x-organization-id': workspaceSession.organizationId,
        'Content-Type': 'application/octet-stream'
      },
      body: uploadBytes
    }
  )

  const uploadedBytes = Number(uploadResponse.uploaded?.bytes || 0)
  if (uploadedBytes !== uploadBytes.byteLength) {
    throw new Error(
      `上传链路返回的 uploaded.bytes 异常: expected=${uploadBytes.byteLength}, actual=${uploadedBytes}`
    )
  }

  console.log(
    `[docker-smoke] 上传链路通过: workspace=${workspaceSession.workspaceId}, project=${workspaceSession.projectId}`
  )
}

const probeWebSocketHandshake = async (baseUrl: string, wsPath = DEFAULT_WS_PATH) => {
  const targetUrl = new URL(resolveAbsoluteUrl(baseUrl, wsPath))
  const port = Number.parseInt(
    targetUrl.port || (targetUrl.protocol === 'https:' ? '443' : '80'),
    10
  )
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`无法解析 WebSocket 探测端口: ${targetUrl.toString()}`)
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      callback()
    }

    const socket = net.createConnection({
      host: targetUrl.hostname,
      port
    })
    const timer = setTimeout(() => {
      finish(() => {
        socket.destroy()
        reject(new Error(`WebSocket 握手超时: ${targetUrl.toString()}`))
      })
    }, REQUEST_TIMEOUT_MS)

    socket.setEncoding('utf8')
    let responseBuffer = ''

    socket.on('connect', () => {
      socket.write(buildWebSocketUpgradeRequest(targetUrl))
    })

    socket.on('data', (chunk) => {
      responseBuffer += chunk
      const statusCode = parseHttpStatusCode(responseBuffer)
      if (statusCode === null) return

      finish(() => {
        clearTimeout(timer)
        socket.end()
        if (statusCode !== 101) {
          reject(new Error(`WebSocket 握手失败: ${targetUrl.toString()} -> HTTP ${statusCode}`))
          return
        }
        resolve()
      })
    })

    socket.on('error', (error) => {
      finish(() => {
        clearTimeout(timer)
        reject(new Error(`WebSocket 握手失败: ${targetUrl.toString()} (${toErrorMessage(error)})`))
      })
    })

    socket.on('close', () => {
      if (settled) return
      finish(() => {
        clearTimeout(timer)
        reject(new Error(`WebSocket 握手连接提前关闭: ${targetUrl.toString()}`))
      })
    })
  })

  console.log(`[docker-smoke] WebSocket 握手通过: ${targetUrl.toString()}`)
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
    const upCommand = [...composePrefix, 'up', '-d']
    if (!options.noBuild) {
      upCommand.push('--build')
    }
    if (composeRuntime.supportsWait) {
      upCommand.push('--wait', '--wait-timeout', String(options.waitTimeoutSec))
    }
    await runCommand(upCommand)

    for (const service of REQUIRED_COMPOSE_SERVICES) {
      await verifyComposeServiceHealth(composePrefix, service)
    }

    const baseUrl = normalizeBaseUrl(options.baseUrl)
    if (!composeRuntime.supportsWait) {
      await waitForEndpoint(
        resolveAbsoluteUrl(baseUrl, '/api/health'),
        options.waitTimeoutSec * 1_000
      )
    }

    const { response: rootResponse, html } = await probeRootDocument(baseUrl)
    const assetPaths = extractStaticAssetPaths(html)
    probeSecurityHeaders(rootResponse)
    await probeEndpoint(resolveAbsoluteUrl(baseUrl, '/api/health'))
    await probeEndpoint(resolveAbsoluteUrl(baseUrl, '/api/capabilities'))
    await probeStaticAssetCache(baseUrl, assetPaths)
    await probeFrontendLabEntries(baseUrl, assetPaths)
    await probeWebSocketHandshake(baseUrl)
    await probeUploadFlow(baseUrl)

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
