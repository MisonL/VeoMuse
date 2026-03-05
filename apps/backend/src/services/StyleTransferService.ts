import { BaseAiService } from './BaseAiService'
import type { ChannelRuntimeContext } from './ChannelConfigService'
import { ChannelConfigService } from './ChannelConfigService'

export interface StyleTransferParams {
  clipId: string
  style: string
  referenceModel?: 'luma-dream' | 'kling-v1' | 'veo-3.1'
}

export interface StyleTransferResult {
  success: boolean
  status: 'ok' | 'not_implemented' | 'error'
  operationId: string
  style?: string
  message?: string
  error?: string
}

interface StyleTransferResponse {
  operationId?: string
  message?: string
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return fallback
}

export class StyleTransferService extends BaseAiService {
  protected serviceName = 'AI-Style-Transfer'
  private static instance = new StyleTransferService()

  static async transfer(
    params: StyleTransferParams,
    context?: ChannelRuntimeContext
  ): Promise<StyleTransferResult> {
    const channel = context?.organizationId
      ? ChannelConfigService.resolve('styleTransfer', context)
      : null
    const apiUrl = channel?.baseUrl || process.env.ALCHEMY_API_URL
    const apiKey = channel?.apiKey || process.env.ALCHEMY_API_KEY

    if (!apiUrl || !apiKey) {
      return {
        success: false,
        status: 'not_implemented',
        operationId: '',
        style: params.style,
        message: 'Style Transfer provider 未配置 (ALCHEMY_API_URL / ALCHEMY_API_KEY)'
      }
    }

    try {
      const { data } = await this.instance.request<StyleTransferResponse>(
        `${apiUrl.replace(/\/$/, '')}/style-transfer`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            clipId: params.clipId,
            style: params.style,
            referenceModel: params.referenceModel || 'luma-dream'
          })
        }
      )
      return {
        success: true,
        status: 'ok',
        operationId: data.operationId || `style_${Date.now()}`,
        style: params.style,
        message: data.message || '风格迁移任务已提交'
      }
    } catch (error: unknown) {
      return {
        success: false,
        status: 'error',
        operationId: '',
        style: params.style,
        message: 'Style Transfer 网络请求失败',
        error: getErrorMessage(error, 'unknown network error')
      }
    }
  }
}
