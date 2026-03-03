import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { ApiKeyService } from '../apps/backend/src/services/ApiKeyService'
import { AudioAnalysisService } from '../apps/backend/src/services/AudioAnalysisService'
import { InpaintService } from '../apps/backend/src/services/InpaintService'
import { KlingDriver } from '../apps/backend/src/services/drivers/KlingDriver'
import { MusicAdviceService } from '../apps/backend/src/services/MusicAdviceService'
import { RelightingService } from '../apps/backend/src/services/RelightingService'
import { SoraDriver } from '../apps/backend/src/services/drivers/SoraDriver'
import { SpatialRenderService } from '../apps/backend/src/services/SpatialRenderService'
import { VoiceMorphService } from '../apps/backend/src/services/VoiceMorphService'

const ENV_KEYS = [
  'AUDIO_ANALYSIS_API_URL',
  'AUDIO_ANALYSIS_API_KEY',
  'RELIGHT_API_URL',
  'RELIGHT_API_KEY',
  'SPATIAL_API_URL',
  'SPATIAL_API_KEY',
  'VOICE_MORPH_API_URL',
  'VOICE_MORPH_API_KEY',
  'KLING_API_URL',
  'KLING_API_KEY',
  'SORA_API_URL',
  'SORA_API_KEY'
] as const

describe('低覆盖 AI 服务与驱动补测', () => {
  const envBackup: Record<string, string | undefined> = {}
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
    ENV_KEYS.forEach((key) => {
      envBackup[key] = process.env[key]
      delete process.env[key]
    })
    ApiKeyService.init(['unit-test-gemini-key'])
  })

  afterEach(() => {
    global.fetch = originalFetch
    ENV_KEYS.forEach((key) => {
      if (envBackup[key] === undefined) delete process.env[key]
      else process.env[key] = envBackup[key]
    })
  })

  it('provider 未配置时应返回 not_implemented', async () => {
    const audio = await AudioAnalysisService.analyze('https://example.com/a.mp3')
    const relight = await RelightingService.applyRelighting('clip-1', 'cinematic')
    const spatial = await SpatialRenderService.reconstruct('clip-2')
    const morph = await VoiceMorphService.morph('https://example.com/a.wav', 'voice-1')

    const kling = await new KlingDriver().generate({ text: 'scene', options: {} })
    const sora = await new SoraDriver().generate({ text: 'scene', options: {} })

    expect(audio.status).toBe('not_implemented')
    expect(relight.status).toBe('not_implemented')
    expect(spatial.status).toBe('not_implemented')
    expect(morph.status).toBe('not_implemented')
    expect(kling.status).toBe('not_implemented')
    expect(sora.status).toBe('not_implemented')
  })

  it('provider 配置后应返回成功结构', async () => {
    process.env.AUDIO_ANALYSIS_API_URL = 'https://mock.audio.local'
    process.env.AUDIO_ANALYSIS_API_KEY = 'audio-key'
    process.env.RELIGHT_API_URL = 'https://mock.relight.local'
    process.env.RELIGHT_API_KEY = 'relight-key'
    process.env.SPATIAL_API_URL = 'https://mock.spatial.local'
    process.env.SPATIAL_API_KEY = 'spatial-key'
    process.env.VOICE_MORPH_API_URL = 'https://mock.voice.local'
    process.env.VOICE_MORPH_API_KEY = 'voice-key'
    process.env.KLING_API_URL = 'https://mock.kling.local'
    process.env.KLING_API_KEY = 'kling-key'
    process.env.SORA_API_URL = 'https://mock.sora.local'
    process.env.SORA_API_KEY = 'sora-key'

    global.fetch = mock((url: string) => {
      if (url.includes('mock.audio.local')) {
        return Promise.resolve(new Response(JSON.stringify({ bpm: 128, beats: [0.5, 1.0, 1.5] })))
      }
      if (url.includes('mock.relight.local')) {
        return Promise.resolve(new Response(JSON.stringify({ operationId: 'relight-op-1' })))
      }
      if (url.includes('mock.spatial.local')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              nerfDataUrl: 'https://cdn.local/scene.nerf',
              meshUrl: 'https://cdn.local/scene.obj',
              totalVoxels: 4096
            })
          )
        )
      }
      if (url.includes('mock.voice.local')) {
        return Promise.resolve(
          new Response(JSON.stringify({ morphedAudioUrl: 'https://cdn.local/morphed.wav' }))
        )
      }
      if (url.includes('mock.kling.local')) {
        return Promise.resolve(
          new Response(JSON.stringify({ operationName: 'kling-op-1', message: 'ok' }))
        )
      }
      if (url.includes('mock.sora.local')) {
        return Promise.resolve(
          new Response(JSON.stringify({ operationName: 'sora-op-1', message: 'ok' }))
        )
      }
      return Promise.resolve(new Response(JSON.stringify({})))
    }) as any

    const audio = await AudioAnalysisService.analyze('https://example.com/a.mp3')
    const relight = await RelightingService.applyRelighting('clip-1', 'studio')
    const spatial = await SpatialRenderService.reconstruct('clip-2', 'ultra')
    const morph = await VoiceMorphService.morph('https://example.com/a.wav', 'voice-2')
    const kling = await new KlingDriver().generate({ text: 'scene', options: {} })
    const sora = await new SoraDriver().generate({ text: 'scene', options: {} })

    expect(audio.status).toBe('ok')
    expect(audio.bpm).toBe(128)
    expect(audio.beats.length).toBe(3)
    expect(relight.status).toBe('ok')
    expect(relight.operationId).toBe('relight-op-1')
    expect(spatial.status).toBe('ok')
    expect(spatial.totalVoxels).toBe(4096)
    expect(morph.status).toBe('ok')
    expect(morph.morphedAudioUrl).toContain('morphed.wav')
    expect(kling.status).toBe('ok')
    expect(kling.operationName).toBe('kling-op-1')
    expect(sora.status).toBe('ok')
    expect(sora.operationName).toBe('sora-op-1')
  })

  it('驱动在上游异常时应返回 error 分支', async () => {
    process.env.KLING_API_URL = 'https://mock.kling.local'
    process.env.KLING_API_KEY = 'kling-key'
    process.env.SORA_API_URL = 'https://mock.sora.local'
    process.env.SORA_API_KEY = 'sora-key'

    global.fetch = mock((url: string) => {
      if (url.includes('mock.kling.local')) {
        return Promise.resolve(new Response('upstream failed', { status: 503 }))
      }
      if (url.includes('mock.sora.local')) {
        return Promise.reject(new Error('network down'))
      }
      return Promise.resolve(new Response('{}'))
    }) as any

    const kling = await new KlingDriver().generate({ text: 'scene', options: {} })
    const sora = await new SoraDriver().generate({ text: 'scene', options: {} })
    expect(kling.status).toBe('error')
    expect(kling.error).toContain('HTTP 503')
    expect(sora.status).toBe('error')
    expect(sora.error).toContain('network down')
  })

  it('Gemini JSON 解析服务应覆盖成功与异常分支', async () => {
    global.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [{ text: '{"fixPrompt":"x","technique":"y","reason":"z"}' }] } }
            ]
          })
        )
      )
    ) as any
    const advice = await InpaintService.getRepairAdvice('画面有噪点')
    expect(advice.fixPrompt).toBe('x')

    global.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    { text: '{"mood":"warm","genre":"ambient","tempo":"slow","description":"ok"}' }
                  ]
                }
              }
            ]
          })
        )
      )
    ) as any
    const music = await MusicAdviceService.getAdvice('温暖夕阳镜头')
    expect(music.genre).toBe('ambient')

    global.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: 'invalid-json' }] } }]
          })
        )
      )
    ) as any
    await expect(MusicAdviceService.getAdvice('invalid')).rejects.toThrow('解析 AI 响应失败')
  })
})
