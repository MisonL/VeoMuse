// apps/backend/src/services/PromptEnhanceService.ts
import { ApiKeyService } from './ApiKeyService';

export interface EnhancedPrompt {
  original: string;
  enhanced: string;
  negative: string;
  styleSuggestion: string;
}

export class PromptEnhanceService {
  private static MODEL = 'gemini-2.0-flash';
  private static API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

  private static SYSTEM_PROMPT = `
你是一位世界顶级的 AI 视频提示词工程师和电影摄影师。
你的任务是将用户简单的描述扩充为适合 Gemini Veo 视频生成模型的电影级提示词。

扩充准则：
1. 视觉化：增加具体的细节（纹理、颜色、材质）。
2. 环境感：描述天气、光影（如“丁达尔效应”、“黄金时间”）。
3. 动态感：描述相机运动（如“推拉摇移”、“手持摄影”）和主体动作。
4. 结构化：输出应包含：主提示词 (Enhanced Prompt)、负面提示词 (Negative Prompt) 和 风格建议。
5. 语言：除非用户特别要求，否则主提示词应使用英文，以便模型更好理解。

请以 JSON 格式返回，包含字段: enhanced, negative, style_suggestion。
`;

  static async enhance(userInput: string): Promise<EnhancedPrompt> {
    const key = ApiKeyService.getNextKey();
    const url = `${this.API_URL}/${this.MODEL}:generateContent?key=${key}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `${this.SYSTEM_PROMPT}

用户输入：${userInput}` }]
          }],
          generationConfig: {
            response_mime_type: "application/json"
          }
        })
      });

      if (!response.ok) {
        throw new Error(`AI 引擎响应失败: ${response.status}`);
      }

      const data = await response.json() as any;
      const content = JSON.parse(data.candidates[0].content.parts[0].text);

      return {
        original: userInput,
        enhanced: content.enhanced,
        negative: content.negative,
        styleSuggestion: content.style_suggestion
      };

    } catch (error: any) {
      console.error('❌ AI 提示词扩充失败:', error.message);
      throw new Error(`AI 创意引擎暂时无法响应: ${error.message}`);
    }
  }
}
