import path from 'path'
import fs from 'fs/promises'
import { BaseAiService } from './BaseAiService'
import type { ChannelRuntimeContext } from './ChannelConfigService'
import { ChannelConfigService } from './ChannelConfigService'

export class TtsService extends BaseAiService {
  protected serviceName = 'AI-TTS'
  private static instance = new TtsService()

  static async synthesize(
    text: string,
    context?: ChannelRuntimeContext
  ): Promise<{
    success: boolean
    status: 'ok' | 'not_implemented' | 'error'
    audioUrl?: string
    message?: string
    error?: string
  }> {
    const channel = context?.organizationId ? ChannelConfigService.resolve('tts', context) : null
    const apiUrl = channel?.baseUrl || process.env.TTS_API_URL
    const apiKey = channel?.apiKey || process.env.TTS_API_KEY

    if (!apiUrl || !apiKey) {
      return {
        success: false,
        status: 'not_implemented',
        message: 'TTS provider 未配置 (TTS_API_URL / TTS_API_KEY)'
      }
    }

    const timestamp = Date.now()
    const fileName = `voice_${timestamp}.mp3`
    const outputDir = path.resolve(process.cwd(), '../../uploads/audio')

    try {
      await fs.mkdir(outputDir, { recursive: true })
    } catch (error) {
      console.warn('[AI-TTS] 创建音频输出目录失败，将继续尝试写入', error)
    }

    const outputPath = path.join(outputDir, fileName)

    try {
      const { data } = await this.instance.request<any>(`${apiUrl.replace(/\/$/, '')}/synthesize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({ text })
      })
      if (data.audioBase64) {
        await fs.writeFile(outputPath, Buffer.from(data.audioBase64, 'base64'))
        return {
          success: true,
          status: 'ok',
          audioUrl: `/uploads/audio/${fileName}`
        }
      }

      if (typeof data.audioUrl === 'string' && data.audioUrl.length > 0) {
        return {
          success: true,
          status: 'ok',
          audioUrl: data.audioUrl
        }
      }

      return {
        success: false,
        status: 'error',
        message: 'TTS 响应缺少 audioBase64/audioUrl'
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error || '')
      return {
        success: false,
        status: 'error',
        message: 'TTS 网络请求失败',
        error: message
      }
    }
  }
}
