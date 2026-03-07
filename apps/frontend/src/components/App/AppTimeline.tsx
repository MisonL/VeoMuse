import type { ReactNode } from 'react'

type AppTool = 'select' | 'cut' | 'hand'

interface AppTimelineProps {
  assetCount: number
  canUndo: boolean
  canRedo: boolean
  activeTool: AppTool
  hasTimelineClips: boolean
  currentMetrics: {
    gpu: number
    ram: string
    cache: string
  }
  telemetryHistory: number[]
  timelineContent: ReactNode
  onActivate: () => void
  onUndo: () => void
  onRedo: () => void
  onActiveToolChange: (tool: AppTool) => void
}

const AppTimeline = ({
  assetCount,
  canUndo,
  canRedo,
  activeTool,
  hasTimelineClips,
  currentMetrics,
  telemetryHistory,
  timelineContent,
  onActivate,
  onUndo,
  onRedo,
  onActiveToolChange
}: AppTimelineProps) => (
  <footer
    className="pro-panel timeline-container"
    onMouseEnter={onActivate}
    onFocusCapture={onActivate}
    data-testid="area-timeline"
  >
    <div className="timeline-actions">
      <div className="timeline-command-deck">
        <div className="timeline-command-copy">
          <span className="timeline-eyebrow">节目编排</span>
          <span className="timeline-section-title">编辑工具</span>
          <span className="timeline-running-order">
            {hasTimelineClips ? 'Run of Show / Prime Cut' : '节目待命 / Waiting For First Clip'}
          </span>
        </div>
        <div className="timeline-control-surface">
          <div className="timeline-priority-band">
            <span className="timeline-priority-pill">主操作区</span>
            <span className="timeline-priority-copy">
              {hasTimelineClips
                ? '继续在这里剪切、拖拽、对齐和回退，节目轨会优先承接你的操作。'
                : '先把第一批片段送入这里，后续的剪切、编排和导出前整理都会在这里完成。'}
            </span>
          </div>
          <div className="timeline-tools" data-guide="timeline-tools">
            <div className="undo-group">
              <button
                id="tool-undo"
                aria-label="撤销"
                className="tool-icon"
                onClick={onUndo}
                disabled={!canUndo}
                data-testid="btn-tool-undo"
              >
                ↩
              </button>
              <button
                id="tool-redo"
                aria-label="重做"
                className="tool-icon"
                onClick={onRedo}
                disabled={!canRedo}
                data-testid="btn-tool-redo"
              >
                ↪
              </button>
            </div>
            <button
              id="tool-select"
              aria-label="选择工具"
              className={`tool-icon ${activeTool === 'select' ? 'active' : ''}`}
              onClick={() => onActiveToolChange('select')}
              data-testid="btn-tool-select"
            >
              ↖
            </button>
            <button
              id="tool-cut"
              aria-label="切割工具"
              className={`tool-icon ${activeTool === 'cut' ? 'active' : ''}`}
              onClick={() => onActiveToolChange('cut')}
              data-testid="btn-tool-cut"
            >
              ✂
            </button>
            <button
              id="tool-hand"
              aria-label="平移工具"
              className={`tool-icon ${activeTool === 'hand' ? 'active' : ''}`}
              onClick={() => onActiveToolChange('hand')}
              data-testid="btn-tool-hand"
            >
              ✋
            </button>
          </div>
        </div>
      </div>

      <div className="system-telemetry">
        <div className="telemetry-dock-head">
          <span className="timeline-section-title telemetry-label">系统状态</span>
          <span className="telemetry-dock-copy">
            {hasTimelineClips
              ? '播出总线稳定 / 节目轨热更新中'
              : `时间轴待命 / 素材库 ${assetCount} 项，等待首个片段入轨`}
          </span>
        </div>
        <div className="telemetry-item">
          <span>
            GPU LOAD: <b className="telemetry-value success">{currentMetrics.gpu}%</b>
          </span>
          <div className="telemetry-sparkline">
            {telemetryHistory.map((value, index) => (
              <div
                key={index}
                className="spark-bar"
                style={{ height: `${Math.max(2, Math.min(100, value))}%` }}
              />
            ))}
          </div>
        </div>
        <div className="telemetry-item telemetry-divider">
          RAM: <span className="telemetry-value success">{currentMetrics.ram}</span>
        </div>
        <div className="telemetry-item telemetry-divider">
          CACHE: <span className="telemetry-value accent">{currentMetrics.cache}</span>
        </div>
      </div>
    </div>
    <div className="timeline-body">
      {!hasTimelineClips ? (
        <div className="timeline-empty-state" role="status">
          <div className="timeline-empty-copy">
            <span className="timeline-section-title">轨道待命</span>
            <strong>中心工作区负责给出第一步，时间轴负责承接编排。</strong>
            <span>素材入轨后，这里会接管节奏、剪切、分段与导出前编排。</span>
          </div>
          <div className="timeline-empty-readout">
            <div>
              <b>素材库</b>
              <span>{assetCount}</span>
            </div>
            <div>
              <b>轨道状态</b>
              <span>空轨待命</span>
            </div>
            <div>
              <b>当前焦点</b>
              <span>首批入轨</span>
            </div>
          </div>
        </div>
      ) : null}
      {timelineContent}
    </div>
  </footer>
)

export default AppTimeline
