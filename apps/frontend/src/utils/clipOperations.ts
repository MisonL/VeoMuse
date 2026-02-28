import type { Clip } from '@veomuse/shared'

type SupportedClipType = 'text' | 'audio'

interface TranslationPayload {
  translatedText: string
  detectedLang: string
  targetLang: string
}

interface StylePayload {
  stylePreset: string
  styleModel: string
  operationId?: string
}

interface VfxPayload {
  vfxType: string
  vfxIntensity: number
  operationId?: string
}

export const buildTranslatedClipClone = (
  baseClip: Clip,
  payload: TranslationPayload,
  nowMs: number
): Clip => {
  const duration = Math.max(1, baseClip.end - baseClip.start)
  const suffix = `translated-${payload.targetLang}`
  const cloneType = baseClip.type as SupportedClipType

  const nextData: Record<string, unknown> = {
    ...(baseClip.data || {}),
    translatedFrom: payload.detectedLang,
    targetLang: payload.targetLang
  }

  if (cloneType === 'text') {
    nextData.content = payload.translatedText
  }

  return {
    ...baseClip,
    id: `${baseClip.id}-${suffix}-${nowMs}`,
    name: cloneType === 'audio' ? payload.translatedText : `${baseClip.name} (${suffix})`,
    start: baseClip.end,
    end: baseClip.end + duration,
    data: nextData
  }
}

export const applyStyleDataUpdate = (
  clipData: Record<string, unknown> | undefined,
  payload: StylePayload
) => ({
  ...(clipData || {}),
  stylePreset: payload.stylePreset,
  styleModel: payload.styleModel,
  styleOperationId: payload.operationId || ''
})

export const applyVfxDataUpdate = (
  clipData: Record<string, unknown> | undefined,
  payload: VfxPayload
) => ({
  ...(clipData || {}),
  vfxType: payload.vfxType,
  vfxIntensity: payload.vfxIntensity,
  vfxOperationId: payload.operationId || ''
})
