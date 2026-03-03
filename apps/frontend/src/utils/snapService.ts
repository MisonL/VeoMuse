import { useEditorStore } from '../store/editorStore'

export interface SnapResult {
  time: number
  snapped: boolean
  targetId?: string
  type?: 'clip' | 'marker' | 'beat'
}

const SNAP_THRESHOLD = 0.3

export const calculateSnap = (time: number, excludeClipId?: string): SnapResult => {
  const { tracks, markers, beatPoints } = useEditorStore.getState()

  const snapPoints: { time: number; id: string; type: 'clip' | 'marker' | 'beat' }[] = [
    { time: 0, id: 'start', type: 'clip' }
  ]

  // 1. 轨道边缘
  tracks.forEach((track) => {
    track.clips.forEach((clip) => {
      if (clip.id !== excludeClipId) {
        snapPoints.push({ time: clip.start, id: clip.id, type: 'clip' })
        snapPoints.push({ time: clip.end, id: clip.id, type: 'clip' })
      }
    })
  })

  // 2. 节奏点 (最高优先级，通常更密集)
  beatPoints.forEach((bt, i) => {
    snapPoints.push({ time: bt, id: `beat-${i}`, type: 'beat' })
  })

  // 3. 标记点
  markers.forEach((marker) => {
    snapPoints.push({ time: marker.time, id: marker.id, type: 'marker' })
  })

  let nearest = snapPoints[0]
  let minDiff = Math.abs(time - nearest.time)

  snapPoints.forEach((p) => {
    const diff = Math.abs(time - p.time)
    // 优先匹配节奏点 (如果在同一范围内)
    const bonus = p.type === 'beat' ? 0.1 : 0
    if (diff - bonus < minDiff) {
      minDiff = diff
      nearest = p
    }
  })

  if (minDiff < SNAP_THRESHOLD) {
    return { time: nearest.time, snapped: true, targetId: nearest.id, type: nearest.type }
  }

  return { time, snapped: false }
}
