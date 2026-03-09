import type { ReactNode } from 'react'

type AppTool = 'select' | 'cut' | 'hand'
type AppMode = 'edit' | 'color' | 'audio'

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
          eyebrow: '实验闭环',
          sectionTitle: '模式总览',
          runningOrder: '实验室 / 四段闭环',
          priorityPill: '实验主轴',
          priorityCopy: '上方主舞台承接比对、治理、创意与协作，下方保持实验上下文与状态总览。',
          telemetryLabel: '实验状态',
          telemetryCopy: '实验室在线 / 双通道路由与策略总线保持热备',
          emptyTitle: '实验台待命',
          emptyLead: '上方实验主舞台负责推进阶段切换，下方负责承接判断线索与运行摘要。',
          emptySummary: '切换到上方实验主舞台后，这里负责承接过程摘要、状态与节奏。',
          emptyTrackStatus: '实验摘要待接入',
          emptyFocus: '四段切换'
        }
      : activeMode === 'audio'
        ? {
            eyebrow: '母带总线',
            sectionTitle: '音频工位',
            runningOrder: '音频大师 / 母带待命',
            priorityPill: '母带主轴',
            priorityCopy: '上方主舞台负责导入、旁白与母带编排，下方保留总线状态、输入待机与节奏摘要。',
            telemetryLabel: '母带状态',
            telemetryCopy: '母带链路待命 / 旁白、音乐与响度流程可随时接入',
            emptyTitle: '音频轨待命',
            emptyLead: '上方母带舞台负责推进导入与调度，下方承接输入健康、总线状态与交付摘要。',
            emptySummary: '素材接入后，这里会承接母带流程、输入状态和导出前检查。',
            emptyTrackStatus: '母带摘要待接入',
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

        <div className={`system-telemetry ${hasTimelineClips ? 'is-armed' : 'is-idle'}`}>
          <div className="telemetry-dock-head">
            <span className="timeline-section-title telemetry-label">{modeMeta.telemetryLabel}</span>
            <span className="telemetry-dock-copy">{modeMeta.telemetryCopy}</span>
          </div>
          <div className="telemetry-item telemetry-item--gpu">
            <span>
              GPU 负载: <b className="telemetry-value success">{currentMetrics.gpu}%</b>
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
            内存: <span className="telemetry-value success">{currentMetrics.ram}</span>
          </div>
          <div className="telemetry-item telemetry-divider">
            缓存: <span className="telemetry-value accent">{currentMetrics.cache}</span>
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
