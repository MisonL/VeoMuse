import { useEditorStore } from '../store/editorStore';

export interface SnapResult {
  time: number;
  snapped: boolean;
  targetId?: string;
}

const SNAP_THRESHOLD = 0.3; // 吸附阈值（秒）

export const calculateSnap = (time: number, excludeClipId?: string): SnapResult => {
  const { tracks, markers } = useEditorStore.getState();
  
  // 收集所有的潜在吸附点：0, 片段起止点, 标记点
  const snapPoints: { time: number; id: string }[] = [{ time: 0, id: 'start' }];
  
  tracks.forEach(track => {
    track.clips.forEach(clip => {
      if (clip.id !== excludeClipId) {
        snapPoints.push({ time: clip.start, id: clip.id });
        snapPoints.push({ time: clip.end, id: clip.id });
      }
    });
  });

  markers.forEach(marker => {
    snapPoints.push({ time: marker.time, id: marker.id });
  });

  // 寻找最近的吸附点
  let nearest = snapPoints[0];
  let minDiff = Math.abs(time - nearest.time);

  snapPoints.forEach(p => {
    const diff = Math.abs(time - p.time);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = p;
    }
  });

  if (minDiff < SNAP_THRESHOLD) {
    return { time: nearest.time, snapped: true, targetId: nearest.id };
  }

  return { time, snapped: false };
};
