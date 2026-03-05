import { create } from 'zustand'
import { temporal } from 'zundo'
import type { Clip, Track, Asset, Marker } from '@veomuse/shared'
import type { MotionData } from '../utils/motionSync'

export type { Clip, Track, Asset, Marker }

const BASELINE_DURATION = 120

const normalizeDuration = (tracks: Track[]) => {
  const maxEnd = tracks.reduce((acc, track) => {
    const trackMax = track.clips.reduce((clipAcc, clip) => {
      const end = Number(clip.end)
      return Number.isFinite(end) ? Math.max(clipAcc, end) : clipAcc
    }, 0)
    return Math.max(acc, trackMax)
  }, 0)
  return Math.max(BASELINE_DURATION, Math.ceil(maxEnd + 1))
}

const buildTrackState = (tracks: Track[], currentTime: number) => {
  const duration = normalizeDuration(tracks)
  return {
    tracks,
    duration,
    currentTime: Math.min(Math.max(0, currentTime), duration)
  }
}

interface EditorState {
  tracks: Track[]
  markers: Marker[]
  beatPoints: number[]
  assets: Asset[]
  currentTime: number
  duration: number
  isPlaying: boolean
  selectedClipId: string | null
  zoomLevel: number
  isMotionCaptureActive: boolean
  latestMotionData: MotionData | null
  isSpatialPreview: boolean
  spatialCamera: { yaw: number; pitch: number; scale: number }

  // Actions
  setTracks: (tracks: Track[]) => void
  setMarkers: (markers: Marker[]) => void
  setBeatPoints: (points: number[]) => void
  setCurrentTime: (time: number) => void
  togglePlay: () => void
  setSelectedClipId: (id: string | null) => void
  setZoomLevel: (level: number) => void
  addAsset: (asset: Asset) => void
  addClip: (trackId: string, clip: Clip) => void
  updateClip: (trackId: string, clipId: string, partialClip: Partial<Clip>) => void
  removeClip: (trackId: string, clipId: string) => void
  splitClip: (trackId: string, clipId: string, at: number) => void
  setMotionCaptureActive: (active: boolean) => void
  setLatestMotionData: (data: MotionData | null) => void
  setSpatialPreview: (enabled: boolean) => void
  setSpatialCamera: (partial: Partial<{ yaw: number; pitch: number; scale: number }>) => void
}

export const useEditorStore = create<EditorState>()(
  temporal(
    (set) => ({
      tracks: [
        { id: 'track-mask1', name: '智能蒙版', type: 'mask', clips: [] },
        { id: 'track-v1', name: '主视频轨道', type: 'video', clips: [] },
        { id: 'track-a1', name: '背景音乐', type: 'audio', clips: [] },
        { id: 'track-t1', name: '文字层', type: 'text', clips: [] }
      ],
      markers: [],
      beatPoints: [],
      assets: [], // 已移除 Mock 数据，等待用户上传或生成
      currentTime: 0,
      duration: 120,
      isPlaying: false,
      selectedClipId: null,
      zoomLevel: 10,
      isMotionCaptureActive: false,
      latestMotionData: null,
      isSpatialPreview: false,
      spatialCamera: { yaw: 0, pitch: 0, scale: 1 },

      setTracks: (tracks) =>
        set((state) => ({
          ...buildTrackState(tracks, state.currentTime)
        })),
      setMarkers: (markers) => set({ markers }),
      setBeatPoints: (beatPoints) => set({ beatPoints }),
      setCurrentTime: (time) =>
        set((state) => ({
          currentTime: Math.min(Math.max(0, time), state.duration)
        })),
      togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
      setSelectedClipId: (id) => set({ selectedClipId: id }),
      setZoomLevel: (zoomLevel) => set({ zoomLevel }),
      addAsset: (asset) =>
        set((state) => ({
          assets: state.assets.some((a) => a.id === asset.id)
            ? state.assets
            : [...state.assets, asset]
        })),
      addClip: (trackId, clip) =>
        set((state) => {
          const newTracks = state.tracks.map((t) => {
            if (t.id !== trackId) return t
            if (t.clips.some((c) => c.id === clip.id)) return t
            return { ...t, clips: [...t.clips, clip] }
          })
          return {
            ...buildTrackState(newTracks, state.currentTime)
          }
        }),
      updateClip: (trackId, clipId, partialClip) =>
        set((state) => {
          const safePartial = { ...partialClip }
          const newTracks = state.tracks.map((t) =>
            t.id === trackId
              ? {
                  ...t,
                  clips: t.clips.map((c) => (c.id === clipId ? { ...c, ...safePartial } : c))
                }
              : t
          )
          return {
            ...buildTrackState(newTracks, state.currentTime)
          }
        }),
      removeClip: (trackId, clipId) =>
        set((state) => {
          const newTracks = state.tracks.map((t) =>
            t.id === trackId ? { ...t, clips: t.clips.filter((c) => c.id !== clipId) } : t
          )
          return {
            selectedClipId: state.selectedClipId === clipId ? null : state.selectedClipId,
            ...buildTrackState(newTracks, state.currentTime)
          }
        }),
      splitClip: (trackId, clipId, at) =>
        set((state) => {
          const newTracks = state.tracks.map((t) => {
            if (t.id !== trackId) return t
            const clip = t.clips.find((c) => c.id === clipId)
            if (!clip || at <= clip.start || at >= clip.end) return t
            const c1 = { ...clip, end: at }
            // 使用物理唯一 ID 避免 Key 冲突
            const c2 = {
              ...clip,
              id: `${clip.id}-cut-${Math.random().toString(36).substring(7)}`,
              start: at
            }
            return { ...t, clips: [...t.clips.filter((c) => c.id !== clipId), c1, c2] }
          })
          return {
            ...buildTrackState(newTracks, state.currentTime)
          }
        }),
      setMotionCaptureActive: (isMotionCaptureActive) => set({ isMotionCaptureActive }),
      setLatestMotionData: (latestMotionData) => set({ latestMotionData }),
      setSpatialPreview: (isSpatialPreview) => set({ isSpatialPreview }),
      setSpatialCamera: (partial) =>
        set((state) => ({
          spatialCamera: { ...state.spatialCamera, ...partial }
        }))
    }),
    {
      limit: 80,
      partialize: (state) => ({
        tracks: state.tracks,
        markers: state.markers,
        beatPoints: state.beatPoints,
        currentTime: state.currentTime,
        duration: state.duration,
        selectedClipId: state.selectedClipId,
        zoomLevel: state.zoomLevel,
        spatialCamera: state.spatialCamera,
        isSpatialPreview: state.isSpatialPreview
      })
    }
  )
)
