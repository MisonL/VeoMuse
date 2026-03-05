// apps/backend/src/services/LipSyncService.ts
import { BaseAiService } from './BaseAiService'
import type { ChannelRuntimeContext } from './ChannelConfigService'
import { ChannelConfigService } from './ChannelConfigService'

interface LipSyncResponse {
  syncedVideoUrl?: string
  operationId?: string
}

interface LipSyncResult {
  success: boolean
  status: 'ok' | 'not_implemented' | 'error'
  syncedVideoUrl?: string
  operationId?: string
  message?: string
  error?: string
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return fallback
}

export class LipSyncService extends BaseAiService {
  protected serviceName = 'AI-Lip-Sync'
  private static instance = new LipSyncService()

  static async sync(
    videoUrl: string,
    audioUrl: string,
    precision: string = 'high',
    context?: ChannelRuntimeContext
  ): Promise<LipSyncResult> {
    const channel = context?.organizationId
      ? ChannelConfigService.resolve('lipSync', context)
      : null
    const apiUrl = channel?.baseUrl || process.env.LIP_SYNC_API_URL
    const apiKey = channel?.apiKey || process.env.LIP_SYNC_API_KEY

    if (!apiUrl || !apiKey) {
      return {
        success: false,
        status: 'not_implemented',
        message: 'Lip Sync provider 未配置 (LIP_SYNC_API_URL / LIP_SYNC_API_KEY)'
      }
    }

    try {
      const { data } = await this.instance.request<LipSyncResponse>(
        `${apiUrl.replace(/\/$/, '')}/sync`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({ videoUrl, audioUrl, precision })
        }
      )

      return {
        success: true,
        status: 'ok',
        syncedVideoUrl: data.syncedVideoUrl,
        operationId: data.operationId || `lip_${Date.now()}`
      }
    } catch (error: unknown) {
      return {
        success: false,
        status: 'error',
        message: 'Lip Sync 失败',
        error: getErrorMessage(error, 'unknown network error')
      }
    }
  }
}
