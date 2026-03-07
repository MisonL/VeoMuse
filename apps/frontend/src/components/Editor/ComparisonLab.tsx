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
    label: '双通道比对',
    description: '同屏对打，快速判断模型与素材的节目表现'
  },
  marketplace: {
    index: '02',
    label: '策略治理',
    description: '用策略与路由约束整个实验室的输出秩序'
  },
  creative: {
    index: '03',
    label: '创意闭环',
    description: '把生成、复用、反馈和版本链聚合成主引擎工位'
  },
  collab: {
    index: '04',
    label: '协作平台',
    description: '把在线协作、Presence 和事件流固定到同一舞台'
  }
} as const

const LAB_STAGE_ORDER = [
  { mode: 'compare', short: '比对' },
  { mode: 'marketplace', short: '治理' },
  { mode: 'creative', short: '创意' },
  { mode: 'collab', short: '协作' }
] as const

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
  const currentStage = LAB_STAGE_META[labMode]

  return (
    <div className="comparison-lab-pro" data-testid="area-comparison-lab" data-lab-mode={labMode}>
      <div className="lab-stage-shell">
        <aside className="lab-stage-spine" aria-hidden="true">
          <div className="lab-stage-ledger">
            <span className="lab-stage-index">{currentStage.index}</span>
            <div className="lab-stage-copy">
              <span className="lab-stage-kicker">routing stage</span>
              <strong>{currentStage.label}</strong>
              <p>{currentStage.description}</p>
            </div>
          </div>
          <div className="lab-stage-markers">
            {LAB_STAGE_ORDER.map((stage) => (
              <div
                key={stage.mode}
                className={`lab-stage-marker ${stage.mode === labMode ? 'active' : ''}`}
              >
                <span className="lab-stage-marker-index">{LAB_STAGE_META[stage.mode].index}</span>
                <span className="lab-stage-marker-label">{stage.short}</span>
              </div>
            ))}
          </div>
        </aside>
        <div className="lab-stage-main">
          <LabToolbar {...toolbarProps} />

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
