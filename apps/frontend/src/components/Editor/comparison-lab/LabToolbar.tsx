import React from 'react'
import type { LabMode } from './types'

interface LabToolbarProps {
  labMode: LabMode
  syncPlayback: boolean
  onSyncPlaybackChange: (checked: boolean) => void
  onExportReport: () => void
  onRefreshMarketplace: () => void
  onOpenChannelPanel: () => void
}

const MODE_META: Record<LabMode, { status: string; actionHint: string }> = {
  compare: {
    status: '双通道总线在线',
    actionHint: '先补齐两路素材，再导出本轮判断结论。'
  },
  marketplace: {
    status: '治理面板待命',
    actionHint: '先看路由和预算，再决定本轮策略是否接入。'
  },
  creative: {
    status: '创意总线待命',
    actionHint: '主引擎、工作流和资产复用会围绕同一工位展开。'
  },
  collab: {
    status: '协作频道待命',
    actionHint: '成员、事件与治理动作会围绕同一条协作频道汇流。'
  }
}

const LabToolbar: React.FC<LabToolbarProps> = ({
  labMode,
  syncPlayback,
  onSyncPlaybackChange,
  onExportReport,
  onRefreshMarketplace,
  onOpenChannelPanel
}) => {
  const currentModeMeta = MODE_META[labMode]
  const primaryAction =
    labMode === 'compare'
      ? {
          label: '导出对比报告',
          onClick: onExportReport
        }
      : labMode === 'marketplace'
        ? {
            label: '刷新治理面板',
            onClick: onRefreshMarketplace
          }
        : null

  return (
    <div className="lab-toolbar" data-guide="lab-toolbar" data-testid="area-lab-toolbar">
      <div className="lab-toolbar-main">
        <div className="lab-toolbar-left">
          <div className="lab-toolbar-bridge-copy">
            <span className="lab-toolbar-bridge-tag">命令桥</span>
            <span className="lab-toolbar-hint">{currentModeMeta.actionHint}</span>
          </div>
          <div className="lab-status-cluster">
            <div className="lab-status">
              <span className="live-dot">●</span> {currentModeMeta.status}
            </div>
            {labMode === 'compare' ? (
              <label className="sync-toggle">
                <input
                  name="syncPlayback"
                  type="checkbox"
                  checked={syncPlayback}
                  onChange={(e) => onSyncPlaybackChange(e.target.checked)}
                />
                <span>同步预览</span>
              </label>
            ) : null}
          </div>
        </div>
        <div className="lab-toolbar-cta">
          {primaryAction ? (
            <button
              id={labMode === 'compare' ? 'btn-export-compare-report' : undefined}
              className="lab-btn"
              onClick={primaryAction.onClick}
            >
              {primaryAction.label}
            </button>
          ) : null}
          <button
            className="lab-btn lab-btn--secondary"
            onClick={onOpenChannelPanel}
            data-testid="btn-open-channel-panel"
          >
            渠道接入
          </button>
        </div>
      </div>
    </div>
  )
}

export default LabToolbar
