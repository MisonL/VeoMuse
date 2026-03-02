import React, { useEffect, useRef, useState } from 'react'
import { adminGetJson, adminPostJson, getAdminToken, setAdminToken as persistAdminToken } from '../../utils/eden'
import { useAdminMetricsPolling, useAdminMetricsStore } from '../../store/adminMetricsStore'
import './TelemetryDashboard.css'

type RepairRange = '24h' | '7d' | '30d' | 'all'
type RepairStatusFilter = 'all' | 'ok' | 'repaired' | 'failed'

const REPAIR_PAGE_SIZE = 20

const TelemetryDashboard: React.FC = () => {
  useAdminMetricsPolling()
  const metrics = useAdminMetricsStore(state => state.metrics)
  const metricsError = useAdminMetricsStore(state => state.error)
  const refreshMetricsNow = useAdminMetricsStore(state => state.refreshNow)
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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fpsHistory = useRef<number[]>([])
  const latestRepairQueryToken = useRef(0)
  const pollFailureStreak = useRef(0)

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

  const buildRepairQuery = (offset: number) => {
    const now = Date.now()
    const fromMs = repairRange === '24h'
      ? now - 24 * 60 * 60 * 1000
      : repairRange === '7d'
        ? now - 7 * 24 * 60 * 60 * 1000
        : repairRange === '30d'
          ? now - 30 * 24 * 60 * 60 * 1000
          : null
    const query = new URLSearchParams({
      limit: String(REPAIR_PAGE_SIZE),
      offset: String(Math.max(0, offset))
    })
    if (fromMs) query.set('from', new Date(fromMs).toISOString())
    if (repairStatusFilter !== 'all') query.set('status', repairStatusFilter)
    if (repairReasonFilter.trim()) query.set('reason', repairReasonFilter.trim())
    return query
  }

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

  const fetchRepairHistory = async (append: boolean) => {
    const nextOffset = append ? dbRepairs.length : 0
    const queryToken = ++latestRepairQueryToken.current
    setIsRepairLoading(true)
    try {
      const repairsPayload = await adminGetJson<any>(`/api/admin/db/repairs?${buildRepairQuery(nextOffset).toString()}`)
      if (queryToken !== latestRepairQueryToken.current) return

      const rows = Array.isArray(repairsPayload.repairs) ? repairsPayload.repairs : []
      const mergedRows = append ? [...dbRepairs, ...rows] : rows
      const page = repairsPayload.page || {}

      setDbRepairs(mergedRows)
      if (Number.isFinite(page.total)) setRepairTotal(Number(page.total))
      else if (!append) setRepairTotal(mergedRows.length)
      setRepairHasMore(
        typeof page.hasMore === 'boolean'
          ? page.hasMore
          : rows.length === REPAIR_PAGE_SIZE
      )
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
      timer = window.setTimeout(() => {
        void tick()
      }, Math.max(3000, delayMs))
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
      if (runtimeTick % 3 === 0) {
        runtimeOk = await fetchDbRuntime()
      }

      const hasFailure = !healthOk || !runtimeOk
      pollFailureStreak.current = hasFailure
        ? Math.min(5, pollFailureStreak.current + 1)
        : 0

      const nextDelay = Math.min(60000, 5000 * (2 ** pollFailureStreak.current))
      schedule(nextDelay)
    }

    void fetchRepairHistory(false)
    void tick()

    return () => {
      disposed = true
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    void fetchRepairHistory(false)
  }, [repairRange, repairStatusFilter, repairReasonFilter])

  const safeRate = (stats: any) => {
    if (!stats?.count) return '--'
    return `${Math.round((stats.success / stats.count) * 100)}%`
  }

  const safeAvg = (stats: any) => {
    if (!stats?.count) return '--'
    return `${Math.round(stats.totalMs / stats.count)}ms`
  }

  const handleSaveToken = async () => {
    persistAdminToken(adminTokenInput)
    pollFailureStreak.current = 0
    await refreshMetricsNow()
    await fetchDbHealth('quick')
    await fetchDbRuntime()
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

  return (
    <div className="telemetry-dashboard">
      <section className="metrics-section">
        <label>播放 FPS 稳定性</label>
        <canvas ref={canvasRef} width={260} height={60} className="fps-chart" />
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
            <span className="value">{(metrics.system.memory.usage * 100).toFixed(1)}%</span>
          </div>
          <div className="metric-card">
            <span className="label">系统负载</span>
            <span className="value">{metrics.system.load[0].toFixed(2)}</span>
          </div>
        </section>
      ) : null}

      <section className="api-metrics">
        <label>AI 服务运行状态</label>
        {metrics ? Object.entries(metrics.api).map(([name, stats]: [string, any]) => (
          <div key={name} className="api-stat-row">
            <span className="api-name">{name}</span>
            <span className="api-success">{safeRate(stats)}</span>
            <span className="api-avg">{safeAvg(stats)}</span>
          </div>
        )) : <div className="api-empty">暂无指标</div>}
      </section>

      <section className="db-ops-panel">
        <label>数据库自愈中心</label>
        <div className="db-token-row">
          <input
            type="password"
            id="db-admin-token"
            name="dbAdminToken"
            value={adminTokenInput}
            onChange={(event) => setAdminTokenInput(event.target.value)}
            placeholder="输入管理员令牌（x-admin-token）"
          />
          <button onClick={() => void handleSaveToken()}>保存令牌</button>
        </div>

        <div className="db-actions-row">
          <button disabled={isDbBusy} onClick={() => void fetchDbHealth('full')}>健康检查</button>
          <button disabled={isDbBusy} onClick={() => void fetchDbRuntime()}>运行配置</button>
          <button disabled={isDbBusy} onClick={() => void handleRepair(false)}>温和修复</button>
          <button disabled={isDbBusy} className="danger" onClick={() => void handleRepair(true)}>强制修复</button>
        </div>

        {dbRuntime ? (
          <div className="db-runtime-card">
            <div>自动修复：<b>{dbRuntime.autoRepairEnabled ? '开启' : '关闭'}</b></div>
            <div>运行巡检：{dbRuntime.runtimeHealthcheckEnabled ? `${Math.round((dbRuntime.runtimeHealthcheckIntervalMs || 0) / 1000)}s / 次` : '关闭'}</div>
            <div className="db-runtime-path">数据库路径：{dbRuntime.dbPath}</div>
          </div>
        ) : null}

        <div className="db-filter-grid">
          <label className="db-filter-field">
            <span>历史范围</span>
            <select id="db-repair-range" name="dbRepairRange" value={repairRange} onChange={(event) => setRepairRange(event.target.value as RepairRange)}>
              <option value="24h">最近 24 小时</option>
              <option value="7d">最近 7 天</option>
              <option value="30d">最近 30 天</option>
              <option value="all">全部</option>
            </select>
          </label>
          <label className="db-filter-field">
            <span>状态</span>
            <select id="db-repair-status" name="dbRepairStatus" value={repairStatusFilter} onChange={(event) => setRepairStatusFilter(event.target.value as RepairStatusFilter)}>
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
            <div>状态：<b>{dbHealth.status}</b></div>
            <div>检查模式：{dbHealth.mode}</div>
            <div>时间：{new Date(dbHealth.checkedAt).toLocaleString()}</div>
            <div className="db-health-msg">{(dbHealth.messages || []).slice(0, 2).join(' | ') || '无'}</div>
          </div>
        ) : null}

        {dbError ? <div className="db-error">{dbError}</div> : null}

        <div className="db-repair-summary">
          <span>已显示 {dbRepairs.length}{repairTotal === null ? '' : ` / ${repairTotal}`} 条</span>
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
