// apps/backend/src/services/VfxService.ts
import { BaseAiService } from './BaseAiService'
import type { ChannelRuntimeContext } from './ChannelConfigService'
import { ChannelConfigService } from './ChannelConfigService'

export interface VfxParams {
  clipId: string
  vfxType: string
  intensity?: number
}

interface VfxApplyResponse {
  operationId?: string
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return fallback
}

export class VfxService extends BaseAiService {
  protected serviceName = 'AI-Neural-VFX'
  private static instance = new VfxService()

  static async applyVfx(
    params: VfxParams,
    context?: ChannelRuntimeContext
  ): Promise<{
    success: boolean
    status: 'ok' | 'not_implemented' | 'error'
    operationId: string
    message?: string
    error?: string
  }> {
    const channel = context?.organizationId ? ChannelConfigService.resolve('vfx', context) : null
    const apiUrl = channel?.baseUrl || process.env.VFX_API_URL
    const apiKey = channel?.apiKey || process.env.VFX_API_KEY

    if (!apiUrl || !apiKey) {
      return {
        success: false,
        status: 'not_implemented',
        operationId: '',
        message: 'VFX provider 未配置 (VFX_API_URL / VFX_API_KEY)'
      }
    }

    try {
      const { data } = await this.instance.request<VfxApplyResponse>(
        `${apiUrl.replace(/\/$/, '')}/apply`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify(params)
        }
      )

      return {
        success: true,
        status: 'ok',
        operationId: data.operationId || `vfx_${params.vfxType}_${Date.now()}`
      }
    } catch (error: unknown) {
      return {
        success: false,
        status: 'error',
        operationId: '',
        message: 'VFX 应用失败',
        error: getErrorMessage(error, 'unknown network error')
      }
    }
  }
}
