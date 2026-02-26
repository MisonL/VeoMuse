export interface Clip {
  id: string;
  start: number;
  end: number;
  src: string;
  name: string;
  type: 'video' | 'audio' | 'text' | 'mask';
  data?: any;
}

export interface Track {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'text' | 'mask';
  clips: Clip[];
}

export interface Asset {
  id: string;
  name: string;
  src: string;
  type: 'video' | 'audio' | 'image';
  thumbnail?: string;
}

export interface Marker {
  id: string;
  time: number;
  label: string;
}

export interface Scene {
  title: string;
  videoPrompt: string;
  audioPrompt: string;
  voiceoverText: string;
  duration: number;
}

export interface DirectorResponse {
  success: boolean;
  storyTitle: string;
  worldId: string;
  scenes: Scene[];
}

export interface TimelineData {
  tracks: Track[];
  exportConfig?: {
    quality: 'standard' | '4k-hdr' | 'spatial-vr';
  };
}
