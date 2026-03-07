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

const MODE_META: Record<LabMode, { index: string; title: string; summary: string }> = {
  compare: {
    index: '01',
    title: '双通道比对',
    summary: '同一素材在两路模型上并行播出，适合快速做节目判断。'
  },
  marketplace: {
    index: '02',
    title: '策略治理',
    summary: '把路由、预算和策略超市拉进同一块播控台，控制整个实验室。'
  },
  creative: {
    index: '03',
    title: '创意闭环',
    summary: '让提示词、工作流、生成结果和复用资产围绕主引擎运转。'
  },
  collab: {
    index: '04',
    title: '协作平台',
    summary: 'Presence、事件流和实时频道集中到一处协作作战室。'
  }
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
  const currentModeMeta = MODE_META[labMode]
  const primaryAction =
    labMode === 'compare'
      ? {
          label: '导出对比报告',
          onClick: onExportReport
        }
      : labMode === 'marketplace'
        ? {
            label: '刷新超市',
            onClick: onRefreshMarketplace
          }
        : null

  return (
    <div className="lab-toolbar" data-guide="lab-toolbar" data-testid="area-lab-toolbar">
      <div className="lab-toolbar-main">
        <div className="lab-toolbar-left">
          <div className="lab-toolbar-identity">
            <div className="lab-kicker">实验协议 / routing deck</div>
            <div className="lab-mode-deck">
              <span className="lab-mode-index">{currentModeMeta.index}</span>
              <div className="lab-mode-copy">
                <strong className="lab-mode-title">{currentModeMeta.title}</strong>
                <span className="lab-mode-summary">{currentModeMeta.summary}</span>
              </div>
            </div>
          </div>
          <div className="lab-status-cluster">
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
      <div className="lab-actions">
        <div className="lab-mode-switch" role="tablist" aria-label="实验室模式切换">
          <button
            id="lab-tab-compare"
            role="tab"
            aria-controls="lab-panel-compare"
            aria-selected={labMode === 'compare'}
            tabIndex={labMode === 'compare' ? 0 : -1}
            className={`lab-mode-btn ${labMode === 'compare' ? 'active' : ''}`}
            onClick={() => onModeChange('compare')}
            data-testid="btn-lab-mode-compare"
          >
            <span className="lab-mode-number">01</span>
            <span className="lab-mode-label">对比</span>
          </button>
          <button
            id="lab-tab-marketplace"
            role="tab"
            aria-controls="lab-panel-marketplace"
            aria-selected={labMode === 'marketplace'}
            tabIndex={labMode === 'marketplace' ? 0 : -1}
            className={`lab-mode-btn ${labMode === 'marketplace' ? 'active' : ''}`}
            onClick={() => onModeChange('marketplace')}
            data-testid="btn-lab-mode-marketplace"
          >
            <span className="lab-mode-number">02</span>
            <span className="lab-mode-label">策略治理</span>
          </button>
          <button
            id="lab-tab-creative"
            role="tab"
            aria-controls="lab-panel-creative"
            aria-selected={labMode === 'creative'}
            tabIndex={labMode === 'creative' ? 0 : -1}
            className={`lab-mode-btn ${labMode === 'creative' ? 'active' : ''}`}
            onClick={() => onModeChange('creative')}
            data-testid="btn-lab-mode-creative"
          >
            <span className="lab-mode-number">03</span>
            <span className="lab-mode-label">创意闭环</span>
          </button>
          <button
            id="lab-tab-collab"
            role="tab"
            aria-controls="lab-panel-collab"
            aria-selected={labMode === 'collab'}
            tabIndex={labMode === 'collab' ? 0 : -1}
            className={`lab-mode-btn ${labMode === 'collab' ? 'active' : ''}`}
            onClick={() => onModeChange('collab')}
            data-testid="btn-lab-mode-collab"
          >
            <span className="lab-mode-number">04</span>
            <span className="lab-mode-label">协作平台</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default LabToolbar
