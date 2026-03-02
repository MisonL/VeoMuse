import { afterEach, describe, expect, it } from 'bun:test'
import fs from 'fs/promises'
import path from 'path'

const tempDir = path.resolve(process.cwd(), 'artifacts', 'tests', 'slo-gate')
const createdFiles: string[] = []
const startedServers: Array<ReturnType<typeof Bun.serve>> = []

const createJsonResponse = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'Content-Type': 'application/json' }
})

const startMockSloServer = (payload: {
  summary: Record<string, unknown>
  breakdown?: Record<string, unknown>
}) => {
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch(req) {
      const { pathname } = new URL(req.url)
      if (pathname === '/api/admin/slo/summary') {
        return createJsonResponse({
          success: true,
          summary: payload.summary
        })
      }
      if (pathname === '/api/admin/slo/breakdown') {
        return createJsonResponse({
          success: true,
          breakdown: payload.breakdown || {
            totalRequests: 0,
            totalRoutes: 0,
            items: []
          }
        })
      }
      return createJsonResponse({ success: false, error: 'not found' }, 404)
    }
  })
  startedServers.push(server)
  return `http://127.0.0.1:${server.port}`
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

  const proc = Bun.spawn([
    'bun',
    'run',
    'scripts/slo_gate.ts',
    '--mode',
    params.mode,
    '--api-base',
    params.apiBase,
    '--output',
    reportPath
  ], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SLO_GATE_TIMEOUT_MS: '800',
      ...(params.env || {})
    },
    stdout: 'pipe',
    stderr: 'pipe'
  })

  const exitCode = await proc.exited
  const report = JSON.parse(await fs.readFile(reportPath, 'utf8'))
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()

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
    totalJourneys: 8,
    successJourneys: 8,
    nonAiSamples: 30
  },
  sourceBreakdown: {
    e2e: { total: 8, success: 8 }
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
    expect(softResult.report.mode).toBe('soft')

    const hardResult = await runSloGate({
      mode: 'hard',
      apiBase: unreachableApi
    })
    expect(hardResult.exitCode).toBe(1)
    expect(hardResult.report.status).toBe('fail')
    expect(hardResult.report.mode).toBe('hard')
  })

  it('样本不足时应命中样本门禁规则', async () => {
    const apiBase = startMockSloServer({
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
    expect(result.report.sampleChecks.nonAiSamples.pass).toBe(false)
    expect(result.report.sampleChecks.journeySamples.pass).toBe(false)
    expect(Array.isArray(result.report.failedRules)).toBe(true)
    expect(result.report.failedRules.some((item: any) => item.key === 'samples.nonAi')).toBe(true)
    expect(result.report.failedRules.some((item: any) => item.key === 'samples.journey')).toBe(true)
  })

  it('报告应包含 schemaVersion、sampleChecks 与 recommendations 字段', async () => {
    const apiBase = startMockSloServer({
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
    expect(result.report.schemaVersion).toBe('1.1')
    expect(result.report.sampleChecks.nonAiSamples.pass).toBe(true)
    expect(result.report.sampleChecks.journeySamples.pass).toBe(true)
    expect(Array.isArray(result.report.recommendations)).toBe(true)
    expect(result.report.recommendations.length).toBeGreaterThan(0)
  })
})
