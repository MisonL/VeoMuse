import './helpers/dom-test-setup'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import TelemetryDashboard from '../apps/frontend/src/components/Editor/TelemetryDashboard'
import { useAdminMetricsStore } from '../apps/frontend/src/store/adminMetricsStore'
import * as adminMetricsStore from '../apps/frontend/src/store/adminMetricsStore'

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

describe('TelemetryDashboard DOM 交互', () => {
  let fetchMock: ReturnType<typeof mock>
  const originalFetch = globalThis.fetch
  let pollingSpy: ReturnType<typeof spyOn> | null = null

  const renderDashboardReady = async () => {
    const view = render(<TelemetryDashboard />)
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((args) => String(args[0]).includes('/api/admin/db/repairs'))
      ).toBe(true)
    })
    return view
  }

  afterEach(() => {
    cleanup()
    pollingSpy?.mockRestore()
    pollingSpy = null
    globalThis.fetch = originalFetch
  })

  beforeEach(() => {
    localStorage.clear()
    pollingSpy = spyOn(adminMetricsStore, 'useAdminMetricsPolling').mockImplementation(() => {})
    useAdminMetricsStore.setState({
      metrics: {
        system: {
          memory: { usage: 0.42 },
          load: [1.2]
        },
        api: {
          translate: { count: 10, success: 9, totalMs: 450 }
        }
      },
      error: '',
      failureStreak: 0,
      isPolling: false,
      lastUpdatedAt: Date.now(),
      renderLoadHistory: new Array(10).fill(0)
    })

    fetchMock = mock((input: string | URL) => {
      const url = String(input)
      if (url.includes('/api/admin/providers/health')) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            providers: [{ providerId: 'openai', category: 'llm', status: 'ok', latencyMs: 128 }]
          })
        )
      }
      if (url.includes('/api/admin/db/repairs')) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            repairs: [],
            page: { hasMore: false, total: 0 }
          })
        )
      }
      if (url.includes('/clips/batch-update')) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            result: { requested: 1, accepted: 1, updated: 1 }
          })
        )
      }
      if (url.includes('/api/admin/db/health')) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            health: {
              status: 'ok',
              mode: 'quick',
              checkedAt: new Date().toISOString(),
              messages: []
            }
          })
        )
      }
      if (url.includes('/api/admin/db/runtime')) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            runtime: {
              autoRepairEnabled: true,
              runtimeHealthcheckEnabled: true,
              runtimeHealthcheckIntervalMs: 5000,
              dbPath: '/tmp/test.sqlite'
            }
          })
        )
      }
      if (url.includes('/api/admin/slo/summary')) {
        return Promise.resolve(jsonResponse({ success: true, summary: null }))
      }
      if (url.includes('/api/admin/slo/breakdown')) {
        return Promise.resolve(jsonResponse({ success: true, breakdown: { items: [] } }))
      }
      if (url.includes('/api/admin/slo/journey-failures')) {
        return Promise.resolve(
          jsonResponse({ success: true, counts: { totalFailJourneys: 0 }, items: [] })
        )
      }
      if (url.includes('/api/projects/')) {
        return Promise.resolve(jsonResponse({ success: true }))
      }
      return Promise.resolve(jsonResponse({ success: true }))
    })
    globalThis.fetch = fetchMock as any
  })

  it('应渲染监控主区块', async () => {
    const view = await renderDashboardReady()
    expect(view.getByText('播放 FPS 稳定性')).toBeInTheDocument()
    expect(view.getByText('AI 服务运行状态')).toBeInTheDocument()
    expect(view.getByText('项目治理卡片（第二入口）')).toBeInTheDocument()
    expect(view.getByText('数据库自愈中心')).toBeInTheDocument()
  })

  it('点击刷新 Provider 状态应触发对应请求', async () => {
    const view = await renderDashboardReady()
    const providerEndpoint = '/api/admin/providers/health'
    const before = fetchMock.mock.calls.filter((args) =>
      String(args[0]).includes(providerEndpoint)
    ).length
    const refreshProviderButton = await waitFor(() => {
      const button = view.getByRole('button', { name: /刷新 Provider 状态|检查中\.\.\./ })
      expect(button).not.toBeDisabled()
      return button
    })
    fireEvent.click(refreshProviderButton)

    await waitFor(() => {
      const after = fetchMock.mock.calls.filter((args) =>
        String(args[0]).includes(providerEndpoint)
      ).length
      expect(after).toBeGreaterThan(before)
    })
    expect(view.getByText('已检查 1 个')).toBeInTheDocument()
  })

  it('点击健康检查应触发 db health 请求', async () => {
    const view = await renderDashboardReady()
    const healthEndpoint = '/api/admin/db/health'
    const before = fetchMock.mock.calls.filter((args) =>
      String(args[0]).includes(healthEndpoint)
    ).length
    const healthCheckButton = await waitFor(() => {
      const button = view.getByRole('button', { name: '健康检查' })
      expect(button).not.toBeDisabled()
      return button
    })
    fireEvent.click(healthCheckButton)

    await waitFor(() => {
      const after = fetchMock.mock.calls.filter((args) =>
        String(args[0]).includes(healthEndpoint)
      ).length
      expect(after).toBeGreaterThan(before)
    })
  })
})
