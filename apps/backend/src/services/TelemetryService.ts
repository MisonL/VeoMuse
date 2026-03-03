// apps/backend/src/services/TelemetryService.ts
import os from 'os'

export interface ApiMetric {
  service: string
  durationMs: number
  success: boolean
  timestamp: string
}

export class TelemetryService {
  private static instance: TelemetryService
  private apiMetrics: ApiMetric[] = []
  private readonly MAX_HISTORY = 1000

  static getInstance(): TelemetryService {
    if (!TelemetryService.instance) TelemetryService.instance = new TelemetryService()
    return TelemetryService.instance
  }

  recordApiCall(metric: ApiMetric) {
    this.apiMetrics.push(metric)
    if (this.apiMetrics.length > this.MAX_HISTORY) this.apiMetrics.shift()
  }

  getRawMetrics() {
    return [...this.apiMetrics]
  }

  getSummary() {
    const apiStats: any = {}
    this.apiMetrics.forEach((m) => {
      if (!apiStats[m.service]) apiStats[m.service] = { count: 0, totalMs: 0, success: 0 }
      apiStats[m.service].count++
      apiStats[m.service].totalMs += m.durationMs
      if (m.success) apiStats[m.service].success++
    })

    const cpuCount = Math.max(1, os.cpus().length)
    const load = os.loadavg()
    const firstLoad = load[0] ?? 0
    const renderLoad = Number(Math.min(100, (firstLoad / cpuCount) * 100).toFixed(2))
    const oneMinuteAgo = Date.now() - 60_000
    const recentFailures = this.apiMetrics.filter(
      (m) => !m.success && new Date(m.timestamp).getTime() >= oneMinuteAgo
    ).length

    return {
      api: apiStats,
      system: {
        memory: {
          free: os.freemem(),
          total: os.totalmem(),
          usage: 1 - os.freemem() / os.totalmem()
        },
        load,
        uptime: os.uptime(),
        renderQueue: recentFailures,
        renderLoad
      },
      timestamp: new Date().toISOString()
    }
  }
}
