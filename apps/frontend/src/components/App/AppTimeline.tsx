import type { ReactNode } from 'react'

type AppTool = 'select' | 'cut' | 'hand'

interface AppTimelineProps {
  canUndo: boolean
  canRedo: boolean
  activeTool: AppTool
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
  canUndo,
  canRedo,
  activeTool,
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
          <span className="timeline-running-order">Run of Show / Prime Cut</span>
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

      <div className="system-telemetry">
        <div className="telemetry-dock-head">
          <span className="timeline-section-title telemetry-label">系统状态</span>
          <span className="telemetry-dock-copy">播出总线稳定 / 节目轨热更新中</span>
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
    <div className="timeline-body">{timelineContent}</div>
  </footer>
)

export default AppTimeline
