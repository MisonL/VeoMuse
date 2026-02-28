// apps/backend/src/services/drivers/GeminiDriver.ts
import type { VideoModelDriver, GenerateParams, GenerateResult } from '../ModelDriver';
import { ApiKeyService } from '../ApiKeyService';

export class GeminiDriver implements VideoModelDriver {
  id = 'veo-3.1';
  name = 'Google Gemini Veo 3.1';

  private API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const keys = ApiKeyService.getAvailableKeys();
    if (!keys.length) {
      return {
        success: false,
        status: 'not_implemented',
        operationName: '',
        message: 'Gemini provider 未配置 GEMINI_API_KEYS',
        provider: this.id
      };
    }

    let lastError: Error | null = null;

    for (const key of keys) {
      try {
        const url = `${this.API_BASE}/veo-3.1-generate-001:predictLongRunning?key=${key}`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: params.negativePrompt ? `${params.text}\n\nNegative: ${params.negativePrompt}` : params.text
              }]
            }]
          })
        });

        if (!response.ok) {
          const errorData = await response.json() as any;
          throw new Error(errorData?.error?.message || `Gemini API Error: ${response.status}`);
        }

        const data = await response.json() as any;
        return {
          success: true,
          status: 'ok',
          operationName: data.name,
          message: 'Gemini 生成任务已提交',
          provider: this.id
        };

      } catch (error: any) {
        lastError = error;
        continue;
      }
    }

    return {
      success: false,
      status: 'error',
      operationName: '',
      message: 'Gemini 请求失败',
      provider: this.id,
      error: lastError?.message || 'Gemini API 密钥均不可用'
    };
  }
}
