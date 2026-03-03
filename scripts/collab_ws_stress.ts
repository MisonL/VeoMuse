type CollabRole = 'owner' | 'editor' | 'viewer'

interface StressConfig {
  selfHost: boolean
  apiBase: string
  clients: number
  rounds: number
  ackTimeoutMs: number
  workspaceName: string
  ownerName: string
  ownerEmail: string
  ownerPassword: string
  runTag: string
}

interface StressClient {
  ws: WebSocket
  sessionId: string
  role: CollabRole
  memberName: string
  ready: boolean
  ackCount: number
  errorCount: number
  broadcastCount: number
  readyWaiter?: {
    resolve: () => void
    reject: (error: Error) => void
    timer: ReturnType<typeof setTimeout>
  }
  pendingAck?: {
    ackType: string
    sentAt: number
    resolve: (latencyMs: number) => void
    reject: (error: Error) => void
    timer: ReturnType<typeof setTimeout>
  }
}

interface StressSummary {
  timestamp: string
  apiBase: string
  workspaceId: string
  projectId: string
  clients: number
  rounds: number
  totalMessages: number
  ackCount: number
  ackRate: number
  avgAckMs: number
  p95AckMs: number
  errors: number
  broadcasts: number
  durationMs: number
}

interface AuthSessionPayload {
  accessToken: string
  refreshToken: string
  expiresAt: string
  user: {
    id: string
    email: string
  }
}

interface OrganizationPayload {
  id: string
  name: string
}

interface AuthResponsePayload {
  success: boolean
  session: AuthSessionPayload
  organizations: OrganizationPayload[]
}

interface AuthContext {
  accessToken: string
  organizationId: string
  userId: string
  email: string
}

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const parseConfig = (): StressConfig => {
  const runTag = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const ownerName = process.env.COLLAB_STRESS_OWNER || 'StressOwner'
  const apiBase = String(process.env.API_BASE_URL || '')
    .trim()
    .replace(/\/+$/, '')
  return {
    selfHost: process.env.SELF_HOST === '1' || process.env.SELF_HOST === 'true',
    apiBase,
    clients: parsePositiveInt(process.env.COLLAB_STRESS_CLIENTS, 12),
    rounds: parsePositiveInt(process.env.COLLAB_STRESS_ROUNDS, 10),
    ackTimeoutMs: parsePositiveInt(process.env.COLLAB_STRESS_ACK_TIMEOUT_MS, 6000),
    workspaceName: process.env.COLLAB_STRESS_WORKSPACE || `WS 压测 ${Date.now()}`,
    ownerName,
    ownerEmail: process.env.COLLAB_STRESS_OWNER_EMAIL || `stress-owner-${runTag}@veomuse.local`,
    ownerPassword: process.env.COLLAB_STRESS_OWNER_PASSWORD || 'StressOwner!2026',
    runTag
  }
}

const percentile = (samples: number[], p: number) => {
  if (!samples.length) return 0
  const sorted = [...samples].sort((a, b) => a - b)
  const index = Math.max(0, Math.ceil(sorted.length * p) - 1)
  return Number((sorted[index] || sorted[sorted.length - 1] || 0).toFixed(2))
}

const average = (samples: number[]) => {
  if (!samples.length) return 0
  const total = samples.reduce((sum, value) => sum + value, 0)
  return Number((total / samples.length).toFixed(2))
}

const toWsBase = (apiBase: string) => {
  if (apiBase.startsWith('https://')) return apiBase.replace('https://', 'wss://')
  if (apiBase.startsWith('http://')) return apiBase.replace('http://', 'ws://')
  return apiBase
}

const requestJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    }
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.error || `HTTP ${response.status}`)
  }
  return payload as T
}

const authHeaders = (auth: AuthContext): HeadersInit => ({
  Authorization: `Bearer ${auth.accessToken}`,
  'x-organization-id': auth.organizationId
})

const extractAuthContext = (payload: AuthResponsePayload): AuthContext => {
  const accessToken = payload.session?.accessToken?.trim()
  const userId = payload.session?.user?.id?.trim()
  const email = payload.session?.user?.email?.trim()
  const organizationId = payload.organizations?.[0]?.id?.trim()
  if (!accessToken || !userId || !email || !organizationId) {
    throw new Error('登录响应缺少 accessToken/userId/organizationId')
  }
  return {
    accessToken,
    organizationId,
    userId,
    email
  }
}

const ensureUserSession = async (
  apiBase: string,
  input: {
    email: string
    password: string
    organizationName?: string
  }
) => {
  try {
    const registered = await requestJson<AuthResponsePayload>(`${apiBase}/api/auth/register`, {
      method: 'POST',
      body: JSON.stringify({
        email: input.email,
        password: input.password,
        organizationName: input.organizationName
      })
    })
    return extractAuthContext(registered)
  } catch (error: any) {
    const message = String(error?.message || '')
    if (!message.includes('已注册')) {
      throw error
    }
  }

  const loggedIn = await requestJson<AuthResponsePayload>(`${apiBase}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      password: input.password
    })
  })
  return extractAuthContext(loggedIn)
}

const waitOpen = (ws: WebSocket, timeoutMs: number) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('WebSocket open timeout'))
    }, timeoutMs)

    ws.onopen = () => {
      clearTimeout(timer)
      resolve()
    }

    ws.onclose = (event) => {
      clearTimeout(timer)
      reject(
        new Error(`WebSocket closed before open (${event.code}): ${event.reason || 'no reason'}`)
      )
    }

    ws.onerror = () => {
      clearTimeout(timer)
      reject(new Error('WebSocket open failed'))
    }
  })

const attachClientHandlers = (client: StressClient) => {
  client.ws.onmessage = (event) => {
    let payload: any = null
    try {
      payload = JSON.parse(String(event.data || '{}'))
    } catch {
      client.errorCount += 1
      return
    }

    if (payload.type === 'presence.snapshot') {
      client.ready = true
      if (client.readyWaiter) {
        clearTimeout(client.readyWaiter.timer)
        client.readyWaiter.resolve()
        client.readyWaiter = undefined
      }
      return
    }

    if (payload.type === 'error') {
      client.errorCount += 1
      if (client.pendingAck) {
        clearTimeout(client.pendingAck.timer)
        client.pendingAck.reject(new Error(payload.error || 'ws error'))
        client.pendingAck = undefined
      }
      return
    }

    if (payload.type === 'collab.event') {
      client.broadcastCount += 1
      return
    }

    if (
      payload.type === 'ack' &&
      client.pendingAck &&
      payload.ackType === client.pendingAck.ackType
    ) {
      const latency = performance.now() - client.pendingAck.sentAt
      clearTimeout(client.pendingAck.timer)
      client.ackCount += 1
      client.pendingAck.resolve(Number(latency.toFixed(2)))
      client.pendingAck = undefined
    }
  }
}

const waitClientReady = (client: StressClient, timeoutMs: number) => {
  if (client.ready) return Promise.resolve()
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      client.readyWaiter = undefined
      reject(new Error(`等待会话就绪超时: ${client.sessionId}`))
    }, timeoutMs)
    client.readyWaiter = { resolve, reject, timer }
  })
}

const sendAndWaitAck = (
  client: StressClient,
  ackType: string,
  payload: Record<string, unknown>,
  timeoutMs: number
) => {
  if (client.pendingAck) return Promise.reject(new Error('Pending ack exists'))
  return new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => {
      client.pendingAck = undefined
      reject(new Error(`Ack timeout for ${ackType}`))
    }, timeoutMs)

    client.pendingAck = {
      ackType,
      sentAt: performance.now(),
      resolve,
      reject,
      timer
    }

    client.ws.send(JSON.stringify(payload))
  })
}

const closeClient = (client: StressClient) => {
  try {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({ type: 'presence.leave' }))
      client.ws.close()
    }
  } catch {
    // noop
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const canReachApiBase = async (apiBase: string) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 1200)
  try {
    const response = await fetch(`${apiBase}/api/health`, {
      method: 'GET',
      signal: controller.signal
    })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

const resolveApiBase = async (configuredApiBase: string) => {
  if (configuredApiBase) return configuredApiBase
  const candidates = [
    'http://127.0.0.1:18081', // Docker 网关入口
    'http://127.0.0.1:33117' // 直连后端监听
  ]

  for (const candidate of candidates) {
    if (await canReachApiBase(candidate)) {
      return candidate
    }
  }

  return candidates[0]
}

const run = async () => {
  const config = parseConfig()
  const startedAt = performance.now()
  let apiBase = await resolveApiBase(config.apiBase)
  let runtimeApp: any = null
  const shouldSelfHost = config.selfHost || (!config.apiBase && !(await canReachApiBase(apiBase)))

  if (shouldSelfHost) {
    const mod = await import('../apps/backend/src/index')
    runtimeApp = mod.createApp()
    runtimeApp.listen({ port: 0, hostname: '127.0.0.1' })
    const port = runtimeApp.server?.port
    if (!port) throw new Error('SELF_HOST 启动失败，未获取到端口')
    apiBase = `http://127.0.0.1:${port}`
    await sleep(150)
  }

  const wsBase = toWsBase(apiBase)
  const ownerAuth = await ensureUserSession(apiBase, {
    email: config.ownerEmail,
    password: config.ownerPassword,
    organizationName: `${config.ownerName} Organization`
  })
  const createPayload = await requestJson<{
    success: boolean
    workspace: { id: string }
    defaultProject: { id: string }
  }>(`${apiBase}/api/workspaces`, {
    method: 'POST',
    headers: authHeaders(ownerAuth),
    body: JSON.stringify({
      name: config.workspaceName,
      ownerName: config.ownerName,
      organizationId: ownerAuth.organizationId
    })
  })

  if (!createPayload.workspace?.id || !createPayload.defaultProject?.id) {
    throw new Error('创建工作区失败，缺少 workspace/project id')
  }

  const workspaceId = createPayload.workspace.id
  const projectId = createPayload.defaultProject.id
  const clients: StressClient[] = []
  const latencies: number[] = []
  const memberSessions: AuthContext[] = []

  try {
    for (let i = 1; i < config.clients; i += 1) {
      const memberName = `StressMember-${i + 1}`
      const memberSession = await ensureUserSession(apiBase, {
        email: `stress-member-${config.runTag}-${i + 1}@veomuse.local`,
        password: `StressMember!2026-${i + 1}`
      })
      memberSessions.push(memberSession)
      await requestJson<{ success: boolean }>(`${apiBase}/api/workspaces/${workspaceId}/members`, {
        method: 'POST',
        headers: authHeaders(ownerAuth),
        body: JSON.stringify({
          name: memberName,
          role: 'editor',
          userId: memberSession.userId
        })
      })
    }

    for (let i = 0; i < config.clients; i += 1) {
      const role: CollabRole = i === 0 ? 'owner' : 'editor'
      const memberName = i === 0 ? config.ownerName : `StressMember-${i + 1}`
      const sessionId = `stress-${i + 1}-${Math.random().toString(36).slice(2, 8)}`
      const accessToken = i === 0 ? ownerAuth.accessToken : memberSessions[i - 1]?.accessToken
      if (!accessToken) {
        throw new Error(`缺少第 ${i + 1} 个客户端 accessToken`)
      }
      const query = new URLSearchParams({
        sessionId
      })
      const ws = new WebSocket(`${wsBase}/ws/collab/${workspaceId}?${query.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })
      await waitOpen(ws, config.ackTimeoutMs)
      const client: StressClient = {
        ws,
        sessionId,
        role,
        memberName,
        ready: false,
        ackCount: 0,
        errorCount: 0,
        broadcastCount: 0
      }
      attachClientHandlers(client)
      await waitClientReady(client, config.ackTimeoutMs)
      clients.push(client)
    }

    const workers = clients.map(async (client, clientIndex) => {
      for (let round = 0; round < config.rounds; round += 1) {
        const patchLatency = await sendAndWaitAck(
          client,
          'timeline.patch',
          {
            type: 'timeline.patch',
            projectId,
            payload: {
              round,
              client: clientIndex,
              detail: 'stress-timeline-patch'
            }
          },
          config.ackTimeoutMs
        )
        latencies.push(patchLatency)

        if (round % 3 === 0) {
          const cursorLatency = await sendAndWaitAck(
            client,
            'cursor.update',
            {
              type: 'cursor.update',
              projectId,
              payload: {
                round,
                x: Number((Math.random() * 0.95).toFixed(3)),
                y: Number((Math.random() * 0.95).toFixed(3))
              }
            },
            config.ackTimeoutMs
          )
          latencies.push(cursorLatency)
        }
      }

      const heartbeatLatency = await sendAndWaitAck(
        client,
        'presence.heartbeat',
        { type: 'presence.heartbeat' },
        config.ackTimeoutMs
      )
      latencies.push(heartbeatLatency)
    })

    await Promise.all(workers)
    await sleep(120)

    const expectedPerClient = config.rounds + Math.floor((config.rounds + 2) / 3) + 1
    const totalMessages = config.clients * expectedPerClient
    const ackCount = clients.reduce((sum, client) => sum + client.ackCount, 0)
    const errors = clients.reduce((sum, client) => sum + client.errorCount, 0)
    const broadcasts = clients.reduce((sum, client) => sum + client.broadcastCount, 0)
    const ackRate = totalMessages > 0 ? Number((ackCount / totalMessages).toFixed(4)) : 0

    const summary: StressSummary = {
      timestamp: new Date().toISOString(),
      apiBase,
      workspaceId,
      projectId,
      clients: config.clients,
      rounds: config.rounds,
      totalMessages,
      ackCount,
      ackRate,
      avgAckMs: average(latencies),
      p95AckMs: percentile(latencies, 0.95),
      errors,
      broadcasts,
      durationMs: Number((performance.now() - startedAt).toFixed(2))
    }

    console.log('--- COLLISION STRESS SUMMARY ---')
    console.log(JSON.stringify(summary, null, 2))

    if (summary.ackRate < 0.99 || summary.errors > 0) {
      process.exitCode = 2
    }
  } finally {
    clients.forEach(closeClient)
    await sleep(60)
    if (runtimeApp && typeof runtimeApp.stop === 'function') {
      runtimeApp.stop()
    } else if (runtimeApp?.server?.stop) {
      runtimeApp.server.stop(true)
    }
  }
}

run().catch((error) => {
  console.error('[collab-ws-stress] failed:', error?.message || error)
  process.exit(1)
})
