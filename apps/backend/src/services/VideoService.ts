// apps/backend/src/services/VideoService.ts
import { ApiKeyService } from './ApiKeyService';

export interface VideoGenerateParams {
  text: string;
  negativePrompt?: string;
  model?: string;
  aspectRatio?: string;
}

export class VideoService {
  private static API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

  static async generateFromText({ 
    text, 
    negativePrompt, 
    model = 'veo-3.1-generate-001' 
  }: VideoGenerateParams) {
    const keys = ApiKeyService.getAvailableKeys();
    let lastError: Error | null = null;

    // 尝试所有可用的 Key
    for (const key of keys) {
      try {
        const url = `${this.API_BASE}/${model}:predictLongRunning?key=${key}`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: negativePrompt ? `${text}

Negative Prompt: ${negativePrompt}` : text
              }]
            }]
          })
        });

        if (!response.ok) {
          const errorData = await response.json() as any;
          throw new Error(errorData?.error?.message || `API 请求失败: ${response.status}`);
        }

        const data = await response.json() as any;
        return {
          success: true,
          operationName: data.name,
          message: '视频生成请求已提交'
        };

      } catch (error: any) {
        lastError = error;
        console.warn(`⚠️ API Key 调用失败，尝试下一个... 错误: ${error.message}`);
        continue;
      }
    }

    throw lastError || new Error('所有 API 密钥均不可用');
  }
}
