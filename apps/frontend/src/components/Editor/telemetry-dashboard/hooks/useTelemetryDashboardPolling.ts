import { useEffect, useRef } from 'react'
import { computePollBackoff } from '../../telemetryDashboard.logic'

interface UseTelemetryDashboardPollingOptions {
  hasAdminToken: boolean
  fetchDbHealth: (mode?: 'quick' | 'full') => Promise<boolean>
  fetchDbRuntime: () => Promise<boolean>
  refreshProviderHealth: () => Promise<boolean>
  refreshSloData: () => Promise<boolean>
}

export const useTelemetryDashboardPolling = ({
  hasAdminToken,
  fetchDbHealth,
  fetchDbRuntime,
  refreshProviderHealth,
  refreshSloData
}: UseTelemetryDashboardPollingOptions) => {
  const pollFailureStreak = useRef(0)

  useEffect(() => {
    let disposed = false
    let timer: number | null = null
    let runtimeTick = 0

    const schedule = (delayMs: number) => {
      if (disposed) return
      timer = window.setTimeout(
        () => {
          void tick()
        },
        Math.max(3000, delayMs)
      )
    }

    const tick = async () => {
      if (disposed) return
      if (!hasAdminToken) {
        pollFailureStreak.current = 0
        schedule(15000)
        return
      }

      runtimeTick += 1
      const healthOk = await fetchDbHealth('quick')
      let runtimeOk = true
      let sloOk = true

      if (runtimeTick % 3 === 0) {
        runtimeOk = await fetchDbRuntime()
        await refreshProviderHealth()
      }

      if (runtimeTick % 2 === 0) {
        sloOk = await refreshSloData()
      }

      const nextBackoff = computePollBackoff({
        healthOk,
        runtimeOk,
        sloOk,
        failureStreak: pollFailureStreak.current
      })
      pollFailureStreak.current = nextBackoff.nextFailureStreak
      schedule(nextBackoff.nextDelayMs)
    }

    void tick()

    return () => {
      disposed = true
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [fetchDbHealth, fetchDbRuntime, hasAdminToken, refreshProviderHealth, refreshSloData])
}
