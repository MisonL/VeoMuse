// apps/backend/src/services/TranslationService.ts
import { ApiKeyService } from './ApiKeyService';

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  detectedLang: string;
  targetLang: string;
}

export class TranslationService {
  private static MODEL = 'gemini-3.1-pro-preview';
  private static API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

  private static SYSTEM_PROMPT = `
你是一位顶级的多语种翻译专家。
你的任务是将用户提供的文字翻译为目标语言，同时保持原始的情感基调、口语化特征和叙事节奏。
这主要用于视频配音，所以译文的长度应尽量与原文保持接近。

请以 JSON 格式返回，包含字段:
- translatedText (字符串): 翻译后的文字。
- detectedLang (字符串): 自动检测到的原始语言。
`;

  static async translate(text: string, targetLang: string): Promise<TranslationResult> {
    const key = ApiKeyService.getNextKey();
    const url = `${this.API_URL}/${this.MODEL}:generateContent?key=${key}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `${this.SYSTEM_PROMPT}

目标语言：${targetLang}
原文：${text}` }]
          }],
          generationConfig: {
            response_mime_type: "application/json",
            thinking_level: "LOW" // 翻译属于快速映射任务
          }
        })
      });

      if (!response.ok) throw new Error(`TranslationService 响应失败: ${response.status}`);

      const data = await response.json() as any;
      const content = JSON.parse(data.candidates[0].content.parts[0].text);

      return {
        originalText: text,
        translatedText: content.translatedText,
        detectedLang: content.detectedLang,
        targetLang
      };

    } catch (error: any) {
      console.error('❌ AI 翻译失败:', error.message);
      throw new Error(`AI 翻译引擎暂时无法响应: ${error.message}`);
    }
  }
}
