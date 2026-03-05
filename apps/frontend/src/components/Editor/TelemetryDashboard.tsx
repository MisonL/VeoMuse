import React, { useEffect, useRef, useState } from 'react'
import {
  adminGetJson,
  adminPostJson,
  getAdminToken,
  setAdminToken as persistAdminToken
} from '../../utils/eden'
import { useAdminMetricsPolling, useAdminMetricsStore } from '../../store/adminMetricsStore'
import {
  applyProjectGovernanceTemplate,
  batchUpdateProjectGovernanceClips,
  createProjectGovernanceComment,
  createProjectGovernanceReview,
  listProjectGovernanceComments,
  listProjectGovernanceReviews,
  listProjectGovernanceTemplates,
  normalizeProjectGovernanceLimit,
  resolveProjectGovernanceComment
} from './comparison-lab/types'
import type {
  ProjectGovernanceClipBatchUpdateResult,
  ProjectGovernanceComment,
  ProjectGovernanceReview,
  ProjectGovernanceTemplate,
  ProjectGovernanceTemplateApplyResult
} from './comparison-lab/types'
import {
  SLO_MIN_JOURNEY_SAMPLES,
  SLO_MIN_NON_AI_SAMPLES,
  buildGovernanceCommentListArgs,
  buildRepairQueryParams,
  computePollBackoff,
  formatApiAverageMs,
  formatApiSuccessRate,
  mergeUniqueComments,
  normalizeClipBatchOperations,
  normalizeJourneyFailCount,
  normalizeRepairHistoryPage,
  normalizeSloSummary,
  parseGovernanceReviewScore,
  parseJsonArray,
  parseJsonObject,
  parseMentions,
  resolveMetricsOverview,
  resolveSelectedCommentId,
  resolveSloDecision
} from './telemetryDashboard.logic'
import type {
  ProviderHealthItem,
  RepairRange,
  RepairStatusFilter,
  SloBreakdownItem,
  SloJourneyFailureItem,
  SloSummary
} from './telemetryDashboard.logic'
import './TelemetryDashboard.css'

const REPAIR_PAGE_SIZE = 20
const SLO_BREAKDOWN_LIMIT = 8
const SLO_JOURNEY_FAILURE_LIMIT = 10

const TelemetryDashboard: React.FC = () => {
  useAdminMetricsPolling()
  const metrics = useAdminMetricsStore((state) => state.metrics)
  const metricsError = useAdminMetricsStore((state) => state.error)
  const refreshMetricsNow = useAdminMetricsStore((state) => state.refreshNow)
  const [sloSummary, setSloSummary] = useState<SloSummary | null>(null)
  const [sloBreakdown, setSloBreakdown] = useState<SloBreakdownItem[]>([])
  const [sloJourneyFailures, setSloJourneyFailures] = useState<SloJourneyFailureItem[]>([])
  const [sloJourneyFailCount, setSloJourneyFailCount] = useState(0)
  const [sloError, setSloError] = useState('')
  const [dbError, setDbError] = useState<string>('')
  const [dbHealth, setDbHealth] = useState<any>(null)
  const [dbRuntime, setDbRuntime] = useState<any>(null)
  const [dbRepairs, setDbRepairs] = useState<any[]>([])
  const [repairRange, setRepairRange] = useState<RepairRange>('24h')
  const [repairStatusFilter, setRepairStatusFilter] = useState<RepairStatusFilter>('all')
  const [repairReasonInput, setRepairReasonInput] = useState('')
  const [repairReasonFilter, setRepairReasonFilter] = useState('')
  const [repairHasMore, setRepairHasMore] = useState(false)
  const [repairTotal, setRepairTotal] = useState<number | null>(null)
  const [isRepairLoading, setIsRepairLoading] = useState(false)
  const [isDbBusy, setIsDbBusy] = useState(false)
  const [adminTokenInput, setAdminTokenInput] = useState(getAdminToken())
  const [governanceProjectId, setGovernanceProjectId] = useState('')
  const [governanceBusy, setGovernanceBusy] = useState(false)
  const [governanceCommentLimit, setGovernanceCommentLimit] = useState('20')
  const [governanceCommentCursor, setGovernanceCommentCursor] = useState('')
  const [governanceCommentHasMore, setGovernanceCommentHasMore] = useState(false)
  const [governanceComments, setGovernanceComments] = useState<ProjectGovernanceComment[]>([])
  const [governanceCommentAnchor, setGovernanceCommentAnchor] = useState('')
  const [governanceCommentContent, setGovernanceCommentContent] = useState('')
  const [governanceCommentMentions, setGovernanceCommentMentions] = useState('')
  const [governanceSelectedCommentId, setGovernanceSelectedCommentId] = useState('')
  const [governanceReviewLimit, setGovernanceReviewLimit] = useState('20')
  const [governanceReviews, setGovernanceReviews] = useState<ProjectGovernanceReview[]>([])
  const [governanceReviewDecision, setGovernanceReviewDecision] =
    useState<ProjectGovernanceReview['decision']>('approved')
  const [governanceReviewSummary, setGovernanceReviewSummary] = useState('')
  const [governanceReviewScore, setGovernanceReviewScore] = useState('')
  const [governanceTemplates, setGovernanceTemplates] = useState<ProjectGovernanceTemplate[]>([])
  const [governanceSelectedTemplateId, setGovernanceSelectedTemplateId] = useState('')
  const [governanceTemplateOptions, setGovernanceTemplateOptions] = useState('{}')
  const [governanceTemplateResult, setGovernanceTemplateResult] =
    useState<ProjectGovernanceTemplateApplyResult | null>(null)
  const [governanceBatchOperations, setGovernanceBatchOperations] = useState(
    '[\n  {"clipId":"clip-a","patch":{"start":0,"end":3}}\n]'
  )
  const [governanceBatchResult, setGovernanceBatchResult] =
    useState<ProjectGovernanceClipBatchUpdateResult | null>(null)
  const [governanceError, setGovernanceError] = useState('')
  const [providerHealthRows, setProviderHealthRows] = useState<ProviderHealthItem[]>([])
  const [providerHealthError, setProviderHealthError] = useState('')
  const [isProviderHealthLoading, setIsProviderHealthLoading] = useState(false)
  const [fpsSummary, setFpsSummary] = useState('暂无 FPS 数据')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fpsHistory = useRef<number[]>([])
  const latestRepairQueryToken = useRef(0)
  const latestGovernanceRequestToken = useRef(0)
  const pollFailureStreak = useRef(0)
  const sloDecision = sloSummary ? resolveSloDecision(sloSummary) : null
  const metricsOverview = resolveMetricsOverview(metrics)

  const formatPercent = (value: number | null, fractionDigits = 1) => {
    if (value === null || !Number.isFinite(value)) return '--'
    return `${(value * 100).toFixed(fractionDigits)}%`
  }

  const formatMs = (value: number | null, fractionDigits = 0) => {
    if (value === null || !Number.isFinite(value)) return '--'
    return `${value.toFixed(fractionDigits)}ms`
  }

  const formatSteps = (value: number | null) => {
    if (value === null || !Number.isFinite(value)) return '--'
    return `${value.toFixed(2)} 步`
  }

  const ensureGovernanceProjectId = () => {
    const projectId = governanceProjectId.trim()
    if (!projectId) {
      setGovernanceError('请先输入项目 ID')
      return ''
    }
    return projectId
  }

  useEffect(() => {
    let lastTime = performance.now()
    let frameCount = 0
    let rafId = 0
    let disposed = false

    const drawFps = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = '#0b66ff'
      ctx.lineWidth = 2
      ctx.beginPath()

      const step = canvas.width / 50
      fpsHistory.current.forEach((fps, i) => {
        const x = i * step
        const y = canvas.height - (fps / 60) * canvas.height
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
    }

    const loop = () => {
      if (disposed) return
      frameCount++
      const now = performance.now()
      if (now - lastTime >= 1000) {
        fpsHistory.current.push(frameCount)
        if (fpsHistory.current.length > 50) fpsHistory.current.shift()
        if (fpsHistory.current.length > 0) {
          const min = Math.min(...fpsHistory.current)
          const max = Math.max(...fpsHistory.current)
          const avg =
            fpsHistory.current.reduce((total, value) => total + value, 0) /
            fpsHistory.current.length
          setFpsSummary(
            `最近 ${fpsHistory.current.length} 秒 FPS：平均 ${avg.toFixed(1)}，最低 ${min}，最高 ${max}`
          )
        }
        frameCount = 0
        lastTime = now
        drawFps()
      }
      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => {
      disposed = true
      cancelAnimationFrame(rafId)
    }
  }, [])

  const fetchDbHealth = async (mode: 'quick' | 'full' = 'quick') => {
    try {
      const healthPayload = await adminGetJson<any>(`/api/admin/db/health?mode=${mode}`)
      setDbHealth(healthPayload.health || null)
      setDbError('')
      return true
    } catch (error: any) {
      setDbError(error?.message || '拉取数据库健康状态失败')
      return false
    }
  }

  const fetchDbRuntime = async () => {
    try {
      const runtimePayload = await adminGetJson<any>('/api/admin/db/runtime')
      setDbRuntime(runtimePayload.runtime || null)
      if (runtimePayload.health) setDbHealth(runtimePayload.health)
      setDbError('')
      return true
    } catch (error: any) {
      setDbError(error?.message || '拉取数据库运行配置失败')
      return false
    }
  }

  const fetchProviderHealth = async () => {
    setIsProviderHealthLoading(true)
    try {
      const payload = await adminGetJson<{
        success: boolean
        providers?: ProviderHealthItem[]
      }>('/api/admin/providers/health')
      setProviderHealthRows(Array.isArray(payload.providers) ? payload.providers : [])
      setProviderHealthError('')
      return true
    } catch (error: any) {
      setProviderHealthRows([])
      setProviderHealthError(error?.message || '拉取 Provider 健康状态失败')
      return false
    } finally {
      setIsProviderHealthLoading(false)
    }
  }

  const fetchSloSummary = async (windowMinutes = 1440) => {
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
    } catch (error: any) {
      setSloSummary(null)
      return error?.message || '拉取 SLO 摘要失败'
    }
  }

  const fetchSloBreakdown = async (windowMinutes = 1440, limit = SLO_BREAKDOWN_LIMIT) => {
    try {
      const payload = await adminGetJson<{
        success: boolean
        breakdown?: { items?: SloBreakdownItem[] }
      }>(`/api/admin/slo/breakdown?windowMinutes=${windowMinutes}&category=non_ai&limit=${limit}`)
      setSloBreakdown(payload.breakdown?.items || [])
      return ''
    } catch (error: any) {
      setSloBreakdown([])
      return error?.message || '拉取 SLO 分解失败'
    }
  }

  const fetchSloJourneyFailures = async (
    windowMinutes = 1440,
    limit = SLO_JOURNEY_FAILURE_LIMIT
  ) => {
    try {
      const payload = await adminGetJson<{
        success: boolean
        counts?: { totalFailJourneys?: number }
        items?: SloJourneyFailureItem[]
      }>(`/api/admin/slo/journey-failures?windowMinutes=${windowMinutes}&limit=${limit}`)
      setSloJourneyFailures(Array.isArray(payload.items) ? payload.items : [])
      setSloJourneyFailCount(normalizeJourneyFailCount(payload.counts?.totalFailJourneys))
      return ''
    } catch (error: any) {
      setSloJourneyFailures([])
      setSloJourneyFailCount(0)
      return error?.message || '拉取失败旅程诊断失败'
    }
  }

  const fetchRepairHistory = async (append: boolean) => {
    if (!getAdminToken().trim()) {
      // 未配置管理员令牌时不主动触发 admin 请求，避免 401 噪音与控制台报错。
      setDbError('')
      setIsRepairLoading(false)
      setDbRepairs([])
      setRepairTotal(null)
      setRepairHasMore(false)
      return
    }

    const nextOffset = append ? dbRepairs.length : 0
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
      const repairsPayload = await adminGetJson<any>(`/api/admin/db/repairs?${query.toString()}`)
      if (queryToken !== latestRepairQueryToken.current) return

      const page = normalizeRepairHistoryPage({
        payload: repairsPayload,
        prevRows: dbRepairs,
        append,
        pageSize: REPAIR_PAGE_SIZE
      })

      setDbRepairs(page.rows)
      setRepairTotal(page.total)
      setRepairHasMore(page.hasMore)
      setDbError('')
    } catch (error: any) {
      if (queryToken !== latestRepairQueryToken.current) return
      setDbError(error?.message || '拉取数据库修复历史失败')
      if (!append) {
        setDbRepairs([])
        setRepairTotal(null)
        setRepairHasMore(false)
      }
    } finally {
      if (queryToken === latestRepairQueryToken.current) {
        setIsRepairLoading(false)
      }
    }
  }

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
      if (!getAdminToken().trim()) {
        schedule(15000)
        return
      }

      runtimeTick += 1
      const healthOk = await fetchDbHealth('quick')
      let runtimeOk = true
      let sloOk = true
      if (runtimeTick % 3 === 0) {
        runtimeOk = await fetchDbRuntime()
        await fetchProviderHealth()
      }
      if (runtimeTick % 2 === 0) {
        const summaryError = await fetchSloSummary(1440)
        const breakdownError = await fetchSloBreakdown(1440)
        const journeyError = await fetchSloJourneyFailures(1440)
        const messages = [summaryError, breakdownError, journeyError].filter(Boolean)
        setSloError(messages.join(' | '))
        sloOk = messages.length === 0
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
  }, [])

  useEffect(() => {
    if (!getAdminToken().trim()) return
    void fetchRepairHistory(false)
  }, [repairRange, repairStatusFilter, repairReasonFilter])

  useEffect(() => {
    setGovernanceCommentCursor('')
    setGovernanceCommentHasMore(false)
    setGovernanceSelectedCommentId('')
    setGovernanceTemplateResult(null)
    setGovernanceBatchResult(null)
    setGovernanceError('')
  }, [governanceProjectId])

  const handleSaveToken = async () => {
    persistAdminToken(adminTokenInput)
    pollFailureStreak.current = 0
    await refreshMetricsNow()
    await fetchDbHealth('quick')
    await fetchDbRuntime()
    await fetchProviderHealth()
    const summaryError = await fetchSloSummary(1440)
    const breakdownError = await fetchSloBreakdown(1440)
    const journeyError = await fetchSloJourneyFailures(1440)
    setSloError([summaryError, breakdownError, journeyError].filter(Boolean).join(' | '))
    await fetchRepairHistory(false)
  }

  const handleRepair = async (force: boolean) => {
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
    } catch (error: any) {
      setDbError(error?.message || '数据库修复失败')
    } finally {
      setIsDbBusy(false)
    }
  }

  const handleApplyReasonFilter = () => {
    setRepairReasonFilter(repairReasonInput.trim())
  }

  const handleClearReasonFilter = () => {
    setRepairReasonInput('')
    setRepairReasonFilter('')
  }

  const handleLoadGovernanceComments = async (append = false) => {
    const projectId = ensureGovernanceProjectId()
    if (!projectId) return
    const args = buildGovernanceCommentListArgs({
      append,
      cursor: governanceCommentCursor,
      limitInput: governanceCommentLimit,
      defaultLimit: 20
    })
    if (args.shouldStop) {
      setGovernanceCommentHasMore(false)
      return
    }
    const requestToken = ++latestGovernanceRequestToken.current
    const isStaleRequest = () =>
      requestToken !== latestGovernanceRequestToken.current ||
      governanceProjectId.trim() !== projectId
    setGovernanceBusy(true)
    setGovernanceError('')
    try {
      const payload = await listProjectGovernanceComments(projectId, {
        limit: args.limit,
        cursor: args.cursor
      })
      if (isStaleRequest()) return
      const rows = payload.comments || []
      const merged = mergeUniqueComments(governanceComments, rows, append)
      setGovernanceComments(merged)
      const nextCursor = payload.page.nextCursor || ''
      setGovernanceCommentCursor(nextCursor)
      setGovernanceCommentHasMore(Boolean(nextCursor) && payload.page.hasMore)
      setGovernanceSelectedCommentId(resolveSelectedCommentId(governanceSelectedCommentId, merged))
    } catch (error: any) {
      if (isStaleRequest()) return
      setGovernanceError(error?.message || '加载项目评论失败')
    } finally {
      if (!isStaleRequest()) {
        setGovernanceBusy(false)
      }
    }
  }

  const handleCreateGovernanceComment = async () => {
    const projectId = ensureGovernanceProjectId()
    if (!projectId) return
    if (!governanceCommentContent.trim()) {
      setGovernanceError('请输入评论内容')
      return
    }
    const requestToken = ++latestGovernanceRequestToken.current
    const isStaleRequest = () =>
      requestToken !== latestGovernanceRequestToken.current ||
      governanceProjectId.trim() !== projectId
    setGovernanceBusy(true)
    setGovernanceError('')
    try {
      const comment = await createProjectGovernanceComment(projectId, {
        anchor: governanceCommentAnchor.trim() || undefined,
        content: governanceCommentContent.trim(),
        mentions: parseMentions(governanceCommentMentions)
      })
      if (isStaleRequest()) return
      if (comment) {
        setGovernanceComments((prev) => [comment, ...prev.filter((item) => item.id !== comment.id)])
        setGovernanceSelectedCommentId(comment.id)
      }
      setGovernanceCommentContent('')
      setGovernanceCommentMentions('')
    } catch (error: any) {
      if (isStaleRequest()) return
      setGovernanceError(error?.message || '创建项目评论失败')
    } finally {
      if (!isStaleRequest()) {
        setGovernanceBusy(false)
      }
    }
  }

  const handleResolveGovernanceComment = async () => {
    const projectId = ensureGovernanceProjectId()
    if (!projectId) return
    if (!governanceSelectedCommentId.trim()) {
      setGovernanceError('请先选择评论')
      return
    }
    const requestToken = ++latestGovernanceRequestToken.current
    const isStaleRequest = () =>
      requestToken !== latestGovernanceRequestToken.current ||
      governanceProjectId.trim() !== projectId
    setGovernanceBusy(true)
    setGovernanceError('')
    try {
      const comment = await resolveProjectGovernanceComment(projectId, governanceSelectedCommentId)
      if (isStaleRequest()) return
      if (comment) {
        setGovernanceComments((prev) =>
          prev.map((item) => (item.id === comment.id ? comment : item))
        )
      }
    } catch (error: any) {
      if (isStaleRequest()) return
      setGovernanceError(error?.message || '标记评论失败')
    } finally {
      if (!isStaleRequest()) {
        setGovernanceBusy(false)
      }
    }
  }

  const handleLoadGovernanceReviews = async () => {
    const projectId = ensureGovernanceProjectId()
    if (!projectId) return
    const limit = normalizeProjectGovernanceLimit(governanceReviewLimit, 20)
    const requestToken = ++latestGovernanceRequestToken.current
    const isStaleRequest = () =>
      requestToken !== latestGovernanceRequestToken.current ||
      governanceProjectId.trim() !== projectId
    setGovernanceBusy(true)
    setGovernanceError('')
    try {
      const rows = await listProjectGovernanceReviews(projectId, { limit })
      if (isStaleRequest()) return
      setGovernanceReviews(rows)
    } catch (error: any) {
      if (isStaleRequest()) return
      setGovernanceError(error?.message || '加载项目评审失败')
    } finally {
      if (!isStaleRequest()) {
        setGovernanceBusy(false)
      }
    }
  }

  const handleCreateGovernanceReview = async () => {
    const projectId = ensureGovernanceProjectId()
    if (!projectId) return
    if (!governanceReviewSummary.trim()) {
      setGovernanceError('请输入评审摘要')
      return
    }
    const parsedScore = parseGovernanceReviewScore(governanceReviewScore)
    if (parsedScore.error) {
      setGovernanceError(parsedScore.error)
      return
    }
    const requestToken = ++latestGovernanceRequestToken.current
    const isStaleRequest = () =>
      requestToken !== latestGovernanceRequestToken.current ||
      governanceProjectId.trim() !== projectId
    setGovernanceBusy(true)
    setGovernanceError('')
    try {
      const review = await createProjectGovernanceReview(projectId, {
        decision: governanceReviewDecision,
        summary: governanceReviewSummary.trim(),
        score: parsedScore.score
      })
      if (isStaleRequest()) return
      if (review) {
        setGovernanceReviews((prev) => [review, ...prev.filter((item) => item.id !== review.id)])
      }
      setGovernanceReviewSummary('')
      setGovernanceReviewScore('')
    } catch (error: any) {
      if (isStaleRequest()) return
      setGovernanceError(error?.message || '创建项目评审失败')
    } finally {
      if (!isStaleRequest()) {
        setGovernanceBusy(false)
      }
    }
  }

  const handleLoadGovernanceTemplates = async () => {
    const projectId = ensureGovernanceProjectId()
    if (!projectId) return
    const requestToken = ++latestGovernanceRequestToken.current
    const isStaleRequest = () =>
      requestToken !== latestGovernanceRequestToken.current ||
      governanceProjectId.trim() !== projectId
    setGovernanceBusy(true)
    setGovernanceError('')
    try {
      const rows = await listProjectGovernanceTemplates(projectId)
      if (isStaleRequest()) return
      setGovernanceTemplates(rows)
      if (
        !governanceSelectedTemplateId ||
        rows.every((item) => item.id !== governanceSelectedTemplateId)
      ) {
        setGovernanceSelectedTemplateId(rows[0]?.id || '')
      }
    } catch (error: any) {
      if (isStaleRequest()) return
      setGovernanceError(error?.message || '加载项目模板失败')
    } finally {
      if (!isStaleRequest()) {
        setGovernanceBusy(false)
      }
    }
  }

  const handleApplyGovernanceTemplate = async () => {
    const projectId = ensureGovernanceProjectId()
    if (!projectId) return
    if (!governanceSelectedTemplateId.trim()) {
      setGovernanceError('请先选择模板')
      return
    }
    let options: Record<string, unknown> = {}
    try {
      options = parseJsonObject(governanceTemplateOptions, '模板应用参数')
    } catch (error: any) {
      setGovernanceError(error?.message || '模板应用参数解析失败')
      return
    }
    const requestToken = ++latestGovernanceRequestToken.current
    const isStaleRequest = () =>
      requestToken !== latestGovernanceRequestToken.current ||
      governanceProjectId.trim() !== projectId
    setGovernanceBusy(true)
    setGovernanceError('')
    try {
      const result = await applyProjectGovernanceTemplate(projectId, {
        templateId: governanceSelectedTemplateId.trim(),
        options: Object.keys(options).length > 0 ? options : undefined
      })
      if (isStaleRequest()) return
      setGovernanceTemplateResult(result || null)
    } catch (error: any) {
      if (isStaleRequest()) return
      setGovernanceError(error?.message || '应用项目模板失败')
    } finally {
      if (!isStaleRequest()) {
        setGovernanceBusy(false)
      }
    }
  }

  const handleGovernanceBatchUpdateClips = async () => {
    const projectId = ensureGovernanceProjectId()
    if (!projectId) return
    let rows: unknown[] = []
    try {
      rows = parseJsonArray(governanceBatchOperations, '批量更新 operations')
    } catch (error: any) {
      setGovernanceError(error?.message || '批量更新参数解析失败')
      return
    }
    const operations = normalizeClipBatchOperations(rows)
    if (operations.length === 0) {
      setGovernanceError('至少提供一条有效操作（clipId + patch）')
      return
    }
    const requestToken = ++latestGovernanceRequestToken.current
    const isStaleRequest = () =>
      requestToken !== latestGovernanceRequestToken.current ||
      governanceProjectId.trim() !== projectId
    setGovernanceBusy(true)
    setGovernanceError('')
    try {
      const result = await batchUpdateProjectGovernanceClips(projectId, operations)
      if (isStaleRequest()) return
      setGovernanceBatchResult(result || null)
    } catch (error: any) {
      if (isStaleRequest()) return
      setGovernanceError(error?.message || '片段批量更新失败')
    } finally {
      if (!isStaleRequest()) {
        setGovernanceBusy(false)
      }
    }
  }

  return (
    <div className="telemetry-dashboard">
      <section className="metrics-section">
        <h3 className="telemetry-section-title">播放 FPS 稳定性</h3>
        <canvas
          ref={canvasRef}
          width={260}
          height={60}
          className="fps-chart"
          aria-label="播放 FPS 趋势图"
        />
        <p className="sr-only" aria-live="polite">
          {fpsSummary}
        </p>
      </section>

      {metricsError ? (
        <div className="metric-card">
          <span className="label">监控状态</span>
          <span className="value value-error">{metricsError}</span>
        </div>
      ) : null}

      {metrics ? (
        <section className="metrics-grid">
          <div className="metric-card">
            <span className="label">内存占用</span>
            <span className="value">{metricsOverview.memoryUsageText}</span>
          </div>
          <div className="metric-card">
            <span className="label">系统负载</span>
            <span className="value">{metricsOverview.systemLoadText}</span>
          </div>
        </section>
      ) : null}

      <section className="api-metrics">
        <h3 className="telemetry-section-title">AI 服务运行状态</h3>
        {metricsOverview.apiEntries.length > 0 ? (
          metricsOverview.apiEntries.map(([name, stats]) => (
            <div key={name} className="api-stat-row">
              <span className="api-name">{name}</span>
              <span className="api-success">{formatApiSuccessRate(stats)}</span>
              <span className="api-avg">{formatApiAverageMs(stats)}</span>
            </div>
          ))
        ) : (
          <div className="api-empty">暂无指标</div>
        )}
      </section>

      <section className="slo-panel">
        <h3 className="telemetry-section-title">北极星 SLO（24h）</h3>
        {sloSummary ? (
          <>
            <div className="slo-grid">
              <div
                className={`slo-card ${sloSummary.passFlags.primaryFlowSuccessRate ? 'pass' : 'fail'}`}
              >
                <span className="slo-name">主链路成功率</span>
                <strong>{formatPercent(sloSummary.current.primaryFlowSuccessRate, 2)}</strong>
                <span className="slo-target">
                  目标 ≥ {formatPercent(sloSummary.targets.primaryFlowSuccessRate, 2)}
                </span>
              </div>
              <div className={`slo-card ${sloSummary.passFlags.nonAiApiP95Ms ? 'pass' : 'fail'}`}>
                <span className="slo-name">非 AI API P95</span>
                <strong>{formatMs(sloSummary.current.nonAiApiP95Ms, 0)}</strong>
                <span className="slo-target">
                  目标 ≤ {formatMs(sloSummary.targets.nonAiApiP95Ms, 0)}
                </span>
              </div>
              <div
                className={`slo-card ${sloSummary.passFlags.firstSuccessAvgSteps ? 'pass' : 'fail'}`}
              >
                <span className="slo-name">首次成功平均步数</span>
                <strong>{formatSteps(sloSummary.current.firstSuccessAvgSteps)}</strong>
                <span className="slo-target">
                  目标 ≤ {sloSummary.targets.firstSuccessAvgSteps.toFixed(2)} 步
                </span>
              </div>
            </div>
            <div className="slo-summary-row">
              <span>
                样本：旅程 {sloSummary.counts.totalJourneys}（成功{' '}
                {sloSummary.counts.successJourneys}）
              </span>
              <span>非 AI 请求样本 {sloSummary.counts.nonAiSamples}</span>
            </div>
            {sloDecision ? (
              <div className="slo-threshold-row">
                <span>
                  样本阈值：旅程 {sloDecision.journeySamples}/{SLO_MIN_JOURNEY_SAMPLES}，非 AI{' '}
                  {sloDecision.nonAiSamples}/{SLO_MIN_NON_AI_SAMPLES}
                </span>
                <span className={`slo-decision-pill ${sloDecision.status}`}>
                  判定来源：{sloDecision.reasonText}
                </span>
              </div>
            ) : null}
            <div className="slo-breakdown-list">
              {sloBreakdown.length > 0 ? (
                sloBreakdown.map((item) => (
                  <div key={`${item.method}-${item.routeKey}`} className="slo-breakdown-item">
                    <span className="route">
                      {item.method} {item.routeKey}
                    </span>
                    <span>count {item.count}</span>
                    <span>成功率 {formatPercent(item.successRate, 1)}</span>
                    <span>P95 {formatMs(item.p95Ms, 0)}</span>
                  </div>
                ))
              ) : (
                <div className="api-empty">暂无 SLO 接口明细</div>
              )}
            </div>
            <div className="slo-failure-header">
              <span>失败旅程总数 {sloJourneyFailCount}</span>
              <span>Top {SLO_JOURNEY_FAILURE_LIMIT}</span>
            </div>
            <div className="slo-failure-list">
              {sloJourneyFailures.length > 0 ? (
                sloJourneyFailures.map((item, index) => (
                  <div
                    key={`${item.failedStage}-${item.errorKind}-${item.httpStatus ?? 'null'}-${index}`}
                    className="slo-failure-item"
                  >
                    <span className="failure-route">
                      {item.failedStage}/{item.errorKind}/{item.httpStatus ?? 'null'}
                    </span>
                    <span>count {item.count}</span>
                    <span>占比 {formatPercent(item.share, 1)}</span>
                    <span>{item.latestAt ? new Date(item.latestAt).toLocaleString() : '-'}</span>
                  </div>
                ))
              ) : (
                <div className="api-empty">暂无失败旅程诊断</div>
              )}
            </div>
          </>
        ) : (
          <div className="api-empty">暂无 SLO 数据，请先保存管理员令牌</div>
        )}
        {sloError ? <div className="db-error">{sloError}</div> : null}
      </section>

      <section className="provider-health-panel">
        <h3 className="telemetry-section-title">Provider 健康检查</h3>
        <div className="governance-action-row">
          <button disabled={isProviderHealthLoading} onClick={() => void fetchProviderHealth()}>
            {isProviderHealthLoading ? '检查中...' : '刷新 Provider 状态'}
          </button>
          <span>
            {providerHealthRows.length > 0 ? `已检查 ${providerHealthRows.length} 个` : '暂无数据'}
          </span>
        </div>
        {providerHealthError ? <div className="db-error">{providerHealthError}</div> : null}
        <div className="governance-list">
          {providerHealthRows.slice(0, 20).map((item) => (
            <div key={item.providerId} className="governance-item">
              <span>
                {item.providerId} / {item.category}
              </span>
              <span>{item.status}</span>
              <span>{item.latencyMs ?? '-'}ms</span>
            </div>
          ))}
          {providerHealthRows.length === 0 ? (
            <div className="api-empty">暂无 Provider 健康记录</div>
          ) : null}
        </div>
      </section>

      <section className="project-governance-panel" data-testid="project-governance-card">
        <h3 className="telemetry-section-title">项目治理卡片（第二入口）</h3>
        <div className="governance-project-row">
          <input
            type="text"
            id="governance-project-id"
            name="governanceProjectId"
            aria-label="项目 ID（prj_xxx）"
            value={governanceProjectId}
            onChange={(event) => setGovernanceProjectId(event.target.value)}
            placeholder="输入项目 ID（prj_xxx）"
          />
          <span>{governanceBusy ? '处理中...' : '空闲'}</span>
        </div>

        <div className="governance-action-row">
          <button
            disabled={governanceBusy}
            onClick={() => void handleLoadGovernanceComments(false)}
          >
            刷新评论
          </button>
          <input
            type="number"
            min={1}
            id="governance-comment-limit"
            name="governanceCommentLimit"
            aria-label="评论 limit"
            value={governanceCommentLimit}
            onChange={(event) => setGovernanceCommentLimit(event.target.value)}
            placeholder="评论 limit"
          />
          <button
            disabled={governanceBusy || !governanceCommentHasMore}
            onClick={() => void handleLoadGovernanceComments(true)}
          >
            评论加载更多
          </button>
        </div>
        <div className="governance-meta-row">
          <span>评论游标：{governanceCommentCursor || '-'}</span>
        </div>
        <div className="governance-input-grid">
          <input
            type="text"
            id="governance-comment-anchor"
            name="governanceCommentAnchor"
            aria-label="评论锚点（可选）"
            value={governanceCommentAnchor}
            onChange={(event) => setGovernanceCommentAnchor(event.target.value)}
            placeholder="评论锚点（可选）"
          />
          <input
            type="text"
            id="governance-comment-content"
            name="governanceCommentContent"
            aria-label="评论内容"
            value={governanceCommentContent}
            onChange={(event) => setGovernanceCommentContent(event.target.value)}
            placeholder="评论内容"
          />
          <input
            type="text"
            id="governance-comment-mentions"
            name="governanceCommentMentions"
            aria-label="评论 mentions"
            value={governanceCommentMentions}
            onChange={(event) => setGovernanceCommentMentions(event.target.value)}
            placeholder="mentions: owner,editor"
          />
          <button disabled={governanceBusy} onClick={() => void handleCreateGovernanceComment()}>
            新建评论
          </button>
        </div>
        <div className="governance-action-row">
          <select
            id="governance-selected-comment-id"
            name="governanceSelectedCommentId"
            aria-label="选择评论"
            value={governanceSelectedCommentId}
            onChange={(event) => setGovernanceSelectedCommentId(event.target.value)}
          >
            <option value="">选择评论后可 Resolve</option>
            {governanceComments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.id.slice(0, 8)} · {item.status}
              </option>
            ))}
          </select>
          <button
            disabled={governanceBusy || !governanceSelectedCommentId}
            onClick={() => void handleResolveGovernanceComment()}
          >
            Resolve 评论
          </button>
        </div>
        <div className="governance-list">
          {governanceComments.slice(0, 8).map((item) => (
            <div key={item.id} className="governance-item">
              <span>{item.content}</span>
              <span>{item.status}</span>
              <span>{item.mentions.length > 0 ? `@${item.mentions.join(',')}` : '-'}</span>
            </div>
          ))}
          {governanceComments.length === 0 ? <div className="api-empty">暂无项目评论</div> : null}
        </div>

        <div className="governance-action-row">
          <button disabled={governanceBusy} onClick={() => void handleLoadGovernanceReviews()}>
            刷新评审
          </button>
          <input
            type="number"
            min={1}
            id="governance-review-limit"
            name="governanceReviewLimit"
            aria-label="评审 limit"
            value={governanceReviewLimit}
            onChange={(event) => setGovernanceReviewLimit(event.target.value)}
            placeholder="评审 limit"
          />
          <select
            id="governance-review-decision"
            name="governanceReviewDecision"
            aria-label="评审决策"
            value={governanceReviewDecision}
            onChange={(event) =>
              setGovernanceReviewDecision(event.target.value as ProjectGovernanceReview['decision'])
            }
          >
            <option value="approved">approved</option>
            <option value="changes_requested">changes_requested</option>
          </select>
          <input
            type="text"
            id="governance-review-summary"
            name="governanceReviewSummary"
            aria-label="评审摘要"
            value={governanceReviewSummary}
            onChange={(event) => setGovernanceReviewSummary(event.target.value)}
            placeholder="评审摘要"
          />
          <input
            type="text"
            id="governance-review-score"
            name="governanceReviewScore"
            aria-label="评审评分（可选）"
            value={governanceReviewScore}
            onChange={(event) => setGovernanceReviewScore(event.target.value)}
            placeholder="评分（可选）"
          />
          <button disabled={governanceBusy} onClick={() => void handleCreateGovernanceReview()}>
            新建评审
          </button>
        </div>
        <div className="governance-list">
          {governanceReviews.slice(0, 8).map((item) => (
            <div key={item.id} className="governance-item">
              <span>{item.decision}</span>
              <span>{item.summary}</span>
              <span>{item.score ?? '-'}</span>
            </div>
          ))}
          {governanceReviews.length === 0 ? <div className="api-empty">暂无项目评审</div> : null}
        </div>

        <div className="governance-action-row">
          <button disabled={governanceBusy} onClick={() => void handleLoadGovernanceTemplates()}>
            刷新模板
          </button>
          <select
            id="governance-selected-template-id"
            name="governanceSelectedTemplateId"
            aria-label="选择模板"
            value={governanceSelectedTemplateId}
            onChange={(event) => setGovernanceSelectedTemplateId(event.target.value)}
          >
            <option value="">选择模板</option>
            {governanceTemplates.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <button
            disabled={governanceBusy || !governanceSelectedTemplateId}
            onClick={() => void handleApplyGovernanceTemplate()}
          >
            应用模板
          </button>
        </div>
        <textarea
          id="governance-template-options"
          name="governanceTemplateOptions"
          aria-label="模板应用参数 JSON"
          value={governanceTemplateOptions}
          onChange={(event) => setGovernanceTemplateOptions(event.target.value)}
          placeholder='模板应用参数 JSON，例如 {"targetTrack":"track-v1"}'
        />
        <div className="governance-meta-row">
          <span>模板回执：{governanceTemplateResult?.traceId || '-'}</span>
          <span>{governanceTemplateResult?.templateName || '-'}</span>
        </div>

        <textarea
          id="governance-batch-operations"
          name="governanceBatchOperations"
          aria-label="片段批量更新 operations JSON 数组"
          value={governanceBatchOperations}
          onChange={(event) => setGovernanceBatchOperations(event.target.value)}
          placeholder="片段批量更新 operations JSON 数组"
        />
        <div className="governance-action-row">
          <button disabled={governanceBusy} onClick={() => void handleGovernanceBatchUpdateClips()}>
            提交 clips/batch-update
          </button>
          <span>requested {governanceBatchResult?.requested ?? '-'}</span>
          <span>accepted {governanceBatchResult?.accepted ?? '-'}</span>
          <span>updated {governanceBatchResult?.updated ?? '-'}</span>
        </div>
        {governanceError ? <div className="db-error">{governanceError}</div> : null}
      </section>

      <section className="db-ops-panel">
        <h3 className="telemetry-section-title">数据库自愈中心</h3>
        <form
          className="db-token-row"
          onSubmit={(event) => {
            event.preventDefault()
            void handleSaveToken()
          }}
        >
          <input
            type="text"
            name="username"
            autoComplete="username"
            tabIndex={-1}
            aria-hidden="true"
            hidden
          />
          <input
            type="password"
            id="db-admin-token"
            name="dbAdminToken"
            aria-label="管理员令牌（x-admin-token）"
            autoComplete="new-password"
            value={adminTokenInput}
            onChange={(event) => setAdminTokenInput(event.target.value)}
            placeholder="输入管理员令牌（x-admin-token）"
          />
          <button type="submit">保存令牌</button>
        </form>

        <div className="db-actions-row">
          <button disabled={isDbBusy} onClick={() => void fetchDbHealth('full')}>
            健康检查
          </button>
          <button disabled={isDbBusy} onClick={() => void fetchDbRuntime()}>
            运行配置
          </button>
          <button disabled={isDbBusy} onClick={() => void handleRepair(false)}>
            温和修复
          </button>
          <button disabled={isDbBusy} className="danger" onClick={() => void handleRepair(true)}>
            强制修复
          </button>
        </div>

        {dbRuntime ? (
          <div className="db-runtime-card">
            <div>
              自动修复：<b>{dbRuntime.autoRepairEnabled ? '开启' : '关闭'}</b>
            </div>
            <div>
              运行巡检：
              {dbRuntime.runtimeHealthcheckEnabled
                ? `${Math.round((dbRuntime.runtimeHealthcheckIntervalMs || 0) / 1000)}s / 次`
                : '关闭'}
            </div>
            <div className="db-runtime-path">数据库路径：{dbRuntime.dbPath}</div>
          </div>
        ) : null}

        <div className="db-filter-grid">
          <label className="db-filter-field">
            <span>历史范围</span>
            <select
              id="db-repair-range"
              name="dbRepairRange"
              value={repairRange}
              onChange={(event) => setRepairRange(event.target.value as RepairRange)}
            >
              <option value="24h">最近 24 小时</option>
              <option value="7d">最近 7 天</option>
              <option value="30d">最近 30 天</option>
              <option value="all">全部</option>
            </select>
          </label>
          <label className="db-filter-field">
            <span>状态</span>
            <select
              id="db-repair-status"
              name="dbRepairStatus"
              value={repairStatusFilter}
              onChange={(event) => setRepairStatusFilter(event.target.value as RepairStatusFilter)}
            >
              <option value="all">全部</option>
              <option value="ok">ok</option>
              <option value="repaired">repaired</option>
              <option value="failed">failed</option>
            </select>
          </label>
        </div>

        <div className="db-search-row">
          <input
            type="text"
            id="db-repair-reason"
            name="dbRepairReason"
            aria-label="修复原因关键词筛选"
            value={repairReasonInput}
            onChange={(event) => setRepairReasonInput(event.target.value)}
            placeholder="按修复原因关键词筛选"
          />
          <button disabled={isRepairLoading} onClick={() => void handleApplyReasonFilter()}>
            应用筛选
          </button>
          <button disabled={isRepairLoading} onClick={() => void handleClearReasonFilter()}>
            清空
          </button>
        </div>

        {dbHealth ? (
          <div className={`db-health-card ${dbHealth.status}`}>
            <div>
              状态：<b>{dbHealth.status}</b>
            </div>
            <div>检查模式：{dbHealth.mode}</div>
            <div>时间：{new Date(dbHealth.checkedAt).toLocaleString()}</div>
            <div className="db-health-msg">
              {(dbHealth.messages || []).slice(0, 2).join(' | ') || '无'}
            </div>
          </div>
        ) : null}

        {dbError ? <div className="db-error">{dbError}</div> : null}

        <div className="db-repair-summary">
          <span>
            已显示 {dbRepairs.length}
            {repairTotal === null ? '' : ` / ${repairTotal}`} 条
          </span>
          <span>{isRepairLoading ? '加载中...' : repairHasMore ? '可继续加载' : '已到末尾'}</span>
        </div>

        <div className="db-repair-list">
          {(dbRepairs || []).map((item, index) => (
            <div key={`${item.timestamp || 'repair'}-${index}`} className="db-repair-item">
              <div className="db-repair-head">
                <span className={`status ${item.status}`}>{item.status}</span>
                <span>{item.reason || 'unknown'}</span>
                <span>{item.timestamp ? new Date(item.timestamp).toLocaleString() : '-'}</span>
              </div>
              <div className="db-repair-meta">
                <span>回收行数：{item.salvage?.copiedRows ?? 0}</span>
                <span>动作：{Array.isArray(item.actions) ? item.actions.length : 0}</span>
              </div>
            </div>
          ))}
          {dbRepairs.length === 0 ? <div className="api-empty">暂无修复记录</div> : null}
        </div>

        {repairHasMore ? (
          <button
            className="db-load-more"
            disabled={isRepairLoading || isDbBusy}
            onClick={() => void fetchRepairHistory(true)}
          >
            {isRepairLoading ? '加载中...' : '加载更多'}
          </button>
        ) : null}
      </section>
    </div>
  )
}

export default TelemetryDashboard
