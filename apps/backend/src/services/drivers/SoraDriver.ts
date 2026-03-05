// apps/backend/src/services/drivers/SoraDriver.ts
import type {
  VideoModelDriver,
  GenerateParams,
  GenerateResult,
  GenerateRuntimeContext
} from '../ModelDriver'
import { ChannelConfigService } from '../ChannelConfigService'

interface SoraGenerateResponse {
  operationName?: string
  id?: string
  message?: string
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return fallback
}

export class SoraDriver implements VideoModelDriver {
  id = 'sora-preview'
  name = 'OpenAI Sora (Preview)'

  async generate(
    params: GenerateParams,
    context?: GenerateRuntimeContext
  ): Promise<GenerateResult> {
    const prompt = String(params.text || '').trim()
    const channel = context?.organizationId
      ? ChannelConfigService.resolve(this.id, {
          organizationId: context.organizationId,
          workspaceId: context.workspaceId
        })
      : null
    const apiUrl = channel?.baseUrl || process.env.SORA_API_URL
    const apiKey = channel?.apiKey || process.env.SORA_API_KEY

    if (!apiUrl || !apiKey) {
      return {
        success: false,
        status: 'not_implemented',
        operationName: '',
        message: 'Sora provider 未配置 (SORA_API_URL / SORA_API_KEY)',
        provider: this.id
      }
    }

    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          prompt,
          negative_prompt: params.negativePrompt,
          generationMode: params.generationMode || 'text_to_video',
          inputs: params.inputs || {},
          options: params.options || {}
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        return {
          success: false,
          status: 'error',
          operationName: '',
          message: 'Sora 生成失败',
          provider: this.id,
          error: `HTTP ${response.status}: ${errorText}`
        }
      }

      const data = (await response.json()) as SoraGenerateResponse
      return {
        success: true,
        status: 'ok',
        operationName: data.operationName || data.id || `sora_${Date.now()}`,
        message: data.message || 'Sora 高清渲染任务已提交',
        provider: this.id
      }
    } catch (error: unknown) {
      return {
        success: false,
        status: 'error',
        operationName: '',
        message: 'Sora 网络请求失败',
        provider: this.id,
        error: getErrorMessage(error, 'unknown network error')
      }
    }
  }
}
