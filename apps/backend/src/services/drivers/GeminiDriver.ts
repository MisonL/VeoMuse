// apps/backend/src/services/drivers/GeminiDriver.ts
import type {
  VideoModelDriver,
  GenerateParams,
  GenerateResult,
  GenerateRuntimeContext,
  VideoGenerationInputSource
} from '../ModelDriver'
import { ApiKeyService } from '../ApiKeyService'
import { ChannelConfigService } from '../ChannelConfigService'

export class GeminiDriver implements VideoModelDriver {
  id = 'veo-3.1'
  name = 'Google Gemini Veo 3.1'

  private API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

  private toProviderMediaInput(source?: VideoGenerationInputSource) {
    if (!source) return undefined
    return {
      uri: source.resolvedUrl,
      mimeType: source.mimeType
    }
  }

  async generate(
    params: GenerateParams,
    context?: GenerateRuntimeContext
  ): Promise<GenerateResult> {
    const channel = context?.organizationId
      ? ChannelConfigService.resolve(this.id, {
          organizationId: context.organizationId,
          workspaceId: context.workspaceId
        })
      : null
    const channelKeys = channel?.apiKey
      ? channel.apiKey
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : []
    const keys = channelKeys.length ? channelKeys : ApiKeyService.getAvailableKeys()
    const apiBase = channel?.baseUrl?.trim() ? channel.baseUrl.replace(/\/$/, '') : this.API_BASE
    if (!keys.length) {
      return {
        success: false,
        status: 'not_implemented',
        operationName: '',
        message: 'Gemini provider 未配置 GEMINI_API_KEYS',
        provider: this.id
      }
    }

    let lastError: Error | null = null

    for (const key of keys) {
      try {
        const configuredModel = String(
          channel?.extra?.model || process.env.GEMINI_VIDEO_MODEL || ''
        ).trim()
        const modelName = configuredModel || 'veo-3.1-generate-001'
        const url = `${apiBase}/${modelName}:predictLongRunning?key=${key}`
        const prompt = String(params.text || '').trim()
        const mode = params.generationMode || 'text_to_video'
        const source: Record<string, unknown> = {}
        if (prompt) source.prompt = prompt
        const sourceImage = params.inputs?.image || params.inputs?.firstFrame
        if (sourceImage) {
          source.image = this.toProviderMediaInput(sourceImage)
        }
        if (params.inputs?.video) {
          source.video = this.toProviderMediaInput(params.inputs.video)
        }

        const referenceImages = (params.inputs?.referenceImages || [])
          .map((item) => this.toProviderMediaInput(item))
          .filter(Boolean)
        const config: Record<string, unknown> = {
          ...(params.options || {})
        }
        if (params.negativePrompt) config.negativePrompt = params.negativePrompt
        if (params.inputs?.lastFrame) {
          config.lastFrame = this.toProviderMediaInput(params.inputs.lastFrame)
        }
        if (referenceImages.length) {
          config.referenceImages = referenceImages
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            generationMode: mode,
            source,
            config,
            contents: [
              {
                parts: [
                  {
                    text: params.negativePrompt
                      ? `${prompt}\n\nNegative: ${params.negativePrompt}`
                      : prompt
                  }
                ]
              }
            ]
          })
        })

        if (!response.ok) {
          const errorData = (await response.json()) as any
          throw new Error(errorData?.error?.message || `Gemini API Error: ${response.status}`)
        }

        const data = (await response.json()) as any
        return {
          success: true,
          status: 'ok',
          operationName: data.name,
          message: 'Gemini 生成任务已提交',
          provider: this.id
        }
      } catch (error: any) {
        lastError = error
        continue
      }
    }

    return {
      success: false,
      status: 'error',
      operationName: '',
      message: 'Gemini 请求失败',
      provider: this.id,
      error: lastError?.message || 'Gemini API 密钥均不可用'
    }
  }
}
