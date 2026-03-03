import { describe, expect, it } from 'bun:test'
import type { Clip, Track } from '../apps/frontend/src/store/editorStore'
import {
  buildAlchemyRequest,
  extractInspectorErrorMessage,
  resolveAlchemyOutcome,
  resolveSelectedClipContext,
  resolveTranslationResult,
  resolveTranslationSourceText
} from '../apps/frontend/src/components/Editor/propertyInspector.logic'

const styleOptions = {
  stylePreset: 'cinematic' as const,
  styleModel: 'luma-dream' as const,
  vfxType: 'magic-particles' as const,
  vfxIntensity: 0.8
}

describe('PropertyInspector 纯逻辑', () => {
  it('resolveSelectedClipContext 应返回命中片段与轨道', () => {
    const tracks: Track[] = [
      {
        id: 'track-v1',
        name: 'v',
        type: 'video',
        clips: [{ id: 'c1', start: 0, end: 5, src: '', name: 'clip', type: 'video' }]
      },
      { id: 'track-a1', name: 'a', type: 'audio', clips: [] }
    ]
    expect(resolveSelectedClipContext(tracks, 'c1')).toEqual({
      selectedClip: tracks[0].clips[0],
      parentTrackId: 'track-v1'
    })
    expect(resolveSelectedClipContext(tracks, 'missing')).toEqual({
      selectedClip: null,
      parentTrackId: null
    })
  })

  it('extractInspectorErrorMessage 应按优先级提取错误', () => {
    expect(extractInspectorErrorMessage({ error: 'E1' }, 'fallback')).toBe('E1')
    expect(extractInspectorErrorMessage({ message: 'E2' }, 'fallback')).toBe('E2')
    expect(extractInspectorErrorMessage({ reason: 'E3' }, 'fallback')).toBe('E3')
    expect(extractInspectorErrorMessage({ repair: { error: 'E4' } }, 'fallback')).toBe('E4')
    expect(extractInspectorErrorMessage({}, 'fallback')).toBe('fallback')
  })

  it('翻译输入与结果归一化应覆盖 text/audio 场景', () => {
    const textClip: Clip = {
      id: 't1',
      start: 0,
      end: 3,
      src: '',
      name: '字幕',
      type: 'text',
      data: { content: '你好' }
    }
    const audioClip: Clip = {
      id: 'a1',
      start: 0,
      end: 3,
      src: '',
      name: 'voice',
      type: 'audio'
    }
    expect(resolveTranslationSourceText(textClip)).toBe('你好')
    expect(resolveTranslationSourceText(audioClip)).toBe('voice')
    expect(
      resolveTranslationResult(
        { translatedText: 'hello', detectedLang: 'zh', targetLang: 'English' },
        'Japanese'
      )
    ).toEqual({
      translatedText: 'hello',
      detectedLang: 'zh',
      targetLang: 'English'
    })
    expect(resolveTranslationResult({ translatedText: 'hello' }, 'Japanese')).toEqual({
      translatedText: 'hello',
      detectedLang: 'auto',
      targetLang: 'Japanese'
    })
    expect(() => resolveTranslationResult({}, 'Japanese')).toThrow('翻译结果为空')
  })

  it('buildAlchemyRequest 应生成不同能力的请求路径与参数', () => {
    const clip: Clip = {
      id: 'c1',
      start: 0,
      end: 3,
      src: '/tmp/demo.mp4',
      name: 'demo',
      type: 'video',
      data: { content: '字幕内容' }
    }
    expect(buildAlchemyRequest('repair', clip, styleOptions)).toEqual({
      path: '/api/ai/repair',
      body: { description: 'demo' }
    })
    expect(buildAlchemyRequest('style', clip, styleOptions)).toEqual({
      path: '/api/ai/alchemy/style-transfer',
      body: { clipId: 'c1', style: 'cinematic', referenceModel: 'luma-dream' }
    })
    expect(buildAlchemyRequest('vfx', clip, styleOptions)).toEqual({
      path: '/api/ai/vfx/apply',
      body: { clipId: 'c1', vfxType: 'magic-particles', intensity: 0.8 }
    })
  })

  it('resolveAlchemyOutcome 应处理 warning/error/success 与 dataUpdate', () => {
    expect(
      resolveAlchemyOutcome(
        'repair',
        { status: 'not_implemented', message: '未配置' },
        {},
        styleOptions
      )
    ).toEqual({
      toastLevel: 'warning',
      toastMessage: '未配置'
    })
    expect(
      resolveAlchemyOutcome('repair', { success: false, message: '失败' }, {}, styleOptions)
    ).toEqual({
      toastLevel: 'error',
      toastMessage: '失败'
    })

    const styleSuccess = resolveAlchemyOutcome(
      'style',
      { success: true, operationId: 'op-style' },
      { previous: true },
      styleOptions
    )
    expect(styleSuccess.toastLevel).toBe('success')
    expect(styleSuccess.dataUpdate).toEqual({
      previous: true,
      stylePreset: 'cinematic',
      styleModel: 'luma-dream',
      styleOperationId: 'op-style'
    })

    const vfxSuccess = resolveAlchemyOutcome(
      'vfx',
      { success: true, operationId: 'op-vfx' },
      {},
      styleOptions
    )
    expect(vfxSuccess.dataUpdate).toEqual({
      vfxType: 'magic-particles',
      vfxIntensity: 0.8,
      vfxOperationId: 'op-vfx'
    })
  })
})
