// apps/backend/src/services/InpaintService.ts
import { BaseAiService, type GeminiGenerateContentResponse } from './BaseAiService'
import { ApiKeyService } from './ApiKeyService'

export interface RepairAdvice {
  fixPrompt: string
  technique: string
  reason: string
}

export class InpaintService extends BaseAiService {
  protected serviceName = 'AI-Video-Inpainter'
  private static instance = new InpaintService()

  private static MODEL = 'gemini-3.1-pro-preview'
  private static API_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

  private static SYSTEM_PROMPT = `你是一位顶级的视频修复专家。请根据问题描述给出一个精准的修复 Prompt JSON (fixPrompt, technique, reason)。`

  static async getRepairAdvice(problemDescription: string): Promise<RepairAdvice> {
    const key = ApiKeyService.getNextKey()
    const url = `${this.API_URL}/${this.MODEL}:generateContent?key=${key}`

    const { data } = await this.instance.request<GeminiGenerateContentResponse>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${this.SYSTEM_PROMPT}\n\n描述：${problemDescription}` }] }],
        generationConfig: { response_mime_type: 'application/json', thinking_level: 'HIGH' }
      })
    })

    return this.instance.parseGeminiJson(data) as RepairAdvice
  }
}
