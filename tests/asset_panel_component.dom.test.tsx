import './helpers/dom-test-setup'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import AssetPanel from '../apps/frontend/src/components/Editor/AssetPanel'
import { useEditorStore, type Track } from '../apps/frontend/src/store/editorStore'
import { useToastStore } from '../apps/frontend/src/store/toastStore'

const createBaseTracks = (): Track[] => [
  { id: 'track-v1', name: '主视频轨道', type: 'video', clips: [] },
  { id: 'track-a1', name: '背景音乐', type: 'audio', clips: [] },
  { id: 'track-t1', name: '文字层', type: 'text', clips: [] }
]

describe('AssetPanel DOM 交互', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    useEditorStore.setState({
      assets: [],
      tracks: createBaseTracks(),
      selectedClipId: null,
      isMotionCaptureActive: false,
      latestMotionData: null
    })
    useToastStore.setState({ toasts: [] })
  })

  it('应支持按关键词搜索并按分类过滤素材', () => {
    useEditorStore.setState({
      assets: [
        { id: 'asset-video-1', name: '城市镜头.mp4', type: 'video', src: '/assets/city.mp4' },
        { id: 'asset-audio-1', name: '旁白.wav', type: 'audio', src: '/assets/voice.wav' }
      ]
    })

    const view = render(<AssetPanel mode="assets" />)

    const searchInput = view.getByPlaceholderText('搜索或导入素材...')
    fireEvent.change(searchInput, { target: { value: '城市' } })
    expect(view.getByText('城市镜头.mp4')).toBeInTheDocument()

    fireEvent.change(searchInput, { target: { value: '' } })
    fireEvent.click(view.getByRole('button', { name: '音频素材' }))
    expect(view.getByText('旁白.wav')).toBeInTheDocument()
  })

  it('点击导入入口应触发隐藏文件输入框 click', () => {
    const view = render(<AssetPanel mode="assets" />)

    const uploadInput = document.querySelector('input[name="assetUploadFiles"]') as HTMLInputElement
    expect(uploadInput).toBeInTheDocument()
    const clickSpy = spyOn(uploadInput, 'click').mockImplementation(() => {})

    fireEvent.click(view.getByTestId('btn-import-assets'))
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('点击素材追加按钮应向时间轴追加至少一个片段', () => {
    useEditorStore.setState({
      assets: [
        { id: 'asset-video-1', name: '城市镜头.mp4', type: 'video', src: '/assets/city.mp4' }
      ],
      tracks: [
        {
          id: 'track-v1',
          name: '主视频轨道',
          type: 'video',
          clips: [{ id: 'clip-old', start: 0, end: 4, src: '/old.mp4', name: 'old', type: 'video' }]
        },
        { id: 'track-a1', name: '背景音乐', type: 'audio', clips: [] },
        { id: 'track-t1', name: '文字层', type: 'text', clips: [] }
      ]
    })

    const view = render(<AssetPanel mode="assets" />)

    const tile = view.getByText('城市镜头.mp4').closest('.asset-tile')
    expect(tile).toBeInTheDocument()
    const addButton = within(tile as HTMLElement).getByRole('button', { name: '➕' })
    fireEvent.click(addButton)

    const videoTrack = useEditorStore.getState().tracks.find((track) => track.id === 'track-v1')
    expect(videoTrack?.clips).toHaveLength(2)
    expect(videoTrack?.clips[1]).toMatchObject({
      name: '城市镜头.mp4',
      type: 'video',
      src: '/assets/city.mp4'
    })
  })
})
