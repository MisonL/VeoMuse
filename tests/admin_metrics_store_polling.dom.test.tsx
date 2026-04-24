import './helpers/dom-test-setup'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { act, render } from '@testing-library/react'
import {
  computeMetricsPollDelay,
  subscribeAdminMetricsPolling,
  useAdminMetricsPolling,
  useAdminMetricsStore
} from '../apps/frontend/src/store/adminMetricsStore'

const ADMIN_TOKEN_STORAGE_KEY = 'veomuse-admin-token'

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

const resetMetricsStore = () => {
  useAdminMetricsStore.setState({
    metrics: null,
    error: '',
    failureStreak: 0,
    isPolling: false,
    lastUpdatedAt: null,
    renderLoadHistory: new Array(10).fill(0)
  })
}

const flushAsyncWork = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const installTimerHarness = () => {
  const handlers: Array<() => void> = []
  const delays: number[] = []
  const cleared: unknown[] = []
  const originalSetTimeout = globalThis.setTimeout
  const originalClearTimeout = globalThis.clearTimeout

  globalThis.setTimeout = ((handler: TimerHandler, timeout?: number) => {
    const timerId = { id: handlers.length + 1 }
    delays.push(Number(timeout || 0))
    handlers.push(() => {
      if (typeof handler === 'function') handler()
    })
    return timerId as unknown as ReturnType<typeof setTimeout>
  }) as typeof setTimeout

  globalThis.clearTimeout = ((timerId?: ReturnType<typeof setTimeout>) => {
    cleared.push(timerId)
  }) as typeof clearTimeout

  return {
    handlers,
    delays,
    cleared,
    restore: () => {
      globalThis.setTimeout = originalSetTimeout
      globalThis.clearTimeout = originalClearTimeout
    }
  }
}

const PollingHarness = () => {
  useAdminMetricsPolling()
  return <div>polling</div>
}

describe('AdminMetricsStore 轮询生命周期', () => {
  const originalFetch = globalThis.fetch
  let restoreTimerHarness: (() => void) | null = null

  beforeEach(() => {
    restoreTimerHarness?.()
    restoreTimerHarness = null
    globalThis.fetch = originalFetch
    localStorage.clear()
    localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, 'admin-token')
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    resetMetricsStore()
  })

  afterEach(() => {
    restoreTimerHarness?.()
    restoreTimerHarness = null
    globalThis.fetch = originalFetch
  })

  it('成功刷新应追加四舍五入后的 renderLoad 并保留最近 24 个点', async () => {
    const history = Array.from({ length: 24 }, (_, index) => index)
    useAdminMetricsStore.setState({ renderLoadHistory: history })
    globalThis.fetch = mock(() =>
      Promise.resolve(
        jsonResponse({
          system: {
            renderLoad: 42.6
          }
        })
      )
    ) as any

    await expect(useAdminMetricsStore.getState().refreshNow()).resolves.toBe(true)

    const state = useAdminMetricsStore.getState()
    expect(state.error).toBe('')
    expect(state.failureStreak).toBe(0)
    expect(state.lastUpdatedAt).toBeNumber()
    expect(state.renderLoadHistory).toHaveLength(24)
    expect(state.renderLoadHistory[0]).toBe(1)
    expect(state.renderLoadHistory.at(-1)).toBe(43)
  })

  it('非 Error 异常应写入显式失败文案并保持 failureStreak 上限', async () => {
    useAdminMetricsStore.setState({ failureStreak: 6 })
    globalThis.fetch = mock(() => Promise.reject('network down')) as any

    await expect(useAdminMetricsStore.getState().refreshNow()).resolves.toBe(false)

    const state = useAdminMetricsStore.getState()
    expect(state.error).toBe('拉取监控数据失败')
    expect(state.failureStreak).toBe(6)
  })

  it('重复订阅应复用同一个轮询循环并在最后一个订阅释放后停止', async () => {
    const timerHarness = installTimerHarness()
    restoreTimerHarness = timerHarness.restore
    globalThis.fetch = mock(() =>
      Promise.resolve(
        jsonResponse({
          system: {
            renderLoad: 11
          }
        })
      )
    ) as any

    const unsubscribeA = subscribeAdminMetricsPolling()
    const unsubscribeB = subscribeAdminMetricsPolling()

    expect(useAdminMetricsStore.getState().isPolling).toBe(true)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)

    await flushAsyncWork()
    expect(timerHarness.delays).toContain(computeMetricsPollDelay(0))

    unsubscribeA()
    expect(useAdminMetricsStore.getState().isPolling).toBe(true)

    await act(async () => {
      timerHarness.handlers[0]?.()
      await flushAsyncWork()
    })

    expect(globalThis.fetch).toHaveBeenCalledTimes(2)

    unsubscribeB()
    expect(useAdminMetricsStore.getState().isPolling).toBe(false)
    expect(timerHarness.cleared.length).toBeGreaterThan(0)
  })

  it('useAdminMetricsPolling 应在页面重新可见时立即刷新并在卸载时移除监听', async () => {
    const timerHarness = installTimerHarness()
    restoreTimerHarness = timerHarness.restore
    globalThis.fetch = mock(() =>
      Promise.resolve(
        jsonResponse({
          system: {
            renderLoad: 19
          }
        })
      )
    ) as any

    const view = render(<PollingHarness />)

    await flushAsyncWork()
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
      await flushAsyncWork()
    })

    expect(globalThis.fetch).toHaveBeenCalledTimes(2)

    view.unmount()
    const callCountAfterUnmount = (globalThis.fetch as ReturnType<typeof mock>).mock.calls.length

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
      await flushAsyncWork()
    })

    expect((globalThis.fetch as ReturnType<typeof mock>).mock.calls.length).toBe(
      callCountAfterUnmount
    )
    expect(timerHarness.cleared.length).toBeGreaterThan(0)
  })
})
