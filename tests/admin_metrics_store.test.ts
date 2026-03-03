import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

type AdminMetricsModule = typeof import('../apps/frontend/src/store/adminMetricsStore')

const ADMIN_TOKEN_STORAGE_KEY = 'veomuse-admin-token'

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

const importStoreModule = async () =>
  (await import(
    `../apps/frontend/src/store/adminMetricsStore.ts?case=${Date.now()}-${Math.random()}`
  )) as AdminMetricsModule

describe('AdminMetricsStore 轮询退避策略', () => {
  const originalWindow = (globalThis as any).window
  const originalDocument = (globalThis as any).document
  const originalLocalStorage = (globalThis as any).localStorage
  const originalFetch = global.fetch
  const originalSetTimeout = globalThis.setTimeout
  const originalClearTimeout = globalThis.clearTimeout

  let storeModule: AdminMetricsModule

  beforeEach(async () => {
    const storage = createStorage()
    Object.defineProperty(globalThis, 'window', { value: globalThis, configurable: true })
    Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
    Object.defineProperty(globalThis, 'document', {
      value: { visibilityState: 'visible' },
      configurable: true
    })

    localStorage.clear()
    localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY)
    storeModule = await importStoreModule()
    storeModule.useAdminMetricsStore.setState({
      metrics: null,
      error: '',
      failureStreak: 0,
      isPolling: false,
      lastUpdatedAt: null,
      renderLoadHistory: new Array(10).fill(0)
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
    globalThis.setTimeout = originalSetTimeout
    globalThis.clearTimeout = originalClearTimeout
    Object.defineProperty(globalThis, 'window', { value: originalWindow, configurable: true })
    Object.defineProperty(globalThis, 'document', { value: originalDocument, configurable: true })
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      configurable: true
    })
  })

  it('应按指数退避增长并保持上限', () => {
    expect(storeModule.computeMetricsPollDelay(0)).toBe(2000)
    expect(storeModule.computeMetricsPollDelay(1)).toBe(4000)
    expect(storeModule.computeMetricsPollDelay(2)).toBe(8000)
    expect(storeModule.computeMetricsPollDelay(4)).toBe(30000)
    expect(storeModule.computeMetricsPollDelay(12)).toBe(30000)
  })

  it('负值输入应回落到基础轮询间隔', () => {
    expect(storeModule.computeMetricsPollDelay(-3)).toBe(2000)
  })

  it('未配置 admin token 时 refreshNow 应失败并写入错误', async () => {
    const ok = await storeModule.useAdminMetricsStore.getState().refreshNow()
    const state = storeModule.useAdminMetricsStore.getState()
    expect(ok).toBe(false)
    expect(state.error).toContain('Admin Token')
    expect(state.failureStreak).toBe(0)
  })

  it('并发 refreshNow 应复用同一 in-flight 请求并只触发一次 fetch', async () => {
    localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, 'admin-token')
    let resolveFetch: ((response: Response) => void) | null = null
    const fetchMock = mock(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        })
    )
    global.fetch = fetchMock as any

    const store = storeModule.useAdminMetricsStore.getState()
    const p1 = store.refreshNow()
    const p2 = store.refreshNow()

    expect(typeof (p1 as Promise<boolean>).then).toBe('function')
    expect(typeof (p2 as Promise<boolean>).then).toBe('function')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    resolveFetch?.(
      new Response(
        JSON.stringify({
          system: {
            renderLoad: 27.2,
            memory: { total: 8 * 1024 ** 3, usage: 0.31 }
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )

    await expect(Promise.all([p1, p2])).resolves.toEqual([true, true])
    const state = storeModule.useAdminMetricsStore.getState()
    expect(state.failureStreak).toBe(0)
    expect(state.error).toBe('')
  })

  it('轮询失败后应按 hidden 因子放大下一次退避间隔', async () => {
    localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, 'admin-token')
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    global.fetch = mock(() => Promise.reject(new Error('network down'))) as any

    const capturedDelay: number[] = []
    globalThis.setTimeout = ((handler: TimerHandler, timeout?: number) => {
      capturedDelay.push(Number(timeout || 0))
      return 1 as any
    }) as typeof setTimeout
    globalThis.clearTimeout = (() => {}) as typeof clearTimeout

    const unsubscribe = storeModule.subscribeAdminMetricsPolling()
    await Promise.resolve()
    await Promise.resolve()
    unsubscribe()

    const expectedDelay = storeModule.computeMetricsPollDelay(1) * 4
    expect(capturedDelay.includes(expectedDelay)).toBe(true)
    expect(storeModule.useAdminMetricsStore.getState().error).toContain('network down')
  })

  it('失败后恢复成功应清理错误并重置 failureStreak', async () => {
    localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, 'admin-token')
    let shouldFail = true
    global.fetch = mock(() => {
      if (shouldFail) return Promise.reject(new Error('temporary failed'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            system: {
              renderLoad: 48.6,
              memory: { total: 16 * 1024 ** 3, usage: 0.52 }
            }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    }) as any

    await expect(storeModule.useAdminMetricsStore.getState().refreshNow()).resolves.toBe(false)
    expect(storeModule.useAdminMetricsStore.getState().failureStreak).toBe(1)
    expect(storeModule.useAdminMetricsStore.getState().error).toContain('temporary failed')

    shouldFail = false
    await expect(storeModule.useAdminMetricsStore.getState().refreshNow()).resolves.toBe(true)

    const recovered = storeModule.useAdminMetricsStore.getState()
    expect(recovered.failureStreak).toBe(0)
    expect(recovered.error).toBe('')
    expect(recovered.metrics?.system?.renderLoad).toBe(48.6)
  })
})
