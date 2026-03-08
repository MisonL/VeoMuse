import './helpers/dom-test-setup'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import PropertyInspector from '../apps/frontend/src/components/Editor/PropertyInspector'
import { useEditorStore, type Track } from '../apps/frontend/src/store/editorStore'
import { useToastStore } from '../apps/frontend/src/store/toastStore'
import * as adminMetricsStore from '../apps/frontend/src/store/adminMetricsStore'

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

const createBaseTracks = (): Track[] => [
  { id: 'track-v1', name: '主视频轨道', type: 'video', clips: [] },
  { id: 'track-a1', name: '背景音乐', type: 'audio', clips: [] },
  { id: 'track-t1', name: '文字层', type: 'text', clips: [] }
]

const createValidJwt = () => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 60 * 60 })
  ).toString('base64url')
  return `${header}.${payload}.sig`
}

const setValidAccessToken = () => {
  localStorage.setItem('veomuse-access-token', createValidJwt())
}

describe('PropertyInspector DOM 交互', () => {
  let fetchMock: ReturnType<typeof mock>
  let pollingSpy: ReturnType<typeof spyOn> | null = null

  afterEach(() => {
    cleanup()
    pollingSpy?.mockRestore()
    pollingSpy = null
  })

  beforeEach(() => {
    localStorage.clear()
    pollingSpy = spyOn(adminMetricsStore, 'useAdminMetricsPolling').mockImplementation(() => {})
    useEditorStore.setState({
      tracks: createBaseTracks(),
      selectedClipId: null
    })
    useToastStore.setState({ toasts: [] })

    fetchMock = mock((input: string | URL) => {
      const url = String(input)
      if (url.includes('/api/ai/translate')) {
        return Promise.resolve(
          jsonResponse({
            translatedText: 'Hello world',
            detectedLang: 'zh',
            targetLang: 'English'
          })
        )
      }
      if (url.includes('/api/ai/repair')) {
        return Promise.resolve(jsonResponse({ success: true }))
      }
      if (url.includes('/api/admin/db/repairs')) {
        return Promise.resolve(
          jsonResponse({ success: true, repairs: [], page: { hasMore: false } })
        )
      }
      if (url.includes('/api/admin/providers/health')) {
        return Promise.resolve(jsonResponse({ success: true, providers: [] }))
      }
      if (url.includes('/api/projects/')) {
        return Promise.resolve(jsonResponse({ success: true }))
      }
      return Promise.resolve(jsonResponse({ success: true }))
    })
    globalThis.fetch = fetchMock as any
  })

  it('未选中片段时应展示空态', () => {
    const view = render(<PropertyInspector />)
    expect(view.getByText('等待片段进入工位')).toBeInTheDocument()
    expect(view.getByText('属性工位待命')).toBeInTheDocument()
    expect(
      view.getByText('时间轴选中片段后，可在这里查看参数、触发炼金，并切换到系统监控值守。')
    ).toBeInTheDocument()
  })

  it('应支持在属性页与监控页之间切换', () => {
    const view = render(<PropertyInspector />)
    expect(view.container.querySelector('.pro-inspector-inner')).toHaveAttribute(
      'data-active-tab',
      'properties'
    )
    fireEvent.click(view.getByRole('button', { name: '系统监控' }))
    expect(view.container.querySelector('.pro-inspector-inner')).toHaveAttribute(
      'data-active-tab',
      'lab'
    )
    expect(view.container.querySelector('.inspector-lab-banner')).toBeInTheDocument()
    expect(view.container.querySelectorAll('.telemetry-command-stat')).toHaveLength(3)
    expect(view.getByText('播放 FPS 稳定性')).toBeInTheDocument()
  })

  it('空态下应可直接切换到系统监控', () => {
    const view = render(<PropertyInspector />)
    fireEvent.click(view.getByRole('button', { name: '切到系统监控' }))
    expect(view.getByText('播放 FPS 稳定性')).toBeInTheDocument()
  })

  it('点击翻译并克隆应调用翻译接口并向轨道追加克隆片段', async () => {
    useEditorStore.setState({
      tracks: [
        { id: 'track-v1', name: '主视频轨道', type: 'video', clips: [] },
        { id: 'track-a1', name: '背景音乐', type: 'audio', clips: [] },
        {
          id: 'track-t1',
          name: '文字层',
          type: 'text',
          clips: [
            {
              id: 'clip-text-1',
              start: 0,
              end: 3,
              src: '',
              name: '字幕片段',
              type: 'text',
              data: { content: '你好世界' }
            }
          ]
        }
      ],
      selectedClipId: 'clip-text-1'
    })

    const view = render(<PropertyInspector />)
    setValidAccessToken()
    fireEvent.click(view.getByRole('button', { name: '翻译并克隆' }))

    await waitFor(() => {
      const textTrack = useEditorStore.getState().tracks.find((track) => track.id === 'track-t1')
      expect(textTrack?.clips).toHaveLength(2)
      expect(textTrack?.clips[1].data?.content).toBe('Hello world')
    })

    expect(fetchMock.mock.calls.some((args) => String(args[0]).includes('/api/ai/translate'))).toBe(
      true
    )
  })

  it('点击炼金按钮应触发对应接口并反馈成功提示', async () => {
    useEditorStore.setState({
      tracks: [
        {
          id: 'track-v1',
          name: '主视频轨道',
          type: 'video',
          clips: [
            { id: 'clip-v1', start: 0, end: 4, src: '/demo.mp4', name: '示例片段', type: 'video' }
          ]
        },
        { id: 'track-a1', name: '背景音乐', type: 'audio', clips: [] },
        { id: 'track-t1', name: '文字层', type: 'text', clips: [] }
      ],
      selectedClipId: 'clip-v1'
    })

    const view = render(<PropertyInspector />)
    setValidAccessToken()
    fireEvent.click(view.getByRole('button', { name: '画面修复' }))

    await waitFor(() => {
      const hasSuccessToast = useToastStore
        .getState()
        .toasts.some((toast) => toast.message.includes('repair 炼金成功'))
      expect(hasSuccessToast).toBe(true)
    })

    expect(fetchMock.mock.calls.some((args) => String(args[0]).includes('/api/ai/repair'))).toBe(
      true
    )
  })
})
