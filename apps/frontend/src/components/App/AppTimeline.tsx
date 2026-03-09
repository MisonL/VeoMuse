import type { ReactNode } from 'react'

type AppTool = 'select' | 'cut' | 'hand'
type AppMode = 'edit' | 'color' | 'audio'

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
  activeMode,
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
}: AppTimelineProps) => {
  const modeMeta =
    activeMode === 'color'
      ? {
          eyebrow: '实验室',
          sectionTitle: '阶段总览',
          runningOrder: '实验室 / 四段阶段',
          priorityPill: '实验室主轴',
          priorityCopy: '上方实验区承接比对、治理、创意与协作，下方保持实验上下文与状态总览。',
          telemetryLabel: '实验状态',
          telemetryCopy: '实验室在线 / 阶段摘要待命',
          emptyTitle: '实验室待命',
          emptyLead: '上方实验室负责推进阶段切换，下方负责承接判断线索与运行摘要。',
          emptySummary: '切换到上方实验室后，这里负责承接阶段摘要、状态与节奏。',
          emptyTrackStatus: '阶段摘要待命',
          emptyFocus: '四段切换'
        }
      : activeMode === 'audio'
        ? {
            eyebrow: '母带总线',
            sectionTitle: '音频工位',
            runningOrder: '音频大师 / 母带待命',
            priorityPill: '母带主轴',
            priorityCopy: '上方工作区负责导入、旁白与母带编排，下方保留状态、输入待机与节奏摘要。',
            telemetryLabel: '母带状态',
            telemetryCopy: '母带链路待命 / 旁白、音乐与响度流程可随时接入',
            emptyTitle: '音频轨待命',
            emptyLead: '上方母带舞台负责推进导入与调度，下方承接输入健康、总线状态与交付摘要。',
            emptySummary: '素材接入后，这里会承接母带流程、输入状态和导出前检查。',
            emptyTrackStatus: '母带摘要待命',
            emptyFocus: '导入 / 母带'
          }
        : {
            eyebrow: '节目编排',
            sectionTitle: '编辑工具',
            runningOrder: hasTimelineClips ? '节目编排 / 主剪版' : '节目待命 / 等待首个片段',
            priorityPill: '主操作区',
            priorityCopy: hasTimelineClips
              ? '继续在这里完成剪切、对齐与回退，节目轨会优先承接你的操作。'
              : '先把第一批片段送入这里，后续的剪切、编排和导出前整理都会在这里完成。',
            telemetryLabel: '系统状态',
            telemetryCopy: hasTimelineClips
              ? '播出总线稳定 / 节目轨热更新中'
              : `时间轴待命 / 素材库 ${assetCount} 项，等待首个片段入轨`,
            emptyTitle: '轨道待命',
            emptyLead: '中心工作区负责给出第一步，时间轴负责承接编排。',
            emptySummary: '素材入轨后，这里会接管节奏、剪切、分段与导出前编排。',
            emptyTrackStatus: '空轨待命',
            emptyFocus: '首批入轨'
          }

  return (
    <footer
      className={`pro-panel timeline-container ${hasTimelineClips ? 'is-armed' : 'is-idle'}`}
      data-active-mode={activeMode}
      onMouseEnter={onActivate}
      onFocusCapture={onActivate}
      data-testid="area-timeline"
    >
      <div className="timeline-actions">
        <div className="timeline-command-deck">
          <div className="timeline-command-copy">
            <span className="timeline-eyebrow">{modeMeta.eyebrow}</span>
            <span className="timeline-section-title">{modeMeta.sectionTitle}</span>
            <span className="timeline-running-order">{modeMeta.runningOrder}</span>
          </div>
          <div className="timeline-control-surface">
            <div className={`timeline-priority-band ${hasTimelineClips ? 'is-armed' : 'is-idle'}`}>
              <span className="timeline-priority-pill">{modeMeta.priorityPill}</span>
              <span className="timeline-priority-copy">{modeMeta.priorityCopy}</span>
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
                  {TOOL_ICON.undo}
                </button>
                <button
                  id="tool-redo"
                  aria-label="重做"
                  className="tool-icon"
                  onClick={onRedo}
                  disabled={!canRedo}
                  data-testid="btn-tool-redo"
                >
                  {TOOL_ICON.redo}
                </button>
              </div>
              <button
                id="tool-select"
                aria-label="选择工具"
                className={`tool-icon ${activeTool === 'select' ? 'active' : ''}`}
                onClick={() => onActiveToolChange('select')}
                data-testid="btn-tool-select"
              >
                {TOOL_ICON.select}
              </button>
              <button
                id="tool-cut"
                aria-label="切割工具"
                className={`tool-icon ${activeTool === 'cut' ? 'active' : ''}`}
                onClick={() => onActiveToolChange('cut')}
                data-testid="btn-tool-cut"
              >
                {TOOL_ICON.cut}
              </button>
              <button
                id="tool-hand"
                aria-label="平移工具"
                className={`tool-icon ${activeTool === 'hand' ? 'active' : ''}`}
                onClick={() => onActiveToolChange('hand')}
                data-testid="btn-tool-hand"
              >
                {TOOL_ICON.hand}
              </button>
            </div>
          </div>
        </div>

        <div className={`system-telemetry ${hasTimelineClips ? 'is-armed' : 'is-idle'}`}>
          <div className="telemetry-dock-head">
            <span className="timeline-section-title telemetry-label">
              {modeMeta.telemetryLabel}
            </span>
            <span className="telemetry-dock-copy">{modeMeta.telemetryCopy}</span>
          </div>
          <div className="telemetry-item telemetry-item--gpu">
            <span>
              GPU 负载:{' '}
              <b className="telemetry-value success">{resolveGpuLabel(currentMetrics.gpu)}</b>
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
            内存:{' '}
            <span className="telemetry-value success">
              {resolveReadoutLabel(currentMetrics.ram)}
            </span>
          </div>
          <div className="telemetry-item telemetry-divider">
            缓存:{' '}
            <span className="telemetry-value accent">
              {resolveReadoutLabel(currentMetrics.cache)}
            </span>
          </div>
        </div>
      </div>
      <div className={`timeline-body ${hasTimelineClips ? 'is-armed' : 'is-idle'}`}>
        <div className={`timeline-editor-slot ${hasTimelineClips ? '' : 'is-dimmed'}`}>
          {timelineContent}
        </div>
        {!hasTimelineClips ? (
          <div className="timeline-empty-overlay" role="status">
            <div className="timeline-empty-state">
              <div className="timeline-empty-glyph" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className="timeline-empty-copy">
                <span className="timeline-section-title">{modeMeta.emptyTitle}</span>
                <strong>{modeMeta.emptyLead}</strong>
                <span>{modeMeta.emptySummary}</span>
              </div>
              <div className="timeline-empty-readout">
                <div>
                  <b>素材库</b>
                  <span>{assetCount}</span>
                </div>
                <div>
                  <b>轨道状态</b>
                  <span>{modeMeta.emptyTrackStatus}</span>
                </div>
                <div>
                  <b>当前焦点</b>
                  <span>{modeMeta.emptyFocus}</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </footer>
  )
}

export default AppTimeline
