import type {
  GenerateParams,
  GenerateResult,
  GenerateRuntimeContext,
  VideoModelDriver
} from '../ModelDriver'
import { ChannelConfigService } from '../ChannelConfigService'

const toNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export class OpenAiCompatibleDriver implements VideoModelDriver {
  id = 'openai-compatible'
  name = 'OpenAI 兼容（自定义）'

  private DEFAULT_PATH = '/v1/chat/completions'

  private resolveUrl(baseUrl: string, path: string) {
    if (/^https?:\/\//i.test(path)) return new URL(path).toString()
    const safePath = path.startsWith('/') ? path : `/${path}`
    return new URL(`${baseUrl.replace(/\/+$/, '')}${safePath}`).toString()
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

    const baseUrl = String(
      channel?.baseUrl ||
        process.env.OPENAI_COMPATIBLE_BASE_URL ||
        process.env.OPENAI_BASE_URL ||
        ''
    ).trim()
    const apiKey = String(
      channel?.apiKey || process.env.OPENAI_COMPATIBLE_API_KEY || process.env.OPENAI_API_KEY || ''
    ).trim()
    const model = String(
      channel?.extra?.model || process.env.OPENAI_COMPATIBLE_MODEL || process.env.OPENAI_MODEL || ''
    ).trim()
    const path =
      String(
        channel?.extra?.path || process.env.OPENAI_COMPATIBLE_PATH || this.DEFAULT_PATH
      ).trim() || this.DEFAULT_PATH

    const temperature =
      channel?.extra?.temperature !== undefined
        ? toNumber(channel.extra.temperature)
        : toNumber(process.env.OPENAI_COMPATIBLE_TEMPERATURE)

    if (!baseUrl || !apiKey || !model) {
      return {
        success: false,
        status: 'not_implemented',
        operationName: '',
        message: 'OpenAI 兼容渠道未配置完整（需要 Base URL / API Key / model）',
        provider: this.id
      }
    }

    let endpoint = ''
    try {
      endpoint = this.resolveUrl(baseUrl, path)
    } catch {
      return {
        success: false,
        status: 'error',
        operationName: '',
        message: 'OpenAI 兼容渠道 URL 配置错误',
        provider: this.id,
        error: `invalid endpoint: ${baseUrl} + ${path}`
      }
    }

    const rawPrompt = String(params.text || '').trim()
    const mode = params.generationMode || 'text_to_video'
    const promptBase = params.negativePrompt
      ? `${rawPrompt}\n\nNegative prompt: ${params.negativePrompt}`
      : rawPrompt
    const multimodalHint =
      mode !== 'text_to_video' || params.inputs
        ? `\n\n[video_generation]\n${JSON.stringify({
            mode,
            inputs: params.inputs || null,
            options: params.options || {}
          })}`
        : ''
    const prompt = `${promptBase}${multimodalHint}`.trim()
    const payload: Record<string, unknown> = {
      model,
      messages: [{ role: 'user', content: prompt }]
    }
    if (temperature !== null) {
      payload.temperature = Math.min(2, Math.max(0, temperature))
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorText = await response.text()
        return {
          success: false,
          status: 'error',
          operationName: '',
          message: 'OpenAI 兼容模型调用失败',
          provider: this.id,
          error: `HTTP ${response.status}: ${errorText}`
        }
      }

      const data = (await response.json()) as any
      const content = data?.choices?.[0]?.message?.content
      const message =
        typeof content === 'string' && content.trim()
          ? `OpenAI 兼容响应：${content.trim().slice(0, 72)}`
          : `OpenAI 兼容模型(${model})调用成功`

      return {
        success: true,
        status: 'ok',
        operationName: data?.id || data?.operationName || `openai_compat_${Date.now()}`,
        message,
        provider: this.id
      }
    } catch (error: any) {
      return {
        success: false,
        status: 'error',
        operationName: '',
        message: 'OpenAI 兼容模型网络请求失败',
        provider: this.id,
        error: error?.message || 'unknown network error'
      }
    }
  }
}
