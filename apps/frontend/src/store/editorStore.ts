import { create } from 'zustand'
import { temporal } from 'zundo'
import { Clip, Track, Asset, Marker } from '@veomuse/shared'

export type { Clip, Track, Asset, Marker };

interface EditorState {
  tracks: Track[];
  markers: Marker[];
  beatPoints: number[]; // 节奏点 (s)
  assets: Asset[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  selectedClipId: string | null;
  zoomLevel: number;
  
  // Actions
  setTracks: (tracks: Track[]) => void;
  setMarkers: (markers: Marker[]) => void;
  setBeatPoints: (points: number[]) => void;
  setCurrentTime: (time: number) => void;
  togglePlay: () => void;
  setSelectedClipId: (id: string | null) => void;
  setZoomLevel: (level: number) => void;
  addAsset: (asset: Asset) => void;
  addClip: (trackId: string, clip: Clip) => void;
  updateClip: (trackId: string, clipId: string, partialClip: Partial<Clip>) => void;
  removeClip: (trackId: string, clipId: string) => void;
  splitClip: (trackId: string, clipId: string, at: number) => void;
}

export const useEditorStore = create<EditorState>()(
  temporal((set) => ({
    tracks: [
      { id: 'track-mask1', name: '智能蒙版', type: 'mask', clips: [] },
      { id: 'track-v1', name: '主视频轨道', type: 'video', clips: [] },
      { id: 'track-a1', name: '背景音乐', type: 'audio', clips: [] },
      { id: 'track-t1', name: '文字层', type: 'text', clips: [] }
    ],
    markers: [],
    beatPoints: [],
    assets: [
      { id: 'asset-1', name: '大雄兔 (示例)', src: 'https://www.w3schools.com/html/mov_bbb.mp4', type: 'video' }
    ],
    currentTime: 0,
    duration: 120, // 提升至 120s
    isPlaying: false,
    selectedClipId: null,
    zoomLevel: 10,

    setTracks: (tracks) => set({ tracks }),
    setMarkers: (markers) => set({ markers }),
    setBeatPoints: (beatPoints) => set({ beatPoints }),
    setCurrentTime: (time) => set({ currentTime: time }),
    togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
    setSelectedClipId: (id) => set({ selectedClipId: id }),
    setZoomLevel: (zoomLevel) => set({ zoomLevel }),
    addAsset: (asset) => set((state) => ({
      assets: state.assets.some(a => a.id === asset.id) ? state.assets : [...state.assets, asset]
    })),
    addClip: (trackId, clip) => set((state) => {
      const newTracks = state.tracks.map(t => {
        if (t.id !== trackId) return t;
        if (t.clips.some(c => c.id === clip.id)) return t;
        return { ...t, clips: [...t.clips, clip] };
      });
      return { tracks: newTracks };
    }),
    updateClip: (trackId, clipId, partialClip) => set((state) => {
      // 边界加固：确保 end 不超过总时长
      const safePartial = { ...partialClip };
      if (safePartial.end !== undefined && safePartial.end > state.duration) {
        safePartial.end = state.duration;
      }
      
      return {
        tracks: state.tracks.map(t => 
          t.id === trackId
            ? {
                ...t,
                clips: t.clips.map(c => 
                  c.id === clipId ? { ...c, ...safePartial } : c
                )
              }
            : t
        )
      };
    }),
    removeClip: (trackId, clipId) => set((state) => ({
      selectedClipId: state.selectedClipId === clipId ? null : state.selectedClipId,
      tracks: state.tracks.map(t =>
        t.id === trackId
          ? { ...t, clips: t.clips.filter(c => c.id !== clipId) }
          : t
      )
    })),
    splitClip: (trackId, clipId, at) => set((state) => ({
      tracks: state.tracks.map(t => {
        if (t.id !== trackId) return t;
        const clip = t.clips.find(c => c.id === clipId);
        if (!clip || at <= clip.start || at >= clip.end) return t;
        const c1 = { ...clip, end: at };
        const c2 = { ...clip, id: `${clip.id}-split-${Date.now()}`, start: at };
        return { ...t, clips: [...t.clips.filter(c => c.id !== clipId), c1, c2] };
      })
    }))
  }))
)
