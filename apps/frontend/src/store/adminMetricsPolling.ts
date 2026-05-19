import { useEffect } from 'react'

interface AdminMetricsPollingControllerOptions {
  computeDelay: (failureStreak: number) => number
  getFailureStreak: () => number
  refreshNow: () => Promise<boolean>
  setPollingState: (state: { isPolling: boolean; failureStreak: number }) => void
}

export const createAdminMetricsPollingController = ({
  computeDelay,
  getFailureStreak,
  refreshNow,
  setPollingState
}: AdminMetricsPollingControllerOptions) => {
  let subscribers = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  const clearTimer = () => {
    if (timer) clearTimeout(timer)
    timer = null
  }

  const scheduleNextTick = () => {
    if (subscribers <= 0) return
    clearTimer()
    const hiddenFactor =
      typeof document !== 'undefined' && document.visibilityState === 'hidden' ? 4 : 1
    const delay = computeDelay(getFailureStreak()) * hiddenFactor
    timer = setTimeout(() => {
      void refreshNow()
    }, delay)
  }

  const startPolling = () => {
    if (subscribers <= 0) return
    setPollingState({ isPolling: true, failureStreak: 0 })
    clearTimer()
    void refreshNow()
  }

  const stopPolling = () => {
    clearTimer()
    setPollingState({ isPolling: false, failureStreak: 0 })
  }

  const subscribe = () => {
    subscribers += 1
    if (subscribers === 1) startPolling()
    return () => {
      subscribers = Math.max(0, subscribers - 1)
      if (subscribers === 0) stopPolling()
    }
  }

  const usePolling = () => {
    useEffect(() => {
      const unsubscribe = subscribe()
      const onVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          clearTimer()
          void refreshNow()
        }
      }
      document.addEventListener('visibilitychange', onVisibilityChange)
      return () => {
        document.removeEventListener('visibilitychange', onVisibilityChange)
        unsubscribe()
      }
    }, [])
  }

  return {
    onRefreshSettled: scheduleNextTick,
    subscribe,
    usePolling
  }
}
