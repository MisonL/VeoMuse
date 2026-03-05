import { describe, expect, it } from 'bun:test'
import {
  normalizeVideoGenerationDisplayText,
  resolveVideoGenerationPollingState,
  resolveVideoGenerationStatusBadgeModifier
} from '../apps/frontend/src/components/Editor/comparison-lab/modes/CreativeModePanel'

describe('创意模式面板任务展示逻辑', () => {
  it('应将任务状态映射为可视化徽标类型', () => {
    expect(resolveVideoGenerationStatusBadgeModifier('queued')).toBe('active')
    expect(resolveVideoGenerationStatusBadgeModifier('submitted')).toBe('active')
    expect(resolveVideoGenerationStatusBadgeModifier('processing')).toBe('active')
    expect(resolveVideoGenerationStatusBadgeModifier('succeeded')).toBe('success')
    expect(resolveVideoGenerationStatusBadgeModifier('failed')).toBe('failed')
    expect(resolveVideoGenerationStatusBadgeModifier('cancel_requested')).toBe('warning')
    expect(resolveVideoGenerationStatusBadgeModifier('canceled')).toBe('neutral')
  })

  it('应按轮询开关与刷新状态生成提示文案', () => {
    expect(
      resolveVideoGenerationPollingState({
        pollingEnabled: true,
        ticking: false
      })
    ).toEqual({
      tone: 'idle',
      text: '自动轮询待机'
    })
    expect(
      resolveVideoGenerationPollingState({
        pollingEnabled: true,
        ticking: true
      })
    ).toEqual({
      tone: 'active',
      text: '自动轮询刷新中'
    })
    expect(
      resolveVideoGenerationPollingState({
        pollingEnabled: false,
        ticking: true
      })
    ).toEqual({
      tone: 'paused',
      text: '自动轮询已关闭'
    })
  })

  it('应归一化任务文本并提供回退值', () => {
    expect(normalizeVideoGenerationDisplayText('  prompt   text   ')).toBe('prompt text')
    expect(normalizeVideoGenerationDisplayText('')).toBe('-')
    expect(normalizeVideoGenerationDisplayText(null, '暂无')).toBe('暂无')
  })
})
