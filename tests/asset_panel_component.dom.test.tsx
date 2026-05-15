import './helpers/dom-test-setup'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import AssetPanel from '../apps/frontend/src/components/Editor/AssetPanel'
import { useActorsStore } from '../apps/frontend/src/store/actorsStore'
import { useEditorStore, type Track } from '../apps/frontend/src/store/editorStore'
import { useToastStore } from '../apps/frontend/src/store/toastStore'
import { clearAuthSession, setAccessToken } from '../apps/frontend/src/utils/eden'

const createBaseTracks = (): Track[] => [
  { id: 'track-v1', name: '主视频轨道', type: 'video', clips: [] },
  { id: 'track-a1', name: '背景音乐', type: 'audio', clips: [] },
  { id: 'track-t1', name: '文字层', type: 'text', clips: [] }
]

const setFreshAccessToken = () => {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))
  setAccessToken(`test.${payload}.token`)
}

describe('AssetPanel DOM 交互', () => {
  afterEach(() => {
    cleanup()
    clearAuthSession()
  })

  beforeEach(() => {
    useEditorStore.setState({
      assets: [],
      tracks: createBaseTracks(),
      selectedClipId: null,
      isMotionCaptureActive: false,
      latestMotionData: null
    })
    useActorsStore.setState({
      actors: [],
      isLoading: false,
      error: '',
      lastLoadedAt: null
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

  it('空素材卡片应作为键盘可达的导入按钮', () => {
    const view = render(<AssetPanel mode="assets" />)

    const uploadInput = document.querySelector('input[name="assetUploadFiles"]') as HTMLInputElement
    expect(uploadInput).toBeInTheDocument()
    const clickSpy = spyOn(uploadInput, 'click').mockImplementation(() => {})

    const emptyImportButton = view.getByRole('button', {
      name: /暂无素材\s*点击或拖拽文件导入/
    })
    expect(emptyImportButton).toHaveAttribute('type', 'button')

    emptyImportButton.focus()
    expect(emptyImportButton).toHaveFocus()
    fireEvent.click(emptyImportButton)
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
    const addButton = within(tile as HTMLElement).getByRole('button', {
      name: '添加城市镜头.mp4到时间轴'
    })
    fireEvent.click(addButton)

    const videoTrack = useEditorStore.getState().tracks.find((track) => track.id === 'track-v1')
    expect(videoTrack?.clips).toHaveLength(2)
    expect(videoTrack?.clips[1]).toMatchObject({
      name: '城市镜头.mp4',
      type: 'video',
      src: '/assets/city.mp4'
    })
  })

  it('AI 导演空分镜不应暴露无效果的填入提示词操作', () => {
    const promptChangeSpy = spyOn({ handle: (_value: string) => {} }, 'handle')
    const view = render(<AssetPanel mode="director" onDirectorPromptChange={promptChangeSpy} />)

    const emptySceneAction = view.getByRole('button', { name: '填入提示词' })
    expect(emptySceneAction).toBeDisabled()

    cleanup()

    const nextView = render(
      <AssetPanel
        mode="director"
        onDirectorPromptChange={promptChangeSpy}
        directorScenes={[{ title: '开场', duration: 5, videoPrompt: '清晨街道推轨镜头' }]}
      />
    )

    const sceneAction = nextView.getByRole('button', { name: '填入提示词' })
    expect(sceneAction).not.toBeDisabled()
    fireEvent.click(sceneAction)
    expect(promptChangeSpy).toHaveBeenCalledWith('清晨街道推轨镜头')
  })

  it('AI 导演空脚本不应暴露无效生成操作', () => {
    const runDirectorSpy = spyOn({ handle: () => {} }, 'handle')
    const view = render(<AssetPanel mode="director" onRunDirector={runDirectorSpy} />)

    const runButton = view.getByTestId('btn-run-director')
    expect(runButton).toBeDisabled()

    cleanup()

    const readyView = render(
      <AssetPanel
        mode="director"
        directorPrompt="清晨街道上，主角从咖啡店走出"
        onRunDirector={runDirectorSpy}
      />
    )
    const readyButton = readyView.getByTestId('btn-run-director')
    expect(readyButton).not.toBeDisabled()
  })

  it('演员库空表单不应暴露无效新增操作', () => {
    setFreshAccessToken()
    useActorsStore.setState({
      actors: [{ id: 'actor-1', name: '参考演员', refImage: 'https://example.com/ref.png', createdAt: '-' }],
      isLoading: false,
      error: '',
      lastLoadedAt: Date.now()
    })

    const view = render(<AssetPanel mode="actors" />)
    const createButton = view.getByRole('button', { name: '新增演员' })

    expect(createButton).toBeDisabled()
    expect(view.getByLabelText('演员名称')).toHaveAttribute('type', 'text')
    expect(view.getByLabelText('演员参考图 URL')).toHaveAttribute('type', 'url')
  })

  it('动捕实验室缺少演员或实时数据时不应暴露无效同步操作', () => {
    setFreshAccessToken()
    const actor = {
      id: 'actor-1',
      name: '动作演员',
      refImage: 'https://example.com/ref.png',
      createdAt: '-'
    }
    useActorsStore.setState({
      actors: [actor],
      isLoading: false,
      error: '',
      lastLoadedAt: Date.now()
    })

    const view = render(<AssetPanel mode="motion" />)
    const syncButton = view.getByRole('button', { name: '同步至演员' })
    expect(syncButton).toBeDisabled()

    fireEvent.change(view.getByRole('combobox', { name: '' }), {
      target: { value: actor.id }
    })
    expect(syncButton).toBeDisabled()

    cleanup()
    useEditorStore.setState({
      latestMotionData: {
        pose: [{ x: 0, y: 0, z: 0 }],
        face: { expression: 'neutral', intensity: 0 },
        timestamp: Date.now()
      }
    })

    const readyView = render(<AssetPanel mode="motion" />)
    const readySyncButton = readyView.getByRole('button', { name: '同步至演员' })
    fireEvent.change(readyView.getByRole('combobox', { name: '' }), {
      target: { value: actor.id }
    })
    expect(readySyncButton).not.toBeDisabled()
  })
})
