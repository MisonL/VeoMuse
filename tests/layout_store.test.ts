import { beforeEach, describe, expect, it } from 'bun:test'
import { LAYOUT_DEFAULTS, LAYOUT_LIMITS, useLayoutStore } from '../apps/frontend/src/store/layoutStore'

describe('布局存储状态验证', () => {
  beforeEach(() => {
    useLayoutStore.getState().resetLayout()
  })

  it('应以默认布局初始化', () => {
    const state = useLayoutStore.getState()
    expect(state.leftPanelPx).toBe(LAYOUT_DEFAULTS.leftPanelPx)
    expect(state.rightPanelPx).toBe(LAYOUT_DEFAULTS.rightPanelPx)
    expect(state.timelinePx).toBe(LAYOUT_DEFAULTS.timelinePx)
  })

  it('应对三块尺寸执行边界限制', () => {
    const state = useLayoutStore.getState()
    state.setLeftPanelPx(999)
    state.setRightPanelPx(-20)
    state.setTimelinePx(999)

    const updated = useLayoutStore.getState()
    expect(updated.leftPanelPx).toBe(LAYOUT_LIMITS.leftPanelPx.max)
    expect(updated.rightPanelPx).toBe(LAYOUT_LIMITS.rightPanelPx.min)
    expect(updated.timelinePx).toBe(LAYOUT_LIMITS.timelinePx.max)
  })

  it('重置布局后应恢复默认值', () => {
    const state = useLayoutStore.getState()
    state.setLeftPanelPx(380)
    state.setRightPanelPx(250)
    state.setTimelinePx(260)
    state.resetLayout()

    const reset = useLayoutStore.getState()
    expect(reset.leftPanelPx).toBe(LAYOUT_DEFAULTS.leftPanelPx)
    expect(reset.rightPanelPx).toBe(LAYOUT_DEFAULTS.rightPanelPx)
    expect(reset.timelinePx).toBe(LAYOUT_DEFAULTS.timelinePx)
  })
})
