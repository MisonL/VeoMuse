// apps/backend/src/services/drivers/PikaDriver.ts
import type {
  VideoModelDriver,
  GenerateParams,
  GenerateResult,
  GenerateRuntimeContext
} from '../ModelDriver'
import { ChannelConfigService } from '../ChannelConfigService'

export class PikaDriver implements VideoModelDriver {
  id = 'pika-1.5'
  name = 'Pika Art 1.5'

  async generate(
    params: GenerateParams,
    context?: GenerateRuntimeContext
  ): Promise<GenerateResult> {
    const prompt = String(params.text || '').trim()
    const effect = params.options?.creativeEffect || 'squish'
    const channel = context?.organizationId
      ? ChannelConfigService.resolve(this.id, {
          organizationId: context.organizationId,
          workspaceId: context.workspaceId
        })
      : null
    const apiUrl = channel?.baseUrl || process.env.PIKA_API_URL
    const apiKey = channel?.apiKey || process.env.PIKA_API_KEY

    if (!apiUrl || !apiKey) {
      return {
        success: false,
        status: 'not_implemented',
        operationName: '',
        message: 'Pika provider 未配置 (PIKA_API_URL / PIKA_API_KEY)',
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
          effect,
          options: params.options || {}
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        return {
          success: false,
          status: 'error',
          operationName: '',
          message: 'Pika 生成失败',
          provider: this.id,
          error: `HTTP ${response.status}: ${errorText}`
        }
      }

      const data = (await response.json()) as any
      return {
        success: true,
        status: 'ok',
        operationName: data.operationName || data.id || `pika_${Date.now()}`,
        message: data.message || `Pika 创意渲染任务已提交，当前应用特效：${effect}`,
        provider: this.id
      }
    } catch (error: any) {
      return {
        success: false,
        status: 'error',
        operationName: '',
        message: 'Pika 网络请求失败',
        provider: this.id,
        error: error.message
      }
    }
  }
}
