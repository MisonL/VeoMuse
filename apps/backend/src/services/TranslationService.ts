// apps/backend/src/services/TranslationService.ts
import { BaseAiService } from './BaseAiService';
import { ApiKeyService } from './ApiKeyService';

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  detectedLang: string;
  targetLang: string;
}

export class TranslationService extends BaseAiService {
  protected serviceName = 'AI-Translator';
  private static instance = new TranslationService();

  private static MODEL = 'gemini-3.1-pro-preview';
  private static API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

  static async translate(text: string, targetLang: string): Promise<TranslationResult> {
    const key = ApiKeyService.getNextKey();
    const url = `${this.API_URL}/${this.MODEL}:generateContent?key=${key}`;

    const { data } = await this.instance.request<any>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `你是一位顶级翻译专家。请将以下内容翻译为 [${targetLang}]，以 JSON 格式返回 (translatedText, detectedLang)：\n\n原文：${text}` }] }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });

    const content = JSON.parse(data.candidates[0].content.parts[0].text);
    return {
      originalText: text,
      translatedText: content.translatedText,
      detectedLang: content.detectedLang,
      targetLang
    };
  }
}
