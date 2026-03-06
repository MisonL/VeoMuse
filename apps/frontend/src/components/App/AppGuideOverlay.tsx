import type { CSSProperties } from 'react'
import type { GuideStep } from '../../utils/appHelpers'

interface AppGuideOverlayProps {
  currentGuideStep: GuideStep
  guideStepIndex: number
  guideStepCount: number
  guideHighlightStyle?: CSSProperties
  guideCardStyle?: CSSProperties
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}

const AppGuideOverlay = ({
  currentGuideStep,
  guideStepIndex,
  guideStepCount,
  guideHighlightStyle,
  guideCardStyle,
  onClose,
  onPrev,
  onNext
}: AppGuideOverlayProps) => (
  <div
    className="guide-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="新手引导"
    data-testid="area-guide-overlay"
  >
    <div className="guide-dim" />
    {guideHighlightStyle ? <div className="guide-highlight" style={guideHighlightStyle} /> : null}
    <section className="guide-card" style={guideCardStyle}>
      <div className="guide-card-head">
        <span className="guide-step">
          步骤 {guideStepIndex + 1} / {guideStepCount}
        </span>
        <button type="button" className="guide-close" onClick={onClose}>
          跳过
        </button>
      </div>
      <h3>{currentGuideStep.title}</h3>
      <p>{currentGuideStep.description}</p>
      <div className="guide-actions">
        {currentGuideStep.actionLabel && currentGuideStep.onAction ? (
          <button type="button" className="guide-action" onClick={currentGuideStep.onAction}>
            {currentGuideStep.actionLabel}
          </button>
        ) : null}
        <button
          type="button"
          className="guide-nav"
          onClick={onPrev}
          disabled={guideStepIndex === 0}
        >
          上一步
        </button>
        <button type="button" className="guide-nav primary" onClick={onNext}>
          {guideStepIndex === guideStepCount - 1 ? '完成引导' : '下一步'}
        </button>
      </div>
    </section>
  </div>
)

export default AppGuideOverlay
