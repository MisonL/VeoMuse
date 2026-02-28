// apps/backend/src/services/drivers/RunwayDriver.ts
import type { VideoModelDriver, GenerateParams, GenerateResult } from '../ModelDriver';

export class RunwayDriver implements VideoModelDriver {
  id = 'runway-gen3';
  name = 'Runway Gen-3 Alpha';

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const apiUrl = process.env.RUNWAY_API_URL;
    const apiKey = process.env.RUNWAY_API_KEY;

    if (!apiUrl || !apiKey) {
      return {
        success: false,
        status: 'not_implemented',
        operationName: '',
        message: 'Runway provider 未配置 (RUNWAY_API_URL / RUNWAY_API_KEY)',
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
          message: 'Runway 生成失败',
          provider: this.id,
          error: `HTTP ${response.status}: ${errorText}`
        };
      }

      const data = await response.json() as any;
      return {
        success: true,
        status: 'ok',
        operationName: data.operationName || data.id || `runway_${Date.now()}`,
        message: data.message || 'Runway 生成任务已在云端排队',
        provider: this.id
      };
    } catch (error: any) {
      return {
        success: false,
        status: 'error',
        operationName: '',
        message: 'Runway 网络请求失败',
        provider: this.id,
        error: error.message
      };
    }
  }
}
