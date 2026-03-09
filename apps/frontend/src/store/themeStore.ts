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
      setItem: (name, value) => {
        void name
        void value
      },
      removeItem: (name) => {
        void name
      }
    }
  })

interface ThemeState {
  mode: ThemeMode
  customPalette: Record<string, string>
  setMode: (mode: ThemeMode) => void
  updateCustomPalette: (palette: Record<string, string>) => void
  resetCustomPalette: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'dark',
      customPalette: {},
      setMode: (mode) => set({ mode }),
      updateCustomPalette: (palette) =>
        set((state) => ({
          customPalette: { ...state.customPalette, ...palette }
        })),
      resetCustomPalette: () => set({ customPalette: {} })
    }),
    {
      name: 'veomuse-theme-storage-v2',
      storage: createSafeStorage(),
      skipHydration: typeof window === 'undefined'
    }
  )
)
