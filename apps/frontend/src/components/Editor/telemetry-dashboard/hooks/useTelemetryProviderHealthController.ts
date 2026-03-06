import { useCallback, useState } from 'react'
import { adminGetJson } from '../../../../utils/eden'
import type { ProviderHealthItem } from '../../telemetryDashboard.logic'

const resolveErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

export const useTelemetryProviderHealthController = () => {
  const [providerHealthRows, setProviderHealthRows] = useState<ProviderHealthItem[]>([])
  const [providerHealthError, setProviderHealthError] = useState('')
  const [isProviderHealthLoading, setIsProviderHealthLoading] = useState(false)

  const fetchProviderHealth = useCallback(async () => {
    setIsProviderHealthLoading(true)
    try {
      const payload = await adminGetJson<{
        success: boolean
        providers?: ProviderHealthItem[]
      }>('/api/admin/providers/health')
      setProviderHealthRows(Array.isArray(payload.providers) ? payload.providers : [])
      setProviderHealthError('')
      return true
    } catch (error: unknown) {
      setProviderHealthRows([])
      setProviderHealthError(resolveErrorMessage(error, '拉取 Provider 健康状态失败'))
      return false
    } finally {
      setIsProviderHealthLoading(false)
    }
  }, [])

  const resetProviderHealth = useCallback(() => {
    setProviderHealthRows([])
    setProviderHealthError('')
    setIsProviderHealthLoading(false)
  }, [])

  return {
    providerHealthRows,
    providerHealthError,
    isProviderHealthLoading,
    fetchProviderHealth,
    resetProviderHealth
  }
}
