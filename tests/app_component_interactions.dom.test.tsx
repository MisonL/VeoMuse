import './helpers/dom-test-setup'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import App from '../apps/frontend/src/App'
import { useEditorStore } from '../apps/frontend/src/store/editorStore'
import { LAYOUT_DEFAULTS, useLayoutStore } from '../apps/frontend/src/store/layoutStore'
import { useToastStore } from '../apps/frontend/src/store/toastStore'
import { useAdminMetricsStore } from '../apps/frontend/src/store/adminMetricsStore'
import * as adminMetricsStore from '../apps/frontend/src/store/adminMetricsStore'

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

const buildDefaultTracks = () =>
  [
    { id: 'track-mask1', name: '智能蒙版', type: 'mask', clips: [] },
    { id: 'track-v1', name: '主视频轨道', type: 'video', clips: [] },
    { id: 'track-a1', name: '背景音乐', type: 'audio', clips: [] },
    { id: 'track-t1', name: '文字层', type: 'text', clips: [] }
  ] as any[]

const resetStores = () => {
  useEditorStore.setState({
    tracks: buildDefaultTracks(),
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
  useLayoutStore.setState({ ...LAYOUT_DEFAULTS })
  useToastStore.setState({ toasts: [] })
}

describe('App DOM 运行态交互补测', () => {
  let fetchMock: ReturnType<typeof mock>
  let pollingSpy: ReturnType<typeof spyOn> | null = null
  let consoleErrorSpy: ReturnType<typeof spyOn> | null = null
  const originalFetch = globalThis.fetch
  const nativeConsoleError = console.error

  const click = async (element: Element | HTMLElement) => {
    await act(async () => {
      fireEvent.click(element)
    })
  }

  const change = async (element: Element | HTMLElement, payload: any) => {
    await act(async () => {
      fireEvent.change(element, payload)
    })
  }

  beforeEach(() => {
    cleanup()
    localStorage.clear()
    resetStores()

    pollingSpy = spyOn(adminMetricsStore, 'useAdminMetricsPolling').mockImplementation(() => {})
    useAdminMetricsStore.setState({
      metrics: {
        system: {
          renderLoad: 36,
          memory: { total: 8 * 1024 ** 3, usage: 0.42 },
          load: [1.4]
        },
        api: {}
      },
      error: '',
      failureStreak: 0,
      isPolling: false,
      lastUpdatedAt: Date.now(),
      renderLoadHistory: [9, 18, 26, 40, 32, 54, 41, 58, 47, 63]
    })

    fetchMock = mock((input: string | URL) => {
      const url = String(input)
      if (url.includes('/api/video/compose')) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            outputPath: '/exports/mock-final.mp4'
          })
        )
      }
      if (url.includes('/api/admin/metrics')) {
        return Promise.resolve(jsonResponse({ success: true, metrics: {} }))
      }
      return Promise.resolve(jsonResponse({ success: true }))
    })
    globalThis.fetch = fetchMock as any
    consoleErrorSpy = spyOn(console, 'error').mockImplementation((...args) => {
      const text = String(args[0] ?? '')
      if (text.includes('not wrapped in act(...)')) return
      nativeConsoleError(...args)
    })
  })

  afterEach(() => {
    resetStores()
    cleanup()
    pollingSpy?.mockRestore()
    pollingSpy = null
    consoleErrorSpy?.mockRestore()
    consoleErrorSpy = null
    globalThis.fetch = originalFetch
  })

  it('应覆盖模式切换与基础入口事件', async () => {
    const view = await act(async () => render(<App />))

    await click(view.getByTestId('btn-mode-audio'))
    expect(view.getByText('音频母带引擎已就绪')).toBeInTheDocument()
    expect(view.getByTestId('btn-mode-audio')).toHaveAttribute('aria-pressed', 'true')

    await click(view.getByRole('button', { name: '导入音频素材' }))
    expect(view.getByTestId('btn-mode-edit').className).toContain('active')
    expect(view.getByTestId('btn-mode-edit')).toHaveAttribute('aria-pressed', 'true')
  }, 30_000)

  it('切换主工作模式时应回到素材库，避免保留不相关的左侧工具态', async () => {
    const view = await act(async () => render(<App />))

    await click(view.getByRole('button', { name: '动捕实验室' }))
    await waitFor(() => {
      expect(view.container.querySelector('.pro-asset-panel[data-mode="motion"]')).not.toBeNull()
    })

    await click(view.getByTestId('btn-mode-audio'))

    await waitFor(() => {
      expect(view.container.querySelector('.pro-asset-panel[data-mode="assets"]')).not.toBeNull()
    })
    expect(view.getByRole('button', { name: '素材库' })).toHaveAttribute('aria-pressed', 'true')
    expect(view.queryByRole('button', { name: 'AI 导演' })).toBeNull()
    expect(view.queryByRole('button', { name: '演员库' })).toBeNull()
    expect(view.queryByRole('button', { name: '动捕实验室' })).toBeNull()
  }, 30_000)

  it('应覆盖导出守卫、成功导出、播放器与画幅控制', async () => {
    localStorage.setItem('veomuse-onboarding-v1', 'done')
    const view = await act(async () => render(<App />))

    await click(view.getByTestId('btn-export'))
    await waitFor(() => {
      expect(
        useToastStore
          .getState()
          .toasts.some((toast) => toast.message.includes('请先导入并放置至少一个可渲染片段'))
      ).toBe(true)
    })

    const populatedTracks = buildDefaultTracks().map((track) =>
      track.id === 'track-v1'
        ? {
            ...track,
            clips: [
              {
                id: 'clip-export-1',
                start: 3,
                end: 8,
                src: 'file:///demo.mp4',
                name: 'demo',
                type: 'video'
              }
            ]
          }
        : track
    )
    await act(async () => {
      useEditorStore.getState().setTracks(populatedTracks as any)
      useEditorStore.getState().setCurrentTime(1)
    })

    // DOM 环境下开启播放会启动 requestAnimationFrame 循环，可能导致 act() 等待过久而 flaky。
    // 这里验证播放切换后立即暂停，避免持续的 60fps 循环拖慢整套用例。
    // 使用 title 因为我们现在使用了 SVG
    const playBtn = view.getByTitle('播放')
    await click(playBtn)
    await waitFor(() => {
      expect(useEditorStore.getState().isPlaying).toBe(true)
    })
    const pauseBtn = view.getByTitle('暂停')
    await click(pauseBtn)
    await waitFor(() => {
      expect(useEditorStore.getState().isPlaying).toBe(false)
    })

    await click(view.getByTitle('下一片段'))
    expect(useEditorStore.getState().currentTime).toBeCloseTo(3, 3)
    await click(view.getByTitle('跳转至开始'))
    expect(useEditorStore.getState().currentTime).toBeCloseTo(0, 3)

    await click(view.getByTestId('btn-export'))
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((args) => String(args[0]).includes('/api/video/compose'))
      ).toBe(true)
    })
    await waitFor(() => {
      expect(
        useToastStore.getState().toasts.some((toast) => toast.message.includes('导出成功'))
      ).toBe(true)
    })
  }, 20_000)
})
