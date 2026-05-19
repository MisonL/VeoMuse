import { create } from 'zustand'
import { adminGetJson, getAdminToken } from '../utils/eden'
import { createAdminMetricsPollingController } from './adminMetricsPolling'

const BASE_INTERVAL_MS = 2000
const MAX_INTERVAL_MS = 30000
const HISTORY_SIZE = 24

interface AdminMetricsPayload {
  system?: {
    renderLoad?: number
  }
  [key: string]: unknown
}

interface AdminMetricsState {
  metrics: AdminMetricsPayload | null
  error: string
  failureStreak: number
  isPolling: boolean
  lastUpdatedAt: number | null
  renderLoadHistory: number[]
  refreshNow: () => Promise<boolean>
}

let inFlightRefresh: Promise<boolean> | null = null

export const computeMetricsPollDelay = (failureStreak: number) => {
  const safe = Math.max(0, failureStreak)
  return Math.min(MAX_INTERVAL_MS, BASE_INTERVAL_MS * 2 ** safe)
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

const pushRenderLoad = (history: number[], renderLoad: number) => {
  const next = [...history, renderLoad]
  if (next.length <= HISTORY_SIZE) return next
  return next.slice(next.length - HISTORY_SIZE)
}

const refreshAdminMetricsNow = async (
  set: (
    partial: Partial<AdminMetricsState> | ((state: AdminMetricsState) => Partial<AdminMetricsState>)
  ) => void
) => {
  if (inFlightRefresh) return inFlightRefresh

  inFlightRefresh = Promise.resolve().then(async () => {
    try {
      if (!getAdminToken().trim()) {
        set((state) => ({
          error: state.error || '请先填写 Admin Token 后查看监控',
          failureStreak: 0
        }))
        return false
      }
      const data = await adminGetJson<AdminMetricsPayload>('/api/admin/metrics')
      const renderLoadRaw = data?.system?.renderLoad
      const renderLoad =
        typeof renderLoadRaw === 'number' && Number.isFinite(renderLoadRaw)
          ? Math.round(renderLoadRaw)
          : 0
      set((state) => ({
        metrics: data,
        error: '',
        failureStreak: 0,
        lastUpdatedAt: Date.now(),
        renderLoadHistory: pushRenderLoad(state.renderLoadHistory, renderLoad)
      }))
      return true
    } catch (error: unknown) {
      set((state) => ({
        error: error instanceof Error ? error.message : '拉取监控数据失败',
        failureStreak: Math.min(6, state.failureStreak + 1)
      }))
      return false
    } finally {
      inFlightRefresh = null
      pollingController.onRefreshSettled()
    }
  })

  return inFlightRefresh
}

const pollingController = createAdminMetricsPollingController({
  computeDelay: computeMetricsPollDelay,
  getFailureStreak: () => useAdminMetricsStore.getState().failureStreak,
  refreshNow: () => refreshAdminMetricsNow(useAdminMetricsStore.setState),
  setPollingState: (state) => {
    useAdminMetricsStore.setState(state)
  }
})

export const subscribeAdminMetricsPolling = pollingController.subscribe
export const useAdminMetricsPolling = pollingController.usePolling
