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
})
