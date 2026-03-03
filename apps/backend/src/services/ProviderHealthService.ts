import { ProviderHttpClient, type ProviderErrorCode } from './providers/ProviderHttpClient'

export type ProviderHealthCategory = 'model' | 'service'
export type ProviderHealthStatus = 'ok' | 'degraded' | 'not_implemented'

export interface ProviderHealthItem {
  providerId: string
  label: string
  category: ProviderHealthCategory
  configured: boolean
  status: ProviderHealthStatus
  baseUrl: string | null
  checkedAt: string
  latencyMs: number | null
  statusCode: number | null
  traceId: string | null
  errorCode: ProviderErrorCode | null
  error: string | null
}

interface ProviderDescriptor {
  providerId: string
  label: string
  category: ProviderHealthCategory
  envBaseUrl?: string
  envApiKey?: string
  fallbackBaseUrl?: string
  fallbackApiKey?: string
  staticConfigured?: () => boolean
}

const configured = (value?: string) => Boolean(value && value.trim().length > 0)

const DESCRIPTORS: ProviderDescriptor[] = [
  {
    providerId: 'veo-3.1',
    label: 'Gemini Veo 3.1',
    category: 'model',
    staticConfigured: () => configured(process.env.GEMINI_API_KEYS)
  },
  {
    providerId: 'kling-v1',
    label: 'Kling V1',
    category: 'model',
    envBaseUrl: 'KLING_API_URL',
    envApiKey: 'KLING_API_KEY'
  },
  {
    providerId: 'sora-preview',
    label: 'Sora Preview',
    category: 'model',
    envBaseUrl: 'SORA_API_URL',
    envApiKey: 'SORA_API_KEY'
  },
  {
    providerId: 'luma-dream',
    label: 'Luma Dream',
    category: 'model',
    envBaseUrl: 'LUMA_API_URL',
    envApiKey: 'LUMA_API_KEY'
  },
  {
    providerId: 'runway-gen3',
    label: 'Runway Gen-3',
    category: 'model',
    envBaseUrl: 'RUNWAY_API_URL',
    envApiKey: 'RUNWAY_API_KEY'
  },
  {
    providerId: 'pika-1.5',
    label: 'Pika 1.5',
    category: 'model',
    envBaseUrl: 'PIKA_API_URL',
    envApiKey: 'PIKA_API_KEY'
  },
  {
    providerId: 'openai-compatible',
    label: 'OpenAI Compatible',
    category: 'model',
    envBaseUrl: 'OPENAI_COMPATIBLE_BASE_URL',
    envApiKey: 'OPENAI_COMPATIBLE_API_KEY',
    fallbackBaseUrl: 'OPENAI_BASE_URL',
    fallbackApiKey: 'OPENAI_API_KEY'
  },
  {
    providerId: 'tts',
    label: 'TTS',
    category: 'service',
    envBaseUrl: 'TTS_API_URL',
    envApiKey: 'TTS_API_KEY'
  },
  {
    providerId: 'voiceMorph',
    label: 'Voice Morph',
    category: 'service',
    envBaseUrl: 'VOICE_MORPH_API_URL',
    envApiKey: 'VOICE_MORPH_API_KEY'
  },
  {
    providerId: 'spatialRender',
    label: 'Spatial Render',
    category: 'service',
    envBaseUrl: 'SPATIAL_API_URL',
    envApiKey: 'SPATIAL_API_KEY'
  },
  {
    providerId: 'vfx',
    label: 'VFX',
    category: 'service',
    envBaseUrl: 'VFX_API_URL',
    envApiKey: 'VFX_API_KEY'
  },
  {
    providerId: 'lipSync',
    label: 'Lip Sync',
    category: 'service',
    envBaseUrl: 'LIP_SYNC_API_URL',
    envApiKey: 'LIP_SYNC_API_KEY'
  },
  {
    providerId: 'audioAnalysis',
    label: 'Audio Analysis',
    category: 'service',
    envBaseUrl: 'AUDIO_ANALYSIS_API_URL',
    envApiKey: 'AUDIO_ANALYSIS_API_KEY'
  },
  {
    providerId: 'relighting',
    label: 'Relighting',
    category: 'service',
    envBaseUrl: 'RELIGHT_API_URL',
    envApiKey: 'RELIGHT_API_KEY'
  },
  {
    providerId: 'styleTransfer',
    label: 'Style Transfer',
    category: 'service',
    envBaseUrl: 'ALCHEMY_API_URL',
    envApiKey: 'ALCHEMY_API_KEY'
  }
]

const resolveEnvPair = (descriptor: ProviderDescriptor) => {
  const base = descriptor.envBaseUrl ? String(process.env[descriptor.envBaseUrl] || '').trim() : ''
  const key = descriptor.envApiKey ? String(process.env[descriptor.envApiKey] || '').trim() : ''

  if (base || key) return { base, key }

  const fallbackBase = descriptor.fallbackBaseUrl
    ? String(process.env[descriptor.fallbackBaseUrl] || '').trim()
    : ''
  const fallbackKey = descriptor.fallbackApiKey
    ? String(process.env[descriptor.fallbackApiKey] || '').trim()
    : ''

  return { base: fallbackBase, key: fallbackKey }
}

const toNotImplemented = (descriptor: ProviderDescriptor): ProviderHealthItem => ({
  providerId: descriptor.providerId,
  label: descriptor.label,
  category: descriptor.category,
  configured: false,
  status: 'not_implemented',
  baseUrl: null,
  checkedAt: new Date().toISOString(),
  latencyMs: null,
  statusCode: null,
  traceId: null,
  errorCode: null,
  error: 'provider 未配置'
})

export class ProviderHealthService {
  static listDescriptors() {
    return DESCRIPTORS.map((item) => ({
      providerId: item.providerId,
      label: item.label,
      category: item.category
    }))
  }

  static async inspect(providerId?: string) {
    const selected = providerId
      ? DESCRIPTORS.filter((item) => item.providerId === providerId)
      : DESCRIPTORS

    const results = await Promise.all(
      selected.map(async (descriptor) => {
        if (descriptor.staticConfigured) {
          const ok = descriptor.staticConfigured()
          if (!ok) return toNotImplemented(descriptor)
          return {
            providerId: descriptor.providerId,
            label: descriptor.label,
            category: descriptor.category,
            configured: true,
            status: 'ok' as ProviderHealthStatus,
            baseUrl: null,
            checkedAt: new Date().toISOString(),
            latencyMs: null,
            statusCode: null,
            traceId: null,
            errorCode: null,
            error: null
          }
        }

        const { base, key } = resolveEnvPair(descriptor)
        if (!configured(base) || !configured(key)) {
          return toNotImplemented(descriptor)
        }

        const probe = await ProviderHttpClient.probe(base, {
          Authorization: `Bearer ${key}`
        })

        return {
          providerId: descriptor.providerId,
          label: descriptor.label,
          category: descriptor.category,
          configured: true,
          status: probe.reachable ? 'ok' : 'degraded',
          baseUrl: base,
          checkedAt: new Date().toISOString(),
          latencyMs: probe.latencyMs,
          statusCode: probe.statusCode,
          traceId: probe.traceId,
          errorCode: probe.errorCode || null,
          error: probe.error || null
        }
      })
    )

    return results
  }
}
