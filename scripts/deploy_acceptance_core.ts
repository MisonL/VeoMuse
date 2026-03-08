import net from 'node:net'

export interface RegisterResponse {
  session?: {
    accessToken?: string
  }
  organizations?: Array<{
    id?: string
  }>
}

export interface CreateWorkspaceResponse {
  workspace?: {
    id?: string
  }
  defaultProject?: {
    id?: string
  }
}

export interface UploadTokenResponse {
  token?: {
    uploadUrl?: string
  }
}

export interface UploadPutResponse {
  uploaded?: {
    bytes?: number
  }
}

export interface DeployAcceptanceStep {
  name: string
  status: 'passed' | 'failed'
  detail: string
}

export interface DeployAcceptanceSummary {
  schemaVersion: '1.0'
  startedAt: string
  finishedAt?: string
  baseUrl: string
  status: 'passed' | 'failed'
  steps: DeployAcceptanceStep[]
  error?: string
}

export interface RunDeploymentAcceptanceOptions {
  baseUrl: string
  loggerPrefix?: string
}

const DEFAULT_LOGGER_PREFIX = '[deploy-acceptance]'
export const DEFAULT_DEPLOY_ACCEPTANCE_BASE_URL = 'http://127.0.0.1:18081'
export const DEFAULT_WS_PATH = '/ws/generation'
export const REQUEST_TIMEOUT_MS = 15_000
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
export const JS_ASSET_REFERENCE_PATTERN =
  /(?:\/assets\/|assets\/|\.\.\/|\.\/)[^"'`\s)\\]+\.js(?:\?[^"'`\s)\\]*)?/g
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
export const TELEMETRY_ENTRY_MARKERS = [
  '系统监控',
  '系统监控正在值守',
  '系统监控与当前创作工位并行值守',
  'ops watch / live audit'
] as const

export const normalizeBaseUrl = (input: string) => {
  if (!input.endsWith('/')) return input
  return input.slice(0, -1)
}

export const validateBaseUrl = (input: string) => {
  const normalized = normalizeBaseUrl(input.trim())
  let url: URL
  try {
    url = new URL(normalized)
  } catch {
    throw new Error(`--base-url 需要合法的 http/https URL，收到: ${input}`)
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`--base-url 仅支持 http/https，收到: ${input}`)
  }

  return normalized
}

export const toErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message
  return String(error || 'unknown error')
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

export const extractReferencedJavaScriptAssetPaths = (scriptContent: string) => {
  const paths: string[] = []
  JS_ASSET_REFERENCE_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null = null
  while ((match = JS_ASSET_REFERENCE_PATTERN.exec(scriptContent))) {
    const assetPath = String(match[0] || '').trim()
    if (!assetPath || paths.includes(assetPath)) continue
    paths.push(assetPath)
  }
  return paths
}

export const resolveJavaScriptAssetUrl = (
  baseUrl: string,
  referrerAssetUrl: string,
  assetPathOrUrl: string
) => {
  if (/^https?:\/\//i.test(assetPathOrUrl)) {
    return assetPathOrUrl
  }

  if (assetPathOrUrl.startsWith('/')) {
    return resolveAbsoluteUrl(baseUrl, assetPathOrUrl)
  }

  if (assetPathOrUrl.startsWith('assets/')) {
    return resolveAbsoluteUrl(baseUrl, `/${assetPathOrUrl}`)
  }

  return new URL(assetPathOrUrl, referrerAssetUrl).toString()
}

export const resolveMissingLabEntryMarkers = (
  assetContents: string | string[],
  expectedMarkers: readonly string[] = LAB_ENTRY_MARKERS
) => {
  const combinedContent = Array.isArray(assetContents) ? assetContents.join('\n') : assetContents
  return expectedMarkers.filter((marker) => !combinedContent.includes(marker))
}

export const resolveMissingTelemetryEntryMarkers = (
  assetContents: string | string[],
  expectedMarkers: readonly string[] = TELEMETRY_ENTRY_MARKERS
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

export const resolveAbsoluteUrl = (baseUrl: string, pathOrUrl: string) =>
  new URL(pathOrUrl, `${normalizeBaseUrl(baseUrl)}/`).toString()

const createLogger = (prefix: string) => (message: string) => {
  console.log(`${prefix} ${message}`)
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

export const probeEndpoint = async (url: string, loggerPrefix = DEFAULT_LOGGER_PREFIX) => {
  const response = await fetchWithTimeout(url)
  expectOkResponse(response, url)
  createLogger(loggerPrefix)(`探测通过: ${url} -> ${response.status}`)
  return response
}

export const waitForEndpoint = async (
  url: string,
  timeoutMs: number,
  loggerPrefix = DEFAULT_LOGGER_PREFIX
) => {
  const startedAt = Date.now()
  let lastError = 'unknown'

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await probeEndpoint(url, loggerPrefix)
      return
    } catch (error: unknown) {
      lastError = toErrorMessage(error)
      await Bun.sleep(1_000)
    }
  }

  throw new Error(`等待服务就绪超时: ${url} (${lastError})`)
}

const probeRootDocument = async (baseUrl: string, loggerPrefix: string) => {
  const url = resolveAbsoluteUrl(baseUrl, '/')
  const response = await fetchWithTimeout(url)
  expectOkResponse(response, url)
  const html = await response.text()
  if (!html.trim()) {
    throw new Error(`首页响应为空: ${url}`)
  }
  createLogger(loggerPrefix)(`首页探测通过: ${url}`)
  return { response, html }
}

const probeSecurityHeaders = (response: Response) => {
  const missingHeaders = resolveMissingSecurityHeaders(response.headers)
  if (missingHeaders.length > 0) {
    throw new Error(`缺少安全响应头: ${missingHeaders.join(', ')}`)
  }
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
  return assetUrl
}

const buildEntryProbeFailureMessage = (
  label: string,
  missingMarkers: string[],
  checkedAssets: string[],
  entryAssetUrls: string[]
) => {
  const failureHints = [
    `missing=${missingMarkers.join(', ') || '(none)'}`,
    `entryAssets=${entryAssetUrls.join(', ') || '(none)'}`,
    `checked=${checkedAssets.join(', ') || '(none)'}`,
    checkedAssets.length === 0 ? 'hint=首页已引用入口资源，但递归探测尚未拉取到任何 JS 资源' : ''
  ].filter(Boolean)
  return `前端${label}入口探测失败: ${failureHints.join('; ')}`
}

const probeFrontendEntryMarkers = async ({
  label,
  baseUrl,
  assetPaths,
  resolveMissingMarkers,
  loggerPrefix
}: {
  label: '实验室' | '系统监控'
  baseUrl: string
  assetPaths: string[]
  resolveMissingMarkers: (assetContents: string[]) => string[]
  loggerPrefix: string
}) => {
  const scriptAssetPaths = filterJavaScriptAssetPaths(assetPaths)
  if (scriptAssetPaths.length === 0) {
    throw new Error(`首页未解析到任何 JS 静态资源路径，无法校验${label}入口`)
  }

  const baseReferrerUrl = `${normalizeBaseUrl(baseUrl)}/`
  const entryAssetUrls = scriptAssetPaths.map((assetPath) =>
    resolveJavaScriptAssetUrl(baseUrl, baseReferrerUrl, assetPath)
  )
  const pendingAssetUrls = [...entryAssetUrls]
  const discoveredAssetUrls = new Set(pendingAssetUrls)
  const checkedAssets: string[] = []
  const assetContents: string[] = []

  while (pendingAssetUrls.length > 0) {
    const assetUrl = pendingAssetUrls.shift()!
    const response = await fetchWithTimeout(assetUrl)
    expectOkResponse(response, assetUrl)
    const scriptContent = await response.text()
    assetContents.push(scriptContent)
    checkedAssets.push(assetUrl)

    const missingMarkers = resolveMissingMarkers(assetContents)
    if (missingMarkers.length === 0) {
      createLogger(loggerPrefix)(`${label}入口探测通过: ${checkedAssets.join(', ')}`)
      return checkedAssets
    }

    for (const dependencyPath of extractReferencedJavaScriptAssetPaths(scriptContent)) {
      const dependencyUrl = resolveJavaScriptAssetUrl(baseUrl, assetUrl, dependencyPath)
      if (discoveredAssetUrls.has(dependencyUrl)) continue
      discoveredAssetUrls.add(dependencyUrl)
      pendingAssetUrls.push(dependencyUrl)
    }
  }

  throw new Error(
    buildEntryProbeFailureMessage(
      label,
      resolveMissingMarkers(assetContents),
      checkedAssets,
      entryAssetUrls
    )
  )
}

const probeFrontendLabEntries = async (
  baseUrl: string,
  assetPaths: string[],
  loggerPrefix: string
) => {
  return await probeFrontendEntryMarkers({
    label: '实验室',
    baseUrl,
    assetPaths,
    resolveMissingMarkers: resolveMissingLabEntryMarkers,
    loggerPrefix
  })
}

const probeFrontendTelemetryEntries = async (
  baseUrl: string,
  assetPaths: string[],
  loggerPrefix: string
) => {
  return await probeFrontendEntryMarkers({
    label: '系统监控',
    baseUrl,
    assetPaths,
    resolveMissingMarkers: resolveMissingTelemetryEntryMarkers,
    loggerPrefix
  })
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
    email: `deploy_acceptance_${suffix}@veomuse.test`,
    password: createSmokePassword(suffix),
    organizationName: `DeployAcceptanceOrg_${suffix}`,
    workspaceName: `deploy-acceptance-${suffix}`
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
        ownerName: 'DeployAcceptanceOwner',
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

const probeUploadFlow = async (baseUrl: string, loggerPrefix: string) => {
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
        fileName: 'deploy-acceptance.bin',
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

  createLogger(loggerPrefix)(
    `上传链路通过: workspace=${workspaceSession.workspaceId}, project=${workspaceSession.projectId}`
  )

  return {
    workspaceId: workspaceSession.workspaceId,
    projectId: workspaceSession.projectId,
    uploadedBytes
  }
}

const probeWebSocketHandshake = async (
  baseUrl: string,
  loggerPrefix: string,
  wsPath = DEFAULT_WS_PATH
) => {
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

  createLogger(loggerPrefix)(`WebSocket 握手通过: ${targetUrl.toString()}`)
  return targetUrl.toString()
}

const recordPassedStep = (summary: DeployAcceptanceSummary, name: string, detail: string) => {
  summary.steps.push({
    name,
    status: 'passed',
    detail
  })
}

const recordFailedStep = (summary: DeployAcceptanceSummary, name: string, detail: string) => {
  summary.steps.push({
    name,
    status: 'failed',
    detail
  })
}

export const runDeploymentAcceptanceProbes = async (
  options: RunDeploymentAcceptanceOptions
): Promise<DeployAcceptanceSummary> => {
  const loggerPrefix = options.loggerPrefix || DEFAULT_LOGGER_PREFIX
  const baseUrl = normalizeBaseUrl(options.baseUrl)
  const summary: DeployAcceptanceSummary = {
    schemaVersion: '1.0',
    startedAt: new Date().toISOString(),
    baseUrl,
    status: 'passed',
    steps: []
  }

  try {
    const { response: rootResponse, html } = await probeRootDocument(baseUrl, loggerPrefix)
    recordPassedStep(summary, 'GET /', `首页可访问，HTML 长度=${html.length}`)

    probeSecurityHeaders(rootResponse)
    recordPassedStep(
      summary,
      '安全响应头',
      `已覆盖 ${REQUIRED_SECURITY_HEADERS.length} 个必需响应头`
    )

    const assetPaths = extractStaticAssetPaths(html)
    const healthResponse = await probeEndpoint(resolveAbsoluteUrl(baseUrl, '/api/health'), loggerPrefix)
    recordPassedStep(summary, 'GET /api/health', `HTTP ${healthResponse.status}`)

    const capabilitiesResponse = await probeEndpoint(
      resolveAbsoluteUrl(baseUrl, '/api/capabilities'),
      loggerPrefix
    )
    recordPassedStep(summary, 'GET /api/capabilities', `HTTP ${capabilitiesResponse.status}`)

    const cachedAssetUrl = await probeStaticAssetCache(baseUrl, assetPaths)
    recordPassedStep(summary, '静态资源缓存', cachedAssetUrl)

    const checkedLabAssets = await probeFrontendLabEntries(baseUrl, assetPaths, loggerPrefix)
    recordPassedStep(summary, '实验室入口 bundle 标识', checkedLabAssets.join(', '))

    const checkedTelemetryAssets = await probeFrontendTelemetryEntries(
      baseUrl,
      assetPaths,
      loggerPrefix
    )
    recordPassedStep(summary, '系统监控入口 bundle 标识', checkedTelemetryAssets.join(', '))

    const wsUrl = await probeWebSocketHandshake(baseUrl, loggerPrefix)
    recordPassedStep(summary, '/ws/generation WebSocket 握手', wsUrl)

    const uploadResult = await probeUploadFlow(baseUrl, loggerPrefix)
    recordPassedStep(
      summary,
      '注册 -> 工作区 -> 上传链路',
      `workspace=${uploadResult.workspaceId}, project=${uploadResult.projectId}, bytes=${uploadResult.uploadedBytes}`
    )
  } catch (error: unknown) {
    summary.status = 'failed'
    summary.error = toErrorMessage(error)
    if (!summary.steps.some((step) => step.status === 'failed')) {
      recordFailedStep(summary, '部署验收', summary.error)
    }
  } finally {
    summary.finishedAt = new Date().toISOString()
  }

  return summary
}

export const buildDeployAcceptanceMarkdown = (summary: DeployAcceptanceSummary) => {
  const lines = [
    '# VeoMuse 外部部署验收摘要',
    '',
    `- 基础地址：\`${summary.baseUrl}\``,
    `- 状态：\`${summary.status}\``,
    `- 开始时间：\`${summary.startedAt}\``,
    `- 结束时间：\`${summary.finishedAt || ''}\``,
    ''
  ]

  if (summary.error) {
    lines.push(`- 错误：${summary.error}`, '')
  }

  lines.push('## 步骤结果', '')
  for (const step of summary.steps) {
    lines.push(`- [${step.status === 'passed' ? 'x' : ' '}] ${step.name}: ${step.detail}`)
  }

  return lines.join('\n')
}
