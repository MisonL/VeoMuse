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

interface RegisterResponse {
  session?: {
    accessToken?: string
    refreshToken?: string
  }
  organizations?: Array<{
    id?: string
  }>
}

interface LoginResponse {
  session?: {
    accessToken?: string
    refreshToken?: string
  }
  organizations?: Array<{
    id?: string
  }>
}

interface AuthMeResponse {
  user?: {
    id?: string
    email?: string
  }
  organizations?: Array<{
    id?: string
  }>
}

interface CreateWorkspaceResponse {
  workspace?: {
    id?: string
    organizationId?: string
  }
  defaultProject?: {
    id?: string
  }
}

interface WorkspaceProjectsResponse {
  projects?: Array<{
    id?: string
  }>
}

interface WorkspaceMembersResponse {
  members?: Array<{
    userId?: string | null
  }>
}

interface ProjectSnapshot {
  id?: string
  content?: Record<string, unknown>
}

interface ProjectSnapshotsResponse {
  snapshots?: ProjectSnapshot[]
}

interface UploadTokenResponse {
  token?: {
    objectKey?: string
    uploadUrl?: string
    publicUrl?: string
  }
}

interface UploadPutResponse {
  uploaded?: {
    objectKey?: string
    bytes?: number
    publicUrl?: string
  }
}

interface DrillIdentity {
  email: string
  password: string
  organizationName: string
  workspaceName: string
  ownerName: string
  snapshotMarker: string
  fileName: string
}

interface AuthenticatedWorkspace {
  accessToken: string
  organizationId: string
  workspaceId: string
  projectId: string
}

interface SnapshotArtifact {
  snapshotId: string
  marker: string
}

interface UploadArtifact {
  objectKey: string
  uploadUrl: string
  publicUrl: string
  expectedBytes: number
}

interface DrillRuntimeState {
  identity: DrillIdentity
  workspace: AuthenticatedWorkspace
  snapshot: SnapshotArtifact
  upload: UploadArtifact
}

interface DrillSummary {
  startedAt: string
  finishedAt?: string
  composeFile: string
  baseUrl: string
  restartedServices: string[]
  workspaceId?: string
  projectId?: string
  organizationId?: string
  snapshotId?: string
  uploadObjectKey?: string
  uploadBytes?: number
  status: 'passed' | 'failed'
  error?: string
}

export const DEFAULT_COMPOSE_FILE = 'config/docker/docker-compose.yml'
export const DEFAULT_BASE_URL = 'http://127.0.0.1:18081'
export const DEFAULT_WAIT_TIMEOUT_SEC = 240
export const REQUEST_TIMEOUT_MS = 15_000
export const INITIAL_REQUIRED_COMPOSE_SERVICES = [
  'veomuse-redis',
  'veomuse-backend',
  'veomuse-frontend'
] as const
export const RESTARTED_COMPOSE_SERVICES = ['veomuse-backend', 'veomuse-frontend'] as const
export const DRILL_SNAPSHOT_KIND = 'docker-persistence-drill'

export const HELP_TEXT = `
Docker Persistence Drill

Usage:
  bun run scripts/docker_persistence_drill.ts [options]

Flags:
  --compose-file <path>   docker compose file path (default: ${DEFAULT_COMPOSE_FILE})
  --base-url <url>        base URL for drill probes (default: ${DEFAULT_BASE_URL})
  --wait-timeout <sec>    wait timeout seconds (default: ${DEFAULT_WAIT_TIMEOUT_SEC})
  --keep-up               keep containers running after the drill
  --no-build              skip --build during compose up
  -h, --help              show help

Flow:
  compose up -> 注册组织/创建工作区 -> 创建项目快照 -> 上传 -> restart backend/frontend
  -> 复检 /api/health、登录、工作区/快照、上传文件仍可用
`.trim()

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

export const buildComposeRestartCommand = (
  composePrefix: string[],
  services: readonly string[] = RESTARTED_COMPOSE_SERVICES
) => [...composePrefix, 'restart', ...services]

export const resolveContainerUploadPath = (objectKey: string) =>
  `/app/uploads/workspace/${objectKey}`

export const buildBackendUploadPersistenceProbeCommand = (
  composePrefix: string[],
  objectKey: string
) => {
  const containerPath = resolveContainerUploadPath(objectKey)
  const escapedPath = `'${containerPath}'`
  return [
    ...composePrefix,
    'exec',
    '-T',
    'veomuse-backend',
    'sh',
    '-lc',
    `test -f ${escapedPath} && wc -c < ${escapedPath}`
  ]
}

const runCommand = async (command: string[], allowFailure = false) => {
  console.log(`[docker-persistence] $ ${command.join(' ')}`)
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
  console.log(`[docker-persistence] $ ${command.join(' ')}`)
  const proc = Bun.spawn(command, {
    stdout: 'pipe',
    stderr: 'pipe'
  })
  const [stdoutText, stderrText, exitCode] = await Promise.all([
    proc.stdout.text(),
    proc.stderr.text(),
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

const resolveAbsoluteUrl = (baseUrl: string, pathOrUrl: string) =>
  new URL(pathOrUrl, `${normalizeBaseUrl(baseUrl)}/`).toString()

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

const probeEndpoint = async (url: string) => {
  const response = await fetchWithTimeout(url)
  expectOkResponse(response, url)
  console.log(`[docker-persistence] 探测通过: ${url} -> ${response.status}`)
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

const waitForComposeServiceHealth = async (
  composePrefix: string[],
  service: string,
  timeoutMs: number
) => {
  const startedAt = Date.now()
  let lastHealth = 'missing'

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const containerId = await captureCommand([...composePrefix, 'ps', '-q', service])
      if (!containerId) {
        lastHealth = 'missing'
      } else {
        lastHealth = await captureCommand([
          'docker',
          'inspect',
          '-f',
          '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}',
          containerId
        ])
        if (lastHealth.trim() === 'healthy') {
          console.log(`[docker-persistence] 服务健康通过: ${service}`)
          return
        }
      }
    } catch (error: unknown) {
      lastHealth = toErrorMessage(error)
    }

    await Bun.sleep(1_000)
  }

  throw new Error(`等待服务 healthy 超时: ${service} (${lastHealth})`)
}

const collectDiagnostics = async (composePrefix: string[]) => {
  console.error('[docker-persistence] 开始采集容器状态与日志...')
  await runCommand([...composePrefix, 'ps'], true)
  await runCommand([...composePrefix, 'logs', '--tail', '200'], true)
}

const createDrillPassword = (seed: string) => {
  const compact = seed
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-12)
    .padEnd(12, 'x')
  return `Vm${compact}#Q9a`
}

const createDrillIdentity = (): DrillIdentity => {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  return {
    email: `docker_persistence_${suffix}@veomuse.test`,
    password: createDrillPassword(suffix),
    organizationName: `DockerPersistenceOrg_${suffix}`,
    workspaceName: `docker-persistence-${suffix}`,
    ownerName: 'DockerPersistenceOwner',
    snapshotMarker: `snapshot-${suffix}`,
    fileName: `docker-persistence-${suffix}.bin`
  }
}

const buildJsonHeaders = (accessToken?: string, organizationId?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }
  if (organizationId) {
    headers['x-organization-id'] = organizationId
  }
  return headers
}

const registerDrillIdentity = async (
  baseUrl: string,
  identity: DrillIdentity
): Promise<{ accessToken: string; organizationId: string }> => {
  const payload = await jsonRequest<RegisterResponse>(
    resolveAbsoluteUrl(baseUrl, '/api/auth/register'),
    {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify({
        email: identity.email,
        password: identity.password,
        organizationName: identity.organizationName
      })
    }
  )

  const accessToken = String(payload.session?.accessToken || '').trim()
  const organizationId = String(payload.organizations?.[0]?.id || '').trim()
  if (!accessToken || !organizationId) {
    throw new Error('注册成功后未返回 accessToken 或 organizationId')
  }

  return {
    accessToken,
    organizationId
  }
}

const createWorkspace = async (
  baseUrl: string,
  identity: DrillIdentity,
  registered: { accessToken: string; organizationId: string }
): Promise<AuthenticatedWorkspace> => {
  const payload = await jsonRequest<CreateWorkspaceResponse>(
    resolveAbsoluteUrl(baseUrl, '/api/workspaces'),
    {
      method: 'POST',
      headers: buildJsonHeaders(registered.accessToken, registered.organizationId),
      body: JSON.stringify({
        name: identity.workspaceName,
        ownerName: identity.ownerName,
        organizationId: registered.organizationId
      })
    }
  )

  const workspaceId = String(payload.workspace?.id || '').trim()
  const projectId = String(payload.defaultProject?.id || '').trim()
  if (!workspaceId || !projectId) {
    throw new Error('创建工作区成功后未返回 workspaceId 或 defaultProject.id')
  }

  return {
    accessToken: registered.accessToken,
    organizationId: registered.organizationId,
    workspaceId,
    projectId
  }
}

const createProjectSnapshot = async (
  baseUrl: string,
  workspace: AuthenticatedWorkspace,
  marker: string
): Promise<SnapshotArtifact> => {
  const payload = await jsonRequest<{ snapshot?: { id?: string } }>(
    resolveAbsoluteUrl(baseUrl, `/api/projects/${workspace.projectId}/snapshots`),
    {
      method: 'POST',
      headers: buildJsonHeaders(workspace.accessToken, workspace.organizationId),
      body: JSON.stringify({
        content: {
          kind: DRILL_SNAPSHOT_KIND,
          marker,
          workspaceId: workspace.workspaceId
        }
      })
    }
  )

  const snapshotId = String(payload.snapshot?.id || '').trim()
  if (!snapshotId) {
    throw new Error('创建项目快照成功后未返回 snapshot.id')
  }

  return {
    snapshotId,
    marker
  }
}

const issueUploadToken = async (
  baseUrl: string,
  workspace: AuthenticatedWorkspace,
  fileName: string
) => {
  const payload = await jsonRequest<UploadTokenResponse>(
    resolveAbsoluteUrl(baseUrl, '/api/storage/upload-token'),
    {
      method: 'POST',
      headers: buildJsonHeaders(workspace.accessToken, workspace.organizationId),
      body: JSON.stringify({
        workspaceId: workspace.workspaceId,
        projectId: workspace.projectId,
        fileName,
        contentType: 'application/octet-stream'
      })
    }
  )

  const objectKey = String(payload.token?.objectKey || '').trim()
  const uploadUrl = String(payload.token?.uploadUrl || '').trim()
  const publicUrl = String(payload.token?.publicUrl || '').trim()
  if (!objectKey || !uploadUrl || !publicUrl) {
    throw new Error('上传令牌响应缺少 objectKey、uploadUrl 或 publicUrl')
  }

  return {
    objectKey,
    uploadUrl,
    publicUrl
  }
}

const uploadDrillAsset = async (
  baseUrl: string,
  workspace: AuthenticatedWorkspace,
  fileName: string
): Promise<UploadArtifact> => {
  const token = await issueUploadToken(baseUrl, workspace, fileName)
  const payloadText = `veomuse-docker-persistence:${workspace.workspaceId}:${token.objectKey}`
  const payloadBytes = new TextEncoder().encode(payloadText)
  const uploadUrl = resolveAbsoluteUrl(baseUrl, token.uploadUrl)
  const uploadResponse = await jsonRequest<UploadPutResponse>(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${workspace.accessToken}`,
      'x-organization-id': workspace.organizationId,
      'Content-Type': 'application/octet-stream'
    },
    body: payloadBytes
  })

  const uploadedBytes = Number(uploadResponse.uploaded?.bytes || 0)
  if (uploadedBytes !== payloadBytes.byteLength) {
    throw new Error(
      `上传链路返回的 uploaded.bytes 异常: expected=${payloadBytes.byteLength}, actual=${uploadedBytes}`
    )
  }

  return {
    objectKey: token.objectKey,
    uploadUrl: token.uploadUrl,
    publicUrl: token.publicUrl,
    expectedBytes: payloadBytes.byteLength
  }
}

const loginDrillIdentity = async (baseUrl: string, identity: DrillIdentity) => {
  const payload = await jsonRequest<LoginResponse>(resolveAbsoluteUrl(baseUrl, '/api/auth/login'), {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({
      email: identity.email,
      password: identity.password
    })
  })

  const accessToken = String(payload.session?.accessToken || '').trim()
  if (!accessToken) {
    throw new Error('登录成功后未返回 accessToken')
  }

  return {
    accessToken,
    organizationIds: (payload.organizations || [])
      .map((item) => String(item.id || '').trim())
      .filter(Boolean)
  }
}

const assertPersistedProjectState = async (
  baseUrl: string,
  identity: DrillIdentity,
  runtimeState: DrillRuntimeState
) => {
  const loggedIn = await loginDrillIdentity(baseUrl, identity)
  if (!loggedIn.organizationIds.includes(runtimeState.workspace.organizationId)) {
    throw new Error(`登录后未看到目标组织: ${runtimeState.workspace.organizationId}`)
  }

  const me = await jsonRequest<AuthMeResponse>(resolveAbsoluteUrl(baseUrl, '/api/auth/me'), {
    headers: {
      Authorization: `Bearer ${loggedIn.accessToken}`,
      'x-organization-id': runtimeState.workspace.organizationId
    }
  })

  if (String(me.user?.email || '').trim() !== identity.email) {
    throw new Error(`登录后的当前用户邮箱不匹配: ${String(me.user?.email || '')}`)
  }

  const workspaceProjects = await jsonRequest<WorkspaceProjectsResponse>(
    resolveAbsoluteUrl(baseUrl, `/api/workspaces/${runtimeState.workspace.workspaceId}/projects`),
    {
      headers: {
        Authorization: `Bearer ${loggedIn.accessToken}`,
        'x-organization-id': runtimeState.workspace.organizationId
      }
    }
  )

  const projectIds = (workspaceProjects.projects || [])
    .map((item) => String(item.id || '').trim())
    .filter(Boolean)
  if (!projectIds.includes(runtimeState.workspace.projectId)) {
    throw new Error(`工作区项目列表缺少默认项目: ${runtimeState.workspace.projectId}`)
  }

  const workspaceMembers = await jsonRequest<WorkspaceMembersResponse>(
    resolveAbsoluteUrl(baseUrl, `/api/workspaces/${runtimeState.workspace.workspaceId}/members`),
    {
      headers: {
        Authorization: `Bearer ${loggedIn.accessToken}`,
        'x-organization-id': runtimeState.workspace.organizationId
      }
    }
  )

  const hasBoundUser = (workspaceMembers.members || []).some(
    (member) => String(member.userId || '').trim() === String(me.user?.id || '').trim()
  )
  if (!hasBoundUser) {
    throw new Error(`工作区成员列表缺少当前用户: ${String(me.user?.id || '')}`)
  }

  const snapshots = await jsonRequest<ProjectSnapshotsResponse>(
    resolveAbsoluteUrl(baseUrl, `/api/projects/${runtimeState.workspace.projectId}/snapshots?limit=20`),
    {
      headers: {
        Authorization: `Bearer ${loggedIn.accessToken}`,
        'x-organization-id': runtimeState.workspace.organizationId
      }
    }
  )

  const matchedSnapshot = (snapshots.snapshots || []).find(
    (item) => String(item.id || '').trim() === runtimeState.snapshot.snapshotId
  )
  if (!matchedSnapshot) {
    throw new Error(`重启后未找到项目快照: ${runtimeState.snapshot.snapshotId}`)
  }

  if (String(matchedSnapshot.content?.kind || '').trim() !== DRILL_SNAPSHOT_KIND) {
    throw new Error(`项目快照 kind 不匹配: ${String(matchedSnapshot.content?.kind || '')}`)
  }

  if (String(matchedSnapshot.content?.marker || '').trim() !== runtimeState.snapshot.marker) {
    throw new Error(`项目快照 marker 不匹配: ${String(matchedSnapshot.content?.marker || '')}`)
  }
}

const assertPersistedUploadOnBackend = async (
  composePrefix: string[],
  upload: UploadArtifact
) => {
  const stdoutText = await captureCommand(
    buildBackendUploadPersistenceProbeCommand(composePrefix, upload.objectKey)
  )
  const storedBytes = Number.parseInt(stdoutText.trim(), 10)
  if (!Number.isFinite(storedBytes) || storedBytes !== upload.expectedBytes) {
    throw new Error(
      `上传文件持久化校验失败: expected=${upload.expectedBytes}, actual=${stdoutText.trim()}`
    )
  }
  console.log(`[docker-persistence] 上传文件持久化通过: ${upload.objectKey}`)
}

const restartApplicationServices = async (composePrefix: string[]) => {
  await runCommand(buildComposeRestartCommand(composePrefix, RESTARTED_COMPOSE_SERVICES))
}

const runInitialDrillFlow = async (baseUrl: string): Promise<DrillRuntimeState> => {
  const identity = createDrillIdentity()
  const registered = await registerDrillIdentity(baseUrl, identity)
  const workspace = await createWorkspace(baseUrl, identity, registered)
  const snapshot = await createProjectSnapshot(baseUrl, workspace, identity.snapshotMarker)
  const upload = await uploadDrillAsset(baseUrl, workspace, identity.fileName)

  console.log(
    `[docker-persistence] 初始建数完成: org=${workspace.organizationId}, workspace=${workspace.workspaceId}, project=${workspace.projectId}`
  )

  return {
    identity,
    workspace,
    snapshot,
    upload
  }
}

const assertPostRestartReadiness = async (
  baseUrl: string,
  composePrefix: string[],
  waitTimeoutMs: number
) => {
  for (const service of RESTARTED_COMPOSE_SERVICES) {
    await waitForComposeServiceHealth(composePrefix, service, waitTimeoutMs)
  }

  await waitForEndpoint(resolveAbsoluteUrl(baseUrl, '/api/health'), waitTimeoutMs)
  await probeEndpoint(resolveAbsoluteUrl(baseUrl, '/'))
}

export const runPersistenceDrill = async (options: CliOptions) => {
  const summary: DrillSummary = {
    startedAt: new Date().toISOString(),
    composeFile: options.composeFile,
    baseUrl: normalizeBaseUrl(options.baseUrl),
    restartedServices: [...RESTARTED_COMPOSE_SERVICES],
    status: 'failed'
  }

  const composeRuntime = await resolveComposeRuntime(options.composeFile)
  const composePrefix = composeRuntime.prefix
  const waitTimeoutMs = options.waitTimeoutSec * 1_000
  let hasFailure = false
  let needDiagnostics = false

  try {
    await runCommand(buildComposeUpCommand(composePrefix, options, composeRuntime.supportsWait))

    for (const service of INITIAL_REQUIRED_COMPOSE_SERVICES) {
      await waitForComposeServiceHealth(composePrefix, service, waitTimeoutMs)
    }

    await waitForEndpoint(resolveAbsoluteUrl(summary.baseUrl, '/api/health'), waitTimeoutMs)

    const runtimeState = await runInitialDrillFlow(summary.baseUrl)
    summary.organizationId = runtimeState.workspace.organizationId
    summary.workspaceId = runtimeState.workspace.workspaceId
    summary.projectId = runtimeState.workspace.projectId
    summary.snapshotId = runtimeState.snapshot.snapshotId
    summary.uploadObjectKey = runtimeState.upload.objectKey
    summary.uploadBytes = runtimeState.upload.expectedBytes

    await restartApplicationServices(composePrefix)
    await assertPostRestartReadiness(summary.baseUrl, composePrefix, waitTimeoutMs)
    await assertPersistedProjectState(summary.baseUrl, runtimeState.identity, runtimeState)
    await assertPersistedUploadOnBackend(composePrefix, runtimeState.upload)

    summary.status = 'passed'
    console.log('[docker-persistence] Drill 检查通过。')
  } catch (error: unknown) {
    hasFailure = true
    needDiagnostics = true
    summary.error = toErrorMessage(error)
    console.error(`[docker-persistence] Drill 检查失败: ${summary.error}`)
  } finally {
    summary.finishedAt = new Date().toISOString()
    console.log('--- DOCKER PERSISTENCE DRILL SUMMARY ---')
    console.log(JSON.stringify(summary, null, 2))
  }

  if (needDiagnostics) {
    await collectDiagnostics(composePrefix)
  }

  if (options.keepUp) {
    console.log('[docker-persistence] --keep-up 已启用，跳过 down 清理。')
  } else {
    const downExitCode = await runCommand(buildComposeDownCommand(composePrefix), true)
    if (downExitCode !== 0) {
      hasFailure = true
      console.error(`[docker-persistence] 清理失败，退出码: ${downExitCode}`)
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
  await runPersistenceDrill(parsed.options)
}

if (import.meta.main) {
  await main().catch((error: unknown) => {
    console.error(`[docker-persistence] ${toErrorMessage(error)}`)
    console.log(HELP_TEXT)
    process.exit(1)
  })
}
