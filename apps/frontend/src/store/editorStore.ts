import { create } from 'zustand'

export interface Clip {
  id: string;
  start: number;
  end: number;
  src: string;
  name: string;
}

export interface Marker {
  id: string;
  time: number;
  label: string;
}

export interface Track {
  id: string;
  name: string;
  clips: Clip[];
}

interface EditorState {
  tracks: Track[];
  markers: Marker[];
  currentTime: number;
  duration: number;
  
  // Actions
  setTracks: (tracks: Track[]) => void;
  setMarkers: (markers: Marker[]) => void;
  setCurrentTime: (time: number) => void;
  addClip: (trackId: string, clip: Clip) => void;
  updateClip: (trackId: string, clipId: string, partialClip: Partial<Clip>) => void;
  removeClip: (trackId: string, clipId: string) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  tracks: [
    { 
      id: 'track-1', 
      name: '主视频轨道', 
      clips: [
        {
          id: 'demo-initial',
          start: 0,
          end: 10,
          src: 'https://www.w3schools.com/html/mov_bbb.mp4',
          name: '欢迎使用 VeoMuse'
        }
      ] 
    },
    { id: 'track-2', name: '特效轨道', clips: [] }
  ],
  markers: [],
  currentTime: 0,
  duration: 60,

  setTracks: (tracks) => set({ tracks }),
  setMarkers: (markers) => set({ markers }),
  setCurrentTime: (time) => set({ currentTime: time }),
  addClip: (trackId, clip) => set((state) => ({
    tracks: state.tracks.map(t => 
      t.id === trackId 
        ? { ...t, clips: t.clips.some(c => c.id === clip.id) ? t.clips : [...t.clips, clip] } 
        : t
    )
  })),
  updateClip: (trackId, clipId, partialClip) => set((state) => ({
    tracks: state.tracks.map(t => 
      t.id === trackId
        ? {
            ...t,
            clips: t.clips.map(c => 
              c.id === clipId ? { ...c, ...partialClip } : c
            )
          }
        : t
    )
  })),
  removeClip: (trackId, clipId) => set((state) => ({
    tracks: state.tracks.map(t =>
      t.id === trackId
        ? { ...t, clips: t.clips.filter(c => c.id !== clipId) }
        : t
    )
  }))
}))
