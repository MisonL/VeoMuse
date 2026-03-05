import fs from 'fs/promises'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { runReleaseGate } from '../scripts/release_gate'

const QUALITY_SUMMARY_PATH = path.resolve(process.cwd(), 'artifacts/quality-summary.json')
const originalFetch = globalThis.fetch

const toStream = (text: string) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      if (text) {
        controller.enqueue(new TextEncoder().encode(text))
      }
      controller.close()
    }
  })

const createSubprocess = (exitCode: number, output = '', errorOutput = '') =>
  ({
    exited: Promise.resolve(exitCode),
    kill: () => {},
    stdout: toStream(output),
    stderr: toStream(errorOutput)
  }) as unknown as Bun.Subprocess

const readSummary = async () => {
  const raw = await fs.readFile(QUALITY_SUMMARY_PATH, 'utf8')
  return JSON.parse(raw) as any
}

describe('发布门禁运行时路径（mock）', () => {
  beforeEach(async () => {
    await fs.rm(QUALITY_SUMMARY_PATH, { force: true }).catch(() => {})
  })

  afterEach(() => {
    mock.restore()
    globalThis.fetch = originalFetch
  })

  it('runReleaseGate 成功路径应写入 passed 汇总', async () => {
    const spawnSpy = spyOn(Bun, 'spawn').mockImplementation((_cmd: any) => createSubprocess(0))
    globalThis.fetch = mock(
      async () =>
        new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
    ) as any

    await runReleaseGate([], { GITHUB_REF_NAME: 'main' } as NodeJS.ProcessEnv)

    expect(spawnSpy).toHaveBeenCalled()
    const summary = await readSummary()
    expect(summary.status).toBe('passed')
    expect(summary.branch).toBe('main')
    expect(Array.isArray(summary.steps)).toBe(true)
    expect(summary.steps.length).toBe(6)
    expect(summary.sloBootstrap?.status).toBe('reused')
    expect(summary.videoGenerateLoop?.trackedStepName).toBe('E2E Regression (Mock)')
    expect(summary.videoGenerateLoop?.status).toBe('passed')
    expect(summary.videoGenerateLoop?.attempts).toBe(1)
    expect(summary.realE2E?.trackedStepName).toBe('E2E Regression (Real)')
    expect(summary.realE2E?.status).toBe('not-run')
    expect(summary.realE2E?.attempts).toBe(0)
  })

  it('with-real-e2e 场景下 real 用例全跳过应失败', async () => {
    const spawnSpy = spyOn(Bun, 'spawn').mockImplementation((cmd: any) => {
      if (Array.isArray(cmd)) {
        const shellCmd = String(cmd[2] || '')
        if (shellCmd.includes('e2e:regression:real')) {
          return createSubprocess(
            0,
            '\nRunning 1 test using 1 worker\n\n  - real test case\n\n  1 skipped\n'
          )
        }
      }
      return createSubprocess(0, '\n  1 passed\n')
    })
    globalThis.fetch = mock(
      async () =>
        new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
    ) as any

    await expect(
      runReleaseGate(['--with-real-e2e'], {
        GITHUB_REF_NAME: 'feature/real-e2e-skipped',
        GEMINI_API_KEYS: 'fake-real-key'
      } as NodeJS.ProcessEnv)
    ).rejects.toThrow('未执行任何 real E2E 用例')

    const summary = await readSummary()
    const realStep = summary.steps.find((step: any) => step.name === 'E2E Regression (Real)')
    expect(summary.status).toBe('failed')
    expect(realStep?.status).toBe('failed')
    expect(String(realStep?.failure?.message || '')).toContain('未执行任何 real E2E 用例')
    expect(summary.realE2E?.status).toBe('failed')
    expect(summary.realE2E?.attempts).toBe(1)
    expect(summary.realE2E?.failureType).toBe('unknown')
    expect(spawnSpy).toHaveBeenCalled()
  })

  it('with-real-e2e 场景下应基于 real 失败输出分类 failureType', async () => {
    const spawnSpy = spyOn(Bun, 'spawn').mockImplementation((cmd: any) => {
      if (Array.isArray(cmd)) {
        const shellCmd = String(cmd[2] || '')
        if (shellCmd.includes('e2e:regression:real')) {
          return createSubprocess(1, '', 'HTTP 401 unauthorized: invalid api key')
        }
      }
      return createSubprocess(0, '\n  1 passed\n')
    })
    globalThis.fetch = mock(
      async () =>
        new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
    ) as any

    await expect(
      runReleaseGate(['--with-real-e2e'], {
        GITHUB_REF_NAME: 'feature/real-e2e-auth-fail',
        GEMINI_API_KEYS: 'fake-real-key'
      } as NodeJS.ProcessEnv)
    ).rejects.toThrow('E2E Regression (Real) failed with exit code 1')

    const summary = await readSummary()
    const realStep = summary.steps.find((step: any) => step.name === 'E2E Regression (Real)')
    expect(summary.status).toBe('failed')
    expect(realStep?.status).toBe('failed')
    expect(String(realStep?.failure?.message || '')).toContain('401 unauthorized')
    expect(summary.realE2E?.status).toBe('failed')
    expect(summary.realE2E?.attempts).toBe(1)
    expect(summary.realE2E?.failureType).toBe('auth')
    expect(spawnSpy).toHaveBeenCalled()
  })

  it('with-real-e2e 缺少凭据时应在开头快速失败', async () => {
    const spawnSpy = spyOn(Bun, 'spawn').mockImplementation((_cmd: any) =>
      createSubprocess(0, '\n  1 passed\n')
    )

    await expect(
      runReleaseGate(['--with-real-e2e'], {
        GITHUB_REF_NAME: 'feature/real-e2e-precheck'
      } as NodeJS.ProcessEnv)
    ).rejects.toThrow('缺少真实回归必需环境变量')

    const summary = await readSummary()
    const precheckStep = summary.steps.find(
      (step: any) => step.name === 'E2E Regression (Real) Precheck'
    )
    expect(summary.status).toBe('failed')
    expect(precheckStep?.status).toBe('failed')
    expect(String(precheckStep?.failure?.message || '')).toContain('GEMINI_API_KEYS')
    expect(spawnSpy).not.toHaveBeenCalled()
  })

  it('SLO Check 默认应至少重试 1 次', async () => {
    let sloAttempts = 0
    const spawnSpy = spyOn(Bun, 'spawn').mockImplementation((cmd: any) => {
      if (Array.isArray(cmd)) {
        const shellCmd = String(cmd[2] || '')
        if (shellCmd.includes('scripts/slo_gate.ts')) {
          sloAttempts += 1
          return createSubprocess(sloAttempts === 1 ? 1 : 0)
        }
      }
      return createSubprocess(0)
    })
    globalThis.fetch = mock(
      async () =>
        new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
    ) as any

    await runReleaseGate([], { GITHUB_REF_NAME: 'feature/slo-retry-default' } as NodeJS.ProcessEnv)

    const summary = await readSummary()
    const sloStep = summary.steps.find((step: any) => String(step.name).includes('SLO Check'))
    expect(summary.status).toBe('passed')
    expect(sloAttempts).toBe(2)
    expect(spawnSpy).toHaveBeenCalledTimes(7)
    expect(sloStep?.status).toBe('passed')
    expect(Array.isArray(sloStep?.attempts)).toBe(true)
    expect(sloStep?.attempts?.length).toBe(2)
    expect(sloStep?.attempts?.[0]?.status).toBe('failed')
    expect(sloStep?.attempts?.[1]?.status).toBe('passed')
  })

  it('SLO Check 应支持通过 RELEASE_GATE_SLO_RETRIES 配置重试次数', async () => {
    let sloAttempts = 0
    const spawnSpy = spyOn(Bun, 'spawn').mockImplementation((cmd: any) => {
      if (Array.isArray(cmd)) {
        const shellCmd = String(cmd[2] || '')
        if (shellCmd.includes('scripts/slo_gate.ts')) {
          sloAttempts += 1
          return createSubprocess(sloAttempts <= 2 ? 1 : 0)
        }
      }
      return createSubprocess(0)
    })
    globalThis.fetch = mock(
      async () =>
        new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
    ) as any

    await runReleaseGate([], {
      GITHUB_REF_NAME: 'feature/slo-retry-config',
      RELEASE_GATE_SLO_RETRIES: '2'
    } as NodeJS.ProcessEnv)

    const summary = await readSummary()
    const sloStep = summary.steps.find((step: any) => String(step.name).includes('SLO Check'))
    expect(summary.status).toBe('passed')
    expect(sloAttempts).toBe(3)
    expect(spawnSpy).toHaveBeenCalledTimes(8)
    expect(sloStep?.status).toBe('passed')
    expect(Array.isArray(sloStep?.attempts)).toBe(true)
    expect(sloStep?.attempts?.length).toBe(3)
    expect(sloStep?.attempts?.[0]?.status).toBe('failed')
    expect(sloStep?.attempts?.[1]?.status).toBe('failed')
    expect(sloStep?.attempts?.[2]?.status).toBe('passed')
  })

  it('runReleaseGate 失败路径应写入 failed 汇总并抛错', async () => {
    let callCount = 0
    spyOn(Bun, 'spawn').mockImplementation((_cmd: any) => {
      callCount += 1
      return createSubprocess(callCount === 2 ? 1 : 0)
    })

    await expect(
      runReleaseGate([], { GITHUB_REF_NAME: 'feature/release-gate-fail' } as NodeJS.ProcessEnv)
    ).rejects.toThrow('Build failed with exit code 1')

    const summary = await readSummary()
    expect(summary.status).toBe('failed')
    expect(summary.failure?.message).toContain('Build failed with exit code 1')
    expect(summary.videoGenerateLoop?.status).toBe('not-run')
    expect(Array.isArray(summary.steps)).toBe(true)
    expect(
      summary.steps.some((step: any) => step.name === 'Build' && step.status === 'failed')
    ).toBe(true)
    expect(Array.isArray(summary.recommendations)).toBe(true)
    expect(summary.recommendations.length).toBeGreaterThan(0)
  })

  it('SLO 健康不可达且自举关闭时应标记 skipped 并继续执行', async () => {
    const spawnSpy = spyOn(Bun, 'spawn').mockImplementation((_cmd: any) => createSubprocess(0))
    globalThis.fetch = mock(async () => {
      throw new Error('failed to fetch')
    }) as any

    await runReleaseGate([], {
      GITHUB_REF_NAME: 'feature/slo-skipped',
      RELEASE_GATE_SLO_BOOTSTRAP: 'false'
    } as NodeJS.ProcessEnv)

    const summary = await readSummary()
    expect(summary.status).toBe('passed')
    expect(summary.sloBootstrap?.status).toBe('skipped')
    expect(String(summary.sloBootstrap?.detail || '')).toContain('bootstrap-disabled')
    expect(summary.videoGenerateLoop?.status).toBe('passed')
    expect(Array.isArray(summary.steps)).toBe(true)
    expect(summary.steps.length).toBe(6)
    expect(spawnSpy).toHaveBeenCalledTimes(6)
  })

  it('视频生成闭环步骤重试耗尽时应失败并阻断后续步骤', async () => {
    const spawnSpy = spyOn(Bun, 'spawn').mockImplementation((cmd: any) => {
      if (Array.isArray(cmd)) {
        const shellCmd = String(cmd[2] || '')
        if (shellCmd.includes('e2e:regression:mock')) {
          return createSubprocess(1)
        }
      }
      return createSubprocess(0)
    })
    globalThis.fetch = mock(
      async () =>
        new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
    ) as any

    await expect(
      runReleaseGate([], { GITHUB_REF_NAME: 'feature/video-loop-fail' } as NodeJS.ProcessEnv)
    ).rejects.toThrow('E2E Regression (Mock) failed with exit code 1')

    const summary = await readSummary()
    expect(summary.status).toBe('failed')
    expect(summary.videoGenerateLoop?.trackedStepName).toBe('E2E Regression (Mock)')
    expect(summary.videoGenerateLoop?.status).toBe('failed')
    expect(summary.videoGenerateLoop?.attempts).toBe(2)
    expect(summary.videoGenerateLoop?.failureType).toBe('unknown')
    expect(String(summary.videoGenerateLoop?.detail || '')).toContain(
      'E2E Regression (Mock) failed with exit code 1'
    )
    expect(
      summary.steps.some(
        (step: any) => step.name === 'E2E Regression (Mock)' && step.status === 'failed'
      )
    ).toBe(true)
    expect(summary.steps.some((step: any) => String(step.name).includes('SLO Check'))).toBe(false)
    expect(spawnSpy).toHaveBeenCalledTimes(6)
  })

  it('SLO 自举后端提前退出时应写入 failed 汇总', async () => {
    const spawnSpy = spyOn(Bun, 'spawn').mockImplementation((cmd: any) => {
      if (Array.isArray(cmd)) {
        return createSubprocess(0)
      }
      return createSubprocess(1)
    })
    globalThis.fetch = mock(async () => {
      throw new Error('failed to fetch')
    }) as any

    await expect(
      runReleaseGate([], {
        GITHUB_REF_NAME: 'feature/slo-bootstrap-fail'
      } as NodeJS.ProcessEnv)
    ).rejects.toThrow('SLO bootstrap backend exited early')

    const summary = await readSummary()
    expect(summary.status).toBe('failed')
    expect(summary.sloBootstrap?.status).toBe('failed')
    expect(String(summary.sloBootstrap?.detail || '')).toContain(
      'SLO bootstrap backend exited early'
    )
    expect(summary.videoGenerateLoop?.status).toBe('passed')
    expect(
      summary.steps.some((step: any) => step.name.includes('SLO Check') && step.status === 'failed')
    ).toBe(true)
    expect(spawnSpy).toHaveBeenCalled()
  })
})
