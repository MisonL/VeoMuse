// apps/backend/src/services/MusicAdviceService.ts
import { BaseAiService, type GeminiGenerateContentResponse } from './BaseAiService'
import { ApiKeyService } from './ApiKeyService'

export interface MusicAdvice {
  mood: string
  genre: string
  tempo: 'slow' | 'medium' | 'fast'
  description: string
}

export class MusicAdviceService extends BaseAiService {
  protected serviceName = 'AI-Music-Consultant'
  private static instance = new MusicAdviceService()

  private static MODEL = 'gemini-3.1-pro-preview'
  private static API_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

  private static SYSTEM_PROMPT = `你是一位顶级的电影配乐大师。请根据视觉描述给出匹配的 BGM 建议 JSON (mood, genre, tempo, description)。`

  static async getAdvice(videoDescription: string): Promise<MusicAdvice> {
    const key = ApiKeyService.getNextKey()
    const url = `${this.API_URL}/${this.MODEL}:generateContent?key=${key}`

    const { data } = await this.instance.request<GeminiGenerateContentResponse>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${this.SYSTEM_PROMPT}\n\n描述：${videoDescription}` }] }],
        generationConfig: { response_mime_type: 'application/json', thinking_level: 'MEDIUM' }
      })
    })

    return this.instance.parseGeminiJson(data) as MusicAdvice
  }
}
