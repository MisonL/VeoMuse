import type { ChannelFormState, VideoInputSourceType } from './types'

type WarningReporter = (message: string) => void

export const buildIdempotencyKey = (action: string) => {
  const uuid =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  return `${action}:${uuid}`
}

export const parseJsonObjectInput = (
  raw: string,
  fieldName: string,
  reportWarning: WarningReporter
): Record<string, unknown> | null => {
  const text = raw.trim()
  if (!text) return {}
  try {
    const parsed = JSON.parse(text) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      reportWarning(`${fieldName} 必须是 JSON 对象`)
      return null
    }
    return parsed as Record<string, unknown>
  } catch {
    reportWarning(`${fieldName} 解析失败，请检查 JSON 格式`)
    return null
  }
}

export const parseJsonArrayInput = (
  raw: string,
  fieldName: string,
  reportWarning: WarningReporter
): unknown[] | null => {
  const text = raw.trim()
  if (!text) return []
  try {
    const parsed = JSON.parse(text) as unknown
    if (!Array.isArray(parsed)) {
      reportWarning(`${fieldName} 必须是 JSON 数组`)
      return null
    }
    return parsed
  } catch {
    reportWarning(`${fieldName} 解析失败，请检查 JSON 格式`)
    return null
  }
}

export const parseMentionsInput = (raw: string) => {
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )
}

export const parseVideoReferenceInputs = (raw: string) => {
  return raw
    .split(/[\n,]/g)
    .map((item) => item.trim())
    .filter(Boolean)
}

export const normalizeVideoSourceInput = (raw: string, sourceType: VideoInputSourceType) => {
  const value = raw.trim()
  if (!value) return undefined
  return {
    sourceType,
    value
  } as const
}

export const buildChannelExtra = (providerId: string, form: ChannelFormState) => {
  if (providerId !== 'openai-compatible') return {}
  const model = form.model.trim()
  const path = form.path.trim()
  const temperatureRaw = form.temperature.trim()
  const extra: Record<string, unknown> = {}
  if (model) extra.model = model
  if (path) extra.path = path
  if (temperatureRaw) extra.temperature = Number(temperatureRaw)
  return extra
}

export const validateChannelForm = (
  providerId: string,
  form: ChannelFormState,
  reportWarning: WarningReporter
) => {
  if (providerId !== 'openai-compatible' || !form.enabled) return true
  if (!form.model.trim()) {
    reportWarning('OpenAI 兼容渠道必须填写 model')
    return false
  }
  const temperatureRaw = form.temperature.trim()
  if (!temperatureRaw) return true
  const temperature = Number(temperatureRaw)
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    reportWarning('temperature 需在 0 到 2 之间')
    return false
  }
  return true
}
