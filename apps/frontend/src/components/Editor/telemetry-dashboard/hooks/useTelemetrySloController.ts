import { useCallback, useMemo, useState } from 'react'
import { adminGetJson } from '../../../../utils/eden'
import {
  normalizeJourneyFailCount,
  normalizeSloSummary,
  resolveSloDecision
} from '../../telemetryDashboard.logic'
import type {
  SloBreakdownItem,
  SloJourneyFailureItem,
  SloSummary
} from '../../telemetryDashboard.logic'

const SLO_BREAKDOWN_LIMIT = 8
const SLO_JOURNEY_FAILURE_LIMIT = 10

const resolveErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

export const useTelemetrySloController = () => {
  const [sloSummary, setSloSummary] = useState<SloSummary | null>(null)
  const [sloBreakdown, setSloBreakdown] = useState<SloBreakdownItem[]>([])
  const [sloJourneyFailures, setSloJourneyFailures] = useState<SloJourneyFailureItem[]>([])
  const [sloJourneyFailCount, setSloJourneyFailCount] = useState(0)
  const [sloError, setSloError] = useState('')

  const fetchSloSummary = useCallback(async (windowMinutes = 1440) => {
    try {
      const payload = await adminGetJson<{ success: boolean; summary?: SloSummary }>(
        `/api/admin/slo/summary?windowMinutes=${windowMinutes}`
      )
      const normalized = normalizeSloSummary(payload.summary)
      if (payload.summary && !normalized) {
        setSloSummary(null)
        return 'SLO 摘要结构异常'
      }
      setSloSummary(normalized)
      return ''
    } catch (error: unknown) {
      setSloSummary(null)
      return resolveErrorMessage(error, '拉取 SLO 摘要失败')
    }
  }, [])

  const fetchSloBreakdown = useCallback(
    async (windowMinutes = 1440, limit = SLO_BREAKDOWN_LIMIT) => {
      try {
        const payload = await adminGetJson<{
          success: boolean
          breakdown?: { items?: SloBreakdownItem[] }
        }>(`/api/admin/slo/breakdown?windowMinutes=${windowMinutes}&category=non_ai&limit=${limit}`)
        setSloBreakdown(payload.breakdown?.items || [])
        return ''
      } catch (error: unknown) {
        setSloBreakdown([])
        return resolveErrorMessage(error, '拉取 SLO 分解失败')
      }
    },
    []
  )

  const fetchSloJourneyFailures = useCallback(
    async (windowMinutes = 1440, limit = SLO_JOURNEY_FAILURE_LIMIT) => {
      try {
        const payload = await adminGetJson<{
          success: boolean
          counts?: { totalFailJourneys?: number }
          items?: SloJourneyFailureItem[]
        }>(`/api/admin/slo/journey-failures?windowMinutes=${windowMinutes}&limit=${limit}`)
        setSloJourneyFailures(Array.isArray(payload.items) ? payload.items : [])
        setSloJourneyFailCount(normalizeJourneyFailCount(payload.counts?.totalFailJourneys))
        return ''
      } catch (error: unknown) {
        setSloJourneyFailures([])
        setSloJourneyFailCount(0)
        return resolveErrorMessage(error, '拉取失败旅程诊断失败')
      }
    },
    []
  )

  const refreshSloData = useCallback(
    async (windowMinutes = 1440) => {
      const summaryError = await fetchSloSummary(windowMinutes)
      const breakdownError = await fetchSloBreakdown(windowMinutes)
      const journeyError = await fetchSloJourneyFailures(windowMinutes)
      const message = [summaryError, breakdownError, journeyError].filter(Boolean).join(' | ')
      setSloError(message)
      return message.length === 0
    },
    [fetchSloBreakdown, fetchSloJourneyFailures, fetchSloSummary]
  )

  const resetSloData = useCallback(() => {
    setSloSummary(null)
    setSloBreakdown([])
    setSloJourneyFailures([])
    setSloJourneyFailCount(0)
    setSloError('')
  }, [])

  const sloDecision = useMemo(
    () => (sloSummary ? resolveSloDecision(sloSummary) : null),
    [sloSummary]
  )

  return {
    sloSummary,
    sloBreakdown,
    sloJourneyFailures,
    sloJourneyFailCount,
    sloError,
    sloDecision,
    refreshSloData,
    resetSloData
  }
}
