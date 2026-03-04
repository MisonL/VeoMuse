import { afterEach, describe, expect, it } from 'bun:test'
import fs from 'fs/promises'
import path from 'path'

const tempDir = path.resolve(process.cwd(), 'artifacts', 'tests', 'slo-gate')
const createdFiles: string[] = []
const startedServers: Array<ReturnType<typeof Bun.serve>> = []
const NATIVE_RESPONSE_CTOR_PROMISE = Bun.fetch('data:text/plain,ok').then(
  (response) => response.constructor as typeof Response
)

const createJsonResponse = async (payload: unknown, status = 200) => {
  const NativeResponse = await NATIVE_RESPONSE_CTOR_PROMISE
  return new NativeResponse(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

const startMockSloServer = async (payload: {
  summary?: Record<string, unknown>
  breakdown?: Record<string, unknown>
  journeyFailures?: Record<string, unknown>
  summarySuccess?: boolean
  breakdownSuccess?: boolean
  journeySuccess?: boolean
  summaryStatus?: number
  breakdownStatus?: number
  journeyStatus?: number
  summaryError?: string
  breakdownError?: string
  journeyError?: string
}) => {
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch(req) {
      const { pathname } = new URL(req.url)
      if (pathname === '/api/admin/slo/summary') {
        const status = payload.summaryStatus ?? 200
        if (status >= 400) {
          return createJsonResponse(
            { success: false, error: payload.summaryError || `HTTP ${status}` },
            status
          )
        }
        if (payload.summarySuccess === false) {
          return createJsonResponse(
            { success: false, error: payload.summaryError || 'summary semantic failure' },
            status
          )
        }
        return createJsonResponse(
          {
            success: true,
            summary: payload.summary || buildSummaryPayload()
          },
          status
        )
      }
      if (pathname === '/api/admin/slo/breakdown') {
        const status = payload.breakdownStatus ?? 200
        if (status >= 400) {
          return createJsonResponse(
            { success: false, error: payload.breakdownError || `HTTP ${status}` },
            status
          )
        }
        if (payload.breakdownSuccess === false) {
          return createJsonResponse(
            { success: false, error: payload.breakdownError || 'breakdown semantic failure' },
            status
          )
        }
        return createJsonResponse(
          {
            success: true,
            breakdown: payload.breakdown || {
              totalRequests: 0,
              totalRoutes: 0,
              items: []
            }
          },
          status
        )
      }
      if (pathname === '/api/admin/slo/journey-failures') {
        const status = payload.journeyStatus ?? 200
        if (status >= 400) {
          return createJsonResponse(
            { success: false, error: payload.journeyError || `HTTP ${status}` },
            status
          )
        }
        if (payload.journeySuccess === false) {
          return createJsonResponse(
            { success: false, error: payload.journeyError || 'journey semantic failure' },
            status
          )
        }
        return createJsonResponse(
          {
            success: true,
            ...(payload.journeyFailures || {
              window: {
                minutes: 60,
                from: new Date(Date.now() - 60 * 60_000).toISOString(),
                to: new Date().toISOString()
              },
              counts: {
                totalFailJourneys: 0
              },
              items: [],
              updatedAt: new Date().toISOString()
            })
          },
          status
        )
      }
      return createJsonResponse({ success: false, error: 'not found' }, 404)
    }
  })
  startedServers.push(server)
  const apiBase = `http://127.0.0.1:${server.port}`

  // 在高负载覆盖率场景下，Bun.serve 启动到可接收连接存在极短窗口，先探活可减少随机 unavailable。
  let lastError: unknown = null
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await Bun.fetch(`${apiBase}/api/admin/slo/summary`)
      if (response.status >= 100) return apiBase
    } catch (error) {
      lastError = error
    }
    await Bun.sleep(20)
  }
  throw new Error(
    `mock SLO server 启动超时: ${String((lastError as any)?.message || lastError || 'unknown')}`
  )
}

const runSloGate = async (params: {
  mode: 'soft' | 'hard'
  apiBase: string
  env?: Record<string, string>
}) => {
  await fs.mkdir(tempDir, { recursive: true })
  const reportPath = path.join(
    tempDir,
    `report-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.json`
  )
  createdFiles.push(reportPath)

  const proc = Bun.spawn(
    [
      'bun',
      'run',
      'scripts/slo_gate.ts',
      '--mode',
      params.mode,
      '--api-base',
      params.apiBase,
      '--output',
      reportPath
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        // 避免继承其他测试残留的 SLO/ADMIN 相关变量，保持门禁脚本测试可重复。
        SLO_GATE_MODE: '',
        SLO_GATE_API_BASE: '',
        SLO_GATE_ADMIN_TOKEN: '',
        SLO_GATE_OUTPUT: '',
        API_BASE_URL: '',
        ADMIN_TOKEN: '',
        SLO_GATE_TIMEOUT_MS: '5000',
        ...(params.env || {})
      },
      stdout: 'pipe',
      stderr: 'pipe'
    }
  )

  const exitCode = await proc.exited
  const NativeResponse = await NATIVE_RESPONSE_CTOR_PROMISE
  const report = JSON.parse(await fs.readFile(reportPath, 'utf8'))
  const stdout = await new NativeResponse(proc.stdout).text()
  const stderr = await new NativeResponse(proc.stderr).text()

  return {
    exitCode,
    report,
    stdout,
    stderr
  }
}

const buildSummaryPayload = (overrides?: Partial<Record<string, any>>) => ({
  targets: {
    primaryFlowSuccessRate: 0.995,
    nonAiApiP95Ms: 400,
    firstSuccessAvgSteps: 8
  },
  current: {
    primaryFlowSuccessRate: 0.998,
    nonAiApiP95Ms: 280,
    firstSuccessAvgSteps: 4
  },
  passFlags: {
    primaryFlowSuccessRate: true,
    nonAiApiP95Ms: true,
    firstSuccessAvgSteps: true
  },
  window: {
    minutes: 60,
    from: new Date(Date.now() - 60 * 60_000).toISOString(),
    to: new Date().toISOString()
  },
  counts: {
    totalJourneys: 12,
    successJourneys: 12,
    nonAiSamples: 30
  },
  sourceBreakdown: {
    e2e: { total: 12, success: 12 }
  },
  updatedAt: new Date().toISOString(),
  ...(overrides || {})
})

afterEach(async () => {
  while (startedServers.length > 0) {
    const server = startedServers.pop()
    server?.stop(true)
  }

  while (createdFiles.length > 0) {
    const filePath = createdFiles.pop()
    if (!filePath) continue
    await fs.rm(filePath, { force: true })
  }
})

describe('SLO 门禁脚本', () => {
  it('API 不可达时，soft 与 hard 应返回不同结果', async () => {
    const unreachableApi = 'http://127.0.0.1:1'

    const softResult = await runSloGate({
      mode: 'soft',
      apiBase: unreachableApi
    })
    expect(softResult.exitCode).toBe(0)
    expect(softResult.report.status).toBe('unavailable')
    expect(softResult.report.errorKind).toBe('unreachable')
    expect(softResult.report.mode).toBe('soft')
    expect(softResult.report.diagnostics.some((item: any) => item.kind === 'unreachable')).toBe(
      true
    )

    const hardResult = await runSloGate({
      mode: 'hard',
      apiBase: unreachableApi
    })
    expect(hardResult.exitCode).toBe(1)
    expect(hardResult.report.status).toBe('fail')
    expect(hardResult.report.errorKind).toBe('unreachable')
    expect(hardResult.report.mode).toBe('hard')
  })

  it('鉴权失败时应标记 auth 诊断类别', async () => {
    const apiBase = await startMockSloServer({
      summaryStatus: 401,
      summaryError: 'Unauthorized',
      breakdownStatus: 403,
      breakdownError: 'Forbidden',
      journeyStatus: 401,
      journeyError: 'Unauthorized'
    })

    const result = await runSloGate({
      mode: 'hard',
      apiBase
    })

    expect(result.exitCode).toBe(1)
    expect(result.report.status).toBe('fail')
    expect(result.report.errorKind).toBe('auth')
    expect(result.report.diagnostics.some((item: any) => item.kind === 'auth')).toBe(true)
  })

  it('HTTP 200 且 success=false 时应识别为接口失败并进入 errorKind/diagnostics', async () => {
    const apiBase = await startMockSloServer({
      summarySuccess: false,
      summaryError: 'summary semantic error'
    })

    const result = await runSloGate({
      mode: 'soft',
      apiBase
    })

    expect(result.exitCode).toBe(0)
    expect(result.report.status).toBe('unavailable')
    expect(result.report.errorKind).toBe('http')
    expect(
      result.report.diagnostics.some(
        (item: any) =>
          item.target === 'summary' &&
          item.kind === 'http' &&
          item.message.includes('success=false')
      )
    ).toBe(true)
  })

  it('journey-failures 异常时不应改变主判定，但应写入诊断', async () => {
    const apiBase = await startMockSloServer({
      summary: buildSummaryPayload(),
      breakdown: {
        totalRequests: 40,
        totalRoutes: 2,
        items: []
      },
      journeyStatus: 503,
      journeyError: 'Service Unavailable'
    })

    const result = await runSloGate({
      mode: 'soft',
      apiBase
    })

    expect(result.exitCode).toBe(0)
    expect(result.report.status).toBe('pass')
    expect(result.report.errorKind).toBe('none')
    expect(Array.isArray(result.report.diagnostics)).toBe(true)
    expect(result.report.diagnostics.some((item: any) => item.target === 'journey_failures')).toBe(
      true
    )
  })

  it('样本不足时应命中样本门禁规则', async () => {
    const apiBase = await startMockSloServer({
      summary: buildSummaryPayload({
        current: {
          primaryFlowSuccessRate: null,
          nonAiApiP95Ms: 320,
          firstSuccessAvgSteps: null
        },
        passFlags: {
          primaryFlowSuccessRate: false,
          nonAiApiP95Ms: true,
          firstSuccessAvgSteps: false
        },
        counts: {
          totalJourneys: 0,
          successJourneys: 0,
          nonAiSamples: 1
        }
      })
    })

    const result = await runSloGate({
      mode: 'hard',
      apiBase,
      env: {
        SLO_GATE_MIN_NON_AI_SAMPLES: '5',
        SLO_GATE_MIN_JOURNEY_SAMPLES: '2'
      }
    })

    expect(result.exitCode).toBe(1)
    expect(result.report.status).toBe('fail')
    expect(result.report.errorKind).toBe('sample_insufficient')
    expect(result.report.sampleChecks.nonAiSamples.pass).toBe(false)
    expect(result.report.sampleChecks.journeySamples.pass).toBe(false)
    expect(Array.isArray(result.report.failedRules)).toBe(true)
    expect(result.report.failedRules.some((item: any) => item.key === 'samples.nonAi')).toBe(true)
    expect(result.report.failedRules.some((item: any) => item.key === 'samples.journey')).toBe(true)
  })

  it('未配置样本阈值时应使用默认 20/10', async () => {
    const apiBase = await startMockSloServer({
      summary: buildSummaryPayload({
        counts: {
          totalJourneys: 9,
          successJourneys: 9,
          nonAiSamples: 19
        }
      })
    })

    const result = await runSloGate({
      mode: 'soft',
      apiBase
    })

    expect(result.exitCode).toBe(0)
    expect(result.report.status).toBe('warn')
    expect(result.report.errorKind).toBe('sample_insufficient')
    expect(result.report.sampleChecks.nonAiSamples.minimum).toBe(20)
    expect(result.report.sampleChecks.journeySamples.minimum).toBe(10)
    expect(result.report.sampleChecks.nonAiSamples.pass).toBe(false)
    expect(result.report.sampleChecks.journeySamples.pass).toBe(false)
    expect(result.report.failedRules.some((item: any) => item.key === 'samples.nonAi')).toBe(true)
    expect(result.report.failedRules.some((item: any) => item.key === 'samples.journey')).toBe(true)
  })

  it('来源占比阈值默认 0 时应保持旧行为', async () => {
    const apiBase = await startMockSloServer({
      summary: buildSummaryPayload({
        sourceBreakdown: {
          e2e: { total: 12, success: 12 }
        }
      })
    })

    const result = await runSloGate({
      mode: 'soft',
      apiBase,
      env: {
        SLO_GATE_MIN_NON_AI_SAMPLES: '1',
        SLO_GATE_MIN_JOURNEY_SAMPLES: '1'
      }
    })

    expect(result.exitCode).toBe(0)
    expect(result.report.status).toBe('pass')
    expect(result.report.minFrontendSourceRatio).toBe(0)
    expect(result.report.sampleChecks.frontendSourceRatio.minimum).toBe(0)
    expect(result.report.sampleChecks.frontendSourceRatio.pass).toBe(true)
    expect(
      result.report.failedRules.some((item: any) => item.key === 'samples.frontendSourceRatio')
    ).toBe(false)
  })

  it('来源占比阈值启用且达标时应通过', async () => {
    const apiBase = await startMockSloServer({
      summary: buildSummaryPayload({
        counts: {
          totalJourneys: 20,
          successJourneys: 20,
          nonAiSamples: 30
        },
        sourceBreakdown: {
          frontend: { total: 16, success: 16 },
          e2e: { total: 4, success: 4 }
        }
      })
    })

    const result = await runSloGate({
      mode: 'soft',
      apiBase,
      env: {
        SLO_GATE_MIN_FRONTEND_SOURCE_RATIO: '0.6',
        SLO_GATE_MIN_NON_AI_SAMPLES: '1',
        SLO_GATE_MIN_JOURNEY_SAMPLES: '1'
      }
    })

    expect(result.exitCode).toBe(0)
    expect(result.report.status).toBe('pass')
    expect(result.report.errorKind).toBe('none')
    expect(result.report.frontendSourceKey).toBe('frontend')
    expect(result.report.sampleChecks.frontendSourceRatio.pass).toBe(true)
    expect(result.report.sampleChecks.frontendSourceRatio.current).toBeCloseTo(0.8, 4)
    expect(
      result.report.failedRules.some((item: any) => item.key === 'samples.frontendSourceRatio')
    ).toBe(false)
  })

  it('来源占比阈值超出区间时应归一化到 [0,1] 并在诊断中解释', async () => {
    const apiBase = await startMockSloServer({
      summary: buildSummaryPayload({
        counts: {
          totalJourneys: 10,
          successJourneys: 10,
          nonAiSamples: 30
        },
        sourceBreakdown: {
          frontend: { total: 8, success: 8 },
          e2e: { total: 2, success: 2 }
        }
      })
    })

    const highResult = await runSloGate({
      mode: 'soft',
      apiBase,
      env: {
        SLO_GATE_MIN_FRONTEND_SOURCE_RATIO: '1.8',
        SLO_GATE_MIN_NON_AI_SAMPLES: '1',
        SLO_GATE_MIN_JOURNEY_SAMPLES: '1'
      }
    })
    expect(highResult.exitCode).toBe(0)
    expect(highResult.report.status).toBe('warn')
    expect(highResult.report.errorKind).toBe('sample_insufficient')
    expect(highResult.report.minFrontendSourceRatio).toBe(1)
    expect(highResult.report.sampleChecks.frontendSourceRatio.minimum).toBe(1)
    expect(
      highResult.report.diagnostics.some(
        (item: any) =>
          item.target === 'gate' &&
          item.level === 'warn' &&
          item.message.includes('SLO_GATE_MIN_FRONTEND_SOURCE_RATIO') &&
          item.message.includes('归一化')
      )
    ).toBe(true)

    const lowResult = await runSloGate({
      mode: 'soft',
      apiBase,
      env: {
        SLO_GATE_MIN_FRONTEND_SOURCE_RATIO: '-0.2',
        SLO_GATE_MIN_NON_AI_SAMPLES: '1',
        SLO_GATE_MIN_JOURNEY_SAMPLES: '1'
      }
    })
    expect(lowResult.exitCode).toBe(0)
    expect(lowResult.report.status).toBe('pass')
    expect(lowResult.report.errorKind).toBe('none')
    expect(lowResult.report.minFrontendSourceRatio).toBe(0)
    expect(lowResult.report.sampleChecks.frontendSourceRatio.minimum).toBe(0)
  })

  it('来源占比阈值启用且不达标时 soft 警告、hard 失败', async () => {
    const apiBase = await startMockSloServer({
      summary: buildSummaryPayload({
        counts: {
          totalJourneys: 20,
          successJourneys: 20,
          nonAiSamples: 30
        },
        sourceBreakdown: {
          frontend: { total: 2, success: 2 },
          e2e: { total: 18, success: 18 }
        }
      })
    })

    const softResult = await runSloGate({
      mode: 'soft',
      apiBase,
      env: {
        SLO_GATE_MIN_FRONTEND_SOURCE_RATIO: '0.5',
        SLO_GATE_MIN_NON_AI_SAMPLES: '1',
        SLO_GATE_MIN_JOURNEY_SAMPLES: '1'
      }
    })

    expect(softResult.exitCode).toBe(0)
    expect(softResult.report.status).toBe('warn')
    expect(softResult.report.errorKind).toBe('sample_insufficient')
    expect(softResult.report.sampleChecks.frontendSourceRatio.pass).toBe(false)
    expect(
      softResult.report.failedRules.some((item: any) => item.key === 'samples.frontendSourceRatio')
    ).toBe(true)
    expect(
      softResult.report.recommendations.some((item: string) =>
        item.includes('SLO_GATE_MIN_FRONTEND_SOURCE_RATIO')
      )
    ).toBe(true)

    const hardResult = await runSloGate({
      mode: 'hard',
      apiBase,
      env: {
        SLO_GATE_MIN_FRONTEND_SOURCE_RATIO: '0.5',
        SLO_GATE_MIN_NON_AI_SAMPLES: '1',
        SLO_GATE_MIN_JOURNEY_SAMPLES: '1'
      }
    })

    expect(hardResult.exitCode).toBe(1)
    expect(hardResult.report.status).toBe('fail')
    expect(hardResult.report.errorKind).toBe('sample_insufficient')
    expect(hardResult.report.sampleChecks.frontendSourceRatio.pass).toBe(false)
    expect(
      hardResult.report.failedRules.some((item: any) => item.key === 'samples.frontendSourceRatio')
    ).toBe(true)
  })

  it('报告应包含 schemaVersion、sampleChecks 与 recommendations 字段', async () => {
    const apiBase = await startMockSloServer({
      summary: buildSummaryPayload(),
      breakdown: {
        totalRequests: 60,
        totalRoutes: 3,
        items: [
          {
            routeKey: '/api/channel/providers',
            method: 'GET',
            count: 20,
            successRate: 1,
            avgMs: 35,
            p95Ms: 90,
            p99Ms: 120,
            lastSeenAt: new Date().toISOString()
          }
        ]
      },
      journeyFailures: {
        window: {
          minutes: 60,
          from: new Date(Date.now() - 60 * 60_000).toISOString(),
          to: new Date().toISOString()
        },
        counts: {
          totalFailJourneys: 3
        },
        items: [
          {
            failedStage: 'workspace',
            errorKind: 'quota',
            httpStatus: 429,
            count: 2,
            share: 2 / 3,
            latestAt: new Date().toISOString()
          }
        ],
        updatedAt: new Date().toISOString()
      }
    })

    const result = await runSloGate({
      mode: 'soft',
      apiBase,
      env: {
        SLO_GATE_REPORT_SCHEMA_VERSION: '1.1',
        SLO_GATE_MIN_NON_AI_SAMPLES: '1',
        SLO_GATE_MIN_JOURNEY_SAMPLES: '1'
      }
    })

    expect(result.exitCode).toBe(0)
    expect(result.report.status).toBe('pass')
    expect(result.report.errorKind).toBe('none')
    expect(result.report.schemaVersion).toBe('1.1')
    expect(result.report.sampleChecks.nonAiSamples.pass).toBe(true)
    expect(result.report.sampleChecks.journeySamples.pass).toBe(true)
    expect(result.report.sampleChecks.frontendSourceRatio.pass).toBe(true)
    expect(result.report.frontendSourceKey).toBe('frontend')
    expect(result.report.minFrontendSourceRatio).toBe(0)
    expect(Array.isArray(result.report.diagnostics)).toBe(true)
    expect(result.report.diagnostics.length).toBeGreaterThan(0)
    expect(result.report.journeyFailures?.counts?.totalFailJourneys).toBe(3)
    expect(Array.isArray(result.report.journeyFailures?.items)).toBe(true)
    expect(result.report.journeyFailures?.items?.[0]?.failedStage).toBe('workspace')
    expect(Array.isArray(result.report.recommendations)).toBe(true)
    expect(result.report.recommendations.length).toBeGreaterThan(0)
  })
})
