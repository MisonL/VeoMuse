import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

type JourneyStoreModule = typeof import('../apps/frontend/src/store/journeyTelemetryStore')

const ACCESS_TOKEN_STORAGE_KEY = 'veomuse-access-token'
const SUCCESS_FLAG_KEY = 'veomuse-first-success-reported-v1'
const QUEUE_STORAGE_KEY = 'veomuse-journey-report-queue-v1'

const createStorage = () => {
  const cache = new Map<string, string>()
  return {
    getItem: (key: string) => cache.get(key) ?? null,
    setItem: (key: string, value: string) => {
      cache.set(key, value)
    },
    removeItem: (key: string) => {
      cache.delete(key)
    },
    clear: () => {
      cache.clear()
    }
  }
}

const createAccessToken = (expSecondsFromNow = 3600) => {
  const payload = {
    exp: Math.floor(Date.now() / 1000) + expSecondsFromNow,
    sub: 'journey-user'
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `mock.${encoded}.sig`
}

describe('JourneyTelemetryStore 覆盖补强', () => {
  const originalFetch = global.fetch
  const originalSetTimeout = globalThis.setTimeout
  const originalClearTimeout = globalThis.clearTimeout

  let storeModule: JourneyStoreModule

  beforeEach(async () => {
    if (typeof (globalThis as any).window === 'undefined') {
      Object.defineProperty(globalThis, 'window', { value: globalThis, configurable: true })
    }
    if (typeof (globalThis as any).localStorage === 'undefined') {
      Object.defineProperty(globalThis, 'localStorage', {
        value: createStorage(),
        configurable: true
      })
    }
    if (typeof (globalThis as any).document === 'undefined') {
      Object.defineProperty(globalThis, 'document', {
        value: {
          addEventListener: () => {},
          removeEventListener: () => {},
          visibilityState: 'visible'
        },
        configurable: true
      })
    }
    globalThis.setTimeout = ((_: (...args: any[]) => void, __?: number) => 1 as any) as any
    globalThis.clearTimeout = (() => {}) as any
    if (typeof localStorage !== 'undefined') localStorage.clear()
    if (!(document as any).addEventListener) (document as any).addEventListener = () => {}
    if (!(document as any).removeEventListener) (document as any).removeEventListener = () => {}
    try {
      ;(document as any).visibilityState = 'visible'
    } catch {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    }
    localStorage.removeItem(SUCCESS_FLAG_KEY)
    localStorage.removeItem(QUEUE_STORAGE_KEY)

    storeModule = await import('../apps/frontend/src/store/journeyTelemetryStore')
    storeModule.useJourneyTelemetryStore.setState({
      steps: [],
      startedAt: null,
      completed: false,
      reporting: false,
      flushingQueue: false,
      pendingQueue: [],
      organizationId: '',
      workspaceId: ''
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
    globalThis.setTimeout = originalSetTimeout
    globalThis.clearTimeout = originalClearTimeout
    if (typeof localStorage !== 'undefined') localStorage.clear()
  })

  it('无 access token 时应将旅程写入待上报队列', async () => {
    const store = storeModule.useJourneyTelemetryStore.getState()
    store.markStep('register_or_login', { organizationId: 'org-1', workspaceId: 'ws-1' })
    store.markStep('workspace_ready')

    const reported = await store.reportJourney(false, {
      reason: 'network',
      failedStage: 'workspace',
      errorKind: 'network',
      httpStatus: 503
    })

    expect(reported).toBe(false)
    const state = storeModule.useJourneyTelemetryStore.getState()
    expect(state.pendingQueue.length).toBe(1)
    expect(state.pendingQueue[0]?.payload?.meta?.failedStage).toBe('workspace')
    expect(localStorage.getItem(QUEUE_STORAGE_KEY)).toContain('first_success_path')
  })

  it('有 access token 时应成功上报并清空队列', async () => {
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, createAccessToken())
    global.fetch = mock(() => Promise.resolve(new Response('{}', { status: 200 }))) as any

    const store = storeModule.useJourneyTelemetryStore.getState()
    store.markStep('register_or_login', { organizationId: 'org-2', workspaceId: 'ws-2' })
    store.markStep('organization_ready')
    store.markStep('workspace_ready')
    store.markStep('generation_triggered')
    store.markStep('export_triggered')

    const reported = await store.reportJourney(true, { reason: 'done' })
    expect(reported).toBe(true)

    await store.flushQueue()
    const state = storeModule.useJourneyTelemetryStore.getState()
    expect(state.completed).toBe(true)
    expect(state.pendingQueue.length).toBe(0)
    expect(localStorage.getItem(SUCCESS_FLAG_KEY)).toBe('1')
  })

  it('flushQueue 发送失败时应进入重试并指数延后', async () => {
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, createAccessToken())
    global.fetch = mock(() => Promise.resolve(new Response('{}', { status: 503 }))) as any
    const now = Date.now()

    storeModule.useJourneyTelemetryStore.setState({
      pendingQueue: [
        {
          id: 'queue-retry',
          payload: {
            flowType: 'first_success_path',
            source: 'frontend',
            stepCount: 2,
            success: false,
            durationMs: 1200,
            organizationId: 'org-r',
            workspaceId: 'ws-r',
            sessionId: 'session-retry',
            idempotencyKey: 'session-retry:failed:2',
            meta: {
              steps: ['register_or_login', 'workspace_ready'],
              reason: 'network',
              failedStage: 'workspace',
              errorKind: 'network',
              httpStatus: 503
            }
          },
          attempt: 0,
          nextAttemptAt: now - 10,
          createdAt: now - 50
        }
      ]
    } as any)

    await storeModule.useJourneyTelemetryStore.getState().flushQueue()
    const queue = storeModule.useJourneyTelemetryStore.getState().pendingQueue
    expect(queue.length).toBe(1)
    expect(queue[0]?.attempt).toBe(1)
    expect((queue[0]?.nextAttemptAt || 0) > now).toBe(true)
    expect(localStorage.getItem(QUEUE_STORAGE_KEY)).toContain('"attempt":1')
  })

  it('flushQueue 达到最大重试次数后应丢弃队列项', async () => {
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, createAccessToken())
    global.fetch = mock(() => Promise.resolve(new Response('{}', { status: 500 }))) as any
    const now = Date.now()

    storeModule.useJourneyTelemetryStore.setState({
      pendingQueue: [
        {
          id: 'queue-drop',
          payload: {
            flowType: 'first_success_path',
            source: 'frontend',
            stepCount: 3,
            success: false,
            durationMs: 900,
            organizationId: 'org-d',
            workspaceId: 'ws-d',
            sessionId: 'session-drop',
            idempotencyKey: 'session-drop:failed:3',
            meta: {
              steps: ['register_or_login', 'workspace_ready', 'generation_triggered'],
              reason: 'server',
              failedStage: 'generate',
              errorKind: 'server',
              httpStatus: 500
            }
          },
          attempt: 2,
          nextAttemptAt: now - 1,
          createdAt: now - 80
        }
      ]
    } as any)

    await storeModule.useJourneyTelemetryStore.getState().flushQueue()
    const queue = storeModule.useJourneyTelemetryStore.getState().pendingQueue
    expect(queue.length).toBe(0)
    expect(localStorage.getItem(QUEUE_STORAGE_KEY)).toBeNull()
  })

  it('flushQueue 发送成功时应移除待上报项', async () => {
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, createAccessToken())
    global.fetch = mock(() => Promise.resolve(new Response('{}', { status: 200 }))) as any
    const now = Date.now()

    storeModule.useJourneyTelemetryStore.setState({
      pendingQueue: [
        {
          id: 'queue-success',
          payload: {
            flowType: 'first_success_path',
            source: 'frontend',
            stepCount: 1,
            success: true,
            durationMs: 420,
            organizationId: 'org-s',
            workspaceId: 'ws-s',
            sessionId: 'session-success',
            idempotencyKey: 'session-success:success:1',
            meta: {
              steps: ['export_triggered'],
              reason: 'done'
            }
          },
          attempt: 0,
          nextAttemptAt: now - 1,
          createdAt: now - 5
        }
      ]
    } as any)

    await storeModule.useJourneyTelemetryStore.getState().flushQueue()
    expect(storeModule.useJourneyTelemetryStore.getState().pendingQueue.length).toBe(0)
  })

  it('resetJourney(force) 应覆盖已完成保护与强制重置分支', () => {
    const beforeSession = storeModule.useJourneyTelemetryStore.getState().sessionId
    storeModule.useJourneyTelemetryStore.setState({
      completed: true,
      steps: ['register_or_login', 'workspace_ready'],
      startedAt: Date.now() - 1200,
      organizationId: 'org-reset',
      workspaceId: 'ws-reset'
    })

    storeModule.useJourneyTelemetryStore.getState().resetJourney()
    const protectedState = storeModule.useJourneyTelemetryStore.getState()
    expect(protectedState.completed).toBe(true)
    expect(protectedState.steps.length).toBe(2)

    storeModule.useJourneyTelemetryStore.getState().resetJourney(true)
    const forced = storeModule.useJourneyTelemetryStore.getState()
    expect(forced.completed).toBe(false)
    expect(forced.steps).toEqual([])
    expect(forced.startedAt).toBeNull()
    expect(forced.organizationId).toBe('')
    expect(forced.workspaceId).toBe('')
    expect(forced.sessionId).not.toBe(beforeSession)
  })
})
