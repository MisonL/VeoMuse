import { describe, expect, it } from 'bun:test'
import type { Clip } from '@veomuse/shared'
import { buildTranslatedClipClone } from '../apps/frontend/src/utils/clipOperations'

const baseTextClip: Clip = {
  id: 'clip-text-1',
  type: 'text',
  name: '原文',
  start: 5,
  end: 11,
  src: '',
  data: {
    content: '清晨女孩走出咖啡店。'
  }
}

const baseAudioClip: Clip = {
  id: 'clip-audio-1',
  type: 'audio',
  name: '清晨女孩走出咖啡店。',
  start: 3,
  end: 8,
  src: 'https://cdn.local/a.mp3',
  data: {}
}

describe('前端翻译克隆逻辑', () => {
  it('文本片段翻译后应克隆并写入 translated 内容与来源语言', () => {
    const cloned = buildTranslatedClipClone(baseTextClip, {
      translatedText: 'A girl walks out of the cafe at dawn.',
      detectedLang: 'Chinese',
      targetLang: 'English'
    }, 123456)

    expect(cloned.id).toContain('translated-English-123456')
    expect(cloned.start).toBe(baseTextClip.end)
    expect(cloned.end).toBe(baseTextClip.end + (baseTextClip.end - baseTextClip.start))
    expect(cloned.data?.content).toBe('A girl walks out of the cafe at dawn.')
    expect(cloned.data?.translatedFrom).toBe('Chinese')
    expect(cloned.data?.targetLang).toBe('English')
  })

  it('音频片段翻译后应克隆并将 name 改为翻译文本', () => {
    const cloned = buildTranslatedClipClone(baseAudioClip, {
      translatedText: 'A girl walks out of the cafe at dawn.',
      detectedLang: 'Chinese',
      targetLang: 'English'
    }, 7890)

    expect(cloned.name).toBe('A girl walks out of the cafe at dawn.')
    expect(cloned.start).toBe(baseAudioClip.end)
    expect(cloned.end).toBe(baseAudioClip.end + (baseAudioClip.end - baseAudioClip.start))
    expect(cloned.data?.translatedFrom).toBe('Chinese')
    expect(cloned.data?.targetLang).toBe('English')
  })
})
