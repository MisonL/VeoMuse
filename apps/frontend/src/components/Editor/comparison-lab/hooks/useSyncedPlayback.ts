import { useEffect } from 'react'

interface UseSyncedPlaybackParams {
  syncPlayback: boolean
  leftAssetId: string
  rightAssetId: string
  leftVideoRef: { current: HTMLVideoElement | null }
  rightVideoRef: { current: HTMLVideoElement | null }
}

export const useSyncedPlayback = ({
  syncPlayback,
  leftAssetId,
  rightAssetId,
  leftVideoRef,
  rightVideoRef
}: UseSyncedPlaybackParams) => {
  useEffect(() => {
    if (!syncPlayback) return
    const left = leftVideoRef.current
    const right = rightVideoRef.current
    if (!left || !right) return

    const onLeftPlay = () => right.play().catch(() => {})
    const onLeftPause = () => right.pause()
    const onLeftSeek = () => {
      if (Math.abs(right.currentTime - left.currentTime) > 0.08) {
        right.currentTime = left.currentTime
      }
    }
    const onRightPlay = () => left.play().catch(() => {})
    const onRightPause = () => left.pause()
    const onRightSeek = () => {
      if (Math.abs(left.currentTime - right.currentTime) > 0.08) {
        left.currentTime = right.currentTime
      }
    }

    left.addEventListener('play', onLeftPlay)
    left.addEventListener('pause', onLeftPause)
    left.addEventListener('seeked', onLeftSeek)
    right.addEventListener('play', onRightPlay)
    right.addEventListener('pause', onRightPause)
    right.addEventListener('seeked', onRightSeek)

    return () => {
      left.removeEventListener('play', onLeftPlay)
      left.removeEventListener('pause', onLeftPause)
      left.removeEventListener('seeked', onLeftSeek)
      right.removeEventListener('play', onRightPlay)
      right.removeEventListener('pause', onRightPause)
      right.removeEventListener('seeked', onRightSeek)
    }
  }, [syncPlayback, leftAssetId, rightAssetId, leftVideoRef, rightVideoRef])
}
