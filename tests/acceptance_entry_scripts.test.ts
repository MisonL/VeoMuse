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
  DEFAULT_OUTPUT_ROOT as REAL_OUTPUT_ROOT,
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
    expect(parsed.options.outputDir).toBe('artifacts/custom-deploy')
    expect(parsed.options.timeoutSec).toBe(300)
    expect(parsed.options.adminTokenEnv).toBe('PROD_ADMIN_TOKEN')
    expect(buildAcceptanceOutputPaths('artifacts/custom-deploy')).toEqual({
      json: path.join('artifacts/custom-deploy', 'summary.json'),
      markdown: path.join('artifacts/custom-deploy', 'summary.md')
    })
  })

  it('acceptance:deploy 默认值应稳定并拒绝非法参数', () => {
    const parsed = parseDeployArgs([])

    expect(parsed.options.outputDir.startsWith(`${DEPLOY_OUTPUT_ROOT}${path.sep}`)).toBe(true)
    expect(parsed.options.timeoutSec).toBe(DEFAULT_TIMEOUT_SEC)
    expect(parsed.options.adminTokenEnv).toBe(DEFAULT_ADMIN_TOKEN_ENV)
    expect(resolveDeployOutputDir(new Date('2026-03-08T04:00:00.000Z'))).toBe(
      path.join(DEPLOY_OUTPUT_ROOT, '2026-03-08T04-00-00-000Z')
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
        adminTokenEnv: 'PROD_ADMIN_TOKEN'
      }
    )

    expect(artifact.outputDir).toBe('artifacts/deploy-acceptance/ok')
    expect(artifact.timeoutSec).toBe(240)
    expect(artifact.adminTokenEnv).toBe('PROD_ADMIN_TOKEN')
  })

  it('acceptance:deploy 应保持非侵入，不出现 compose 或 restart 命令', () => {
    const source = readFileSync(path.resolve(process.cwd(), 'scripts/deploy_acceptance.ts'), 'utf8')
    expect(source).not.toContain('docker compose')
    expect(source).not.toContain('docker-compose')
    expect(source).not.toContain('restart')
    expect(source).toContain('runDeploymentAcceptanceProbes')
    expect(source).toContain("waitForEndpoint(resolveAbsoluteUrl(baseUrl, '/api/health')")
  })

  it('acceptance:real 应解析参数并生成稳定默认输出目录', () => {
    const parsed = parseRealArgs(['--output-dir', 'artifacts/custom-real'])
    expect(parsed.showHelp).toBe(false)
    expect(parsed.options.outputDir).toBe('artifacts/custom-real')
    expect(resolveRealOutputDir(new Date('2026-03-08T05:00:00.000Z'))).toBe(
      path.join(REAL_OUTPUT_ROOT, '2026-03-08T05-00-00-000Z')
    )
    expect(() => parseRealArgs(['--unknown'])).toThrow('未知参数')
  })

  it('acceptance:real markdown 应显式输出 precheck、realE2E 与失败步骤', () => {
    const markdown = buildRealAcceptanceMarkdown({
      schemaVersion: '1.0',
      startedAt: '2026-03-08T05:10:00.000Z',
      finishedAt: '2026-03-08T05:11:00.000Z',
      outputDir: 'artifacts/real-acceptance/fail',
      status: 'failed',
      precheck: {
        status: 'passed',
        message: '真实回归凭据预检通过。',
        missingEnv: []
      },
      releaseGate: {
        status: 'failed',
        message: 'realE2E.status=failed'
      },
      qualitySummaryPath: 'artifacts/quality-summary.json',
      realE2EStatus: 'failed',
      realE2EFailureType: 'auth',
      failedSteps: ['E2E Regression (Real)']
    })

    expect(markdown).toContain('realE2E.status')
    expect(markdown).toContain('auth')
    expect(markdown).toContain('E2E Regression (Real)')
  })

  it('package.json 应暴露外部验收入口脚本', () => {
    const pkg = JSON.parse(readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>
    }

    expect(pkg.scripts?.['acceptance:deploy']).toBe('bun run scripts/deploy_acceptance.ts')
    expect(pkg.scripts?.['acceptance:real']).toBe('bun run scripts/real_acceptance.ts')
  })
})
