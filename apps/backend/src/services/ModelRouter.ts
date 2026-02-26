// apps/backend/src/services/ModelRouter.ts
import { BaseAiService } from './BaseAiService';
import { ApiKeyService } from './ApiKeyService';

export interface ModelRecommendation {
  recommendedModelId: string;
  reason: string;
  confidence: number;
}

export class ModelRouter extends BaseAiService {
  protected serviceName = 'AI-Model-Router';
  private static instance = new ModelRouter();

  private static MODEL = 'gemini-3.1-pro-preview';
  private static API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

  static async recommend(prompt: string): Promise<ModelRecommendation> {
    const key = ApiKeyService.getNextKey();
    const url = `${this.API_URL}/${this.MODEL}:generateContent?key=${key}`;

    const { data } = await this.instance.request<any>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `你是一位顶级 AI 模型专家。请为以下创意推荐最佳模型 (veo-3.1, kling-v1, sora-preview)，以 JSON 返回 (recommendedModelId, reason, confidence)：\n\n提示词：${prompt}` }] }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });

    return JSON.parse(data.candidates[0].content.parts[0].text) as ModelRecommendation;
  }
}
