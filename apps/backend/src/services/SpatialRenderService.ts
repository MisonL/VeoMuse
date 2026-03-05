// apps/backend/src/services/SpatialRenderService.ts
import { BaseAiService } from './BaseAiService'
import type { ChannelRuntimeContext } from './ChannelConfigService'
import { ChannelConfigService } from './ChannelConfigService'

export interface SpatialResult {
  success: boolean
  status?: 'ok' | 'not_implemented' | 'error'
  message?: string
  nerfDataUrl: string
  meshUrl: string
  totalVoxels: number
  error?: string
}

interface SpatialReconstructResponse {
  nerfDataUrl: string
  meshUrl: string
  totalVoxels?: number
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return fallback
}

export class SpatialRenderService extends BaseAiService {
  protected serviceName = 'AI-Spatial-Renderer'
  private static instance = new SpatialRenderService()

  static async reconstruct(
    clipId: string,
    quality: string = 'ultra',
    context?: ChannelRuntimeContext
  ): Promise<SpatialResult> {
    const channel = context?.organizationId
      ? ChannelConfigService.resolve('spatialRender', context)
      : null
    const apiUrl = channel?.baseUrl || process.env.SPATIAL_API_URL
    const apiKey = channel?.apiKey || process.env.SPATIAL_API_KEY

    if (!apiUrl || !apiKey) {
      return {
        success: false,
        status: 'not_implemented',
        message: 'Spatial provider 未配置 (SPATIAL_API_URL / SPATIAL_API_KEY)',
        nerfDataUrl: '',
        meshUrl: '',
        totalVoxels: 0
      }
    }

    try {
      const { data } = await this.instance.request<SpatialReconstructResponse>(
        `${apiUrl.replace(/\/$/, '')}/reconstruct`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({ clipId, quality })
        }
      )

      return {
        success: true,
        status: 'ok',
        nerfDataUrl: data.nerfDataUrl,
        meshUrl: data.meshUrl,
        totalVoxels: data.totalVoxels || 0
      }
    } catch (error: unknown) {
      return {
        success: false,
        status: 'error',
        message: 'Spatial 重构失败',
        nerfDataUrl: '',
        meshUrl: '',
        totalVoxels: 0,
        error: getErrorMessage(error, 'unknown network error')
      }
    }
  }
}
