import React from 'react'
import { useThemeStore, ThemeMode } from '../../store/themeStore'
import './ThemeSwitcher.css'

const ThemeSwitcher: React.FC = () => {
  const { mode, setMode } = useThemeStore()

  const modes: { id: ThemeMode; label: string; icon: string }[] = [
    { id: 'light', label: '亮色', icon: '☀️' },
    { id: 'dark', label: '暗色', icon: '🌙' },
    { id: 'system', label: '系统', icon: '💻' }
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
          <span className="btn-icon">{m.icon}</span>
          <span className="btn-text">{m.label}</span>
        </button>
      ))}
    </div>
  )
}

export default ThemeSwitcher
