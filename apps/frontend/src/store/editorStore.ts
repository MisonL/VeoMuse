import { create } from 'zustand'

export interface Clip {
  id: string;
  start: number; // 在时间轴上的起始时间 (s)
  end: number;   // 在时间轴上的结束时间 (s)
  src: string;   // 视频源地址
  name: string;
}

export interface Track {
  id: string;
  name: string;
  clips: Clip[];
}

interface EditorState {
  tracks: Track[];
  currentTime: number;
  duration: number;
  
  // Actions
  setTracks: (tracks: Track[]) => void;
  setCurrentTime: (time: number) => void;
  addClip: (trackId: string, clip: Clip) => void;
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
  currentTime: 0,
  duration: 60,

  setTracks: (tracks) => set({ tracks }),
  setCurrentTime: (time) => set({ currentTime: time }),
  addClip: (trackId, clip) => set((state) => ({
    tracks: state.tracks.map(t => 
      t.id === trackId 
        ? { ...t, clips: t.clips.some(c => c.id === clip.id) ? t.clips : [...t.clips, clip] } 
        : t
    )
  }))
}))
