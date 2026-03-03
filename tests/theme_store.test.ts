import { describe, it, expect, beforeEach } from 'bun:test'
import { useThemeStore } from '../apps/frontend/src/store/themeStore'

describe('ThemeStore 状态管理验证 (Phase 2)', () => {
  beforeEach(() => {
    // 每次测试前重置 Store 状态 (由于 Zustand persist 可能影响测试，需手动重置)
    useThemeStore.setState({
      mode: 'light',
      customPalette: {}
    })
  })

  it('Store 应能正确初始化默认状态', () => {
    const state = useThemeStore.getState()
    expect(state.mode).toBe('light')
    expect(state.customPalette).toEqual({})
  })

  it('setMode 应能切换主题模式', () => {
    const { setMode } = useThemeStore.getState()

    setMode('dark')
    expect(useThemeStore.getState().mode).toBe('dark')

    setMode('light')
    expect(useThemeStore.getState().mode).toBe('light')
  })

  it('updateCustomPalette 应能更新自定义色板', () => {
    const { updateCustomPalette } = useThemeStore.getState()

    updateCustomPalette({ '--ap-bg': '#ff0000' })
    expect(useThemeStore.getState().customPalette['--ap-bg']).toBe('#ff0000')
  })
})
