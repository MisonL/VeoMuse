import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { clamp } from '../utils/layoutMath'
import type { CenterPanelMode, PreviewAspect, TopBarDensity } from '../types/layout'

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
  leftPanelPx: 360,
  rightPanelPx: 300,
  timelinePx: 272,
  centerMode: 'fit' as CenterPanelMode,
  topBarDensity: 'comfortable' as TopBarDensity,
  previewAspect: '16:9' as PreviewAspect
} as const

export const LAYOUT_LIMITS = {
  leftPanelPx: { min: 280, max: 760 },
  rightPanelPx: { min: 260, max: 680 },
  timelinePx: { min: 220, max: 520 }
} as const

interface LayoutState {
  leftPanelPx: number
  rightPanelPx: number
  timelinePx: number
  centerMode: CenterPanelMode
  topBarDensity: TopBarDensity
  previewAspect: PreviewAspect
  setLeftPanelPx: (px: number) => void
  setRightPanelPx: (px: number) => void
  setTimelinePx: (px: number) => void
  setCenterMode: (mode: CenterPanelMode) => void
  setTopBarDensity: (density: TopBarDensity) => void
  setPreviewAspect: (aspect: PreviewAspect) => void
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
      setCenterMode: (centerMode) => set({ centerMode }),
      setTopBarDensity: (topBarDensity) => set({ topBarDensity }),
      setPreviewAspect: (previewAspect) => set({ previewAspect }),
      resetLayout: () => set({ ...LAYOUT_DEFAULTS })
    }),
    {
      name: 'veomuse-layout-storage-v9',
      storage: createSafeStorage(),
      skipHydration: typeof window === 'undefined'
    }
  )
)
