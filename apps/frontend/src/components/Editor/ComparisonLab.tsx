import React from 'react'
import type { ComparisonLabProps } from './comparison-lab/types'
import { useComparisonLabController } from './comparison-lab/hooks/useComparisonLabController'
import LabToolbar from './comparison-lab/LabToolbar'
import CompareModePanel from './comparison-lab/modes/CompareModePanel'
import MarketplaceModePanel from './comparison-lab/modes/MarketplaceModePanel'
import CreativeModeContainer from './comparison-lab/modes/creative/CreativeModeContainer'
import CollabModeContainer from './comparison-lab/modes/collab/CollabModeContainer'
import ChannelAccessPanel from './comparison-lab/ChannelAccessPanel'
import './ComparisonLab.css'

const LAB_STAGE_META = {
  compare: {
    index: '01',
    label: '双通道比对'
  },
  marketplace: {
    index: '02',
    label: '策略治理'
  },
  creative: {
    index: '03',
    label: '创意闭环'
  },
  collab: {
    index: '04',
    label: '协作平台'
  }
} as const

const LAB_STAGE_ORDER = [
  { mode: 'compare', short: '比对' },
  { mode: 'marketplace', short: '治理' },
  { mode: 'creative', short: '创意' },
  { mode: 'collab', short: '协作' }
] as const

const LAB_STAGE_STATUS_LABEL = {
  current: '当前阶段',
  completed: '已完成阶段',
  available: '可进入阶段'
} as const

const resolveStageStatus = (stageIndex: number, currentStageIndex: number) => {
  if (stageIndex === currentStageIndex) return 'current'
  if (stageIndex < currentStageIndex) return 'completed'
  return 'available'
}

const ComparisonLab: React.FC<ComparisonLabProps> = ({
  onOpenAssets,
  channelPanelRequestNonce
}) => {
  const {
    labMode,
    toolbarProps,
    comparePanelProps,
    marketplacePanelProps,
    creativeContainerProps,
    collabContainerProps,
    channelAccessPanelProps
  } = useComparisonLabController({ onOpenAssets, channelPanelRequestNonce })
  const currentStageIndex = LAB_STAGE_ORDER.findIndex((stage) => stage.mode === labMode)

  return (
    <div className="comparison-lab-pro" data-testid="area-comparison-lab" data-lab-mode={labMode}>
      <div className="lab-stage-shell">
        <aside className="lab-stage-spine">
          <div className="lab-stage-rail-head">
            <span className="lab-stage-rail-kicker">stage rail</span>
            <strong>实验阶段</strong>
          </div>
          <div className="lab-stage-markers" role="tablist" aria-label="实验室阶段切换">
            {LAB_STAGE_ORDER.map((stage, stageIndex) => {
              const status = resolveStageStatus(stageIndex, currentStageIndex)
              return (
                <button
                  key={stage.mode}
                  id={`lab-tab-${stage.mode}`}
                  role="tab"
                  type="button"
                  aria-controls={`lab-panel-${stage.mode}`}
                  aria-selected={stage.mode === labMode}
                  aria-current={status === 'current' ? 'step' : undefined}
                  tabIndex={stage.mode === labMode ? 0 : -1}
                  data-testid={`btn-lab-mode-${stage.mode}`}
                  data-stage-status={status}
                  className={`lab-stage-marker ${status === 'current' ? 'active is-current' : ''} ${
                    status === 'completed' ? 'is-completed' : 'is-available'
                  }`}
                  onClick={() => toolbarProps.onModeChange(stage.mode)}
                >
                  <span className="lab-stage-marker-index">{LAB_STAGE_META[stage.mode].index}</span>
                  <span className="lab-stage-marker-copy">
                    <span className="lab-stage-marker-label">{stage.short}</span>
                    <span className="lab-stage-marker-state">{LAB_STAGE_STATUS_LABEL[status]}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </aside>
        <div className="lab-stage-main">
          <LabToolbar
            labMode={toolbarProps.labMode}
            syncPlayback={toolbarProps.syncPlayback}
            onSyncPlaybackChange={toolbarProps.onSyncPlaybackChange}
            onExportReport={toolbarProps.onExportReport}
            onRefreshMarketplace={toolbarProps.onRefreshMarketplace}
            onOpenChannelPanel={toolbarProps.onOpenChannelPanel}
          />

          <div className="lab-panel-stack">
            {labMode === 'compare' ? (
              <section
                id="lab-panel-compare"
                role="tabpanel"
                aria-labelledby="lab-tab-compare"
                className="lab-panel-slot"
              >
                <CompareModePanel {...comparePanelProps} />
              </section>
            ) : null}

            {labMode === 'marketplace' ? (
              <section
                id="lab-panel-marketplace"
                role="tabpanel"
                aria-labelledby="lab-tab-marketplace"
                className="lab-panel-slot"
              >
                <MarketplaceModePanel {...marketplacePanelProps} />
              </section>
            ) : null}

            {labMode === 'creative' ? (
              <section
                id="lab-panel-creative"
                role="tabpanel"
                aria-labelledby="lab-tab-creative"
                className="lab-panel-slot"
              >
                <CreativeModeContainer {...creativeContainerProps} />
              </section>
            ) : null}

            {labMode === 'collab' ? (
              <section
                id="lab-panel-collab"
                role="tabpanel"
                aria-labelledby="lab-tab-collab"
                className="lab-panel-slot"
              >
                <CollabModeContainer {...collabContainerProps} />
              </section>
            ) : null}
          </div>
        </div>
      </div>

      <ChannelAccessPanel {...channelAccessPanelProps} />
    </div>
  )
}

export default ComparisonLab
