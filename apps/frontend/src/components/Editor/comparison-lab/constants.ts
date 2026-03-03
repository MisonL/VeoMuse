import type { PolicyWeightState } from './types'

export const MODEL_CAPABILITY_ROWS: Array<{ id: string; label: string; env: string }> = [
  { id: 'veo-3.1', label: 'Gemini Veo 3.1', env: 'GEMINI_API_KEYS' },
  { id: 'kling-v1', label: 'Kling V1', env: 'KLING_API_URL + KLING_API_KEY' },
  { id: 'sora-preview', label: 'Sora Preview', env: 'SORA_API_URL + SORA_API_KEY' },
  { id: 'luma-dream', label: 'Luma Dream', env: 'LUMA_API_URL + LUMA_API_KEY' },
  { id: 'runway-gen3', label: 'Runway Gen-3', env: 'RUNWAY_API_URL + RUNWAY_API_KEY' },
  { id: 'pika-1.5', label: 'Pika 1.5', env: 'PIKA_API_URL + PIKA_API_KEY' },
  { id: 'openai-compatible', label: 'OpenAI 兼容（自定义）', env: 'Base URL + API Key + model' }
]

export const SERVICE_CAPABILITY_ROWS: Array<{ id: string; label: string; env: string }> = [
  { id: 'tts', label: 'TTS 配音', env: 'TTS_API_URL + TTS_API_KEY' },
  { id: 'voiceMorph', label: '音色迁移', env: 'VOICE_MORPH_API_URL + VOICE_MORPH_API_KEY' },
  { id: 'spatialRender', label: '空间重构', env: 'SPATIAL_API_URL + SPATIAL_API_KEY' },
  { id: 'vfx', label: 'VFX 特效', env: 'VFX_API_URL + VFX_API_KEY' },
  { id: 'lipSync', label: '口型同步', env: 'LIP_SYNC_API_URL + LIP_SYNC_API_KEY' },
  {
    id: 'audioAnalysis',
    label: '音频分析',
    env: 'AUDIO_ANALYSIS_API_URL + AUDIO_ANALYSIS_API_KEY'
  },
  { id: 'relighting', label: '重光照', env: 'RELIGHT_API_URL + RELIGHT_API_KEY' },
  { id: 'styleTransfer', label: '风格迁移', env: 'ALCHEMY_API_URL + ALCHEMY_API_KEY' }
]

export const POLICY_EXEC_PAGE_SIZE = 12

export const POLICY_BUDGET_GUARD_LABELS: Record<
  'ok' | 'warning' | 'critical' | 'degraded',
  string
> = {
  ok: '预算安全',
  warning: '预算预警',
  critical: '预算超限',
  degraded: '自动降级'
}

export const DEFAULT_POLICY_WEIGHTS: PolicyWeightState = {
  quality: 0.45,
  speed: 0.2,
  cost: 0.15,
  reliability: 0.2
}
