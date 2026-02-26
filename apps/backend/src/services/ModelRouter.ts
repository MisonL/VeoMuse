// apps/backend/src/services/ModelRouter.ts
import { ApiKeyService } from './ApiKeyService';

export interface ModelRecommendation {
  recommendedModelId: string;
  reason: string;
  confidence: number;
}

export class ModelRouter {
  private static MODEL = 'gemini-3.1-pro-preview';
  private static API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

  private static SYSTEM_PROMPT = `
你是一位顶级的 AI 视频模型专家。
你的任务是根据一段视频提示词，从以下模型中推荐最适合的一个：
1. "veo-3.1" (Gemini Veo): 适合一般创意、色彩丰富、生成稳定的场景。
2. "kling-v1" (快手可灵): 适合高动态运动、复杂人体动作、大光影变换。
3. "sora-preview" (OpenAI Sora): 适合电影级写实、超长连贯镜头、物理规律严谨的场景。

请以 JSON 格式返回，包含字段: recommendedModelId, reason, confidence (0-1)。
`;

  static async recommend(prompt: string): Promise<ModelRecommendation> {
    const key = ApiKeyService.getNextKey();
    const url = `${this.API_URL}/${this.MODEL}:generateContent?key=${key}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `${this.SYSTEM_PROMPT}

提示词：${prompt}` }]
          }],
          generationConfig: {
            response_mime_type: "application/json",
            thinking_level: "LOW" // 路由属于快速分类任务
          }
        })
      });

      if (!response.ok) throw new Error(`ModelRouter 响应失败: ${response.status}`);

      const data = await response.json() as any;
      const content = JSON.parse(data.candidates[0].content.parts[0].text);

      return content as ModelRecommendation;

    } catch (error: any) {
      console.error('❌ 模型推荐失败:', error.message);
      // 默认回退到 Gemini
      return { recommendedModelId: 'veo-3.1', reason: '默认推荐', confidence: 0.5 };
    }
  }
}
