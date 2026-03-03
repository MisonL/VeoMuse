import { describe, expect, it } from 'bun:test'
import { useEditorStore } from '../apps/frontend/src/store/editorStore'

describe('空间预览模式状态验证', () => {
  it('默认应为 2D 预览', () => {
    const state = useEditorStore.getState()
    expect(state.isSpatialPreview).toBe(false)
    expect(state.spatialCamera.yaw).toBe(0)
    expect(state.spatialCamera.pitch).toBe(0)
  })

  it('应支持切换 3D 预览并更新相机参数', () => {
    const { setSpatialPreview, setSpatialCamera } = useEditorStore.getState()

    setSpatialPreview(true)
    setSpatialCamera({ yaw: 12, pitch: -6, scale: 1.05 })

    const next = useEditorStore.getState()
    expect(next.isSpatialPreview).toBe(true)
    expect(next.spatialCamera.yaw).toBe(12)
    expect(next.spatialCamera.pitch).toBe(-6)
    expect(next.spatialCamera.scale).toBe(1.05)
  })
})
