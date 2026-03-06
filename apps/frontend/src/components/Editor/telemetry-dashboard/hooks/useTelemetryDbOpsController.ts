import { useCallback, useEffect, useRef, useState } from 'react'
import {
  adminGetJson,
  adminPostJson,
  getAdminToken,
  setAdminToken as persistAdminToken
} from '../../../../utils/eden'
import { buildRepairQueryParams } from '../../telemetryDashboard.logic'
import type { RepairRange, RepairStatusFilter } from '../../telemetryDashboard.logic'
import type { DbHealthSummary, DbRepairRecord, DbRuntimeConfig } from '../types'

const REPAIR_PAGE_SIZE = 20

const resolveErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

interface UseTelemetryDbOpsControllerOptions {
  refreshMetricsNow: () => Promise<unknown>
  refreshProviderHealth: () => Promise<boolean>
  refreshSloData: () => Promise<boolean>
  resetProviderHealth: () => void
  resetSloData: () => void
}

export const useTelemetryDbOpsController = ({
  refreshMetricsNow,
  refreshProviderHealth,
  refreshSloData,
  resetProviderHealth,
  resetSloData
}: UseTelemetryDbOpsControllerOptions) => {
  const [dbError, setDbError] = useState('')
  const [dbHealth, setDbHealth] = useState<DbHealthSummary | null>(null)
  const [dbRuntime, setDbRuntime] = useState<DbRuntimeConfig | null>(null)
  const [dbRepairs, setDbRepairs] = useState<DbRepairRecord[]>([])
  const [repairRange, setRepairRange] = useState<RepairRange>('24h')
  const [repairStatusFilter, setRepairStatusFilter] = useState<RepairStatusFilter>('all')
  const [repairReasonInput, setRepairReasonInput] = useState('')
  const [repairReasonFilter, setRepairReasonFilter] = useState('')
  const [repairHasMore, setRepairHasMore] = useState(false)
  const [repairTotal, setRepairTotal] = useState<number | null>(null)
  const [isRepairLoading, setIsRepairLoading] = useState(false)
  const [isDbBusy, setIsDbBusy] = useState(false)
  const [savedAdminToken, setSavedAdminToken] = useState(() => getAdminToken())
  const [adminTokenInput, setAdminTokenInput] = useState(() => getAdminToken())

  const latestRepairQueryToken = useRef(0)
  const dbRepairsRef = useRef<DbRepairRecord[]>([])

  const hasAdminToken = savedAdminToken.trim().length > 0

  useEffect(() => {
    dbRepairsRef.current = dbRepairs
  }, [dbRepairs])

  const fetchDbHealth = useCallback(async (mode: 'quick' | 'full' = 'quick') => {
    try {
      const healthPayload = await adminGetJson<{ health?: DbHealthSummary }>(
        `/api/admin/db/health?mode=${mode}`
      )
      setDbHealth(healthPayload.health || null)
      setDbError('')
      return true
    } catch (error: unknown) {
      setDbError(resolveErrorMessage(error, '拉取数据库健康状态失败'))
      return false
    }
  }, [])

  const fetchDbRuntime = useCallback(async () => {
    try {
      const runtimePayload = await adminGetJson<{
        runtime?: DbRuntimeConfig
        health?: DbHealthSummary
      }>('/api/admin/db/runtime')
      setDbRuntime(runtimePayload.runtime || null)
      if (runtimePayload.health) setDbHealth(runtimePayload.health)
      setDbError('')
      return true
    } catch (error: unknown) {
      setDbError(resolveErrorMessage(error, '拉取数据库运行配置失败'))
      return false
    }
  }, [])

  const fetchRepairHistory = useCallback(
    async (append: boolean) => {
      if (!getAdminToken().trim()) {
        setDbError('')
        setIsRepairLoading(false)
        setDbRepairs([])
        dbRepairsRef.current = []
        setRepairTotal(null)
        setRepairHasMore(false)
        return
      }

      const nextOffset = append ? dbRepairsRef.current.length : 0
      const queryToken = ++latestRepairQueryToken.current
      setIsRepairLoading(true)
      try {
        const query = buildRepairQueryParams({
          offset: nextOffset,
          range: repairRange,
          status: repairStatusFilter,
          reason: repairReasonFilter,
          pageSize: REPAIR_PAGE_SIZE
        })
        const repairsPayload = await adminGetJson<{
          repairs?: DbRepairRecord[]
          page?: { hasMore?: boolean; total?: number | null }
        }>(`/api/admin/db/repairs?${query.toString()}`)
        if (queryToken !== latestRepairQueryToken.current) return

        const incomingRows = Array.isArray(repairsPayload.repairs) ? repairsPayload.repairs : []
        const rows = append ? [...dbRepairsRef.current, ...incomingRows] : incomingRows
        setDbRepairs(rows)
        dbRepairsRef.current = rows
        setRepairTotal(
          typeof repairsPayload.page?.total === 'number'
            ? repairsPayload.page.total
            : append
              ? null
              : rows.length
        )
        setRepairHasMore(
          typeof repairsPayload.page?.hasMore === 'boolean'
            ? repairsPayload.page.hasMore
            : incomingRows.length === REPAIR_PAGE_SIZE
        )
        setDbError('')
      } catch (error: unknown) {
        if (queryToken !== latestRepairQueryToken.current) return
        setDbError(resolveErrorMessage(error, '拉取数据库修复历史失败'))
        if (!append) {
          setDbRepairs([])
          dbRepairsRef.current = []
          setRepairTotal(null)
          setRepairHasMore(false)
        }
      } finally {
        if (queryToken === latestRepairQueryToken.current) {
          setIsRepairLoading(false)
        }
      }
    },
    [repairRange, repairReasonFilter, repairStatusFilter]
  )

  useEffect(() => {
    if (!hasAdminToken) return
    void fetchRepairHistory(false)
  }, [fetchRepairHistory, hasAdminToken])

  const handleSaveToken = useCallback(async () => {
    persistAdminToken(adminTokenInput)
    setSavedAdminToken(adminTokenInput)

    if (!adminTokenInput.trim()) {
      setDbError('')
      setDbHealth(null)
      setDbRuntime(null)
      setDbRepairs([])
      dbRepairsRef.current = []
      setRepairTotal(null)
      setRepairHasMore(false)
      resetProviderHealth()
      resetSloData()
      return
    }

    await refreshMetricsNow()
    await fetchDbHealth('quick')
    await fetchDbRuntime()
    await refreshProviderHealth()
    await refreshSloData()
    await fetchRepairHistory(false)
  }, [
    adminTokenInput,
    fetchDbHealth,
    fetchDbRuntime,
    fetchRepairHistory,
    refreshMetricsNow,
    refreshProviderHealth,
    refreshSloData,
    resetProviderHealth,
    resetSloData
  ])

  const handleRepair = useCallback(
    async (force: boolean) => {
      if (force) {
        const confirmed = window.confirm('强制修复会触发数据库重建与数据回收，确认继续吗？')
        if (!confirmed) return
      }
      setIsDbBusy(true)
      try {
        await adminPostJson('/api/admin/db/repair', {
          force,
          reason: force ? 'dashboard-force-repair' : 'dashboard-repair',
          checkMode: force ? 'full' : 'quick'
        })
        await fetchDbHealth('full')
        await fetchDbRuntime()
        await fetchRepairHistory(false)
      } catch (error: unknown) {
        setDbError(resolveErrorMessage(error, '数据库修复失败'))
      } finally {
        setIsDbBusy(false)
      }
    },
    [fetchDbHealth, fetchDbRuntime, fetchRepairHistory]
  )

  const handleApplyReasonFilter = useCallback(() => {
    setRepairReasonFilter(repairReasonInput.trim())
  }, [repairReasonInput])

  const handleClearReasonFilter = useCallback(() => {
    setRepairReasonInput('')
    setRepairReasonFilter('')
  }, [])

  return {
    adminTokenInput,
    isDbBusy,
    dbRuntime,
    repairRange,
    repairStatusFilter,
    repairReasonInput,
    isRepairLoading,
    dbHealth,
    dbError,
    dbRepairs,
    repairTotal,
    repairHasMore,
    hasAdminToken,
    setAdminTokenInput,
    setRepairRange,
    setRepairStatusFilter,
    setRepairReasonInput,
    fetchDbHealth,
    fetchDbRuntime,
    fetchRepairHistory,
    handleSaveToken,
    handleRepair,
    handleApplyReasonFilter,
    handleClearReasonFilter
  }
}
