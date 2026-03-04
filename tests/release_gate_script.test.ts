import { describe, expect, it } from 'bun:test'
import {
  buildSloGateCommand,
  buildQualitySummaryStep,
  createQualitySummary,
  finalizeQualitySummary,
  isCiEnvironment,
  isLocalSloApiBase,
  parseArgValue,
  parseSloMode,
  resolveFailureDomain,
  resolveSloApiBase,
  resolveSloBootstrapEnabled,
  resolveSloMode
} from '../scripts/release_gate'

const envOf = (input: Record<string, string | undefined>) => input as NodeJS.ProcessEnv

describe('发布门禁脚本策略', () => {
  it('应解析 SLO 模式并拒绝非法值', () => {
    expect(parseSloMode('hard')).toBe('hard')
    expect(parseSloMode(' soft ')).toBe('soft')
    expect(parseSloMode('HARD')).toBe('hard')
    expect(parseSloMode('')).toBeNull()
    expect(parseSloMode('strict')).toBeNull()
  })

  it('应解析命令行参数值（空格与等号两种写法）', () => {
    expect(parseArgValue(['--api-base', 'http://127.0.0.1:19090'], '--api-base')).toBe(
      'http://127.0.0.1:19090'
    )
    expect(parseArgValue(['--api-base=http://127.0.0.1:18080'], '--api-base')).toBe(
      'http://127.0.0.1:18080'
    )
    expect(parseArgValue(['--mode', 'soft'], '--api-base')).toBe('')
  })

  it('应识别 CI 环境变量', () => {
    expect(isCiEnvironment(envOf({}))).toBe(false)
    expect(isCiEnvironment(envOf({ CI: 'true' }))).toBe(true)
    expect(isCiEnvironment(envOf({ GITHUB_ACTIONS: '1' }))).toBe(true)
  })

  it('应在 CI 主分支默认使用 hard，本地默认使用 soft', () => {
    const ciMain = resolveSloMode({
      env: envOf({}),
      currentBranch: 'main',
      isCi: true
    })
    const localMain = resolveSloMode({
      env: envOf({}),
      currentBranch: 'main',
      isCi: false
    })

    expect(ciMain).toBe('hard')
    expect(localMain).toBe('soft')
  })

  it('显式模式应覆盖默认分支策略', () => {
    const explicitHard = resolveSloMode({
      env: envOf({ RELEASE_SLO_MODE: 'hard' }),
      currentBranch: 'feature/x',
      isCi: false
    })
    const explicitSoft = resolveSloMode({
      env: envOf({ SLO_GATE_MODE: 'soft' }),
      currentBranch: 'main',
      isCi: true
    })

    expect(explicitHard).toBe('hard')
    expect(explicitSoft).toBe('soft')
  })

  it('SLO API 地址应按参数优先级解析', () => {
    const fromArg = resolveSloApiBase({
      argv: ['--api-base', 'http://127.0.0.1:19090'],
      env: envOf({
        SLO_GATE_API_BASE: 'http://127.0.0.1:33117',
        API_BASE_URL: 'http://127.0.0.1:8080'
      })
    })
    const fromSloEnv = resolveSloApiBase({
      argv: [],
      env: envOf({
        SLO_GATE_API_BASE: 'http://127.0.0.1:33117/',
        API_BASE_URL: 'http://127.0.0.1:8080'
      })
    })
    const fromApiBase = resolveSloApiBase({
      argv: [],
      env: envOf({ API_BASE_URL: 'http://127.0.0.1:8080/' })
    })
    const fallbackDefault = resolveSloApiBase({
      argv: [],
      env: envOf({})
    })

    expect(fromArg).toBe('http://127.0.0.1:19090')
    expect(fromSloEnv).toBe('http://127.0.0.1:33117')
    expect(fromApiBase).toBe('http://127.0.0.1:8080')
    expect(fallbackDefault).toBe('http://127.0.0.1:33117')
  })

  it('应生成带 mode 与 api-base 的 SLO 门禁命令', () => {
    const command = buildSloGateCommand('soft', 'http://127.0.0.1:33117')

    expect(command).toContain('bun run scripts/slo_gate.ts')
    expect(command).toContain('--mode soft')
    expect(command).toContain('--api-base "http://127.0.0.1:33117"')
  })

  it('应正确识别本机 SLO API 地址', () => {
    expect(isLocalSloApiBase('http://127.0.0.1:33117')).toBe(true)
    expect(isLocalSloApiBase('http://localhost:33117')).toBe(true)
    expect(isLocalSloApiBase('http://0.0.0.0:33117')).toBe(true)
    expect(isLocalSloApiBase('http://192.168.1.50:33117')).toBe(false)
  })

  it('SLO 自举应默认本地开启、CI 关闭，且支持显式覆盖', () => {
    const localDefault = resolveSloBootstrapEnabled({
      env: envOf({}),
      isCi: false,
      apiBase: 'http://127.0.0.1:33117'
    })
    const ciDefault = resolveSloBootstrapEnabled({
      env: envOf({}),
      isCi: true,
      apiBase: 'http://127.0.0.1:33117'
    })
    const explicitOff = resolveSloBootstrapEnabled({
      env: envOf({ RELEASE_GATE_SLO_BOOTSTRAP: 'false' }),
      isCi: false,
      apiBase: 'http://127.0.0.1:33117'
    })
    const explicitOn = resolveSloBootstrapEnabled({
      env: envOf({ RELEASE_GATE_SLO_BOOTSTRAP: 'true' }),
      isCi: true,
      apiBase: 'http://api.example.com'
    })

    expect(localDefault).toBe(true)
    expect(ciDefault).toBe(false)
    expect(explicitOff).toBe(false)
    expect(explicitOn).toBe(true)
  })

  it('应生成包含关键元信息的质量汇总骨架', () => {
    const summary = createQualitySummary({
      branch: 'main',
      ci: true,
      sloMode: 'hard',
      sloApiBase: 'http://127.0.0.1:33117',
      runRealE2E: false,
      sloBootstrapEnabled: false,
      generatedAt: '2026-03-02T00:00:00.000Z'
    })

    expect(summary.schemaVersion).toBe('1.0')
    expect(summary.generatedAt).toBe('2026-03-02T00:00:00.000Z')
    expect(summary.status).toBe('passed')
    expect(summary.branch).toBe('main')
    expect(summary.ci).toBe(true)
    expect(summary.sloMode).toBe('hard')
    expect(summary.sloApiBase).toBe('http://127.0.0.1:33117')
    expect(summary.runRealE2E).toBe(false)
    expect(summary.sloBootstrap.enabled).toBe(false)
    expect(summary.sloBootstrap.status).toBe('not-needed')
    expect(Array.isArray(summary.steps)).toBe(true)
    expect(summary.steps.length).toBe(0)
    expect(Array.isArray(summary.recommendations)).toBe(true)
    expect(summary.recommendations.length).toBe(0)
  })

  it('应构建失败步骤结构并保留失败信息与耗时字段', () => {
    const step = buildQualitySummaryStep({
      step: {
        name: 'Unit Tests',
        command: 'bun run test'
      },
      status: 'failed',
      startedAtMs: 1000,
      endedAtMs: 1600,
      attempts: [
        {
          attempt: 1,
          startedAtMs: 1100,
          endedAtMs: 1500,
          durationMs: 400,
          status: 'failed',
          exitCode: 1,
          failureMessage: 'Unit Tests failed with exit code 1 (400ms)'
        }
      ],
      failureMessage: 'Unit Tests failed with exit code 1 (400ms)',
      failureExitCode: 1
    })

    expect(step.name).toBe('Unit Tests')
    expect(step.status).toBe('failed')
    expect(step.startedAt).toBe(new Date(1000).toISOString())
    expect(step.endedAt).toBe(new Date(1600).toISOString())
    expect(step.durationMs).toBe(600)
    expect(step.attempts.length).toBe(1)
    expect(step.attempts[0]?.durationMs).toBe(400)
    expect(step.attempts[0]?.status).toBe('failed')
    expect(step.attempts[0]?.exitCode).toBe(1)
    expect(step.attempts[0]?.failureMessage).toContain('exit code 1')
    expect(step.failure?.message).toContain('exit code 1')
    expect(step.failure?.exitCode).toBe(1)
    expect(step.failure?.domain).toBe('test')
  })

  it('失败步骤应按名称与命令识别 domain', () => {
    const cases = [
      { step: { name: 'Secrets Scan', command: 'bun run security:scan' }, expected: 'security' },
      { step: { name: 'Build', command: 'bun run build' }, expected: 'build' },
      {
        step: { name: 'Unit Tests', command: 'bun run test' },
        expected: 'test'
      },
      { step: { name: 'E2E Smoke', command: 'bun run e2e:smoke -- --workers=1' }, expected: 'e2e' },
      {
        step: { name: 'SLO Check (hard)', command: 'bun run scripts/slo_gate.ts --mode hard' },
        expected: 'slo'
      },
      {
        step: { name: 'Post Deploy Verify', command: 'bun run verify:post-deploy' },
        expected: 'unknown'
      }
    ] as const

    for (const item of cases) {
      const result = buildQualitySummaryStep({
        step: item.step,
        status: 'failed',
        startedAtMs: 1_000,
        endedAtMs: 1_200,
        attempts: [],
        failureMessage: `${item.step.name} failed`,
        failureExitCode: 1
      })
      expect(result.failure?.domain).toBe(item.expected)
    }
  })

  it('resolveFailureDomain 应在无规则匹配时返回 unknown', () => {
    expect(resolveFailureDomain({ name: 'Deploy', command: 'bun run deploy' })).toBe('unknown')
    expect(resolveFailureDomain({ name: 'SLO Probe', command: 'curl /api/health' })).toBe('slo')
  })

  it('finalize 后应生成可执行 recommendations 并去重', () => {
    const base = createQualitySummary({
      branch: 'feature/recommendation',
      ci: false,
      sloMode: 'soft',
      sloApiBase: 'http://127.0.0.1:33117',
      runRealE2E: false,
      sloBootstrapEnabled: true,
      generatedAt: '2026-03-02T00:00:00.000Z'
    })
    const duplicateSecurityFailure = buildQualitySummaryStep({
      step: {
        name: 'Secrets Scan',
        command: 'bun run security:scan'
      },
      status: 'failed',
      startedAtMs: 2_000,
      endedAtMs: 2_200,
      attempts: [],
      failureMessage: 'Secrets Scan failed',
      failureExitCode: 1
    })
    const buildFailure = buildQualitySummaryStep({
      step: {
        name: 'Build',
        command: 'bun run build'
      },
      status: 'failed',
      startedAtMs: 2_300,
      endedAtMs: 2_900,
      attempts: [],
      failureMessage: 'Build failed',
      failureExitCode: 2
    })

    const failed = finalizeQualitySummary(
      {
        ...base,
        steps: [duplicateSecurityFailure, duplicateSecurityFailure, buildFailure]
      },
      {
        status: 'failed',
        failureMessage: 'release gate failed',
        generatedAt: '2026-03-02T00:01:00.000Z'
      }
    )

    expect(Array.isArray(failed.recommendations)).toBe(true)
    expect(failed.recommendations.some((item) => item.includes('敏感信息或高危配置'))).toBe(true)
    expect(failed.recommendations.some((item) => item.includes('编译或打包错误'))).toBe(true)
    expect(failed.recommendations.some((item) => item.includes('bun run release:gate'))).toBe(true)
    expect(
      failed.recommendations.filter((item) => item.includes('敏感信息或高危配置')).length
    ).toBe(1)
    expect(
      failed.recommendations.filter((item) => item.includes('优先单独复现失败步骤「Secrets Scan」'))
        .length
    ).toBe(1)
  })

  it('失败收敛时应输出 failed 状态与顶层失败信息', () => {
    const base = createQualitySummary({
      branch: 'feature/test',
      ci: false,
      sloMode: 'soft',
      sloApiBase: 'http://127.0.0.1:33117',
      runRealE2E: true,
      sloBootstrapEnabled: true,
      generatedAt: '2026-03-02T00:00:00.000Z'
    })
    const failed = finalizeQualitySummary(base, {
      status: 'failed',
      failureMessage: 'Build failed with exit code 2',
      generatedAt: '2026-03-02T00:01:00.000Z'
    })

    expect(failed.status).toBe('failed')
    expect(failed.generatedAt).toBe('2026-03-02T00:01:00.000Z')
    expect(failed.failure?.message).toBe('Build failed with exit code 2')
    expect(Array.isArray(failed.recommendations)).toBe(true)
    expect(failed.recommendations.length).toBeGreaterThan(0)
  })

  it('通过收敛时应移除 failure 字段并清空 recommendations', () => {
    const base = createQualitySummary({
      branch: 'feature/passed',
      ci: false,
      sloMode: 'soft',
      sloApiBase: 'http://127.0.0.1:33117',
      runRealE2E: false,
      sloBootstrapEnabled: false,
      generatedAt: '2026-03-02T00:00:00.000Z'
    })
    const failed = finalizeQualitySummary(base, {
      status: 'failed',
      failureMessage: 'temporary failure',
      generatedAt: '2026-03-02T00:01:00.000Z'
    })
    const passed = finalizeQualitySummary(failed, {
      status: 'passed',
      generatedAt: '2026-03-02T00:02:00.000Z'
    })

    expect(passed.status).toBe('passed')
    expect(passed.generatedAt).toBe('2026-03-02T00:02:00.000Z')
    expect('failure' in passed).toBe(false)
    expect(Array.isArray(passed.recommendations)).toBe(true)
    expect(passed.recommendations.length).toBe(0)
  })
})
