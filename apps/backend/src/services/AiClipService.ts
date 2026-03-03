// apps/backend/src/services/AiClipService.ts
import { BaseAiService } from './BaseAiService'
import { ApiKeyService } from './ApiKeyService'

export interface CutPoint {
  time: number
  reason: string
}

export interface AiClipSuggestion {
  cutPoints: CutPoint[]
}

export class AiClipService extends BaseAiService {
  protected serviceName = 'AI-Clip-Editor'
  private static instance = new AiClipService()

  private static MODEL = 'gemini-3.1-pro-preview'
  private static API_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

  private static SYSTEM_PROMPT = `你是一位世界顶级的电影剪辑师。请根据描述和时长给出剪切打点 JSON (cutPoints: {time, reason}[])。`

  private static buildOfflineSuggestion(
    description: string,
    durationSeconds: number
  ): AiClipSuggestion {
    const safeDuration = Math.max(2, Math.round(durationSeconds || 8))
    const points = Math.min(4, Math.max(1, Math.floor(safeDuration / 2)))
    const interval = Math.max(1, safeDuration / (points + 1))

    return {
      cutPoints: Array.from({ length: points }).map((_, idx) => ({
        time: Number(((idx + 1) * interval).toFixed(1)),
        reason: `离线节奏建议：${description.slice(0, 18) || '按动作变化切换'}`
      }))
    }
  }

  static async suggestCuts(
    description: string,
    durationSeconds: number
  ): Promise<AiClipSuggestion> {
    const availableKeys = ApiKeyService.getAvailableKeys()
    if (!availableKeys.length) {
      return this.buildOfflineSuggestion(description, durationSeconds)
    }
    const key = ApiKeyService.getNextKey()

    const url = `${this.API_URL}/${this.MODEL}:generateContent?key=${key}`
    try {
      const { data } = await this.instance.request<any>(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${this.SYSTEM_PROMPT}\n\n- 描述: ${description}\n- 时长: ${durationSeconds}`
                }
              ]
            }
          ],
          generationConfig: { response_mime_type: 'application/json', thinking_level: 'HIGH' }
        })
      })

      const parsed = this.instance.parseGeminiJson(data) as AiClipSuggestion
      if (!Array.isArray(parsed?.cutPoints) || parsed.cutPoints.length === 0) {
        return this.buildOfflineSuggestion(description, durationSeconds)
      }
      return parsed
    } catch {
      return this.buildOfflineSuggestion(description, durationSeconds)
    }
  }
}
