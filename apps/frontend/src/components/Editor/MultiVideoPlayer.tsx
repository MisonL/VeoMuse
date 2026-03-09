import React, { memo, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '../../store/editorStore'
import TextOverlay from './TextOverlay'
import { syncController } from '../../utils/SyncController'
import './MultiVideoPlayer.css'

const MultiVideoPlayer: React.FC = () => {
  const { tracks, isSpatialPreview, spatialCamera, setSpatialCamera } = useEditorStore(
    useShallow((state) => ({
      tracks: state.tracks,
      isSpatialPreview: state.isSpatialPreview,
      spatialCamera: state.spatialCamera,
      setSpatialCamera: state.setSpatialCamera
    }))
  )
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const hasPlayableVideo = tracks.some(
    (track) =>
      track.type === 'video' && track.clips.some((clip) => (clip.src || '').trim().length > 0)
  )

  // 注意：我们移除了对 currentTime 和 isPlaying 的依赖，防止频繁渲染
  // 同步逻辑现在由外部的 syncController 驱动

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isSpatialPreview) return
    dragStartRef.current = { x: event.clientX, y: event.clientY }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isSpatialPreview || !dragStartRef.current) return
    const dx = event.clientX - dragStartRef.current.x
    const dy = event.clientY - dragStartRef.current.y
    setSpatialCamera({
      yaw: Math.max(-35, Math.min(35, spatialCamera.yaw + dx * 0.08)),
      pitch: Math.max(-20, Math.min(20, spatialCamera.pitch - dy * 0.08))
    })
    dragStartRef.current = { x: event.clientX, y: event.clientY }
  }

  const clearPointerDrag = () => {
    dragStartRef.current = null
  }

  return (
    <div className="multi-video-player glass-panel">
      <div
        className={`player-stage ${isSpatialPreview ? 'spatial-mode' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={clearPointerDrag}
        onPointerLeave={clearPointerDrag}
        style={
          isSpatialPreview
            ? {
                transform: `perspective(1200px) rotateX(${spatialCamera.pitch}deg) rotateY(${spatialCamera.yaw}deg) scale(${spatialCamera.scale})`
              }
            : undefined
        }
      >
        {tracks.map((track) =>
          track.clips.map((clip) => {
            const normalizedSrc = (clip.src || '').trim()
            if (track.type === 'video') {
              if (!normalizedSrc) return null
              return (
                <video
                  key={clip.id}
                  ref={(el) => syncController.registerVideo(clip.id, el)}
                  src={normalizedSrc}
                  className={`player-video-instance ${clip.data?.vfxType || ''}`}
                  style={
                    {
                      '--vfx-intensity': String(clip.data?.vfxIntensity ?? 0.8)
                    } as React.CSSProperties
                  }
                  muted={false}
                  playsInline
                />
              )
            }
            if (track.type === 'audio') {
              if (!normalizedSrc) return null
              return (
                <audio
                  key={clip.id}
                  ref={(el) => syncController.registerAudio(clip.id, el)}
                  src={normalizedSrc}
                />
              )
            }
            return null
          })
        )}
        {!hasPlayableVideo ? (
          <div className="player-empty-state">
            <div className="player-empty-kicker">PREVIEW STAGE</div>
            <div className="player-empty-title">主工作台已待命</div>
            <div className="player-empty-subtitle">
              导入素材或交给 AI 导演生成首批分镜后，节目画面会在这里自动接管并进入预览。
            </div>
          </div>
        ) : null}
        {hasPlayableVideo ? <div className="vfx-layer-overlay"></div> : null}
        <TextOverlay />
      </div>
    </div>
  )
}

export default memo(MultiVideoPlayer)
