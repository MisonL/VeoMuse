import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import path from 'path'
import {
  buildAcceptanceOutputPaths,
  buildDeployAcceptanceArtifact,
  DEFAULT_ADMIN_TOKEN_ENV,
  DEFAULT_OUTPUT_ROOT as DEPLOY_OUTPUT_ROOT,
  DEFAULT_TIMEOUT_SEC,
  parseArgs as parseDeployArgs,
  resolveDefaultOutputDir as resolveDeployOutputDir
} from '../scripts/deploy_acceptance'
import {
  buildRealAcceptanceMarkdown,
  buildRealAcceptanceCommand,
  DEFAULT_OUTPUT_ROOT as REAL_OUTPUT_ROOT,
  DEFAULT_TIMEOUT_SEC as REAL_TIMEOUT_SEC,
  parseArgs as parseRealArgs,
  resolveDefaultOutputDir as resolveRealOutputDir
} from '../scripts/real_acceptance'

describe('外部验收入口脚本', () => {
  it('acceptance:deploy 应解析参数并生成稳定输出路径', () => {
    const parsed = parseDeployArgs([
      '--base-url',
      'https://veomuse.example.com/',
      '--output-dir',
      'artifacts/custom-deploy',
      '--timeout',
      '300',
      '--admin-token-env',
      'PROD_ADMIN_TOKEN'
    ])

    expect(parsed.showHelp).toBe(false)
    expect(parsed.options.baseUrl).toBe('https://veomuse.example.com')
    expect(parsed.options.outputDir).toBe(path.resolve(process.cwd(), 'artifacts/custom-deploy'))
    expect(parsed.options.timeoutSec).toBe(300)
    expect(parsed.options.adminTokenEnv).toBe('PROD_ADMIN_TOKEN')
    expect(
      buildAcceptanceOutputPaths(path.resolve(process.cwd(), 'artifacts/custom-deploy'))
    ).toEqual({
      json: path.join(path.resolve(process.cwd(), 'artifacts/custom-deploy'), 'summary.json'),
      markdown: path.join(path.resolve(process.cwd(), 'artifacts/custom-deploy'), 'summary.md')
    })
  })

  it('acceptance:deploy 默认值应稳定并拒绝非法参数', () => {
    const parsed = parseDeployArgs([])

    expect(
      parsed.options.outputDir.startsWith(path.resolve(process.cwd(), DEPLOY_OUTPUT_ROOT))
    ).toBe(true)
    expect(parsed.options.timeoutSec).toBe(DEFAULT_TIMEOUT_SEC)
    expect(parsed.options.adminTokenEnv).toBe(DEFAULT_ADMIN_TOKEN_ENV)
    expect(resolveDeployOutputDir(new Date('2026-03-08T04:00:00.000Z'))).toBe(
      path.resolve(process.cwd(), DEPLOY_OUTPUT_ROOT, '2026-03-08T04-00-00-000Z')
    )

    expect(() => parseDeployArgs(['--timeout', '0'])).toThrow('--timeout 需要正整数')
    expect(() => parseDeployArgs(['--base-url', 'veomuse.local'])).toThrow(
      '--base-url 需要合法的 http/https URL'
    )
    expect(() => parseDeployArgs(['--unknown'])).toThrow('未知参数')
  })

  it('acceptance:deploy 产物构造应补齐输出目录与记录字段', () => {
    const artifact = buildDeployAcceptanceArtifact(
      {
        schemaVersion: '1.0',
        startedAt: '2026-03-08T04:10:00.000Z',
        finishedAt: '2026-03-08T04:11:00.000Z',
        baseUrl: 'https://veomuse.example.com',
        status: 'passed',
        steps: []
      },
      {
        outputDir: 'artifacts/deploy-acceptance/ok',
        timeoutSec: 240,
        adminTokenEnv: 'PROD_ADMIN_TOKEN',
        adminTokenPresent: true
      }
    )

    expect(artifact.outputDir).toBe('artifacts/deploy-acceptance/ok')
    expect(artifact.timeoutSec).toBe(240)
    expect(artifact.adminTokenEnv).toBe('PROD_ADMIN_TOKEN')
    expect(artifact.adminTokenPresent).toBe(true)
  })

  it('acceptance:deploy 默认应保持只读，不再包含 register/workspace/upload 写探针', () => {
    const entrySource = readFileSync(
      path.resolve(process.cwd(), 'scripts/deploy_acceptance.ts'),
      'utf8'
    )
    const coreSource = readFileSync(
      path.resolve(process.cwd(), 'scripts/deploy_acceptance_core.ts'),
      'utf8'
    )

    expect(entrySource).not.toContain('docker compose')
    expect(entrySource).not.toContain('docker-compose')
    expect(entrySource).not.toContain('restart')
    expect(entrySource).toContain('runDeploymentAcceptanceProbes')
    expect(entrySource).toContain('adminTokenEnv')
    expect(coreSource).not.toContain('createAuthenticatedWorkspace')
    expect(coreSource).not.toContain('probeUploadFlow')
    expect(coreSource).toContain('/api/admin/metrics')
  })

  it('acceptance:real 应解析部署实例参数并生成稳定默认输出目录', () => {
    const parsed = parseRealArgs([
      '--base-url',
      'https://veomuse.example.com/',
      '--api-base-url',
      'https://api.veomuse.example.com/',
      '--output-dir',
      'artifacts/custom-real',
      '--timeout',
      '480'
    ])
    expect(parsed.showHelp).toBe(false)
    expect(parsed.options.baseUrl).toBe('https://veomuse.example.com')
    expect(parsed.options.apiBaseUrl).toBe('https://api.veomuse.example.com')
    expect(parsed.options.outputDir).toBe(path.resolve(process.cwd(), 'artifacts/custom-real'))
    expect(parsed.options.timeoutSec).toBe(480)
    expect(resolveRealOutputDir(new Date('2026-03-08T05:00:00.000Z'))).toBe(
      path.resolve(process.cwd(), REAL_OUTPUT_ROOT, '2026-03-08T05-00-00-000Z')
    )
    expect(parseRealArgs([]).options.timeoutSec).toBe(REAL_TIMEOUT_SEC)
    expect(() => parseRealArgs(['--timeout', '0'])).toThrow('--timeout 需要正整数')
    expect(() => parseRealArgs(['--unknown'])).toThrow('未知参数')
  })

  it('acceptance:real markdown 应显式输出 precheck、就绪探测、外部 real 回归与失败步骤', () => {
    const markdown = buildRealAcceptanceMarkdown({
      schemaVersion: '1.0',
      startedAt: '2026-03-08T05:10:00.000Z',
      finishedAt: '2026-03-08T05:11:00.000Z',
      outputDir: 'artifacts/real-acceptance/fail',
      baseUrl: 'https://veomuse.example.com',
      apiBaseUrl: 'https://api.veomuse.example.com',
      status: 'failed',
      precheck: {
        status: 'passed',
        message: '真实回归凭据预检通过。',
        missingEnv: []
      },
      readiness: {
        status: 'passed',
        message: '部署实例已就绪'
      },
      realE2E: {
        status: 'failed',
        message: '外部 @real 回归失败，exitCode=1',
        command: 'bunx playwright test -c playwright.acceptance.config.ts --grep @real'
      },
      failedSteps: ['external-playwright-real']
    })

    expect(markdown).toContain('外部 @real 回归')
    expect(markdown).toContain('部署实例已就绪')
    expect(markdown).toContain('external-playwright-real')
  })

  it('acceptance:real 应构造指向已部署实例的外部 Playwright 命令，且不内部注入 E2E_REAL_CHANNELS', () => {
    const command = buildRealAcceptanceCommand({
      baseUrl: 'https://veomuse.example.com',
      apiBaseUrl: 'https://api.veomuse.example.com',
      outputDir: path.resolve(process.cwd(), 'artifacts/custom-real')
    })

    expect(command.cmd.join(' ')).toContain('playwright.acceptance.config.ts')
    expect(command.cmd.join(' ')).toContain('--project=external-regression-chromium')
    expect(command.cmd.join(' ')).toContain('--grep @real')
    expect(command.cmd.join(' ')).not.toContain('release_gate')
    expect(command.env.PLAYWRIGHT_BASE_URL).toBe('https://veomuse.example.com')
    expect(command.env.PLAYWRIGHT_API_BASE_URL).toBe('https://api.veomuse.example.com')
    expect(command.env.E2E_REAL_CHANNELS).toBeUndefined()
  })

  it('package.json 应暴露外部验收入口脚本', () => {
    const pkg = JSON.parse(readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>
    }

    expect(pkg.scripts?.['acceptance:deploy']).toBe('bun run scripts/deploy_acceptance.ts')
    expect(pkg.scripts?.['acceptance:real']).toBe('bun run scripts/real_acceptance.ts')
  })
})
