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
    summary: '同一批素材在两路模型上并行接入，先判断差异，再决定是否继续放量。'
  },
  marketplace: {
    index: '02',
    label: '策略治理',
    summary: '把路由、预算和治理面板接到同一条实验总线，统一处理策略决策。'
  },
  creative: {
    index: '03',
    label: '创意闭环',
    summary: '让提示词、工作流、生成结果和资产复用围绕同一创意工位形成闭环。'
  },
  collab: {
    index: '04',
    label: '协作平台',
    summary: '成员、事件流与治理动作汇入同一条协作频道，形成多人联动闭环。'
  }
} as const

const LAB_STAGE_ORDER = [
  { mode: 'compare', short: '比对' },
  { mode: 'marketplace', short: '治理' },
  { mode: 'creative', short: '创意' },
  { mode: 'collab', short: '协作' }
] as const

const LAB_STAGE_STATUS_LABEL = {
  current: '当前工位',
  completed: '热备工位',
  available: '待接入'
} as const

const resolveStageStatus = (stageIndex: number, currentStageIndex: number) => {
  if (stageIndex === currentStageIndex) return 'current'
  if (stageIndex < currentStageIndex) return 'completed'
  return 'available'
}

const focusStageButton = (mode: (typeof LAB_STAGE_ORDER)[number]['mode']) => {
  window.requestAnimationFrame(() => {
    const nextButton = document.getElementById(`lab-tab-${mode}`)
    if (nextButton instanceof HTMLButtonElement) {
      nextButton.focus()
    }
  })
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
  const activeStageMeta = LAB_STAGE_META[labMode]
  const activeStageState =
    labMode === 'compare'
      ? '适合先完成模型判断'
      : labMode === 'marketplace'
        ? '优先检查路由、预算与策略命中'
        : labMode === 'creative'
          ? '把主描述、版本链和工作流收进同一工位'
          : '先建立协作频道，再接入治理动作'
  const handleStageKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    stageIndex: number
  ) => {
    let nextIndex = stageIndex
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (stageIndex + 1) % LAB_STAGE_ORDER.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (stageIndex - 1 + LAB_STAGE_ORDER.length) % LAB_STAGE_ORDER.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = LAB_STAGE_ORDER.length - 1
    } else {
      return
    }

    event.preventDefault()
    const nextMode = LAB_STAGE_ORDER[nextIndex]?.mode
    if (!nextMode) return
    toolbarProps.onModeChange(nextMode)
    focusStageButton(nextMode)
  }

  return (
    <div className="comparison-lab-pro" data-testid="area-comparison-lab" data-lab-mode={labMode}>
      <div className="lab-stage-shell">
        <aside className="lab-stage-spine">
          <div className="lab-stage-rail-head">
            <span className="lab-stage-rail-kicker">实验总控工位</span>
            <strong>工位索引</strong>
            <p className="lab-stage-rail-note">四个工位共用同一条实验总线，按当前目标切换。</p>
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
                  onKeyDown={(event) => handleStageKeyDown(event, stageIndex)}
                >
                  <span className="lab-stage-marker-index">{LAB_STAGE_META[stage.mode].index}</span>
                  <span className="lab-stage-marker-copy">
                    <span className="lab-stage-marker-header">
                      <span className="lab-stage-marker-label">{stage.short}</span>
                      <span className={`lab-stage-state-chip lab-stage-state-chip--${status}`}>
                        {status === 'current'
                          ? '当前工位'
                          : status === 'completed'
                            ? '热备'
                            : '待接入'}
                      </span>
                    </span>
                    <span className="lab-stage-marker-state">{LAB_STAGE_STATUS_LABEL[status]}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </aside>
        <div className="lab-stage-main">
          <div className="lab-stage-hero">
            <div className="lab-stage-hero-copy">
              <span className="lab-stage-hero-kicker">实验总控工位 / 当前总线</span>
              <div className="lab-stage-hero-headline">
                <strong>{activeStageMeta.label}</strong>
                <span className="lab-stage-hero-chip">总线在线</span>
              </div>
              <p>{activeStageMeta.summary}</p>
            </div>
            <div className="lab-stage-hero-status">
              <div className="lab-stage-hero-card">
                <span>当前工位</span>
                <strong>{activeStageMeta.index}</strong>
              </div>
              <div className="lab-stage-hero-card">
                <span>当前任务</span>
                <strong>{activeStageState}</strong>
              </div>
            </div>
          </div>

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
