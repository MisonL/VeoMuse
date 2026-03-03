import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'bun:test'
import {
  buildRuntimeFailureReport,
  generateApiContractReport,
  hasEndpoint,
  listApiTestFiles,
  loadApiContractGuardConfig,
  loadApiRouteRegistry,
  readTextFile,
  resolveApiContractEndpoints,
  resolveArgValue,
  resolveGuardInput,
  runApiContractGuard,
  toErrorMessage,
  type ApiContractGuardConfig,
  type ApiContractGuardReport
} from '../scripts/api_contract_guard'

const tempDirs: string[] = []

const createCaseDir = async (name: string) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `veomuse-api-guard-${name}-`))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (!dir) continue
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  }
})

describe('API 契约守卫 runtime 核心覆盖', () => {
  it('hasEndpoint 应支持动态参数与空内容兜底', () => {
    expect(hasEndpoint('', '/api/v4/creative/prompt-workflows/:workflowId/run')).toBe(false)
    expect(
      hasEndpoint(
        "group.post('/api/v4/creative/prompt-workflows/:id/run', () => ({ ok: true }))",
        '/api/v4/creative/prompt-workflows/:workflowId/run'
      )
    ).toBe(true)
  })

  it('readTextFile 与 listApiTestFiles 应处理缺失路径', async () => {
    const dir = await createCaseDir('files')
    const testsDir = path.join(dir, 'tests')
    await fs.mkdir(testsDir, { recursive: true })
    await Promise.all([
      fs.writeFile(path.join(dir, 'doc.md'), 'hello', 'utf8'),
      fs.writeFile(path.join(testsDir, 'a_api.test.ts'), '// a', 'utf8'),
      fs.writeFile(path.join(testsDir, 'b_api.test.ts'), '// b', 'utf8'),
      fs.writeFile(path.join(testsDir, 'ignore.test.ts'), '// ignore', 'utf8')
    ])

    expect(await readTextFile(path.join(dir, 'doc.md'))).toBe('hello')
    expect(await readTextFile(path.join(dir, 'missing.md'))).toBe('')
    expect(await listApiTestFiles(testsDir)).toEqual([
      path.resolve(testsDir, 'a_api.test.ts'),
      path.resolve(testsDir, 'b_api.test.ts')
    ])
    expect(await listApiTestFiles(path.join(dir, 'missing-tests'))).toEqual([])
  })

  it('resolveArgValue 与 resolveGuardInput 应解析 backend/docs/tests/config/registry 参数', () => {
    const argv = [
      '--backend',
      'apps/backend/src/index.ts',
      '--docs=docs/API_DOCUMENTATION.md',
      '--tests-dir',
      'tests',
      '--config=scripts/api_contract_guard.config.json',
      '--registry',
      'docs/api-routes.generated.json'
    ]
    expect(resolveArgValue(argv, '--backend')).toBe('apps/backend/src/index.ts')
    expect(resolveArgValue(argv, '--docs')).toBe('docs/API_DOCUMENTATION.md')
    expect(resolveArgValue(argv, '--tests-dir')).toBe('tests')
    expect(resolveArgValue(argv, '--config')).toBe('scripts/api_contract_guard.config.json')
    expect(resolveArgValue(argv, '--registry')).toBe('docs/api-routes.generated.json')
    expect(resolveArgValue(argv, '--missing')).toBe('')

    const resolved = resolveGuardInput(argv)
    expect(resolved.backendPath.endsWith('/apps/backend/src/index.ts')).toBe(true)
    expect(resolved.docsPath.endsWith('/docs/API_DOCUMENTATION.md')).toBe(true)
    expect(resolved.testsDir.endsWith('/tests')).toBe(true)
    expect(resolved.configPath.endsWith('/scripts/api_contract_guard.config.json')).toBe(true)
    expect(resolved.registryPath.endsWith('/docs/api-routes.generated.json')).toBe(true)
  })

  it('loadApiRouteRegistry 应处理缺失文件并解析排序去重结果', async () => {
    const dir = await createCaseDir('registry')
    const registryPath = path.join(dir, 'api-routes.generated.json')
    await fs.writeFile(
      registryPath,
      JSON.stringify(['/api/demo/b', '/api/demo/a', '/api/demo/b', 'not-api'], null, 2),
      'utf8'
    )

    expect(await loadApiRouteRegistry(registryPath)).toEqual(['/api/demo/a', '/api/demo/b'])

    await expect(loadApiRouteRegistry(path.join(dir, 'missing.json'))).rejects.toThrow(
      'API 路由注册表'
    )
  })

  it('loadApiContractGuardConfig 与 resolveApiContractEndpoints 应支持 include/exclude/manual 规则', async () => {
    const dir = await createCaseDir('config')
    const configPath = path.join(dir, 'api_contract_guard.config.json')
    const rawConfig: ApiContractGuardConfig = {
      includePrefixes: ['/api/demo'],
      excludePatterns: ['skip$'],
      manualRequiredEndpoints: ['/api/manual/required']
    }
    await fs.writeFile(configPath, JSON.stringify(rawConfig, null, 2), 'utf8')

    const config = await loadApiContractGuardConfig(configPath)
    const endpoints = resolveApiContractEndpoints(
      ['/api/demo/keep', '/api/demo/skip', '/api/other/outside'],
      config
    )

    expect(endpoints).toEqual(['/api/demo/keep', '/api/manual/required'])
  })

  it('generateApiContractReport 应按 registry + config 计算检查集合并返回缺失维度', async () => {
    const dir = await createCaseDir('report')
    const backendPath = path.join(dir, 'backend.ts')
    const docsPath = path.join(dir, 'api.md')
    const testsDir = path.join(dir, 'tests')
    const configPath = path.join(dir, 'api_contract_guard.config.json')
    const registryPath = path.join(dir, 'api-routes.generated.json')
    await fs.mkdir(testsDir, { recursive: true })

    await Promise.all([
      fs.writeFile(
        backendPath,
        [
          "app.get('/api/demo/a', () => ({ ok: true }))",
          "app.get('/api/manual/required', () => ({ ok: true }))"
        ].join('\n'),
        'utf8'
      ),
      fs.writeFile(docsPath, 'POST `/api/demo/a`\n\nPOST `/api/manual/required`', 'utf8'),
      fs.writeFile(
        path.join(testsDir, 'demo_api.test.ts'),
        'const a = "/api/demo/a"\nconst m = "/api/manual/required"',
        'utf8'
      ),
      fs.writeFile(
        configPath,
        JSON.stringify(
          {
            includePrefixes: ['/api/demo'],
            excludePatterns: [],
            manualRequiredEndpoints: ['/api/manual/required', '/api/demo/b']
          } satisfies ApiContractGuardConfig,
          null,
          2
        ),
        'utf8'
      ),
      fs.writeFile(registryPath, JSON.stringify(['/api/demo/a'], null, 2), 'utf8')
    ])

    const report = await generateApiContractReport({
      backendPath,
      docsPath,
      testsDir,
      configPath,
      registryPath
    })

    expect(report.status).toBe('failed')
    expect(report.checks.map((item) => item.endpoint)).toEqual([
      '/api/demo/a',
      '/api/demo/b',
      '/api/manual/required'
    ])
    const missing = report.failures.find((item) => item.endpoint === '/api/demo/b')
    expect(missing?.missing).toEqual(['route', 'documentation', 'tests'])
  })

  it('runApiContractGuard 应返回成功/失败退出码，并覆盖异常分支', async () => {
    const passedReport: ApiContractGuardReport = {
      status: 'passed',
      checks: [],
      failures: [],
      generatedAt: new Date().toISOString()
    }
    const failedReport: ApiContractGuardReport = {
      status: 'failed',
      checks: [],
      failures: [{ endpoint: '/api/demo', missing: ['tests'] }],
      generatedAt: new Date().toISOString()
    }

    const passed = await runApiContractGuard([], {
      generateReport: async () => passedReport
    })
    expect(passed.exitCode).toBe(0)
    expect(passed.report.status).toBe('passed')

    const failed = await runApiContractGuard([], {
      generateReport: async () => failedReport
    })
    expect(failed.exitCode).toBe(1)
    expect(failed.report.status).toBe('failed')

    const runtimeError = await runApiContractGuard([], {
      generateReport: async () => {
        throw new Error('boom')
      }
    })
    expect(runtimeError.exitCode).toBe(1)
    expect(runtimeError.report.status).toBe('failed')
    expect(runtimeError.report.failures[0]?.reason).toBe('boom')
  })

  it('toErrorMessage 与 buildRuntimeFailureReport 应输出稳定结构', () => {
    expect(toErrorMessage(new Error('x'))).toBe('x')
    expect(toErrorMessage('y')).toBe('y')
    expect(toErrorMessage(undefined)).toBe('unknown error')

    const report = buildRuntimeFailureReport('runtime bad')
    expect(report.status).toBe('failed')
    expect(report.failures[0]?.endpoint).toBe('__runtime__')
    expect(report.failures[0]?.missing).toEqual(['route', 'documentation', 'tests'])
    expect(report.failures[0]?.reason).toBe('runtime bad')
  })
})
