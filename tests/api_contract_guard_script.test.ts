import { afterEach, describe, expect, it } from 'bun:test'
import fs from 'fs/promises'
import path from 'path'
import {
  buildEndpointPattern,
  type ApiContractGuardConfig,
  type ApiContractGuardReport
} from '../scripts/api_contract_guard'

const tempRoot = path.resolve(process.cwd(), 'artifacts', 'tests', 'api-contract-guard')
const createdCaseDirs: string[] = []

const BASE_REGISTRY_ENDPOINTS = [
  '/api/demo/alpha',
  '/api/demo/beta/:id',
  '/api/demo/gamma'
] as const

interface FixturePaths {
  backendPath: string
  docsPath: string
  testsDir: string
  configPath: string
  registryPath: string
}

interface CreateFixtureParams {
  caseName: string
  registryEndpoints?: readonly string[]
  config?: Partial<ApiContractGuardConfig>
  omitInDocs?: string
  omitInTests?: string
  skipRegistry?: boolean
  additionalBackendEndpoints?: readonly string[]
  additionalDocsEndpoints?: readonly string[]
  additionalTestEndpoints?: readonly string[]
}

const uniqueSorted = (items: readonly string[]) =>
  [...new Set(items.map((item) => item.trim()).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  )

const toApiTestTemplatePath = (endpoint: string) =>
  endpoint.replace(/:([A-Za-z0-9_]+)/g, (_match: string, paramName: string) => `\${${paramName}}`)

const buildBackendContent = (endpoints: readonly string[]) =>
  [
    'const app = { get: () => app, post: () => app }',
    ...endpoints.map((endpoint, index) => {
      const method = index % 2 === 0 ? 'get' : 'post'
      return `app.${method}('${endpoint}', () => ({ ok: true }))`
    })
  ].join('\n')

const buildDocsContent = (endpoints: readonly string[]) =>
  ['# API CONTRACT FIXTURE', ...endpoints.map((endpoint) => `### POST \`${endpoint}\``)].join(
    '\n\n'
  )

const buildApiTestContent = (endpoints: readonly string[]) =>
  [
    "import { describe, it, expect } from 'bun:test'",
    "describe('api contract fixture', () => {",
    "  it('contains all endpoints', () => {",
    "    const id = 'id-1'",
    ...endpoints.map(
      (endpoint, index) =>
        `    const request${index} = \`http://localhost${toApiTestTemplatePath(endpoint)}\``
    ),
    '    expect(true).toBe(true)',
    '  })',
    '})'
  ].join('\n')

const createFixture = async (params: CreateFixtureParams) => {
  await fs.mkdir(tempRoot, { recursive: true })
  const caseDir = path.join(
    tempRoot,
    `${params.caseName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  )
  createdCaseDirs.push(caseDir)
  await fs.mkdir(caseDir, { recursive: true })

  const backendPath = path.join(caseDir, 'backend_index.ts')
  const docsPath = path.join(caseDir, 'API_DOCUMENTATION.md')
  const testsDir = path.join(caseDir, 'tests')
  const configPath = path.join(caseDir, 'api_contract_guard.config.json')
  const registryPath = path.join(caseDir, 'api-routes.generated.json')
  await fs.mkdir(testsDir, { recursive: true })

  const registryEndpoints = uniqueSorted(params.registryEndpoints || BASE_REGISTRY_ENDPOINTS)
  const backendEndpoints = uniqueSorted([
    ...registryEndpoints,
    ...(params.additionalBackendEndpoints || [])
  ])
  const docsEndpoints = uniqueSorted(
    [...registryEndpoints, ...(params.additionalDocsEndpoints || [])].filter(
      (endpoint) => endpoint !== params.omitInDocs
    )
  )
  const testEndpoints = uniqueSorted(
    [...registryEndpoints, ...(params.additionalTestEndpoints || [])].filter(
      (endpoint) => endpoint !== params.omitInTests
    )
  )

  const config: ApiContractGuardConfig = {
    includePrefixes: ['/api/demo'],
    excludePatterns: [],
    manualRequiredEndpoints: [],
    ...(params.config || {})
  }

  const writes = [
    fs.writeFile(backendPath, buildBackendContent(backendEndpoints), 'utf8'),
    fs.writeFile(docsPath, buildDocsContent(docsEndpoints), 'utf8'),
    fs.writeFile(
      path.join(testsDir, 'contract_api.test.ts'),
      buildApiTestContent(testEndpoints),
      'utf8'
    ),
    fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  ]

  if (!params.skipRegistry) {
    writes.push(
      fs.writeFile(registryPath, `${JSON.stringify(registryEndpoints, null, 2)}\n`, 'utf8')
    )
  }

  await Promise.all(writes)

  return {
    backendPath,
    docsPath,
    testsDir,
    configPath,
    registryPath
  } satisfies FixturePaths
}

const runGuardCli = async (fixture: FixturePaths) => {
  const proc = Bun.spawn(
    [
      'bun',
      'run',
      'scripts/api_contract_guard.ts',
      '--backend',
      fixture.backendPath,
      '--docs',
      fixture.docsPath,
      '--tests-dir',
      fixture.testsDir,
      '--config',
      fixture.configPath,
      '--registry',
      fixture.registryPath
    ],
    {
      cwd: process.cwd(),
      stdout: 'pipe',
      stderr: 'pipe'
    }
  )

  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text()
  ])
  const output = stdout.trim()
  if (!output) {
    throw new Error(`api_contract_guard 无输出: ${stderr}`)
  }

  return {
    exitCode,
    report: JSON.parse(output) as ApiContractGuardReport
  }
}

afterEach(async () => {
  while (createdCaseDirs.length > 0) {
    const caseDir = createdCaseDirs.pop()
    if (!caseDir) continue
    await fs.rm(caseDir, { recursive: true, force: true })
  }
})

describe('API 契约守卫脚本', () => {
  it('buildEndpointPattern 应支持分组前缀路径与动态参数匹配', () => {
    const pattern = buildEndpointPattern('/api/v4/creative/prompt-workflows/:workflowId/run')
    const runsPattern = buildEndpointPattern('/api/v4/creative/prompt-workflows/:workflowId/runs')
    const ackPattern = buildEndpointPattern('/api/v4/admin/reliability/alerts/:alertId/ack')

    expect(
      pattern.test("group.post('/api/v4/creative/prompt-workflows/:id/run', () => ({ ok: true }))")
    ).toBe(true)
    expect(pattern.test('POST `/api/v4/creative/prompt-workflows/:workflowId/run`')).toBe(true)
    expect(
      pattern.test('http://localhost/api/v4/creative/prompt-workflows/${workflowId}/run')
    ).toBe(true)
    expect(pattern.test('/api/v4/creative/prompt-workflows/:workflowId/retry')).toBe(false)

    expect(
      runsPattern.test(
        "group.get('/api/v4/creative/prompt-workflows/:id/runs', () => ({ ok: true }))"
      )
    ).toBe(true)
    expect(
      runsPattern.test('http://localhost/api/v4/creative/prompt-workflows/${workflowId}/runs')
    ).toBe(true)
    expect(runsPattern.test('/api/v4/creative/prompt-workflows/:workflowId/run')).toBe(false)

    expect(
      ackPattern.test(
        "group.post('/api/v4/admin/reliability/alerts/:id/ack', () => ({ ok: true }))"
      )
    ).toBe(true)
    expect(ackPattern.test('http://localhost/api/v4/admin/reliability/alerts/${alertId}/ack')).toBe(
      true
    )
    expect(ackPattern.test('/api/v4/admin/reliability/alerts/:alertId/close')).toBe(false)
  })

  it('全通过场景应输出 passed 并返回 0', async () => {
    const fixture = await createFixture({ caseName: 'all-pass' })
    const result = await runGuardCli(fixture)

    expect(result.exitCode).toBe(0)
    expect(result.report.status).toBe('passed')
    expect(result.report.checks.length).toBe(BASE_REGISTRY_ENDPOINTS.length)
    expect(result.report.failures.length).toBe(0)
    expect(
      result.report.checks.every((item) => item.route && item.documentation && item.tests)
    ).toBe(true)
    expect(Number.isNaN(Date.parse(result.report.generatedAt))).toBe(false)
  })

  it('缺文档场景应输出 failed 且标记 documentation 缺失', async () => {
    const missingEndpoint = BASE_REGISTRY_ENDPOINTS[1]
    const fixture = await createFixture({
      caseName: 'missing-docs',
      omitInDocs: missingEndpoint
    })
    const result = await runGuardCli(fixture)

    expect(result.exitCode).toBe(1)
    expect(result.report.status).toBe('failed')

    const failure = result.report.failures.find((item) => item.endpoint === missingEndpoint)
    expect(failure).toBeDefined()
    expect(failure?.missing).toEqual(['documentation'])
  })

  it('缺测试场景应输出 failed 且标记 tests 缺失', async () => {
    const missingEndpoint = BASE_REGISTRY_ENDPOINTS[2]
    const fixture = await createFixture({
      caseName: 'missing-tests',
      omitInTests: missingEndpoint
    })
    const result = await runGuardCli(fixture)

    expect(result.exitCode).toBe(1)
    expect(result.report.status).toBe('failed')

    const failure = result.report.failures.find((item) => item.endpoint === missingEndpoint)
    expect(failure).toBeDefined()
    expect(failure?.missing).toEqual(['tests'])
  })

  it('registry 缺失时应走 runtime failed 分支', async () => {
    const fixture = await createFixture({
      caseName: 'missing-registry',
      skipRegistry: true
    })
    const result = await runGuardCli(fixture)

    expect(result.exitCode).toBe(1)
    expect(result.report.status).toBe('failed')
    expect(result.report.failures[0]?.endpoint).toBe('__runtime__')
    expect(result.report.failures[0]?.reason).toContain('API 路由注册表')
  })

  it('配置过滤应只保留 includePrefixes 且排除 excludePatterns 命中的 endpoint', async () => {
    const fixture = await createFixture({
      caseName: 'config-filter',
      registryEndpoints: ['/api/demo/keep', '/api/demo/skip', '/api/other/outside'],
      config: {
        includePrefixes: ['/api/demo'],
        excludePatterns: ['skip$'],
        manualRequiredEndpoints: []
      }
    })
    const result = await runGuardCli(fixture)

    expect(result.exitCode).toBe(0)
    expect(result.report.status).toBe('passed')
    expect(result.report.checks.map((item) => item.endpoint)).toEqual(['/api/demo/keep'])
  })

  it('manualRequiredEndpoints 应追加到检查集合（即使不在 registry）', async () => {
    const manualEndpoint = '/api/manual/required'
    const fixture = await createFixture({
      caseName: 'manual-endpoint',
      registryEndpoints: ['/api/demo/keep'],
      config: {
        includePrefixes: ['/api/demo'],
        excludePatterns: [],
        manualRequiredEndpoints: [manualEndpoint]
      },
      additionalBackendEndpoints: [manualEndpoint],
      additionalDocsEndpoints: [manualEndpoint],
      additionalTestEndpoints: [manualEndpoint]
    })
    const result = await runGuardCli(fixture)

    expect(result.exitCode).toBe(0)
    expect(result.report.status).toBe('passed')
    expect(result.report.checks.map((item) => item.endpoint)).toEqual([
      '/api/demo/keep',
      manualEndpoint
    ])
  })
})
