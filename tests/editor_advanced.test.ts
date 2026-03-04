import { beforeEach, describe, it, expect } from 'bun:test'
import { useEditorStore } from '../apps/frontend/src/store/editorStore'
import { calculateSnap } from '../apps/frontend/src/utils/snapService'

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

describe('编辑器高级功能验证', () => {
  beforeEach(() => {
    resetEditorStore()
  })

  it('磁吸算法应在靠近边缘时返回修正后的时间点', () => {
    useEditorStore.getState().addClip('track-v1', {
      id: 'clip-snap',
      start: 10,
      end: 20,
      src: 'file:///demo.mp4',
      name: 'snap-demo',
      type: 'video'
    } as any)
    expect(calculateSnap(9.8).time).toBe(10)
    expect(calculateSnap(9.8, 'clip-snap').snapped).toBe(false)
  })

  it('Store 应能正确管理选中片段 ID', () => {
    const { setSelectedClipId } = useEditorStore.getState()
    setSelectedClipId('test-selection')
    expect(useEditorStore.getState().selectedClipId).toBe('test-selection')
  })

  it('分割算法逻辑验证', () => {
    useEditorStore.getState().addClip('track-v1', {
      id: 'clip-split',
      start: 0,
      end: 10,
      src: 'file:///demo.mp4',
      name: 'split-demo',
      type: 'video'
    } as any)

    useEditorStore.getState().splitClip('track-v1', 'clip-split', 4)
    const clips = useEditorStore
      .getState()
      .tracks.find((t) => t.id === 'track-v1')
      ?.clips.slice()
    expect(clips?.length).toBe(2)
    const c1 = clips?.find((c) => c.id === 'clip-split')
    const c2 = clips?.find((c) => c.id !== 'clip-split')
    expect(c1?.end).toBe(4)
    expect(c2?.start).toBe(4)
  })

  it('Clip 应支持存储转场 (Transition) 配置', () => {
    const { addClip } = useEditorStore.getState()
    const clipWithTrans: any = {
      id: 'clip-trans',
      start: 0,
      end: 5,
      src: 'v.mp4',
      name: '转场测试',
      type: 'video',
      data: {
        transitionIn: { type: 'fade', duration: 1.0 },
        transitionOut: { type: 'fade', duration: 0.5 }
      }
    }
    addClip('track-v1', clipWithTrans)
    const state = useEditorStore.getState()
    const clip = state.tracks
      .find((t) => t.id === 'track-v1')
      ?.clips.find((c) => c.id === 'clip-trans')
    expect(clip?.data.transitionIn.type).toBe('fade')
  })
})
