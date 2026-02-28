import { describe, expect, it } from 'bun:test'
import { calcAspectFit, clamp } from '../apps/frontend/src/utils/layoutMath'

describe('布局数学工具验证', () => {
  it('clamp 应按上下界限制值', () => {
    expect(clamp(12, 0, 10)).toBe(10)
    expect(clamp(-3, 0, 10)).toBe(0)
    expect(clamp(6, 0, 10)).toBe(6)
  })

  it('calcAspectFit 应在标准 16:9 容器内输出满幅', () => {
    const fit = calcAspectFit(1920, 1080)
    expect(fit).toEqual({ width: 1920, height: 1080 })
  })

  it('calcAspectFit 应在高容器内按宽度等比收敛', () => {
    const fit = calcAspectFit(1200, 1000)
    expect(fit.width).toBe(1200)
    expect(fit.height).toBe(675)
  })

  it('calcAspectFit 应在矮容器内按高度等比收敛', () => {
    const fit = calcAspectFit(700, 200)
    expect(fit.height).toBe(200)
    expect(fit.width).toBe(356)
  })

  it('calcAspectFit 输入非法尺寸时返回 0', () => {
    expect(calcAspectFit(0, 100)).toEqual({ width: 0, height: 0 })
    expect(calcAspectFit(100, 0)).toEqual({ width: 0, height: 0 })
    expect(calcAspectFit(Number.NaN, 100)).toEqual({ width: 0, height: 0 })
  })
})
