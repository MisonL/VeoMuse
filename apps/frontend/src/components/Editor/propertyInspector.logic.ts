import type { Clip, Track } from '../../store/editorStore'
import { applyStyleDataUpdate, applyVfxDataUpdate } from '../../utils/clipOperations'

export type AlchemyActionType = 'repair' | 'style' | 'lip' | 'enhance' | 'audio' | 'tts' | 'vfx'

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

const asNonEmptyString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value : null

export const resolveSelectedClipContext = (tracks: Track[], selectedClipId: string | null) => {
  if (!selectedClipId) {
    return {
      selectedClip: null as Clip | null,
      parentTrackId: null as string | null
    }
  }
  for (const track of tracks) {
    const clip = track.clips.find((item) => item.id === selectedClipId)
    if (clip) {
      return {
        selectedClip: clip,
        parentTrackId: track.id
      }
    }
  }
  return {
    selectedClip: null as Clip | null,
    parentTrackId: null as string | null
  }
}

export const extractInspectorErrorMessage = (payload: unknown, fallback: string) => {
  const row = asRecord(payload)
  if (!row) return fallback
  const directError = asNonEmptyString(row.error)
  if (directError) return directError
  const directMessage = asNonEmptyString(row.message)
  if (directMessage) return directMessage
  const directReason = asNonEmptyString(row.reason)
  if (directReason) return directReason
  const repair = asRecord(row.repair)
  const repairError = asNonEmptyString(repair?.error)
  if (repairError) return repairError
  return fallback
}

export const resolveTranslationSourceText = (clip: Clip) => {
  if (clip.type === 'text') return clip.data?.content || clip.name
  return clip.name
}

export const resolveTranslationResult = (
  payload:
    | { translatedText?: string; detectedLang?: string; targetLang?: string }
    | null
    | undefined,
  fallbackTargetLang: string
) => {
  if (!payload?.translatedText) throw new Error('翻译结果为空')
  return {
    translatedText: payload.translatedText,
    detectedLang: payload.detectedLang || 'auto',
    targetLang: payload.targetLang || fallbackTargetLang
  }
}

export const buildAlchemyRequest = (
  type: AlchemyActionType,
  clip: Clip,
  options: {
    stylePreset: 'cinematic' | 'van_gogh' | 'cyberpunk'
    styleModel: 'luma-dream' | 'kling-v1' | 'veo-3.1'
    vfxType: 'magic-particles' | 'cyber-glitch' | 'neon-bloom'
    vfxIntensity: number
  }
) => {
  switch (type) {
    case 'repair':
      return {
        path: '/api/ai/repair',
        body: { description: clip.name }
      }
    case 'style':
      return {
        path: '/api/ai/alchemy/style-transfer',
        body: {
          clipId: clip.id,
          style: options.stylePreset,
          referenceModel: options.styleModel
        }
      }
    case 'lip':
      return {
        path: '/api/ai/sync-lip',
        body: {
          videoUrl: clip.src,
          audioUrl: clip.src
        }
      }
    case 'enhance':
      return {
        path: '/api/ai/enhance',
        body: { prompt: clip.name }
      }
    case 'audio':
      return {
        path: '/api/ai/analyze-audio',
        body: { audioUrl: clip.src }
      }
    case 'tts':
      return {
        path: '/api/ai/tts',
        body: { text: clip.data?.content || '' }
      }
    case 'vfx':
      return {
        path: '/api/ai/vfx/apply',
        body: {
          clipId: clip.id,
          vfxType: options.vfxType,
          intensity: options.vfxIntensity
        }
      }
  }
}

export const resolveAlchemyOutcome = (
  type: AlchemyActionType,
  payload: unknown,
  clipData: Clip['data'],
  options: {
    stylePreset: 'cinematic' | 'van_gogh' | 'cyberpunk'
    styleModel: 'luma-dream' | 'kling-v1' | 'veo-3.1'
    vfxType: 'magic-particles' | 'cyber-glitch' | 'neon-bloom'
    vfxIntensity: number
  }
) => {
  const payloadRecord = asRecord(payload)
  const status = asNonEmptyString(payloadRecord?.status)
  const message = asNonEmptyString(payloadRecord?.message)
  const operationId = asNonEmptyString(payloadRecord?.operationId) || ''
  if (status === 'not_implemented') {
    return {
      toastLevel: 'warning' as const,
      toastMessage: message || '该能力未配置 provider'
    }
  }
  if (payloadRecord?.success === false) {
    return {
      toastLevel: 'error' as const,
      toastMessage: message || '该能力执行失败'
    }
  }

  let dataUpdate: Record<string, unknown> | undefined
  if (type === 'style') {
    dataUpdate = applyStyleDataUpdate(clipData, {
      stylePreset: options.stylePreset,
      styleModel: options.styleModel,
      operationId
    })
  }
  if (type === 'vfx') {
    dataUpdate = applyVfxDataUpdate(clipData, {
      vfxType: options.vfxType,
      vfxIntensity: options.vfxIntensity,
      operationId
    })
  }
  return {
    toastLevel: 'success' as const,
    toastMessage: `✨ ${type} 炼金成功`,
    dataUpdate
  }
}
