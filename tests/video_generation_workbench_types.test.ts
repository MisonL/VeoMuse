import { describe, expect, it } from 'bun:test'
import {
  resolveGeminiQuickCheck,
  resolveVideoGenerationRequiredInputs
} from '../apps/frontend/src/components/Editor/comparison-lab/types'

describe('视频工作台类型分支', () => {
  it('resolveVideoGenerationRequiredInputs: 四种模式应返回预期必填输入', () => {
    expect(resolveVideoGenerationRequiredInputs('text_to_video')).toEqual([])
    expect(resolveVideoGenerationRequiredInputs('image_to_video')).toEqual([
      'image_or_referenceImages'
    ])
    expect(resolveVideoGenerationRequiredInputs('video_extend')).toEqual(['video'])
    expect(resolveVideoGenerationRequiredInputs('first_last_frame_transition')).toEqual([
      'firstFrame',
      'lastFrame'
    ])
  })

  it('resolveGeminiQuickCheck: 应覆盖 unknown/ready/missing 状态', () => {
    expect(resolveGeminiQuickCheck(null)).toEqual({
      status: 'unknown',
      title: 'Gemini 可用性未知',
      description: '先点击“Gemini 快速自检”刷新 /api/capabilities。'
    })

    expect(resolveGeminiQuickCheck({ models: { 'veo-3.1': true } })).toEqual({
      status: 'ready',
      title: 'Gemini Veo 3.1 已就绪',
      description: '可直接创建视频生成任务。'
    })

    expect(resolveGeminiQuickCheck({ models: { 'veo-3.1': false } })).toEqual({
      status: 'missing',
      title: 'Gemini Veo 3.1 未就绪',
      description: '请在渠道接入面板配置 Gemini Key/Endpoint 后重试。'
    })
  })
})
