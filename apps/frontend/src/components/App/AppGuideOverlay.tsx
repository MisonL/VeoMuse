import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react'
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

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ')

const AppGuideOverlay = ({
  currentGuideStep,
  guideStepIndex,
  guideStepCount,
  guideHighlightStyle,
  guideCardStyle,
  onClose,
  onPrev,
  onNext
}: AppGuideOverlayProps) => {
  const dialogRef = useRef<HTMLElement | null>(null)
  const primaryActionRef = useRef<HTMLButtonElement | null>(null)
  const previousFocusedElementRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const activeElement = document.activeElement
    previousFocusedElementRef.current = activeElement instanceof HTMLElement ? activeElement : null

    window.requestAnimationFrame(() => {
      primaryActionRef.current?.focus()
    })

    return () => {
      window.requestAnimationFrame(() => {
        previousFocusedElementRef.current?.focus()
      })
    }
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key !== 'Tab') return
    const container = dialogRef.current
    if (!container) return
    const focusableElements = Array.from(
      container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter((element) => !element.hasAttribute('disabled') && element.tabIndex !== -1)
    if (focusableElements.length === 0) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]
    const activeElement = document.activeElement

    if (event.shiftKey && activeElement === firstElement) {
      event.preventDefault()
      lastElement?.focus()
      return
    }

    if (!event.shiftKey && activeElement === lastElement) {
      event.preventDefault()
      firstElement?.focus()
    }
  }

  return (
    <div
      className="guide-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="新手引导"
      data-testid="area-guide-overlay"
    >
      <div className="guide-dim" />
      {guideHighlightStyle ? <div className="guide-highlight" style={guideHighlightStyle} /> : null}
      <section
        ref={dialogRef}
        className="guide-card"
        style={guideCardStyle}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
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
          <button
            ref={primaryActionRef}
            type="button"
            className="guide-nav primary"
            onClick={onNext}
          >
            {guideStepIndex === guideStepCount - 1 ? '完成引导' : '下一步'}
          </button>
        </div>
      </section>
    </div>
  )
}

export default AppGuideOverlay
