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
  private static SUPPORTED_MODELS = [
    'veo-3.1',
    'kling-v1',
    'sora-preview',
    'luma-dream',
    'runway-gen3',
    'pika-1.5'
  ] as const;

  private static fallbackRecommend(prompt: string): ModelRecommendation {
    const text = prompt.toLowerCase();

    if (/(特效|卡通|动漫|夸张|创意|奇幻|二次元)/.test(text)) {
      return {
        recommendedModelId: 'pika-1.5',
        reason: '检测到强特效/风格化需求，优先推荐 Pika。',
        confidence: 0.72
      };
    }

    if (/(镜头|运镜|动作|跟拍|快节奏|转场)/.test(text)) {
      return {
        recommendedModelId: 'runway-gen3',
        reason: '检测到镜头运动与动态调度需求，优先推荐 Runway。',
        confidence: 0.74
      };
    }

    if (/(电影|质感|写实|cinematic|realistic|光影)/.test(text)) {
      return {
        recommendedModelId: 'luma-dream',
        reason: '检测到电影化写实风格需求，优先推荐 Luma。',
        confidence: 0.7
      };
    }

    if (/(长镜头|叙事|故事|史诗|大片)/.test(text)) {
      return {
        recommendedModelId: 'sora-preview',
        reason: '检测到长叙事与镜头连续性需求，优先推荐 Sora。',
        confidence: 0.68
      };
    }

    return {
      recommendedModelId: 'veo-3.1',
      reason: '默认推荐稳定通用模型 Veo 3.1。',
      confidence: 0.6
    };
  }

  static async recommend(prompt: string): Promise<ModelRecommendation> {
    const availableKeys = ApiKeyService.getAvailableKeys();
    if (!availableKeys.length) {
      return {
        ...this.fallbackRecommend(prompt),
        reason: '未配置 Gemini API Key，已使用本地路由策略。'
      };
    }

    try {
      const key = ApiKeyService.getNextKey();
      const url = `${this.API_URL}/${this.MODEL}:generateContent?key=${key}`;

      const { data } = await this.instance.request<any>(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `你是一位顶级 AI 模型专家。请在以下模型中推荐最合适的一个：
veo-3.1, kling-v1, sora-preview, luma-dream, runway-gen3, pika-1.5

请严格返回 JSON：{ "recommendedModelId": string, "reason": string, "confidence": number }
其中 recommendedModelId 必须是上面 6 个 ID 之一。

提示词：${prompt}`
            }]
          }],
          generationConfig: { response_mime_type: 'application/json' }
        })
      });

      const content = JSON.parse(data.candidates[0].content.parts[0].text) as ModelRecommendation;
      if (!this.SUPPORTED_MODELS.includes(content.recommendedModelId as any)) {
        return {
          ...this.fallbackRecommend(prompt),
          reason: `AI 返回了未知模型 ID，已降级到本地路由。原始原因：${content.reason || 'N/A'}`
        };
      }

      return content;
    } catch (error) {
      return {
        ...this.fallbackRecommend(prompt),
        reason: '模型推荐服务暂不可用，已降级到本地路由策略。'
      };
    }
  }
}
