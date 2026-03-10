import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import path from 'path'
import { useThemeStore } from '../apps/frontend/src/store/themeStore'

describe('亮色主题与视觉令牌验证', () => {
  it('ThemeStore 默认模式应为 dark', () => {
    expect(useThemeStore.getState().mode).toBe('dark')
  })

  it('theme.css 应以亮色变量为默认并提供 dark 覆盖', () => {
    const cssPath = path.resolve(process.cwd(), 'apps/frontend/src/theme.css')
    const content = readFileSync(cssPath, 'utf8')
    expect(content).toContain(':root')
    expect(content).toContain('color-scheme: light')
    expect(content).toContain("[data-theme='dark']")
    expect(content).toContain('--ap-accent')
    expect(content).toContain('--ap-transition-fast')
  })

  it('App 不应再内联注入主题变量块', () => {
    const appPath = path.resolve(process.cwd(), 'apps/frontend/src/App.tsx')
    const content = readFileSync(appPath, 'utf8')
    expect(content.includes('<style>{`')).toBe(false)
    expect(content).toContain("import './App.css'")
  })
})
