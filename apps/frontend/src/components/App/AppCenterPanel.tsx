import type { CSSProperties, ReactNode, RefObject } from 'react'
import type { PreviewAspect } from '../../utils/appHelpers'

type AppMode = 'edit' | 'color' | 'audio'

interface AppCenterPanelProps {
  activeMode: AppMode
  assetCount: number
  hasTimelineClips: boolean
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
  onOpenDirector: () => void
  onSwitchToLab: () => void
}

const AppCenterPanel = ({
  activeMode,
  assetCount,
  hasTimelineClips,
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
  onOpenDirector,
  onSwitchToLab
}: AppCenterPanelProps) => {
  const launchpadTitle =
    assetCount > 0 ? '素材已就绪，下一步把画面送上节目轨' : '先把首批素材送上导播台'
  const launchpadSummary =
    assetCount > 0
      ? `素材抽屉里已有 ${assetCount} 个资产，下一步把它们送入时间轴，或交给 AI 导演生成首批分镜。`
      : '从左侧素材抽屉导入资源，或打开 AI 导演自动生成第一批分镜，中心工作区会自动接管节目画面。'

  return (
    <section className="pro-panel monitor-core panel-center" data-testid="area-center-panel">
      {activeMode === 'edit' ? (
        <div className="monitor-content">
          <div className="monitor-stage-shell">
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
                <div className="monitor-cue-strip">
                  <span className="monitor-cue-pill">PGM-01</span>
                  <span className="monitor-cue-copy">
                    {isPlaying ? '节目正在播出，转场链路稳定' : '节目待播，控制台已进入预备态'}
                  </span>
                </div>
                {previewPlayer}
              </div>
            </div>
            <div className="monitor-lower-third">
              {!hasTimelineClips ? (
                <div className="monitor-launchpad">
                  <div className="monitor-launchpad-copy">
                    <span className="monitor-ledger-label">首轮编排</span>
                    <strong>{launchpadTitle}</strong>
                    <small>{launchpadSummary}</small>
                  </div>
                  <div className="monitor-launchpad-actions">
                    <button
                      type="button"
                      className="monitor-action-btn monitor-action-btn--signal"
                      onClick={onOpenAssets}
                    >
                      {assetCount > 0 ? '打开素材抽屉' : '导入素材'}
                    </button>
                    <button type="button" className="monitor-action-btn" onClick={onOpenDirector}>
                      打开 AI 导演
                    </button>
                    <button type="button" className="monitor-action-btn" onClick={onSwitchToLab}>
                      切到实验室
                    </button>
                  </div>
                  <div className="monitor-launchpad-stats">
                    <div className="monitor-readout">
                      <span className="monitor-readout-label">素材库</span>
                      <strong>{assetCount}</strong>
                    </div>
                    <div className="monitor-readout">
                      <span className="monitor-readout-label">节目轨</span>
                      <strong>待入轨</strong>
                    </div>
                    <div className="monitor-readout">
                      <span className="monitor-readout-label">下一步</span>
                      <strong>导入 / 导演</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="monitor-ledger">
                    <div className="monitor-ledger-card">
                      <span className="monitor-ledger-label">节目单</span>
                      <strong>Prime Cut / A-01</strong>
                      <small>主编排轨已锁定到节目总线</small>
                    </div>
                    <div className="monitor-ledger-card">
                      <span className="monitor-ledger-label">画幅</span>
                      <strong>{previewAspect}</strong>
                      <small>{isSpatialPreview ? 'Spatial Bus 在线' : 'Flat Feed 在线'}</small>
                    </div>
                    <div className="monitor-ledger-card">
                      <span className="monitor-ledger-label">播出态</span>
                      <strong>{isPlaying ? 'Playing' : 'Cue Ready'}</strong>
                      <small>{isPlaying ? 'Transport 正在推进' : '等待进入下一段'}</small>
                    </div>
                  </div>
                  <div className="monitor-control-band">
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
                    <div className="monitor-action-strip">
                      <button type="button" className="monitor-action-btn" onClick={onOpenAssets}>
                        打开素材抽屉
                      </button>
                      <button
                        type="button"
                        className="monitor-action-btn monitor-action-btn--signal"
                        onClick={onSwitchToLab}
                      >
                        切到实验室
                      </button>
                    </div>
                  </div>
                  <div className="monitor-readout-cluster">
                    <div className="monitor-readout">
                      <span className="monitor-readout-label">Feed</span>
                      <strong>{isSpatialPreview ? '3D BUS' : '2D BUS'}</strong>
                    </div>
                    <div className="monitor-readout">
                      <span className="monitor-readout-label">Aspect</span>
                      <strong>{previewAspect}</strong>
                    </div>
                    <div className="monitor-readout">
                      <span className="monitor-readout-label">Status</span>
                      <strong>{isPlaying ? 'Rolling' : 'Standby'}</strong>
                    </div>
                  </div>
                </>
              )}
            </div>
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
}

export default AppCenterPanel
