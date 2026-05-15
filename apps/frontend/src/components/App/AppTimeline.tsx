import type { ReactNode } from 'react'

type AppMode = 'edit' | 'color' | 'audio'
type AppTool = 'select' | 'cut' | 'hand'

const EMPTY_HINT_BY_MODE: Record<AppMode, { title: string; description: string }> = {
  edit: {
    title: '主节目轨空置',
    description: '请从左侧拖入素材，或使用 AI 导演启动编排'
  },
  color: {
    title: '实验轨空置',
    description: '完成双通道比对后，时间轴会承接选定片段与实验结论'
  },
  audio: {
    title: '母带轨空置',
    description: '导入音频素材后，时间轴会承接节拍、响度与交付检查'
  }
}

const TOOL_ICON = {
  undo: (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M8 5 4 9l4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 9h6a4 4 0 0 1 0 8H8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  redo: (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="m12 5 4 4-4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 9H9a4 4 0 0 0 0 8h3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  select: (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M5 3v11l3.4-2.2L11 17l2-1.1-2.5-5.1L15 10 5 3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  ),
  cut: (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="5" cy="6" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="5" cy="14" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M7 7.3 15 3M7 12.7 15 17"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  ),
  hand: (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M6.5 10V6.2a1 1 0 1 1 2 0V9m0 0V4.8a1 1 0 1 1 2 0V9m0 0V5.8a1 1 0 1 1 2 0V10m0 0V7.4a1 1 0 1 1 2 0V12c0 3-1.7 5-4.6 5-2.7 0-4-1.6-4.9-3.6l-1-2.2a1 1 0 0 1 1.8-.8L6.5 11V10Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
} as const

const resolveGpuLabel = (value: number) => (value <= 0 ? '待载入' : `${value}%`)

const resolveReadoutLabel = (value: string) => {
  const text = value.trim()
  return text === '0 / 0' || text === '0%' || text.length === 0 ? '待载入' : value
}

interface AppTimelineProps {
  activeMode: AppMode
  canUndo: boolean
  canRedo: boolean
  activeTool: AppTool
  hasTimelineClips: boolean
  currentMetrics: {
    gpu: number
    ram: string
    cache: string
  }
  timelineContent: ReactNode
  onActivate: () => void
  onUndo: () => void
  onRedo: () => void
  onActiveToolChange: (tool: AppTool) => void
  onOpenAssets?: () => void
  onOpenDirector?: () => void
}

const AppTimeline = ({
  activeMode,
  canUndo,
  canRedo,
  activeTool,
  hasTimelineClips,
  currentMetrics,
  timelineContent,
  onActivate,
  onUndo,
  onRedo,
  onActiveToolChange,
  onOpenAssets,
  onOpenDirector
}: AppTimelineProps) => {
  const emptyHint = EMPTY_HINT_BY_MODE[activeMode]
  const canShowEditActions = activeMode === 'edit' && onOpenAssets && onOpenDirector

  return (
    <footer
      className={`pro-panel timeline-container ${hasTimelineClips ? 'is-armed' : 'is-idle'}`}
      onMouseEnter={onActivate}
      onFocusCapture={onActivate}
      data-testid="area-timeline"
    >
      <div className="timeline-header-refined">
        <div className="timeline-tools-refined">
          <div className="tool-group">
            <button
              className="tool-btn-lite"
              onClick={onUndo}
              disabled={!canUndo}
              title="撤销 (Cmd+Z)"
              aria-label="撤销"
            >
              {TOOL_ICON.undo}
            </button>
            <button
              className="tool-btn-lite"
              onClick={onRedo}
              disabled={!canRedo}
              title="重做 (Cmd+Shift+Z)"
              aria-label="重做"
            >
              {TOOL_ICON.redo}
            </button>
          </div>
          <div className="tool-divider" />
          <div className="tool-group">
            <button
              className={`tool-btn-lite ${activeTool === 'select' ? 'active' : ''}`}
              onClick={() => onActiveToolChange('select')}
              title="选择工具 (V)"
              aria-label="选择工具"
            >
              {TOOL_ICON.select}
            </button>
            <button
              className={`tool-btn-lite ${activeTool === 'cut' ? 'active' : ''}`}
              onClick={() => onActiveToolChange('cut')}
              title="剪切工具 (C)"
              aria-label="剪切工具"
            >
              {TOOL_ICON.cut}
            </button>
            <button
              className={`tool-btn-lite ${activeTool === 'hand' ? 'active' : ''}`}
              onClick={() => onActiveToolChange('hand')}
              title="手形工具 (H)"
              aria-label="手形工具"
            >
              {TOOL_ICON.hand}
            </button>
          </div>
        </div>

        <div className="timeline-status-refined">
          <span className="status-item">
            <span className="dot" /> {hasTimelineClips ? '已就绪' : '待命'}
          </span>
          <div className="telemetry-lite">
            <span>GPU {resolveGpuLabel(currentMetrics.gpu)}</span>
            <span>MEM {resolveReadoutLabel(currentMetrics.ram)}</span>
          </div>
        </div>
      </div>

      <div className="timeline-body-refined">
        {timelineContent}
        {!hasTimelineClips && (
          <>
            <div className="timeline-empty-hint">
              <div className="timeline-empty-copy">
                <strong>{emptyHint.title}</strong>
                <p>{emptyHint.description}</p>
              </div>
            </div>
            {canShowEditActions ? (
              <div className="timeline-empty-cta-rail" aria-label="时间轴空态操作">
                <button type="button" className="timeline-empty-action primary" onClick={onOpenAssets}>
                  从素材库入轨
                </button>
                <button type="button" className="timeline-empty-action" onClick={onOpenDirector}>
                  AI 导演编排
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </footer>
  )
}

export default AppTimeline
