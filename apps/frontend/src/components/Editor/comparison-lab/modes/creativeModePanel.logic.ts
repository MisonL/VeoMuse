import type { VideoGenerationJobStatus } from '../types'

export type VideoGenerationStatusBadgeModifier =
  | 'active'
  | 'success'
  | 'failed'
  | 'warning'
  | 'neutral'

export type VideoGenerationPollingState = {
  tone: 'active' | 'idle' | 'paused'
  text: string
}

export const resolveVideoGenerationStatusBadgeModifier = (
  status: VideoGenerationJobStatus
): VideoGenerationStatusBadgeModifier => {
  if (status === 'succeeded') return 'success'
  if (status === 'failed') return 'failed'
  if (status === 'cancel_requested') return 'warning'
  if (status === 'canceled') return 'neutral'
  return 'active'
}

export const resolveVideoGenerationPollingState = (params: {
  pollingEnabled: boolean
  ticking: boolean
}): VideoGenerationPollingState => {
  if (!params.pollingEnabled) {
    return {
      tone: 'paused',
      text: '自动轮询已关闭'
    }
  }
  if (params.ticking) {
    return {
      tone: 'active',
      text: '自动轮询刷新中'
    }
  }
  return {
    tone: 'idle',
    text: '自动轮询待机'
  }
}

export const normalizeVideoGenerationDisplayText = (value: unknown, fallback = '-') => {
  const normalized = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!normalized) return fallback
  return normalized
}
