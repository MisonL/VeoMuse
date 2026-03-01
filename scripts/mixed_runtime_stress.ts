interface ScenarioConfig {
  name: string
  path: string
  buildBody: (index: number) => Record<string, unknown>
  validate: (payload: any) => boolean
}

interface ScenarioMetric {
  name: string
  total: number
  success: number
  failed: number
  avgMs: number
  p95Ms: number
  sampleError?: string
}

const parseIntSafe = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const percentile = (samples: number[], p: number) => {
  if (!samples.length) return 0
  const sorted = [...samples].sort((a, b) => a - b)
  const index = Math.max(0, Math.ceil(sorted.length * p) - 1)
  return Number((sorted[index] || sorted[sorted.length - 1] || 0).toFixed(2))
}

const average = (samples: number[]) => {
  if (!samples.length) return 0
  return Number((samples.reduce((sum, value) => sum + value, 0) / samples.length).toFixed(2))
}

const apiBase = (process.env.API_BASE_URL || 'http://127.0.0.1:18081').trim().replace(/\/+$/, '')
const mockBindHost = (process.env.MOCK_PROVIDER_BIND_HOST || '127.0.0.1').trim()
const mockPort = parseIntSafe(process.env.MOCK_PROVIDER_PORT, 39092)
const mockProviderBaseUrl = (
  process.env.MOCK_PROVIDER_BASE_URL ||
  `http://host.docker.internal:${mockPort}`
).trim().replace(/\/+$/, '')
const totalRequests = parseIntSafe(process.env.STRESS_TOTAL_REQUESTS, 480)
const concurrency = parseIntSafe(process.env.STRESS_CONCURRENCY, 24)

const jsonResponse = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'Content-Type': 'application/json' }
})

const startMockProvider = () => Bun.serve({
  hostname: mockBindHost,
  port: mockPort,
  reusePort: true,
  fetch(req) {
    const url = new URL(req.url)
    const path = url.pathname

    if (path.endsWith('/veo-3.1-generate-001:predictLongRunning')) {
      return jsonResponse({ name: `veo-op-${Date.now()}` })
    }
    if (path.endsWith('/generate')) {
      return jsonResponse({ operationName: `gen-op-${Date.now()}`, message: 'ok' })
    }
    if (path.endsWith('/synthesize')) {
      return jsonResponse({ audioBase64: Buffer.from('stress-audio').toString('base64') })
    }
    if (path.endsWith('/apply')) {
      return jsonResponse({ operationId: `apply-${Date.now()}` })
    }
    return jsonResponse({ error: `unknown path: ${path}` }, 404)
  }
})

const requestJson = async <T>(
  path: string,
  init?: RequestInit,
  headers?: Record<string, string>
): Promise<T> => {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      ...(headers || {})
    }
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(`${path} -> HTTP ${response.status}: ${(payload as any)?.error || 'unknown'}`)
  }
  return payload as T
}

const run = async () => {
  const started = performance.now()
  const server = startMockProvider()
  const stamp = Date.now()
  const email = `stress-${stamp}@example.com`
  const password = 'VM_TEST_PASSWORD'

  try {
    const registerData = await requestJson<any>('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        organizationName: `Stress-Org-${stamp}`
      })
    })
    const token = String(registerData?.session?.accessToken || '')
    const orgId = String(registerData?.organizations?.[0]?.id || '')
    if (!token || !orgId) {
      throw new Error('register response invalid')
    }
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      'x-organization-id': orgId,
      'Content-Type': 'application/json'
    }

    const wsData = await requestJson<any>('/api/workspaces', {
      method: 'POST',
      body: JSON.stringify({
        name: `Stress-Workspace-${stamp}`,
        ownerName: `StressOwner-${stamp}`,
        organizationId: orgId
      })
    }, authHeaders)
    const workspaceId = String(wsData?.workspace?.id || '')
    const projectId = String(wsData?.defaultProject?.id || '')
    if (!workspaceId || !projectId) {
      throw new Error('workspace response invalid')
    }

    const providers = ['veo-3.1', 'tts', 'vfx']
    for (const providerId of providers) {
      const saved = await requestJson<any>(`/api/organizations/${orgId}/channels/${providerId}`, {
        method: 'PUT',
        body: JSON.stringify({
          baseUrl: mockProviderBaseUrl,
          apiKey: 'stress-key',
          enabled: true
        })
      }, authHeaders)
      if (!saved?.success) {
        throw new Error(`failed to save provider ${providerId}`)
      }
    }

    const scenarios: ScenarioConfig[] = [
      {
        name: 'video-generate-veo',
        path: '/api/video/generate',
        buildBody: (index) => ({
          modelId: 'veo-3.1',
          text: `stress prompt #${index}`,
          workspaceId
        }),
        validate: (payload) => payload?.status === 'ok' && payload?.success === true
      },
      {
        name: 'ai-tts',
        path: '/api/ai/tts',
        buildBody: (index) => ({
          text: `stress tts #${index}`,
          workspaceId
        }),
        validate: (payload) => payload?.status === 'ok' && typeof payload?.audioUrl === 'string'
      },
      {
        name: 'ai-vfx-apply',
        path: '/api/ai/vfx/apply',
        buildBody: () => ({
          clipId: projectId,
          vfxType: 'glow',
          intensity: 0.7,
          workspaceId
        }),
        validate: (payload) => payload?.status === 'ok' && typeof payload?.operationId === 'string'
      }
    ]

    const counters = new Map<string, { total: number; success: number; failed: number; latencies: number[]; sampleError?: string }>()
    for (const scenario of scenarios) {
      counters.set(scenario.name, {
        total: 0,
        success: 0,
        failed: 0,
        latencies: []
      })
    }

    let cursor = 0
    const nextTask = () => {
      if (cursor >= totalRequests) return null
      const id = cursor
      cursor += 1
      return id
    }

    const workers = Array.from({ length: concurrency }, (_, workerIndex) => (async () => {
      while (true) {
        const taskId = nextTask()
        if (taskId === null) return
        const scenario = scenarios[taskId % scenarios.length]
        const metric = counters.get(scenario.name)!
        metric.total += 1
        const begin = performance.now()
        try {
          const data = await requestJson<any>(scenario.path, {
            method: 'POST',
            body: JSON.stringify(scenario.buildBody(taskId + workerIndex))
          }, authHeaders)
          const latency = Number((performance.now() - begin).toFixed(2))
          metric.latencies.push(latency)
          if (scenario.validate(data)) {
            metric.success += 1
          } else {
            metric.failed += 1
            if (!metric.sampleError) {
              metric.sampleError = `unexpected payload: ${JSON.stringify(data).slice(0, 220)}`
            }
          }
        } catch (error: any) {
          const latency = Number((performance.now() - begin).toFixed(2))
          metric.latencies.push(latency)
          metric.failed += 1
          if (!metric.sampleError) {
            metric.sampleError = error?.message || String(error)
          }
        }
      }
    })())

    await Promise.all(workers)

    const metrics: ScenarioMetric[] = Array.from(counters.entries()).map(([name, value]) => ({
      name,
      total: value.total,
      success: value.success,
      failed: value.failed,
      avgMs: average(value.latencies),
      p95Ms: percentile(value.latencies, 0.95),
      sampleError: value.sampleError
    }))

    const total = metrics.reduce((sum, item) => sum + item.total, 0)
    const success = metrics.reduce((sum, item) => sum + item.success, 0)
    const failed = metrics.reduce((sum, item) => sum + item.failed, 0)
    const successRate = total > 0 ? Number((success / total).toFixed(4)) : 0
    const durationMs = Number((performance.now() - started).toFixed(2))

    const summary = {
      timestamp: new Date().toISOString(),
      apiBase,
      mockProviderBaseUrl,
      mockBindHost: `${mockBindHost}:${mockPort}`,
      totalRequests: total,
      concurrency,
      success,
      failed,
      successRate,
      durationMs,
      metrics
    }

    console.log('--- MIXED RUNTIME STRESS SUMMARY ---')
    console.log(JSON.stringify(summary, null, 2))

    if (successRate < 0.99 || failed > 0) {
      process.exit(2)
    }
  } finally {
    server.stop(true)
  }
}

run().catch((error) => {
  console.error('[mixed-runtime-stress] failed:', error?.message || error)
  process.exit(1)
})
