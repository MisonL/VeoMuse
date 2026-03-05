// apps/backend/src/services/RelightingService.ts
import { BaseAiService } from './BaseAiService'
import type { ChannelRuntimeContext } from './ChannelConfigService'
import { ChannelConfigService } from './ChannelConfigService'

interface RelightingApplyResponse {
  operationId?: string
}

interface RelightingResult {
  success: boolean
  status: 'ok' | 'not_implemented' | 'error'
  operationId?: string
  message?: string
  error?: string
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return fallback
}

export class RelightingService extends BaseAiService {
  protected serviceName = 'AI-Relighting-Engine'
  private static instance = new RelightingService()

  static async applyRelighting(
    clipId: string,
    style: string,
    context?: ChannelRuntimeContext
  ): Promise<RelightingResult> {
    const channel = context?.organizationId
      ? ChannelConfigService.resolve('relighting', context)
      : null
    const apiUrl = channel?.baseUrl || process.env.RELIGHT_API_URL
    const apiKey = channel?.apiKey || process.env.RELIGHT_API_KEY

    if (!apiUrl || !apiKey) {
      return {
        success: false,
        status: 'not_implemented',
        message: 'Relighting provider 未配置 (RELIGHT_API_URL / RELIGHT_API_KEY)'
      }
    }

    try {
      const { data } = await this.instance.request<RelightingApplyResponse>(
        `${apiUrl.replace(/\/$/, '')}/apply`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({ clipId, style })
        }
      )

      return {
        success: true,
        status: 'ok',
        operationId: data.operationId || `relight_${Date.now()}`
      }
    } catch (error: unknown) {
      return {
        success: false,
        status: 'error',
        message: 'Relighting 失败',
        error: getErrorMessage(error, 'unknown network error')
      }
    }
  }
}
