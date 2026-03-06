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

  return (
    <div className="comparison-lab-pro" data-testid="area-comparison-lab">
      <LabToolbar {...toolbarProps} />

      {labMode === 'compare' ? (
        <section id="lab-panel-compare" role="tabpanel" aria-labelledby="lab-tab-compare">
          <CompareModePanel {...comparePanelProps} />
        </section>
      ) : null}

      {labMode === 'marketplace' ? (
        <section id="lab-panel-marketplace" role="tabpanel" aria-labelledby="lab-tab-marketplace">
          <MarketplaceModePanel {...marketplacePanelProps} />
        </section>
      ) : null}

      {labMode === 'creative' ? (
        <section id="lab-panel-creative" role="tabpanel" aria-labelledby="lab-tab-creative">
          <CreativeModeContainer {...creativeContainerProps} />
        </section>
      ) : null}

      {labMode === 'collab' ? (
        <section id="lab-panel-collab" role="tabpanel" aria-labelledby="lab-tab-collab">
          <CollabModeContainer {...collabContainerProps} />
        </section>
      ) : null}

      <ChannelAccessPanel {...channelAccessPanelProps} />
    </div>
  )
}

export default ComparisonLab
