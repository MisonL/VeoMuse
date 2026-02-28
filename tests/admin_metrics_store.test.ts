import { describe, expect, it } from 'bun:test'
import { computeMetricsPollDelay } from '../apps/frontend/src/store/adminMetricsStore'

describe('AdminMetricsStore 轮询退避策略', () => {
  it('应按指数退避增长并保持上限', () => {
    expect(computeMetricsPollDelay(0)).toBe(2000)
    expect(computeMetricsPollDelay(1)).toBe(4000)
    expect(computeMetricsPollDelay(2)).toBe(8000)
    expect(computeMetricsPollDelay(4)).toBe(30000)
    expect(computeMetricsPollDelay(12)).toBe(30000)
  })

  it('负值输入应回落到基础轮询间隔', () => {
    expect(computeMetricsPollDelay(-3)).toBe(2000)
  })
})
