import { useEffect } from 'react'
import { create } from 'zustand'
import { adminGetJson, getAdminToken } from '../utils/eden'

const BASE_INTERVAL_MS = 2000
const MAX_INTERVAL_MS = 30000
const HISTORY_SIZE = 24

type AdminMetricsPayload = any

interface AdminMetricsState {
  metrics: AdminMetricsPayload | null
  error: string
  failureStreak: number
  isPolling: boolean
  lastUpdatedAt: number | null
  renderLoadHistory: number[]
  refreshNow: () => Promise<boolean>
}

let pollingSubscribers = 0
let pollingTimer: ReturnType<typeof setTimeout> | null = null
let inFlightRefresh: Promise<boolean> | null = null

export const computeMetricsPollDelay = (failureStreak: number) => {
  const safe = Math.max(0, failureStreak)
  return Math.min(MAX_INTERVAL_MS, BASE_INTERVAL_MS * (2 ** safe))
}

export const useAdminMetricsStore = create<AdminMetricsState>((set) => ({
  metrics: null,
  error: '',
  failureStreak: 0,
  isPolling: false,
  lastUpdatedAt: null,
  renderLoadHistory: new Array(10).fill(0),
  refreshNow: async () => refreshAdminMetricsNow(set)
}))

const scheduleNextTick = () => {
  if (pollingSubscribers <= 0) return
  const { failureStreak } = useAdminMetricsStore.getState()
  const hiddenFactor = typeof document !== 'undefined' && document.visibilityState === 'hidden' ? 4 : 1
  const delay = computeMetricsPollDelay(failureStreak) * hiddenFactor
  pollingTimer = setTimeout(() => {
    void refreshAdminMetricsNow(useAdminMetricsStore.setState)
  }, delay)
}

const pushRenderLoad = (history: number[], renderLoad: number) => {
  const next = [...history, renderLoad]
  if (next.length <= HISTORY_SIZE) return next
  return next.slice(next.length - HISTORY_SIZE)
}

const clearPollingTimer = () => {
  if (pollingTimer) clearTimeout(pollingTimer)
  pollingTimer = null
}

const refreshAdminMetricsNow = async (
  set: (partial: Partial<AdminMetricsState> | ((state: AdminMetricsState) => Partial<AdminMetricsState>)) => void
) => {
  if (inFlightRefresh) return inFlightRefresh

  inFlightRefresh = (async () => {
    if (!getAdminToken().trim()) {
      set((state) => ({
        error: state.error || '请先填写 Admin Token 后查看监控',
        failureStreak: 0
      }))
      return false
    }
    try {
      const data = await adminGetJson<AdminMetricsPayload>('/api/admin/metrics')
      const renderLoad = Number.isFinite(data?.system?.renderLoad) ? Math.round(data.system.renderLoad) : 0
      set((state) => ({
        metrics: data,
        error: '',
        failureStreak: 0,
        lastUpdatedAt: Date.now(),
        renderLoadHistory: pushRenderLoad(state.renderLoadHistory, renderLoad)
      }))
      return true
    } catch (error: any) {
      set((state) => ({
        error: error?.message || '拉取监控数据失败',
        failureStreak: Math.min(6, state.failureStreak + 1)
      }))
      return false
    } finally {
      inFlightRefresh = null
      clearPollingTimer()
      scheduleNextTick()
    }
  })()

  return inFlightRefresh
}

const startPolling = () => {
  if (pollingSubscribers <= 0) return
  const { isPolling } = useAdminMetricsStore.getState()
  if (isPolling) return
  useAdminMetricsStore.setState({ isPolling: true, failureStreak: 0 })
  clearPollingTimer()
  void refreshAdminMetricsNow(useAdminMetricsStore.setState)
}

const stopPolling = () => {
  clearPollingTimer()
  useAdminMetricsStore.setState({ isPolling: false, failureStreak: 0 })
}

export const subscribeAdminMetricsPolling = () => {
  pollingSubscribers += 1
  startPolling()
  return () => {
    pollingSubscribers = Math.max(0, pollingSubscribers - 1)
    if (pollingSubscribers === 0) stopPolling()
  }
}

export const useAdminMetricsPolling = () => {
  useEffect(() => {
    const unsubscribe = subscribeAdminMetricsPolling()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        clearPollingTimer()
        void useAdminMetricsStore.getState().refreshNow()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      unsubscribe()
    }
  }, [])
}
