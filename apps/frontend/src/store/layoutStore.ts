import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { clamp } from '../utils/layoutMath'

const createSafeStorage = () => createJSONStorage(() => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage
  }

  return {
    getItem: () => null,
    setItem: (_name, _value) => {},
    removeItem: (_name) => {}
  }
})

export const LAYOUT_DEFAULTS = {
  leftPanelPx: 460,
  rightPanelPx: 420,
  timelinePx: 336
} as const

export const LAYOUT_LIMITS = {
  leftPanelPx: { min: 280, max: 620 },
  rightPanelPx: { min: 260, max: 580 },
  timelinePx: { min: 240, max: 460 }
} as const

interface LayoutState {
  leftPanelPx: number
  rightPanelPx: number
  timelinePx: number
  setLeftPanelPx: (px: number) => void
  setRightPanelPx: (px: number) => void
  setTimelinePx: (px: number) => void
  resetLayout: () => void
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      ...LAYOUT_DEFAULTS,
      setLeftPanelPx: (px) => set({
        leftPanelPx: clamp(px, LAYOUT_LIMITS.leftPanelPx.min, LAYOUT_LIMITS.leftPanelPx.max)
      }),
      setRightPanelPx: (px) => set({
        rightPanelPx: clamp(px, LAYOUT_LIMITS.rightPanelPx.min, LAYOUT_LIMITS.rightPanelPx.max)
      }),
      setTimelinePx: (px) => set({
        timelinePx: clamp(px, LAYOUT_LIMITS.timelinePx.min, LAYOUT_LIMITS.timelinePx.max)
      }),
      resetLayout: () => set({ ...LAYOUT_DEFAULTS })
    }),
    {
      name: 'veomuse-layout-storage-v3',
      storage: createSafeStorage(),
      skipHydration: typeof window === 'undefined'
    }
  )
)
