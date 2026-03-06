import fs from 'fs/promises'
import path from 'path'

type GuardStatus = 'passed' | 'failed'
export type ContractDimension = 'route' | 'documentation' | 'tests'

export interface ApiContractCheck {
  endpoint: string
  route: boolean
  documentation: boolean
  tests: boolean
}

export interface ApiContractFailure {
  endpoint: string
  missing: ContractDimension[]
  reason?: string
}

export interface ApiContractGuardReport {
  status: GuardStatus
  checks: ApiContractCheck[]
  failures: ApiContractFailure[]
  generatedAt: string
}

export interface ApiContractGuardConfig {
  includePrefixes: string[]
  excludePatterns: string[]
  manualRequiredEndpoints: string[]
}

interface ApiContractGuardInput {
  backendPath: string
  docsPath: string
  testsDir: string
  configPath: string
  registryPath: string
  endpoints?: readonly string[]
}

const DEFAULT_CONFIG: ApiContractGuardConfig = {
  includePrefixes: [],
  excludePatterns: [],
  manualRequiredEndpoints: []
}

const DEFAULT_INPUT: ApiContractGuardInput = {
  backendPath: path.resolve(process.cwd(), 'apps/backend/src/index.ts'),
  docsPath: path.resolve(process.cwd(), 'docs/API_DOCUMENTATION.md'),
  testsDir: path.resolve(process.cwd(), 'tests'),
  configPath: path.resolve(process.cwd(), 'scripts/api_contract_guard.config.json'),
  registryPath: path.resolve(process.cwd(), 'docs/api-routes.generated.json')
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const normalizeEndpoint = (value: string) => {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  const normalized = withLeadingSlash.replace(/\/{2,}/g, '/')
  if (normalized === '/') return normalized
  return normalized.replace(/\/+$/g, '')
}

export const buildEndpointPattern = (endpoint: string) => {
  const normalized = normalizeEndpoint(endpoint)
  const segments = normalized.split('/').filter(Boolean)
  const pattern = segments
    .map((segment) => {
      if (segment.startsWith(':')) {
        return String.raw`(?:[:][A-Za-z0-9_]+|\$\{[^}]+\})`
      }
      return escapeRegExp(segment)
    })
    .join('/')
  return new RegExp(`/${pattern}(?=$|[^A-Za-z0-9_/-])`)
}

export const hasEndpoint = (content: string, endpoint: string) => {
  if (!content.trim()) return false
  return buildEndpointPattern(endpoint).test(content)
}

export const readTextFile = async (filePath: string) => {
  try {
    return await fs.readFile(filePath, 'utf8')
  } catch {
    return ''
  }
}

export const readRequiredTextFile = async (filePath: string, fileLabel: string) => {
  try {
    return await fs.readFile(filePath, 'utf8')
  } catch (error) {
    const detail = toErrorMessage(error)
    throw new Error(`读取 ${fileLabel} 失败: ${filePath} (${detail})`)
  }
}

export const listApiTestFiles = async (testsDir: string) => {
  try {
    const entries = await fs.readdir(testsDir, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('_api.test.ts'))
      .map((entry) => path.resolve(testsDir, entry.name))
      .sort((left, right) => left.localeCompare(right))
  } catch {
    return [] as string[]
  }
}

const parseStringArrayField = (
  rawValue: unknown,
  fieldName: keyof ApiContractGuardConfig
): string[] => {
  if (rawValue === undefined || rawValue === null) return []
  if (!Array.isArray(rawValue)) {
    throw new Error(`配置项 ${fieldName} 必须是字符串数组`)
  }
  return rawValue.map((item, index) => {
    if (typeof item !== 'string') {
      throw new Error(`配置项 ${fieldName}[${index}] 必须是字符串`)
    }
    return item.trim()
  })
}

export const loadApiRouteRegistry = async (registryPath: string): Promise<string[]> => {
  const content = await readRequiredTextFile(registryPath, 'API 路由注册表')
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch (error) {
    throw new Error(`解析 API 路由注册表失败: ${registryPath} (${toErrorMessage(error)})`)
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`API 路由注册表格式错误: ${registryPath}（期望 JSON 数组）`)
  }

  const unique = new Set<string>()
  parsed.forEach((item, index) => {
    if (typeof item !== 'string') {
      throw new Error(`API 路由注册表第 ${index + 1} 项必须是字符串`)
    }
    const normalized = normalizeEndpoint(item)
    if (normalized.startsWith('/api')) {
      unique.add(normalized)
    }
  })

  return [...unique].sort((left, right) => left.localeCompare(right))
}

export const loadApiContractGuardConfig = async (
  configPath: string
): Promise<ApiContractGuardConfig> => {
  const content = await readRequiredTextFile(configPath, 'API 契约守卫配置')
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch (error) {
    throw new Error(`解析 API 契约守卫配置失败: ${configPath} (${toErrorMessage(error)})`)
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`API 契约守卫配置格式错误: ${configPath}（期望 JSON 对象）`)
  }

  const config = parsed as Partial<ApiContractGuardConfig>
  return {
    ...DEFAULT_CONFIG,
    includePrefixes: parseStringArrayField(config.includePrefixes, 'includePrefixes')
      .map((item) => normalizeEndpoint(item))
      .filter(Boolean),
    excludePatterns: parseStringArrayField(config.excludePatterns, 'excludePatterns').filter(
      Boolean
    ),
    manualRequiredEndpoints: parseStringArrayField(
      config.manualRequiredEndpoints,
      'manualRequiredEndpoints'
    )
      .map((item) => normalizeEndpoint(item))
      .filter(Boolean)
  }
}

const isPrefixMatched = (endpoint: string, prefix: string) => {
  if (endpoint === prefix) return true
  if (prefix === '/api') return endpoint.startsWith('/api/')
  return endpoint.startsWith(`${prefix}/`)
}

export const resolveApiContractEndpoints = (
  registryEndpoints: readonly string[],
  config: ApiContractGuardConfig
) => {
  const normalizedRegistry = [
    ...new Set(
      registryEndpoints
        .map((item) => normalizeEndpoint(item))
        .filter((endpoint) => endpoint.startsWith('/api'))
    )
  ].sort((left, right) => left.localeCompare(right))

  const includePrefixes = [
    ...new Set(
      config.includePrefixes
        .map((item) => normalizeEndpoint(item))
        .filter((endpoint) => endpoint.startsWith('/api'))
    )
  ]

  const excludePatterns = config.excludePatterns.map((pattern) => {
    try {
      return new RegExp(pattern)
    } catch (error) {
      throw new Error(`excludePatterns 包含无效正则: ${pattern} (${toErrorMessage(error)})`)
    }
  })

  const scoped = includePrefixes.length
    ? normalizedRegistry.filter((endpoint) =>
        includePrefixes.some((prefix) => isPrefixMatched(endpoint, prefix))
      )
    : normalizedRegistry

  const filtered = scoped.filter(
    (endpoint) => !excludePatterns.some((pattern) => pattern.test(endpoint))
  )
  const unique = new Set<string>(filtered)

  config.manualRequiredEndpoints
    .map((item) => normalizeEndpoint(item))
    .filter((endpoint) => endpoint.startsWith('/api'))
    .forEach((endpoint) => unique.add(endpoint))

  return [...unique].sort((left, right) => left.localeCompare(right))
}

export const resolveApiContractEndpointsFromFiles = async (params: {
  configPath: string
  registryPath: string
}) => {
  const [registryEndpoints, config] = await Promise.all([
    loadApiRouteRegistry(params.registryPath),
    loadApiContractGuardConfig(params.configPath)
  ])
  return resolveApiContractEndpoints(registryEndpoints, config)
}

export const resolveArgValue = (argv: string[], flag: string) => {
  const equalsPrefix = `${flag}=`
  for (let index = 0; index < argv.length; index += 1) {
    const item = String(argv[index] || '').trim()
    if (!item) continue
    if (item === flag) {
      return String(argv[index + 1] || '').trim()
    }
    if (item.startsWith(equalsPrefix)) {
      return item.slice(equalsPrefix.length).trim()
    }
  }
  return ''
}

export const resolveGuardInput = (argv: string[]): ApiContractGuardInput => {
  const backendArg = resolveArgValue(argv, '--backend')
  const docsArg = resolveArgValue(argv, '--docs')
  const testsDirArg = resolveArgValue(argv, '--tests-dir')
  const configArg = resolveArgValue(argv, '--config')
  const registryArg = resolveArgValue(argv, '--registry')

  return {
    ...DEFAULT_INPUT,
    backendPath: path.resolve(process.cwd(), backendArg || DEFAULT_INPUT.backendPath),
    docsPath: path.resolve(process.cwd(), docsArg || DEFAULT_INPUT.docsPath),
    testsDir: path.resolve(process.cwd(), testsDirArg || DEFAULT_INPUT.testsDir),
    configPath: path.resolve(process.cwd(), configArg || DEFAULT_INPUT.configPath),
    registryPath: path.resolve(process.cwd(), registryArg || DEFAULT_INPUT.registryPath)
  }
}

export const generateApiContractReport = async (
  input: Partial<ApiContractGuardInput> = {}
): Promise<ApiContractGuardReport> => {
  const resolvedInput: ApiContractGuardInput = {
    backendPath: path.resolve(input.backendPath || DEFAULT_INPUT.backendPath),
    docsPath: path.resolve(input.docsPath || DEFAULT_INPUT.docsPath),
    testsDir: path.resolve(input.testsDir || DEFAULT_INPUT.testsDir),
    configPath: path.resolve(input.configPath || DEFAULT_INPUT.configPath),
    registryPath: path.resolve(input.registryPath || DEFAULT_INPUT.registryPath),
    endpoints: input.endpoints
  }

  const endpoints = resolvedInput.endpoints
    ? [
        ...new Set(resolvedInput.endpoints.map((item) => normalizeEndpoint(item)).filter(Boolean))
      ].sort((left, right) => left.localeCompare(right))
    : await resolveApiContractEndpointsFromFiles({
        configPath: resolvedInput.configPath,
        registryPath: resolvedInput.registryPath
      })

  if (endpoints.length === 0) {
    throw new Error('未解析到任何待检查 endpoint，请检查 registry/config 配置')
  }

  const [backendContent, docsContent, apiTestFiles] = await Promise.all([
    readTextFile(resolvedInput.backendPath),
    readTextFile(resolvedInput.docsPath),
    listApiTestFiles(resolvedInput.testsDir)
  ])
  const apiTestContents = await Promise.all(apiTestFiles.map((filePath) => readTextFile(filePath)))
  const routeRegistry = await loadApiRouteRegistry(resolvedInput.registryPath)
  const routeRegistrySet = new Set(routeRegistry.map((endpoint) => normalizeEndpoint(endpoint)))

  const checks: ApiContractCheck[] = endpoints.map((endpoint) => ({
    endpoint,
    route:
      routeRegistrySet.has(normalizeEndpoint(endpoint)) || hasEndpoint(backendContent, endpoint),
    documentation: hasEndpoint(docsContent, endpoint),
    tests: apiTestContents.some((content) => hasEndpoint(content, endpoint))
  }))

  const failures: ApiContractFailure[] = checks
    .filter((check) => !check.route || !check.documentation || !check.tests)
    .map((check) => {
      const missing: ContractDimension[] = []
      if (!check.route) missing.push('route')
      if (!check.documentation) missing.push('documentation')
      if (!check.tests) missing.push('tests')
      return {
        endpoint: check.endpoint,
        missing
      }
    })

  return {
    status: failures.length === 0 ? 'passed' : 'failed',
    checks,
    failures,
    generatedAt: new Date().toISOString()
  }
}

export const toErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message
  return String(error || 'unknown error')
}

export const buildRuntimeFailureReport = (reason: string): ApiContractGuardReport => ({
  status: 'failed',
  checks: [],
  failures: [
    {
      endpoint: '__runtime__',
      missing: ['route', 'documentation', 'tests'],
      reason
    }
  ],
  generatedAt: new Date().toISOString()
})

export const runApiContractGuard = async (
  argv: string[] = process.argv.slice(2),
  deps?: {
    generateReport?: typeof generateApiContractReport
  }
) => {
  try {
    const input = resolveGuardInput(argv)
    const generateReport = deps?.generateReport || generateApiContractReport
    const report = await generateReport(input)
    return {
      report,
      exitCode: report.status === 'passed' ? 0 : 1
    }
  } catch (error) {
    return {
      report: buildRuntimeFailureReport(toErrorMessage(error)),
      exitCode: 1
    }
  }
}

const run = async () => {
  const result = await runApiContractGuard()
  console.log(JSON.stringify(result.report, null, 2))
  process.exit(result.exitCode)
}

if (import.meta.main) {
  void run()
}
