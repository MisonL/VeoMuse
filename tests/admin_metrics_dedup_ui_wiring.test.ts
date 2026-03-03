import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import path from 'path'

const read = (relative: string) => readFileSync(path.resolve(process.cwd(), relative), 'utf8')

describe('监控轮询去重接线验证', () => {
  it('App 与 TelemetryDashboard 应订阅 adminMetricsStore，而非各自请求 /api/admin/metrics', () => {
    const app = read('apps/frontend/src/App.tsx')
    const dashboard = read('apps/frontend/src/components/Editor/TelemetryDashboard.tsx')

    expect(app).toContain('useAdminMetricsPolling')
    expect(dashboard).toContain('useAdminMetricsPolling')
    expect(app.includes("adminGetJson<any>('/api/admin/metrics')")).toBe(false)
    expect(dashboard.includes("adminGetJson<any>('/api/admin/metrics')")).toBe(false)
  })

  it('TelemetryDashboard 应接入失败旅程聚合接口', () => {
    const dashboard = read('apps/frontend/src/components/Editor/TelemetryDashboard.tsx')
    expect(dashboard).toContain('/api/admin/slo/journey-failures')
    expect(dashboard).toContain('sloJourneyFailures')
    expect(dashboard).toContain('sloJourneyFailCount')
  })

  it('TelemetryDashboard 应展示样本阈值与判定来源', () => {
    const dashboard = read('apps/frontend/src/components/Editor/TelemetryDashboard.tsx')
    expect(dashboard).toContain('SLO_MIN_NON_AI_SAMPLES')
    expect(dashboard).toContain('SLO_MIN_JOURNEY_SAMPLES')
    expect(dashboard).toContain('样本阈值')
    expect(dashboard).toContain('判定来源')
  })
})
