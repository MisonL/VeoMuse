import { useEffect } from 'react'
import { useThemeStore, ThemeMode } from '../store/themeStore'

export const useThemeSync = () => {
  const { mode, customPalette } = useThemeStore()

  useEffect(() => {
    const applyTheme = (resolvedMode: 'light' | 'dark') => {
      document.documentElement.setAttribute('data-theme', resolvedMode)
      
      // 应用自定义色板 (如果有)
      Object.entries(customPalette).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value)
      })
    }

    const handleSystemChange = (e: MediaQueryListEvent) => {
      if (mode === 'system') {
        applyTheme(e.matches ? 'dark' : 'light')
      }
    }

    if (mode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      applyTheme(mediaQuery.matches ? 'dark' : 'light')
      mediaQuery.addEventListener('change', handleSystemChange)
      return () => mediaQuery.removeEventListener('change', handleSystemChange)
    } else {
      applyTheme(mode as 'light' | 'dark')
    }
  }, [mode, customPalette])
}
