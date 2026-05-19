import type { CSSProperties, ReactNode, RefObject } from 'react'
import type { PreviewAspect } from '../../utils/appHelpers'

type AppMode = 'edit' | 'color' | 'audio'

const OUTPUT_DOCK_STEPS = ['Preview', 'Lab', 'Render']
const AUDIO_BUS_STEPS = ['Input', 'Rhythm', 'Delivery']
const WATCH_BUS_STEPS = ['Observe', 'Repair', 'Release']

const OutputDockFlow = () => (
  <div
    className="output-dock-flow"
    data-testid="output-dock"
    data-visual-system="nebula-flow"
    aria-label="输出停靠链路"
  >
    <span className="output-dock-kicker">Output Dock</span>
    <span className="output-dock-steps" aria-hidden="true">
      {OUTPUT_DOCK_STEPS.map((step) => (
        <span key={step}>{step}</span>
      ))}
    </span>
  </div>
)

const AudioBusFlow = () => (
  <div
    className="audio-bus-flow"
    data-testid="audio-bus"
    data-visual-system="nebula-flow"
    aria-label="音频母带链路"
  >
    <span className="audio-bus-kicker">Audio Bus</span>
    <span className="audio-bus-steps" aria-hidden="true">
      {AUDIO_BUS_STEPS.map((step) => (
        <span key={step}>{step}</span>
      ))}
    </span>
  </div>
)

const WatchBusFlow = () => (
  <div
    className="watch-bus-flow"
    data-testid="watch-bus"
    data-visual-system="nebula-flow"
    aria-label="实验室监控链路"
  >
    <span className="watch-bus-kicker">Watch Bus</span>
    <span className="watch-bus-steps" aria-hidden="true">
      {WATCH_BUS_STEPS.map((step) => (
        <span key={step}>{step}</span>
      ))}
    </span>
  </div>
)

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
  return (
    <section className="pro-panel monitor-core panel-center" data-testid="area-center-panel">
      {activeMode === 'edit' ? (
        <div className="monitor-content">
          <div className={`monitor-stage-shell ${hasTimelineClips ? 'is-armed' : 'is-idle'}`}>
            <div className="monitor-stage-primary">
              <div className="preview-host" ref={previewHostRef} data-testid="area-preview-host">
                <div
                  className="preview-frame"
                  style={
                    previewFrameStyle
                      ? { ...previewFrameStyle, minHeight: 0 }
                      : { width: '100%', aspectRatio: '16 / 9', minHeight: 0 }
                  }
                  data-testid="area-preview-frame"
                  data-aspect-ratio={previewAspect}
                >
                  <div className="monitor-overlay">
                    <div className="monitor-overlay-left">
                      <div className="live-badge">REALTIME 实时预览</div>
                      {timecodeDisplay}
                    </div>
                    <div className="preview-meta">
                      <button
                        onClick={onToggleSpatialPreview}
                        className={`preview-mode-toggle ${isSpatialPreview ? 'active' : ''}`}
                      >
                        {isSpatialPreview ? '3D' : '2D'}
                      </button>
                      <div className="preview-quality">REC 4K HDR</div>
                    </div>
                  </div>
                  {previewPlayer}
                </div>
                {!hasTimelineClips && (
                  <div className="monitor-empty-overlay">
                    <div
                      className="empty-hero director-canvas-launchpad"
                      data-testid="director-canvas-launchpad"
                      data-visual-system="nebula-flow"
                    >
                      <span className="director-canvas-kicker">Director&apos;s Canvas</span>
                      <div className="empty-icon" aria-hidden="true">
                        VM
                      </div>
                      <strong>{assetCount > 0 ? '素材已就绪' : '开启创作流'}</strong>
                      <p>
                        {assetCount > 0
                          ? '拖入素材，或让 AI 导演把现有片段扩写成可剪辑分镜。'
                          : '导入本地素材开始剪辑，或唤醒 AI 导演从文字构建首个分镜。'}
                      </p>
                      <div className="director-route-spine" aria-label="AI 创作链路">
                        <span>Prompt</span>
                        <span>Shots</span>
                        <span>Timeline</span>
                      </div>
                      <div className="empty-actions">
                        <button
                          onClick={onOpenAssets}
                          className="empty-btn empty-action-card is-import primary"
                          aria-label="导入素材"
                        >
                          <span className="empty-action-kicker" aria-hidden="true">
                            Import
                          </span>
                          导入素材
                        </button>
                        <button
                          onClick={onOpenDirector}
                          className="empty-btn empty-action-card is-ai"
                          aria-label="AI 导演"
                        >
                          <span className="empty-action-kicker" aria-hidden="true">
                            AI Director
                          </span>
                          <span className="empty-action-title">唤醒 AI 导演</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="monitor-bottom-bar" data-shell-role="output-dock">
                <div className="monitor-controls-group">
                  <div className="transport-controls-compact">
                    <button
                      className="transport-btn-small"
                      onClick={onSeekToStart}
                      title="跳转至开始"
                      aria-label="跳转到开头"
                      data-testid="btn-player-prev"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                        <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
                      </svg>
                    </button>
                    <button
                      className="transport-btn-main"
                      onClick={onTogglePlay}
                      title={isPlaying ? '暂停' : '播放'}
                      aria-label={isPlaying ? '暂停' : '播放'}
                      data-testid="btn-player-play"
                    >
                      {isPlaying ? (
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>
                    <button
                      className="transport-btn-small"
                      onClick={onSeekToNextClip}
                      title="下一片段"
                      aria-label="跳转到下一片段"
                      data-testid="btn-player-next"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                        <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                      </svg>
                    </button>
                  </div>
                </div>

                <OutputDockFlow />

                <div className="monitor-info-group">
                  <div className="monitor-stat">
                    <span className="label">片段</span>
                    <strong className="value">{assetCount}</strong>
                  </div>
                  <div className="monitor-stat">
                    <span className="label">输出画幅</span>
                    <strong className="value">{previewAspect}</strong>
                  </div>
                </div>

                <div className="monitor-actions-group">
                  <button onClick={onSwitchToLab} className="action-pill">
                    视频实验室
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : activeMode === 'color' ? (
        labSurface === 'watch' ? (
          <div className="lab-watch-stage-shell" data-shell-role="watch-bus">
            <WatchBusFlow />
            {labWatchPanel}
          </div>
        ) : (
          comparisonLab
        )
      ) : (
        <div className="audio-master-stage" data-shell-role="audio-bus">
          <div className="audio-master-hero" data-testid="audio-master-hero">
            <div className="audio-master-hero-copy">
              <span className="audio-master-kicker">Audio Mastering</span>
              <strong className="audio-master-title">音频母带引擎已就绪</strong>
              <p className="audio-master-summary">
                旁白、音乐与节奏感应分析会在同一工作区对齐，导入音频后即可进入母带链路。
              </p>
              <AudioBusFlow />
              <div className="audio-master-actions">
                <button type="button" onClick={onOpenAssets} className="empty-btn primary">
                  导入音频素材
                </button>
              </div>
            </div>

            <div className="audio-master-status-tower" data-testid="audio-master-status-tower">
              <div className="audio-master-status-card">
                <span>母带输入</span>
                <strong>等待音频</strong>
              </div>
              <div className="audio-master-status-card">
                <span>节拍栅格</span>
                <strong>未分析</strong>
              </div>
              <div className="audio-master-status-card">
                <span>交付校验</span>
                <strong>待确认</strong>
              </div>
            </div>
          </div>

          <div className="audio-master-lanes" data-testid="audio-master-lanes">
            <div className="audio-master-lane">
              <span className="audio-master-lane-kicker">Input</span>
              <strong>母带输入</strong>
              <p>导入旁白、配乐或现场收音后，系统会建立统一素材基线。</p>
            </div>
            <div className="audio-master-lane">
              <span className="audio-master-lane-kicker">Rhythm</span>
              <strong>节拍栅格</strong>
              <p>自动提取节奏、停顿与能量段落，为剪辑点提供可复核参照。</p>
            </div>
            <div className="audio-master-lane">
              <span className="audio-master-lane-kicker">Delivery</span>
              <strong>交付校验</strong>
              <p>统一响度、峰值和对话清晰度检查，减少导出前返工。</p>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default AppCenterPanel
