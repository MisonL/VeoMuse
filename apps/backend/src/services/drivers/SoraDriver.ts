// apps/backend/src/services/drivers/SoraDriver.ts
import type { VideoModelDriver, GenerateParams, GenerateResult } from '../ModelDriver';

export class SoraDriver implements VideoModelDriver {
  id = 'sora-preview';
  name = 'OpenAI Sora (Preview)';

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const apiUrl = process.env.SORA_API_URL;
    const apiKey = process.env.SORA_API_KEY;

    if (!apiUrl || !apiKey) {
      return {
        success: false,
        status: 'not_implemented',
        operationName: '',
        message: 'Sora provider 未配置 (SORA_API_URL / SORA_API_KEY)',
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
          message: 'Sora 生成失败',
          provider: this.id,
          error: `HTTP ${response.status}: ${errorText}`
        };
      }

      const data = await response.json() as any;
      return {
        success: true,
        status: 'ok',
        operationName: data.operationName || data.id || `sora_${Date.now()}`,
        message: data.message || 'Sora 高清渲染任务已提交',
        provider: this.id
      };
    } catch (error: any) {
      return {
        success: false,
        status: 'error',
        operationName: '',
        message: 'Sora 网络请求失败',
        provider: this.id,
        error: error.message
      };
    }
  }
}
