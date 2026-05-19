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

interface OpenAiCompatibleResponse {
  id?: string
  operationName?: string
  output_text?: string
  output?: Array<{
    content?: Array<{
      text?: string
      type?: string
    }>
  }>
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

type OpenAiCompatibleProtocol = 'chat' | 'responses'

const DEFAULT_CHAT_PATH = '/v1/chat/completions'
const DEFAULT_RESPONSES_PATH = '/v1/responses'

const trimPathSlashes = (path: string) => path.replace(/\/+$/, '') || '/'

const parseEndpointPath = (path: string) => {
  const raw = path.trim()
  const isAbsolute = /^https?:\/\//i.test(raw)
  try {
    return {
      isAbsolute,
      url: new URL(isAbsolute ? raw : raw.startsWith('/') ? raw : `/${raw}`, 'https://veomuse.local')
    }
  } catch {
    return null
  }
}

const pathEndsWithEndpoint = (path: string, endpoint: string) => {
  const parsed = parseEndpointPath(path)
  if (!parsed) return false
  return trimPathSlashes(parsed.url.pathname).toLowerCase().endsWith(endpoint)
}

const replaceEndpoint = (path: string, fromEndpoint: string, toEndpoint: string) => {
  const parsed = parseEndpointPath(path)
  if (!parsed) return path
  const currentPath = trimPathSlashes(parsed.url.pathname)
  if (!currentPath.toLowerCase().endsWith(fromEndpoint)) return path
  parsed.url.pathname = `${currentPath.slice(0, currentPath.length - fromEndpoint.length)}${toEndpoint}`
  return parsed.isAbsolute
    ? parsed.url.toString()
    : `${parsed.url.pathname}${parsed.url.search}${parsed.url.hash}`
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return fallback
}

export class OpenAiCompatibleDriver implements VideoModelDriver {
  id = 'openai-compatible'
  name = 'OpenAI 兼容（自定义）'

  private resolveUrl(baseUrl: string, path: string) {
    if (/^https?:\/\//i.test(path)) return new URL(path).toString()
    const safePath = path.startsWith('/') ? path : `/${path}`
    return new URL(`${baseUrl.replace(/\/+$/, '')}${safePath}`).toString()
  }

  private resolveProtocol(rawProtocol: unknown, path: string): OpenAiCompatibleProtocol {
    const protocol = String(rawProtocol || '').trim().toLowerCase()
    if (protocol === 'chat' || protocol === 'chat-completions') return 'chat'
    if (protocol === 'responses' || protocol === 'response') return 'responses'
    if (protocol) {
      throw new Error('OpenAI 兼容渠道 protocol 仅支持 chat 或 responses')
    }
    return pathEndsWithEndpoint(path, DEFAULT_RESPONSES_PATH) ? 'responses' : 'chat'
  }

  private resolvePath(rawPath: unknown, protocol: OpenAiCompatibleProtocol) {
    const fallback = protocol === 'responses' ? DEFAULT_RESPONSES_PATH : DEFAULT_CHAT_PATH
    const path = String(rawPath || fallback).trim() || fallback
    if (protocol === 'responses') return replaceEndpoint(path, DEFAULT_CHAT_PATH, DEFAULT_RESPONSES_PATH)
    if (protocol === 'chat') return replaceEndpoint(path, DEFAULT_RESPONSES_PATH, DEFAULT_CHAT_PATH)
    return path
  }

  private buildPayload(protocol: OpenAiCompatibleProtocol, model: string, prompt: string) {
    if (protocol === 'responses') {
      return {
        model,
        input: prompt
      }
    }
    return {
      model,
      messages: [{ role: 'user', content: prompt }]
    }
  }

  private extractResponsesContent(data: OpenAiCompatibleResponse) {
    if (typeof data?.output_text === 'string' && data.output_text.trim()) {
      return data.output_text.trim()
    }

    for (const item of data?.output || []) {
      for (const content of item.content || []) {
        if (typeof content.text === 'string' && content.text.trim()) {
          return content.text.trim()
        }
      }
    }
    return ''
  }

  private extractContent(data: OpenAiCompatibleResponse, protocol: OpenAiCompatibleProtocol) {
    if (protocol === 'responses') {
      return this.extractResponsesContent(data)
    }

    const chatContent = data?.choices?.[0]?.message?.content
    if (typeof chatContent === 'string' && chatContent.trim()) return chatContent.trim()
    return ''
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
    const rawPath = channel?.extra?.path || process.env.OPENAI_COMPATIBLE_PATH
    const rawProtocol = channel?.extra?.protocol || process.env.OPENAI_COMPATIBLE_PROTOCOL
    let protocol: OpenAiCompatibleProtocol
    let path = ''
    try {
      protocol = this.resolveProtocol(rawProtocol, String(rawPath || ''))
      path = this.resolvePath(rawPath, protocol)
    } catch (error: unknown) {
      return {
        success: false,
        status: 'error',
        operationName: '',
        message: 'OpenAI 兼容渠道 protocol 配置错误',
        provider: this.id,
        error: getErrorMessage(error, 'invalid protocol')
      }
    }

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
    const payload: Record<string, unknown> = this.buildPayload(protocol, model, prompt)
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

      const data = (await response.json()) as OpenAiCompatibleResponse
      const content = this.extractContent(data, protocol)
      const message =
        content
          ? `OpenAI 兼容响应：${content.slice(0, 72)}`
          : `OpenAI 兼容模型(${model})调用成功`

      return {
        success: true,
        status: 'ok',
        operationName: data?.id || data?.operationName || `openai_compat_${Date.now()}`,
        message,
        provider: this.id
      }
    } catch (error: unknown) {
      return {
        success: false,
        status: 'error',
        operationName: '',
        message: 'OpenAI 兼容模型网络请求失败',
        provider: this.id,
        error: getErrorMessage(error, 'unknown network error')
      }
    }
  }
}
