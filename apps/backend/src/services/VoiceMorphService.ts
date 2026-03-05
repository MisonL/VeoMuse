// apps/backend/src/services/VoiceMorphService.ts
import { BaseAiService } from './BaseAiService'
import type { ChannelRuntimeContext } from './ChannelConfigService'
import { ChannelConfigService } from './ChannelConfigService'

interface VoiceMorphResponse {
  morphedAudioUrl?: string
  audioUrl?: string
}

interface VoiceMorphResult {
  success: boolean
  status: 'ok' | 'not_implemented' | 'error'
  morphedAudioUrl?: string
  message?: string
  error?: string
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return fallback
}

export class VoiceMorphService extends BaseAiService {
  protected serviceName = 'AI-Voice-Morpher'
  private static instance = new VoiceMorphService()

  static async morph(
    audioUrl: string,
    targetVoiceId: string,
    context?: ChannelRuntimeContext
  ): Promise<VoiceMorphResult> {
    const channel = context?.organizationId
      ? ChannelConfigService.resolve('voiceMorph', context)
      : null
    const apiUrl = channel?.baseUrl || process.env.VOICE_MORPH_API_URL
    const apiKey = channel?.apiKey || process.env.VOICE_MORPH_API_KEY

    if (!apiUrl || !apiKey) {
      return {
        success: false,
        status: 'not_implemented',
        message: 'Voice Morph provider 未配置 (VOICE_MORPH_API_URL / VOICE_MORPH_API_KEY)'
      }
    }

    try {
      const { data } = await this.instance.request<VoiceMorphResponse>(
        `${apiUrl.replace(/\/$/, '')}/morph`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({ audioUrl, targetVoiceId })
        }
      )
      return {
        success: true,
        status: 'ok',
        morphedAudioUrl: data.morphedAudioUrl || data.audioUrl
      }
    } catch (error: unknown) {
      return {
        success: false,
        status: 'error',
        message: '音色迁移网络请求失败',
        error: getErrorMessage(error, 'unknown network error')
      }
    }
  }
}
