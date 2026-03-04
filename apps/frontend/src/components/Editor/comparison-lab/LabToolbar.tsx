import React from 'react'
import type { LabMode } from './types'

interface LabToolbarProps {
  labMode: LabMode
  syncPlayback: boolean
  onSyncPlaybackChange: (checked: boolean) => void
  onModeChange: (mode: LabMode) => void
  onExportReport: () => void
  onRefreshMarketplace: () => void
  onOpenChannelPanel: () => void
}

const LabToolbar: React.FC<LabToolbarProps> = ({
  labMode,
  syncPlayback,
  onSyncPlaybackChange,
  onModeChange,
  onExportReport,
  onRefreshMarketplace,
  onOpenChannelPanel
}) => {
  return (
    <div className="lab-toolbar" data-guide="lab-toolbar" data-testid="area-lab-toolbar">
      <div className="lab-toolbar-main">
        <div className="lab-toolbar-left">
          <div className="lab-status">
            <span className="live-dot">●</span> 实验室在线
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
        <div className="lab-toolbar-cta">
          {labMode === 'compare' ? (
            <button id="btn-export-compare-report" className="lab-btn" onClick={onExportReport}>
              导出对比报告
            </button>
          ) : (
            <button className="lab-btn" onClick={onRefreshMarketplace}>
              刷新超市
            </button>
          )}
          <button
            className="lab-btn lab-btn--secondary"
            onClick={onOpenChannelPanel}
            data-testid="btn-open-channel-panel"
          >
            渠道接入
          </button>
        </div>
      </div>
      <div className="lab-actions">
        <div className="lab-mode-switch">
          <button
            className={`lab-mode-btn ${labMode === 'compare' ? 'active' : ''}`}
            onClick={() => onModeChange('compare')}
            data-testid="btn-lab-mode-compare"
          >
            对比
          </button>
          <button
            className={`lab-mode-btn ${labMode === 'marketplace' ? 'active' : ''}`}
            onClick={() => onModeChange('marketplace')}
            data-testid="btn-lab-mode-marketplace"
          >
            策略治理
          </button>
          <button
            className={`lab-mode-btn ${labMode === 'creative' ? 'active' : ''}`}
            onClick={() => onModeChange('creative')}
            data-testid="btn-lab-mode-creative"
          >
            创意闭环
          </button>
          <button
            className={`lab-mode-btn ${labMode === 'collab' ? 'active' : ''}`}
            onClick={() => onModeChange('collab')}
            data-testid="btn-lab-mode-collab"
          >
            协作平台
          </button>
        </div>
      </div>
    </div>
  )
}

export default LabToolbar
