import type { CSSProperties, ReactNode, RefObject } from 'react'
import type { PreviewAspect } from '../../utils/appHelpers'

type AppMode = 'edit' | 'color' | 'audio'

interface AppCenterPanelProps {
  activeMode: AppMode
  labSurface: 'stage' | 'watch'
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
  labWatchPanel: ReactNode
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
  labSurface,
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
  labWatchPanel,
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
          <div className={`monitor-stage-shell ${hasTimelineClips ? 'is-armed' : 'is-idle'}`}>
            <div className="monitor-stage-primary">
              <div className="preview-host" ref={previewHostRef} data-testid="area-preview-host">
                <div
                  className="preview-frame"
                  style={previewFrameStyle}
                  data-testid="area-preview-frame"
                  data-aspect-ratio={previewAspect}
                >
                  <div className="monitor-deck-label">节目监看</div>
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
                  {hasTimelineClips ? (
                    <div className="monitor-cue-strip">
                      <span className="monitor-cue-pill">主监 01</span>
                      <span className="monitor-cue-copy">
                        {isPlaying ? '节目正在播出，转场链路稳定' : '节目待播，控制台已进入预备态'}
                      </span>
                    </div>
                  ) : null}
                  {previewPlayer}
                </div>
              </div>

              {!hasTimelineClips ? (
                <div className="monitor-stage-intro">
                  <div className="monitor-stage-intro-copy">
                    <span className="monitor-ledger-label">首轮编排</span>
                    <strong>{launchpadTitle}</strong>
                    <small>{launchpadSummary}</small>
                  </div>
                  <div className="monitor-stage-intro-actions">
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
                </div>
              ) : null}

              {hasTimelineClips ? (
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
              ) : null}
            </div>

            <aside className="monitor-stage-aside">
              {!hasTimelineClips ? (
                <div className="monitor-launchpad">
                  <div className="monitor-launchpad-kicker">
                    <span className="monitor-ledger-label">中央看板</span>
                    <strong>值守概览</strong>
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
                  <div className="monitor-launchpad-note">
                    <span className="monitor-ledger-label">状态提示</span>
                    <small>
                      主预览区已经完成首轮准备，右侧只保留值守摘要，不再平铺完整空态说明。
                    </small>
                  </div>
                </div>
              ) : (
                <div className="monitor-stage-aside-stack">
                  <div className="monitor-ledger">
                    <div className="monitor-ledger-card">
                      <span className="monitor-ledger-label">节目单</span>
                      <strong>主编排 / A-01</strong>
                      <small>主编排轨已锁定到节目总线</small>
                    </div>
                    <div className="monitor-ledger-card">
                      <span className="monitor-ledger-label">画幅</span>
                      <strong>{previewAspect}</strong>
                      <small>{isSpatialPreview ? '空间总线在线' : '平面主画面在线'}</small>
                    </div>
                    <div className="monitor-ledger-card">
                      <span className="monitor-ledger-label">播出态</span>
                      <strong>{isPlaying ? '播出中' : '待切入'}</strong>
                      <small>{isPlaying ? '播出链路正在推进' : '等待进入下一段'}</small>
                    </div>
                  </div>
                  <div className="monitor-readout-cluster">
                    <div className="monitor-readout">
                      <span className="monitor-readout-label">画面总线</span>
                      <strong>{isSpatialPreview ? '3D 总线' : '2D 总线'}</strong>
                    </div>
                    <div className="monitor-readout">
                      <span className="monitor-readout-label">画幅比例</span>
                      <strong>{previewAspect}</strong>
                    </div>
                    <div className="monitor-readout">
                      <span className="monitor-readout-label">当前状态</span>
                      <strong>{isPlaying ? '播出推进' : '待命'}</strong>
                    </div>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      ) : activeMode === 'color' ? (
        labSurface === 'watch' ? (
          <div className="lab-watch-stage-shell">{labWatchPanel}</div>
        ) : (
          comparisonLab
        )
      ) : (
        <div className="audio-master-stage">
          <section className="audio-master-hero">
            <div className="audio-master-hero-copy">
              <span className="audio-master-kicker">音频工作区 / 待命</span>
              <strong className="audio-master-title">音频母带引擎已就绪</strong>
              <p className="audio-master-summary">
                旁白、音乐、节奏和响度会在同一条母带链路里接管。先导入一批素材，再决定是直接进入母带，还是切到实验室做对照。
              </p>
            </div>
            <div className="audio-master-status-tower">
              <div className="audio-master-status-card">
                <span>输入源</span>
                <strong>待导入</strong>
              </div>
              <div className="audio-master-status-card">
                <span>母带总线</span>
                <strong>待命</strong>
              </div>
              <div className="audio-master-status-card">
                <span>下一步</span>
                <strong>导入 / 对照</strong>
              </div>
            </div>
          </section>

          <section className="audio-master-lanes">
            <div className="audio-master-lane">
              <span className="audio-master-lane-kicker">旁白链路</span>
              <strong>旁白链路待命</strong>
              <p>脚本、配音和语气校准会在导入素材后接管第一条旁白母线。</p>
            </div>
            <div className="audio-master-lane">
              <span className="audio-master-lane-kicker">音乐链路</span>
              <strong>音乐节奏待命</strong>
              <p>背景乐、节拍点和情绪能量会在这里锁定到当前节目节奏。</p>
            </div>
            <div className="audio-master-lane">
              <span className="audio-master-lane-kicker">交付校验</span>
              <strong>交付校验待命</strong>
              <p>响度、峰值和导出前检查会在最终交付前集中完成。</p>
            </div>
          </section>

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
