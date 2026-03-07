import type { CSSProperties, ReactNode, RefObject } from 'react'
import type { PreviewAspect } from '../../utils/appHelpers'

type AppMode = 'edit' | 'color' | 'audio'

interface AppCenterPanelProps {
  activeMode: AppMode
  previewAspect: PreviewAspect
  previewFrameStyle?: CSSProperties
  previewHostRef: RefObject<HTMLDivElement | null>
  isSpatialPreview: boolean
  isPlaying: boolean
  timecodeDisplay: ReactNode
  previewPlayer: ReactNode
  comparisonLab: ReactNode
  onToggleSpatialPreview: () => void
  onSeekToStart: () => void
  onTogglePlay: () => void
  onSeekToNextClip: () => void
  onOpenAssets: () => void
  onSwitchToLab: () => void
}

const AppCenterPanel = ({
  activeMode,
  previewAspect,
  previewFrameStyle,
  previewHostRef,
  isSpatialPreview,
  isPlaying,
  timecodeDisplay,
  previewPlayer,
  comparisonLab,
  onToggleSpatialPreview,
  onSeekToStart,
  onTogglePlay,
  onSeekToNextClip,
  onOpenAssets,
  onSwitchToLab
}: AppCenterPanelProps) => (
  <section className="pro-panel monitor-core panel-center" data-testid="area-center-panel">
    {activeMode === 'edit' ? (
      <div className="monitor-content">
        <div className="preview-host" ref={previewHostRef} data-testid="area-preview-host">
          <div
            className="preview-frame"
            style={previewFrameStyle}
            data-testid="area-preview-frame"
            data-aspect-ratio={previewAspect}
          >
            <div className="monitor-deck-label">PROGRAM MONITOR</div>
            <div className="monitor-overlay">
              <div className="monitor-overlay-left">
                <div className="live-badge">● 实时</div>
                {timecodeDisplay}
              </div>
              <div className="preview-meta">
                <button
                  onClick={onToggleSpatialPreview}
                  className={`preview-mode-toggle ${isSpatialPreview ? 'active' : ''}`}
                  data-testid="btn-preview-mode-toggle"
                >
                  {isSpatialPreview ? '3D 模式' : '2D 模式'}
                </button>
                <div className="preview-quality">4K | HDR</div>
              </div>
            </div>
            {previewPlayer}
          </div>
        </div>

        <div className="transport-controls">
          <button
            id="tool-prev"
            aria-label="跳转到开头"
            className="transport-btn"
            onClick={onSeekToStart}
            data-testid="btn-player-prev"
          >
            ⏮
          </button>
          <button
            id="tool-play"
            aria-label={isPlaying ? '暂停播放' : '开始播放'}
            className="transport-btn play"
            onClick={onTogglePlay}
            data-testid="btn-player-play"
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button
            id="tool-next"
            aria-label="跳转到下一片段"
            className="transport-btn"
            onClick={onSeekToNextClip}
            data-testid="btn-player-next"
          >
            ⏭
          </button>
        </div>
      </div>
    ) : activeMode === 'color' ? (
      comparisonLab
    ) : (
      <div className="audio-master-state">
        <div className="audio-master-icon">🎚️</div>
        <div className="audio-master-title">AUDIO MASTER 引擎已就绪</div>
        <div className="audio-master-actions">
          <button type="button" className="audio-master-btn primary" onClick={onOpenAssets}>
            导入素材开始处理
          </button>
          <button type="button" className="audio-master-btn" onClick={onSwitchToLab}>
            切换到实验室对比
          </button>
        </div>
      </div>
    )}
  </section>
)

export default AppCenterPanel
