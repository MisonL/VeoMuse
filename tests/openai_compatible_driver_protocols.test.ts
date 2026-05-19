import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { ChannelConfigService } from '../apps/backend/src/services/ChannelConfigService'
import { OpenAiCompatibleDriver } from '../apps/backend/src/services/drivers/OpenAiCompatibleDriver'

const ENV_KEYS = [
  'OPENAI_COMPATIBLE_BASE_URL',
  'OPENAI_COMPATIBLE_API_KEY',
  'OPENAI_COMPATIBLE_MODEL',
  'OPENAI_COMPATIBLE_PATH',
  'OPENAI_COMPATIBLE_PROTOCOL',
  'OPENAI_COMPATIBLE_TEMPERATURE',
  'OPENAI_BASE_URL',
  'OPENAI_API_KEY',
  'OPENAI_MODEL'
] as const

describe('OpenAI 兼容渠道协议支持', () => {
  const envBackup: Record<string, string | undefined> = {}
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
    for (const key of ENV_KEYS) {
      envBackup[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    for (const key of ENV_KEYS) {
      const previous = envBackup[key]
      if (previous === undefined) delete process.env[key]
      else process.env[key] = previous
    }
  })

  it('默认 chat 协议应调用 chat/completions 并发送 messages', async () => {
    const calls: Array<{ url: string; body: any }> = []
    process.env.OPENAI_COMPATIBLE_BASE_URL = 'https://mock-openai.local'
    process.env.OPENAI_COMPATIBLE_API_KEY = 'test-key'
    process.env.OPENAI_COMPATIBLE_MODEL = 'gpt-compatible'

    globalThis.fetch = mock((url: string, init?: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init?.body || '{}')) })
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: 'chatcmpl_1',
            choices: [{ message: { content: 'chat ok' } }]
          })
        )
      )
    }) as typeof fetch

    const result = await new OpenAiCompatibleDriver().generate({ text: '生成一段视频提示词' })

    expect(result.status).toBe('ok')
    expect(result.operationName).toBe('chatcmpl_1')
    expect(calls[0].url).toBe('https://mock-openai.local/v1/chat/completions')
    expect(calls[0].body.model).toBe('gpt-compatible')
    expect(calls[0].body.messages).toEqual([
      { role: 'user', content: '生成一段视频提示词' }
    ])
    expect(calls[0].body.input).toBeUndefined()
  })

  it('responses 协议应调用 responses endpoint 并发送 input', async () => {
    const calls: Array<{ url: string; body: any }> = []
    process.env.OPENAI_COMPATIBLE_BASE_URL = 'https://mock-openai.local'
    process.env.OPENAI_COMPATIBLE_API_KEY = 'test-key'
    process.env.OPENAI_COMPATIBLE_MODEL = 'gpt-compatible'
    process.env.OPENAI_COMPATIBLE_PROTOCOL = 'responses'

    globalThis.fetch = mock((url: string, init?: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init?.body || '{}')) })
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: 'resp_1',
            output: [
              {
                content: [
                  {
                    type: 'output_text',
                    text: 'responses ok'
                  }
                ]
              }
            ]
          })
        )
      )
    }) as typeof fetch

    const result = await new OpenAiCompatibleDriver().generate({
      text: '生成一段视频提示词',
      negativePrompt: '低清晰度'
    })

    expect(result.status).toBe('ok')
    expect(result.operationName).toBe('resp_1')
    expect(result.message).toContain('responses ok')
    expect(calls[0].url).toBe('https://mock-openai.local/v1/responses')
    expect(calls[0].body.model).toBe('gpt-compatible')
    expect(calls[0].body.input).toContain('生成一段视频提示词')
    expect(calls[0].body.input).toContain('Negative prompt: 低清晰度')
    expect(calls[0].body.messages).toBeUndefined()
  })

  it('responses 协议不应从 chat 响应结构静默提取内容', async () => {
    process.env.OPENAI_COMPATIBLE_BASE_URL = 'https://mock-openai.local'
    process.env.OPENAI_COMPATIBLE_API_KEY = 'test-key'
    process.env.OPENAI_COMPATIBLE_MODEL = 'gpt-compatible'
    process.env.OPENAI_COMPATIBLE_PROTOCOL = 'responses'

    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            id: 'resp_wrong_schema',
            choices: [{ message: { content: 'chat schema should not be used' } }]
          })
        )
      )
    ) as typeof fetch

    const result = await new OpenAiCompatibleDriver().generate({ text: '生成一段视频提示词' })

    expect(result.status).toBe('ok')
    expect(result.message).not.toContain('chat schema should not be used')
    expect(result.message).toBe('OpenAI 兼容模型(gpt-compatible)调用成功')
  })

  it('chat 协议不应从 responses 响应结构静默提取内容', async () => {
    process.env.OPENAI_COMPATIBLE_BASE_URL = 'https://mock-openai.local'
    process.env.OPENAI_COMPATIBLE_API_KEY = 'test-key'
    process.env.OPENAI_COMPATIBLE_MODEL = 'gpt-compatible'
    process.env.OPENAI_COMPATIBLE_PROTOCOL = 'chat'

    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            id: 'chat_wrong_schema',
            output_text: 'responses schema should not be used'
          })
        )
      )
    ) as typeof fetch

    const result = await new OpenAiCompatibleDriver().generate({ text: '生成一段视频提示词' })

    expect(result.status).toBe('ok')
    expect(result.message).not.toContain('responses schema should not be used')
    expect(result.message).toBe('OpenAI 兼容模型(gpt-compatible)调用成功')
  })

  it('responses 协议遇到旧默认 chat path 时应改用 responses endpoint', async () => {
    const calls: Array<{ url: string; body: any }> = []
    process.env.OPENAI_COMPATIBLE_BASE_URL = 'https://mock-openai.local'
    process.env.OPENAI_COMPATIBLE_API_KEY = 'test-key'
    process.env.OPENAI_COMPATIBLE_MODEL = 'gpt-compatible'
    process.env.OPENAI_COMPATIBLE_PROTOCOL = 'responses'
    process.env.OPENAI_COMPATIBLE_PATH = '/v1/chat/completions'

    globalThis.fetch = mock((url: string, init?: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init?.body || '{}')) })
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: 'resp_legacy_path',
            output_text: 'responses normalized path ok'
          })
        )
      )
    }) as typeof fetch

    const result = await new OpenAiCompatibleDriver().generate({ text: '生成一段视频提示词' })

    expect(result.status).toBe('ok')
    expect(calls[0].url).toBe('https://mock-openai.local/v1/responses')
    expect(calls[0].body.input).toContain('生成一段视频提示词')
    expect(calls[0].body.messages).toBeUndefined()
  })

  it('responses 协议遇到旧 chat 绝对 URL 时应保留 host 并改用 responses endpoint', async () => {
    const calls: Array<{ url: string; body: any }> = []
    process.env.OPENAI_COMPATIBLE_BASE_URL = 'https://fallback-openai.local'
    process.env.OPENAI_COMPATIBLE_API_KEY = 'test-key'
    process.env.OPENAI_COMPATIBLE_MODEL = 'gpt-compatible'
    process.env.OPENAI_COMPATIBLE_PROTOCOL = 'responses'
    process.env.OPENAI_COMPATIBLE_PATH = 'https://mock-openai.local/v1/chat/completions/'

    globalThis.fetch = mock((url: string, init?: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init?.body || '{}')) })
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: 'resp_absolute_legacy_path',
            output_text: 'absolute responses normalized path ok'
          })
        )
      )
    }) as typeof fetch

    const result = await new OpenAiCompatibleDriver().generate({ text: '生成一段视频提示词' })

    expect(result.status).toBe('ok')
    expect(calls[0].url).toBe('https://mock-openai.local/v1/responses')
    expect(calls[0].body.input).toContain('生成一段视频提示词')
    expect(calls[0].body.messages).toBeUndefined()
  })

  it('未显式指定协议时不应因路径子串 responses 误判为 responses 协议', async () => {
    const calls: Array<{ url: string; body: any }> = []
    process.env.OPENAI_COMPATIBLE_BASE_URL = 'https://mock-openai.local'
    process.env.OPENAI_COMPATIBLE_API_KEY = 'test-key'
    process.env.OPENAI_COMPATIBLE_MODEL = 'gpt-compatible'
    process.env.OPENAI_COMPATIBLE_PATH = '/v1/responses-log'

    globalThis.fetch = mock((url: string, init?: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init?.body || '{}')) })
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: 'chat_custom_path',
            choices: [{ message: { content: 'custom chat ok' } }]
          })
        )
      )
    }) as typeof fetch

    const result = await new OpenAiCompatibleDriver().generate({ text: '生成一段视频提示词' })

    expect(result.status).toBe('ok')
    expect(calls[0].url).toBe('https://mock-openai.local/v1/responses-log')
    expect(calls[0].body.messages).toEqual([
      { role: 'user', content: '生成一段视频提示词' }
    ])
    expect(calls[0].body.input).toBeUndefined()
  })

  it('OpenAI 兼容渠道配置应拒绝非法 protocol', async () => {
    const invalid = await ChannelConfigService.testConfig({
      providerId: 'openai-compatible',
      apiKey: 'test-key',
      baseUrl: 'https://mock-openai.local',
      extra: {
        model: 'gpt-compatible',
        protocol: 'legacy-completions'
      }
    })

    expect(invalid.success).toBe(false)
    expect(invalid.message).toContain('protocol')
  })

  it('环境变量中的非法 protocol 应显式失败且不发起上游请求', async () => {
    process.env.OPENAI_COMPATIBLE_BASE_URL = 'https://mock-openai.local'
    process.env.OPENAI_COMPATIBLE_API_KEY = 'test-key'
    process.env.OPENAI_COMPATIBLE_MODEL = 'gpt-compatible'
    process.env.OPENAI_COMPATIBLE_PROTOCOL = 'legacy-completions'
    const fetchMock = mock(() => {
      throw new Error('should not call upstream when protocol is invalid')
    })
    globalThis.fetch = fetchMock as typeof fetch

    const result = await new OpenAiCompatibleDriver().generate({ text: '生成一段视频提示词' })

    expect(result.status).toBe('error')
    expect(result.message).toContain('protocol')
    expect(fetchMock).toHaveBeenCalledTimes(0)
  })
})
