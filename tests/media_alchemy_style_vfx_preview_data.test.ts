import { describe, expect, it } from 'bun:test'
import { applyStyleDataUpdate, applyVfxDataUpdate } from '../apps/frontend/src/utils/clipOperations'

describe('媒体炼金术前端回写数据', () => {
  it('风格迁移成功后应回写 stylePreset/styleModel/styleOperationId', () => {
    const updated = applyStyleDataUpdate(
      { foo: 'bar', stylePreset: 'cinematic' },
      {
        stylePreset: 'cyberpunk',
        styleModel: 'luma-dream',
        operationId: 'style-op-123'
      }
    )

    expect(updated.foo).toBe('bar')
    expect(updated.stylePreset).toBe('cyberpunk')
    expect(updated.styleModel).toBe('luma-dream')
    expect(updated.styleOperationId).toBe('style-op-123')
  })

  it('VFX 应用成功后应回写 vfxType/vfxIntensity/vfxOperationId', () => {
    const updated = applyVfxDataUpdate(
      { stylePreset: 'cyberpunk' },
      {
        vfxType: 'neon-bloom',
        vfxIntensity: 0.7,
        operationId: 'vfx-op-9'
      }
    )

    expect(updated.stylePreset).toBe('cyberpunk')
    expect(updated.vfxType).toBe('neon-bloom')
    expect(updated.vfxIntensity).toBe(0.7)
    expect(updated.vfxOperationId).toBe('vfx-op-9')
  })
})
