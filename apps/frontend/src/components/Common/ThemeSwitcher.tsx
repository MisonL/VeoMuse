import React from 'react'
import { useThemeStore } from '../../store/themeStore'
import type { ThemeMode } from '../../store/themeStore'
import './ThemeSwitcher.css'

const ThemeSwitcher: React.FC = () => {
  const { mode, setMode } = useThemeStore()

  const modes: { id: ThemeMode; label: string; shortLabel: string }[] = [
    { id: 'light', label: '亮色', shortLabel: '亮' },
    { id: 'dark', label: '暗色', shortLabel: '暗' },
    { id: 'system', label: '系统', shortLabel: '系' }
  ]

  return (
    <div className="theme-switcher-pro">
      {modes.map((m) => (
        <button
          key={m.id}
          className={`theme-btn ${mode === m.id ? 'active' : ''}`}
          onClick={() => setMode(m.id)}
          title={m.label}
        >
          <span className="btn-dot" aria-hidden>
            {m.shortLabel}
          </span>
          <span className="btn-text">{m.label}</span>
        </button>
      ))}
    </div>
  )
}

export default ThemeSwitcher
