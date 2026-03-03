// apps/backend/src/services/PromptEnhanceService.ts
import { BaseAiService } from './BaseAiService'
import { ApiKeyService } from './ApiKeyService'

export interface EnhancedPrompt {
  original: string
  enhanced: string
  negative: string
  styleSuggestion: string
}

export class PromptEnhanceService extends BaseAiService {
  protected serviceName = 'AI-Prompt-Enhancer'
  private static instance = new PromptEnhanceService()

  private static MODEL = 'gemini-3.1-pro-preview'
  private static API_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

  static async enhance(userInput: string): Promise<EnhancedPrompt> {
    const key = ApiKeyService.getNextKey()
    const url = `${this.API_URL}/${this.MODEL}:generateContent?key=${key}`

    const { data } = await this.instance.request<any>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `你是一位顶级视频提示词专家。请将用户输入扩充为 JSON 格式 (enhanced, negative, style_suggestion)：\n\n用户输入：${userInput}`
              }
            ]
          }
        ],
        generationConfig: { response_mime_type: 'application/json', thinking_level: 'HIGH' }
      })
    })

    const content = JSON.parse(data.candidates[0].content.parts[0].text)
    return {
      original: userInput,
      enhanced: content.enhanced,
      negative: content.negative,
      styleSuggestion: content.style_suggestion
    }
  }
}
