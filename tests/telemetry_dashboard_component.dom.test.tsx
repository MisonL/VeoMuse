import './helpers/dom-test-setup'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import TelemetryDashboard from '../apps/frontend/src/components/Editor/TelemetryDashboard'
import { useAdminMetricsStore } from '../apps/frontend/src/store/adminMetricsStore'
import * as adminMetricsStore from '../apps/frontend/src/store/adminMetricsStore'
import { useTelemetryGovernanceController } from '../apps/frontend/src/components/Editor/telemetry-dashboard/hooks/useTelemetryGovernanceController'

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

describe('TelemetryDashboard DOM 交互', () => {
  let fetchMock: ReturnType<typeof mock>
  const originalFetch = globalThis.fetch
  let pollingSpy: ReturnType<typeof spyOn> | null = null

  it('未填写 Admin Token 时不应主动请求数据库修复历史', async () => {
    localStorage.removeItem('veomuse-admin-token')
    render(<TelemetryDashboard />)
    await new Promise((resolve) => setTimeout(resolve, 120))
    expect(
      fetchMock.mock.calls.some((args) => String(args[0]).includes('/api/admin/db/repairs'))
    ).toBe(false)
  })

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
    localStorage.setItem('veomuse-admin-token', 'test-admin-token')
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

  it('稳定态命令条应渲染 stable tone 与 0 异常信号', async () => {
    const view = await renderDashboardReady()

    await waitFor(() => {
      expect(view.container.querySelector('.telemetry-dashboard')).toHaveAttribute(
        'data-tone',
        'stable'
      )
    })
    expect(view.getByText('总控链路稳定')).toBeInTheDocument()
    expect(view.getByText('关键指标、Provider 链路与 SLO 判定处于可播出状态。')).toBeInTheDocument()
    expect(
      Array.from(view.container.querySelectorAll('.telemetry-command-stat strong')).map(
        (node) => node.textContent
      )
    ).toEqual(['0', '1', 'Pending'])
  })

  it('降级态命令条应渲染 degraded tone 与异常副标题', async () => {
    useAdminMetricsStore.setState((state) => ({
      ...state,
      error: 'metrics unavailable'
    }))
    const view = await renderDashboardReady()

    await waitFor(() => {
      expect(view.container.querySelector('.telemetry-dashboard')).toHaveAttribute(
        'data-tone',
        'degraded'
      )
    })
    expect(view.getByText('总控链路存在异常待复核')).toBeInTheDocument()
    expect(view.getByText('当前已捕获 1 处异常信号，建议先查看告警与 Provider 健康状态。')).toBeInTheDocument()
    expect(
      Array.from(view.container.querySelectorAll('.telemetry-command-stat strong')).map(
        (node) => node.textContent
      )[0]
    ).toBe('1')
  })

  it('SLO 异常时命令条应计入 degraded 异常信号', async () => {
    fetchMock.mockImplementation((input: string | URL) => {
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
      if (url.includes('/api/admin/db/health')) {
        return Promise.resolve(jsonResponse({ success: true, health: { status: 'ok' } }))
      }
      if (url.includes('/api/admin/db/runtime')) {
        return Promise.resolve(jsonResponse({ success: true, runtime: { dbPath: '/tmp/test.sqlite' } }))
      }
      if (url.includes('/api/admin/slo/summary')) {
        return Promise.resolve(jsonResponse({ success: false, error: 'slo summary failed' }, 500))
      }
      if (url.includes('/api/admin/slo/breakdown')) {
        return Promise.resolve(jsonResponse({ success: true, breakdown: { items: [] } }))
      }
      if (url.includes('/api/admin/slo/journey-failures')) {
        return Promise.resolve(jsonResponse({ success: true, counts: { totalFailJourneys: 0 }, items: [] }))
      }
      return Promise.resolve(jsonResponse({ success: true }))
    })

    const view = await renderDashboardReady()

    await waitFor(() => {
      expect(view.container.querySelector('.telemetry-dashboard')).toHaveAttribute(
        'data-tone',
        'degraded'
      )
    })
    expect(view.getByText('当前已捕获 1 处异常信号，建议先查看告警与 Provider 健康状态。')).toBeInTheDocument()
  })

  it('Provider unhealthy 时命令条应计入异常 Provider 信号', async () => {
    fetchMock.mockImplementation((input: string | URL) => {
      const url = String(input)
      if (url.includes('/api/admin/providers/health')) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            providers: [
              { providerId: 'openai', category: 'llm', status: 'ok', latencyMs: 128 },
              { providerId: 'veo', category: 'video', status: 'degraded', latencyMs: 820 }
            ]
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
      if (url.includes('/api/admin/db/health')) {
        return Promise.resolve(jsonResponse({ success: true, health: { status: 'ok' } }))
      }
      if (url.includes('/api/admin/db/runtime')) {
        return Promise.resolve(jsonResponse({ success: true, runtime: { dbPath: '/tmp/test.sqlite' } }))
      }
      if (url.includes('/api/admin/slo/summary')) {
        return Promise.resolve(jsonResponse({ success: true, summary: null }))
      }
      if (url.includes('/api/admin/slo/breakdown')) {
        return Promise.resolve(jsonResponse({ success: true, breakdown: { items: [] } }))
      }
      if (url.includes('/api/admin/slo/journey-failures')) {
        return Promise.resolve(jsonResponse({ success: true, counts: { totalFailJourneys: 0 }, items: [] }))
      }
      return Promise.resolve(jsonResponse({ success: true }))
    })

    const view = await renderDashboardReady()

    await waitFor(() => {
      expect(view.container.querySelector('.telemetry-dashboard')).toHaveAttribute(
        'data-tone',
        'degraded'
      )
    })
    expect(
      Array.from(view.container.querySelectorAll('.telemetry-command-stat strong')).map(
        (node) => node.textContent
      )
    ).toEqual(['1', '2', 'Pending'])
  })

  it('首次挂载仅请求一次数据库修复历史', async () => {
    await renderDashboardReady()
    await waitFor(() => {
      const repairsCalls = fetchMock.mock.calls.filter((args) =>
        String(args[0]).includes('/api/admin/db/repairs')
      ).length
      expect(repairsCalls).toBe(1)
    })
  })

  it('已有 Admin Token 时首屏应立即拉取 runtime/provider/SLO 数据', async () => {
    await renderDashboardReady()
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((args) => String(args[0]).includes('/api/admin/db/runtime'))
      ).toBe(true)
      expect(
        fetchMock.mock.calls.some((args) =>
          String(args[0]).includes('/api/admin/providers/health')
        )
      ).toBe(true)
      expect(
        fetchMock.mock.calls.some((args) => String(args[0]).includes('/api/admin/slo/summary'))
      ).toBe(true)
    })
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

  it('切换项目 ID 时应清空旧评论、评审和模板列表', async () => {
    fetchMock.mockImplementation((input: string | URL) => {
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
      if (url.includes('/api/projects/prj-old/comments')) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            comments: [
              {
                id: 'comment-old',
                content: '旧项目评论',
                status: 'open',
                mentions: [],
                createdAt: '2026-03-07T10:00:00.000Z'
              }
            ],
            page: { hasMore: false, nextCursor: null, limit: 20 }
          })
        )
      }
      if (url.includes('/api/projects/prj-old/reviews')) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            reviews: [
              {
                id: 'review-old',
                decision: 'approved',
                summary: '旧项目评审',
                score: 0.9
              }
            ]
          })
        )
      }
      if (url.includes('/api/projects/prj-old/templates')) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            templates: [{ id: 'template-old', name: '旧项目模板' }]
          })
        )
      }
      if (url.includes('/api/projects/prj-new/comments')) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            comments: [],
            page: { hasMore: false, nextCursor: null, limit: 20 }
          })
        )
      }
      if (url.includes('/api/projects/prj-new/reviews')) {
        return Promise.resolve(jsonResponse({ success: true, reviews: [] }))
      }
      if (url.includes('/api/projects/prj-new/templates')) {
        return Promise.resolve(jsonResponse({ success: true, templates: [] }))
      }
      if (url.includes('/api/projects/')) {
        return Promise.resolve(jsonResponse({ success: true }))
      }
      return Promise.resolve(jsonResponse({ success: true }))
    })

    let controller: ReturnType<typeof useTelemetryGovernanceController> | null = null

    const GovernanceHarness = () => {
      controller = useTelemetryGovernanceController()
      return (
        <div>
          <div data-testid="comments-count">{controller.governanceComments.length}</div>
          <div data-testid="reviews-count">{controller.governanceReviews.length}</div>
          <div data-testid="templates-count">{controller.governanceTemplates.length}</div>
          <div data-testid="selected-template">
            {controller.governanceSelectedTemplateId || '-'}
          </div>
        </div>
      )
    }

    const view = render(<GovernanceHarness />)

    await act(async () => {
      controller?.setGovernanceProjectId('prj-old')
    })
    await act(async () => {
      await controller?.handleLoadGovernanceComments(false)
      await controller?.handleLoadGovernanceReviews()
      await controller?.handleLoadGovernanceTemplates()
    })
    await act(async () => {
      controller?.setGovernanceSelectedTemplateId('template-old')
    })

    await waitFor(() => {
      expect(view.getByTestId('comments-count').textContent).toBe('1')
      expect(view.getByTestId('reviews-count').textContent).toBe('1')
      expect(view.getByTestId('templates-count').textContent).toBe('1')
      expect(view.getByTestId('selected-template').textContent).toBe('template-old')
    })

    await act(async () => {
      controller?.setGovernanceProjectId('prj-new')
    })

    await waitFor(() => {
      expect(view.getByTestId('comments-count').textContent).toBe('0')
      expect(view.getByTestId('reviews-count').textContent).toBe('0')
      expect(view.getByTestId('templates-count').textContent).toBe('0')
      expect(view.getByTestId('selected-template').textContent).toBe('-')
    })
  })
})
