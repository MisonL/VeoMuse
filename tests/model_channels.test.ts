import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { app } from '../apps/backend/src/index'
import { buildTestPassword } from './helpers/credentials'

const createAccessToken = async () => {
  const suffix = Math.random().toString(36).slice(2, 10)
  const password = buildTestPassword(suffix)
  const response = await app.handle(
    new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `channels-${suffix}@veomuse.test`,
        password,
        organizationName: `渠道组织-${suffix}`
      })
    })
  )
  const payload = (await response.json()) as any
  if (response.status !== 200 || !payload?.session?.accessToken) {
    throw new Error(`failed to create session: ${payload?.error || response.status}`)
  }
  return payload.session.accessToken as string
}

describe('模型通道闭环验证', () => {
  const envBackup: Record<string, string | undefined> = {}
  const providerEnvKeys = [
    'LUMA_API_URL',
    'LUMA_API_KEY',
    'RUNWAY_API_URL',
    'RUNWAY_API_KEY',
    'PIKA_API_URL',
    'PIKA_API_KEY',
    'OPENAI_COMPATIBLE_BASE_URL',
    'OPENAI_COMPATIBLE_API_KEY',
    'OPENAI_COMPATIBLE_MODEL',
    'OPENAI_COMPATIBLE_PATH',
    'OPENAI_COMPATIBLE_TEMPERATURE',
    'OPENAI_BASE_URL',
    'OPENAI_API_KEY',
    'OPENAI_MODEL'
  ]

  beforeEach(() => {
    providerEnvKeys.forEach((key) => {
      envBackup[key] = process.env[key]
      process.env[key] = ''
    })
  })

  afterEach(() => {
    providerEnvKeys.forEach((key) => {
      const previous = envBackup[key]
      if (previous === undefined) delete process.env[key]
      else process.env[key] = previous
    })
  })

  it('模型列表应包含 Luma/Runway/Pika/OpenAI 兼容', async () => {
    const response = await app.handle(new Request('http://localhost/api/models'))
    const data = (await response.json()) as Array<{ id: string; name: string }>

    expect(response.status).toBe(200)
    expect(data.some((m) => m.id === 'luma-dream')).toBe(true)
    expect(data.some((m) => m.id === 'runway-gen3')).toBe(true)
    expect(data.some((m) => m.id === 'pika-1.5')).toBe(true)
    expect(data.some((m) => m.id === 'openai-compatible')).toBe(true)
  })

  it('Luma/Runway/Pika 未配置 provider 时应显式返回 not_implemented', async () => {
    const modelIds = ['luma-dream', 'runway-gen3', 'pika-1.5', 'openai-compatible']
    const accessToken = await createAccessToken()

    for (const modelId of modelIds) {
      const response = await app.handle(
        new Request('http://localhost/api/video/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            modelId,
            text: '测试创意提示词',
            options: { quality: 'standard' }
          })
        })
      )

      const data = (await response.json()) as any
      expect(response.status).toBe(200)
      expect(data.provider).toBe(modelId)
      expect(data.status).toBe('not_implemented')
    }
  })
})
