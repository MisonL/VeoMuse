import React, { useCallback, useEffect, useRef } from 'react'

interface ResizeHandleProps {
  axis: 'x' | 'y'
  onDrag: (delta: number) => void
  ariaLabel: string
  className?: string
  disabled?: boolean
}

const ResizeHandle: React.FC<ResizeHandleProps> = ({ axis, onDrag, ariaLabel, className, disabled = false }) => {
  const pointerIdRef = useRef<number | null>(null)
  const lastOffsetRef = useRef(0)

  const clearDraggingState = useCallback(() => {
    pointerIdRef.current = null
    document.body.classList.remove('resizing-x', 'resizing-y')
  }, [])

  useEffect(() => {
    return () => {
      clearDraggingState()
    }
  }, [clearDraggingState])

  const getOffset = (event: React.PointerEvent<HTMLDivElement>) => (
    axis === 'x' ? event.clientX : event.clientY
  )

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return
    event.preventDefault()
    pointerIdRef.current = event.pointerId
    lastOffsetRef.current = getOffset(event)
    event.currentTarget.setPointerCapture(event.pointerId)
    document.body.classList.add(axis === 'x' ? 'resizing-x' : 'resizing-y')
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || pointerIdRef.current !== event.pointerId) return
    const next = getOffset(event)
    const delta = next - lastOffsetRef.current
    lastOffsetRef.current = next
    if (delta !== 0) onDrag(delta)
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return
    clearDraggingState()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    if (axis === 'x' && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault()
      const step = event.shiftKey ? 24 : 10
      onDrag(event.key === 'ArrowLeft' ? -step : step)
    }
    if (axis === 'y' && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault()
      const step = event.shiftKey ? 24 : 10
      onDrag(event.key === 'ArrowUp' ? -step : step)
    }
  }

  return (
    <div
      role="separator"
      aria-label={ariaLabel}
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      className={`resize-handle resize-handle-${axis} ${className || ''} ${disabled ? 'disabled' : ''}`.trim()}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
    />
  )
}

export default ResizeHandle
