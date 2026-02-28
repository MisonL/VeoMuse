// apps/backend/src/services/drivers/KlingDriver.ts
import type { VideoModelDriver, GenerateParams, GenerateResult } from '../ModelDriver';

export class KlingDriver implements VideoModelDriver {
  id = 'kling-v1';
  name = '快手可灵 Kling V1';

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const apiUrl = process.env.KLING_API_URL;
    const apiKey = process.env.KLING_API_KEY;

    if (!apiUrl || !apiKey) {
      return {
        success: false,
        status: 'not_implemented',
        operationName: '',
        message: 'Kling provider 未配置 (KLING_API_URL / KLING_API_KEY)',
        provider: this.id
      };
    }

    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          prompt: params.text,
          negative_prompt: params.negativePrompt,
          options: params.options || {}
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          status: 'error',
          operationName: '',
          message: 'Kling 生成失败',
          provider: this.id,
          error: `HTTP ${response.status}: ${errorText}`
        };
      }

      const data = await response.json() as any;
      return {
        success: true,
        status: 'ok',
        operationName: data.operationName || data.id || `kling_${Date.now()}`,
        message: data.message || 'Kling 视频生成已提交',
        provider: this.id
      };
    } catch (error: any) {
      return {
        success: false,
        status: 'error',
        operationName: '',
        message: 'Kling 网络请求失败',
        provider: this.id,
        error: error.message
      };
    }
  }
}
