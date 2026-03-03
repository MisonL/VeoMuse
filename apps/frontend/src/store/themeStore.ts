import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark' | 'system'

const createSafeStorage = () =>
  createJSONStorage(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage
    }

    return {
      getItem: () => null,
      setItem: (_name, _value) => {},
      removeItem: (_name) => {}
    }
  })

interface ThemeState {
  mode: ThemeMode
  customPalette: Record<string, string>

  // Actions
  setMode: (mode: ThemeMode) => void
  updateCustomPalette: (palette: Record<string, string>) => void
  resetCustomPalette: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'light',
      customPalette: {},

      setMode: (mode) => set({ mode }),

      updateCustomPalette: (palette) =>
        set((state) => ({
          customPalette: { ...state.customPalette, ...palette }
        })),

      resetCustomPalette: () => set({ customPalette: {} })
    }),
    {
      name: 'veomuse-theme-storage',
      storage: createSafeStorage(),
      // 仅在浏览器环境下执行持久化
      skipHydration: typeof window === 'undefined'
    }
  )
)
