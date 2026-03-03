import { beforeEach, describe, it, expect } from 'bun:test'
import { useEditorStore } from '../apps/frontend/src/store/editorStore'

describe('EditorStore 状态管理验证 (旗舰版)', () => {
  beforeEach(() => {
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
  })

  it('Store 应能正确初始化四轨道模型', () => {
    const state = useEditorStore.getState()
    expect(state.tracks.length).toBe(4)
    expect(state.tracks.map((t) => t.type)).toContain('video')
    expect(state.tracks.map((t) => t.type)).toContain('audio')
    expect(state.tracks.map((t) => t.type)).toContain('mask')
  })

  it('addClip 应能向指定轨道添加片段', () => {
    const { addClip, tracks } = useEditorStore.getState()
    const initialCount = tracks.find((t) => t.id === 'track-v1')?.clips.length || 0
    const newClip: any = {
      id: 'test-new-clip',
      start: 0,
      end: 5,
      src: 'test.mp4',
      name: '测试视频',
      type: 'video'
    }

    addClip('track-v1', newClip)

    const updatedTracks = useEditorStore.getState().tracks
    const vTrack = updatedTracks.find((t) => t.id === 'track-v1')
    expect(vTrack?.clips.length).toBe(initialCount + 1)
  })

  it('updateClip 应能更新片段属性', () => {
    const { addClip, updateClip } = useEditorStore.getState()
    addClip('track-v1', {
      id: 'test-new-clip',
      start: 0,
      end: 5,
      src: 'test.mp4',
      name: '原始名称',
      type: 'video'
    } as any)
    updateClip('track-v1', 'test-new-clip', { name: '已重命名' })

    const state = useEditorStore.getState()
    const clip = state.tracks
      .find((t) => t.id === 'track-v1')
      ?.clips.find((c) => c.id === 'test-new-clip')
    expect(clip?.name).toBe('已重命名')
  })
})
