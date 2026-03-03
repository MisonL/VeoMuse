import { describe, it, expect } from 'bun:test'
import { useEditorStore } from '../apps/frontend/src/store/editorStore'

describe('素材中心 (Asset Hub) 逻辑验证', () => {
  it('Store 应能存储并初始化资产列表', () => {
    const state = useEditorStore.getState()
    expect(state.assets).toBeDefined()
    expect(Array.isArray(state.assets)).toBe(true)
  })

  it('addAsset 应能向库中添加新素材', () => {
    const { addAsset } = useEditorStore.getState()
    addAsset({
      id: 'asset-1',
      name: '极光视频',
      src: 'aurora.mp4',
      type: 'video'
    })

    expect(useEditorStore.getState().assets.length).toBeGreaterThan(0)
  })
})
