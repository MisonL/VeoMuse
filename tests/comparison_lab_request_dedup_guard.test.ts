import './helpers/dom-test-setup'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import ComparisonLab from '../apps/frontend/src/components/Editor/ComparisonLab'
import { useEditorStore } from '../apps/frontend/src/store/editorStore'
import { useToastStore } from '../apps/frontend/src/store/toastStore'

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

const buildJwt = () => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, sub: 'u-test' })
  ).toString('base64url')
  return `${header}.${payload}.signature`
}

const resetEditorStore = () => {
  useEditorStore.setState({
    tracks: [
      { id: 'track-mask1', name: '智能蒙版', type: 'mask', clips: [] },
      { id: 'track-v1', name: '主视频轨道', type: 'video', clips: [] },
      { id: 'track-a1', name: '背景音乐', type: 'audio', clips: [] },
      { id: 'track-t1', name: '文字层', type: 'text', clips: [] }
    ],
    markers: [],
    beatPoints: [],
    assets: [],
    currentTime: 0,
    duration: 120,
    isPlaying: false,
    selectedClipId: null,
    zoomLevel: 10,
    isMotionCaptureActive: false,
    latestMotionData: null,
    isSpatialPreview: false,
    spatialCamera: { yaw: 0, pitch: 0, scale: 1 }
  })
}

describe('ComparisonLab 请求去重守卫', () => {
  const originalFetch = globalThis.fetch
  let fetchMock: ReturnType<typeof mock>

  const countCalls = (part: string) =>
    fetchMock.mock.calls.filter((args) => String(args[0]).includes(part)).length

  beforeEach(() => {
    cleanup()
    localStorage.clear()
    resetEditorStore()
    useToastStore.setState({ toasts: [] })

    localStorage.setItem('veomuse-access-token', buildJwt())
    localStorage.setItem('veomuse-refresh-token', 'refresh-token')
    localStorage.setItem('veomuse-organization-id', 'org-1')

    fetchMock = mock((input: string | URL, init?: RequestInit) => {
      const url = String(input)
      const method = String(init?.method || 'GET').toUpperCase()

      if (url.includes('/api/auth/me')) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            user: { id: 'user-1', email: 'owner@veomuse.local' },
            organizations: [{ id: 'org-1', name: '组织一' }]
          })
        )
      }

      if (url.includes('/api/models/policies/') && url.includes('/executions')) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            executions: [],
            page: { hasMore: false, offset: 0, total: 0 }
          })
        )
      }

      if (url.includes('/api/models/policies')) {
        if (method === 'POST') {
          return Promise.resolve(
            jsonResponse({
              success: true,
              policy: {
                id: `pl_${Date.now()}`,
                name: '默认创作策略',
                description: '',
                enabled: true,
                priority: 'quality',
                maxBudgetUsd: 1.2,
                allowedModels: ['veo-3.1'],
                weights: { quality: 0.45, speed: 0.2, cost: 0.15, reliability: 0.2 }
              }
            })
          )
        }
        if (method === 'PATCH') {
          return Promise.resolve(
            jsonResponse({
              success: true,
              policy: {
                id: 'pl_existing',
                name: 'existing',
                description: '',
                enabled: true,
                priority: 'quality',
                maxBudgetUsd: 1.2,
                allowedModels: ['veo-3.1'],
                weights: { quality: 0.45, speed: 0.2, cost: 0.15, reliability: 0.2 }
              }
            })
          )
        }
        return Promise.resolve(jsonResponse({ success: true, policies: [] }))
      }

      if (url.includes('/api/models/marketplace')) {
        return Promise.resolve(jsonResponse({ success: true, models: [] }))
      }

      if (url.includes('/api/models')) {
        return Promise.resolve(
          jsonResponse([
            { id: 'veo-3.1', name: 'Veo 3.1' },
            { id: 'kling-v1', name: 'Kling V1' }
          ])
        )
      }

      if (url.includes('/api/organizations/org-1/members')) {
        return Promise.resolve(jsonResponse({ success: true, members: [] }))
      }

      if (url.includes('/api/organizations/org-1/quota')) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            quota: { requestLimit: 0, storageLimitBytes: 0, concurrencyLimit: 0 },
            usage: { requestCount: 0, storageBytes: 0, activeRequests: 0, lastRequestAt: null }
          })
        )
      }

      if (url.includes('/api/organizations/org-1/channels')) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            configs: [],
            capabilities: { models: {}, services: {} }
          })
        )
      }

      if (url.includes('/api/capabilities')) {
        return Promise.resolve(jsonResponse({ models: {}, services: {}, timestamp: 'now' }))
      }

      return Promise.resolve(jsonResponse({ success: true }))
    })

    globalThis.fetch = fetchMock as any
  })

  afterEach(() => {
    cleanup()
    useToastStore.setState({ toasts: [] })
    globalThis.fetch = originalFetch
  })

  it('首屏策略列表仅请求一次', async () => {
    render(React.createElement(ComparisonLab, { onOpenAssets: () => {} }))

    await waitFor(() => {
      expect(countCalls('/api/auth/me')).toBeGreaterThan(0)
    })

    await waitFor(() => {
      expect(countCalls('/api/models/policies')).toBe(1)
    })
  })

  it('打开渠道面板时 capabilities/configs/quota 各仅增量请求一次', async () => {
    const view = render(React.createElement(ComparisonLab, { onOpenAssets: () => {} }))

    await waitFor(() => {
      expect(countCalls('/api/auth/me')).toBeGreaterThan(0)
      expect(countCalls('/api/organizations/org-1/quota')).toBeGreaterThan(0)
    })

    const beforeCapabilities = countCalls('/api/capabilities')
    const beforeConfigs = countCalls('/api/organizations/org-1/channels')
    const beforeQuota = countCalls('/api/organizations/org-1/quota')

    fireEvent.click(view.getByTestId('btn-open-channel-panel'))

    await waitFor(() => {
      expect(view.getByTestId('area-channel-panel')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(countCalls('/api/capabilities')).toBe(beforeCapabilities + 1)
      expect(countCalls('/api/organizations/org-1/channels')).toBe(beforeConfigs + 1)
      expect(countCalls('/api/organizations/org-1/quota')).toBe(beforeQuota + 1)
    })
  })

  it('策略创建按钮重复点击时应仅提交一次 POST', async () => {
    const view = render(React.createElement(ComparisonLab, { onOpenAssets: () => {} }))

    await waitFor(() => {
      expect(countCalls('/api/models/policies')).toBe(1)
    })

    fireEvent.click(view.getByTestId('btn-lab-mode-marketplace'))

    await waitFor(() => {
      expect(view.getByText('策略治理中心')).toBeInTheDocument()
    })

    const createButton = view.getByText('创建策略')
    fireEvent.click(createButton)
    fireEvent.click(createButton)

    await waitFor(() => {
      const postCalls = fetchMock.mock.calls.filter(([url, init]) => {
        const method = String((init as RequestInit | undefined)?.method || 'GET').toUpperCase()
        return String(url).includes('/api/models/policies') && method === 'POST'
      })
      expect(postCalls.length).toBe(1)
    })
  })

  it('阶段 rail 应稳定暴露 current/completed/available 状态', async () => {
    const view = render(React.createElement(ComparisonLab, { onOpenAssets: () => {} }))

    await waitFor(() => {
      expect(view.getByTestId('btn-lab-mode-compare')).toHaveAttribute(
        'data-stage-status',
        'current'
      )
      expect(view.getByTestId('btn-lab-mode-compare')).toHaveAttribute('aria-current', 'step')
      expect(view.getByTestId('btn-lab-mode-marketplace')).toHaveAttribute(
        'data-stage-status',
        'available'
      )
      expect(view.getByText('进行中')).toBeInTheDocument()
    })

    fireEvent.click(view.getByTestId('btn-lab-mode-collab'))

    await waitFor(() => {
      expect(view.getByTestId('btn-lab-mode-compare')).toHaveAttribute(
        'data-stage-status',
        'completed'
      )
      expect(view.getByTestId('btn-lab-mode-creative')).toHaveAttribute(
        'data-stage-status',
        'completed'
      )
      expect(view.getByTestId('btn-lab-mode-collab')).toHaveAttribute(
        'data-stage-status',
        'current'
      )
      expect(view.getByTestId('btn-lab-mode-collab')).toHaveAttribute('aria-current', 'step')
      expect(view.getAllByText('已完成').length).toBeGreaterThan(0)
    })
  })
})
