// apps/backend/src/services/drivers/LumaDriver.ts
import type { VideoModelDriver, GenerateParams, GenerateResult, GenerateRuntimeContext } from '../ModelDriver';
import { ChannelConfigService } from '../ChannelConfigService';

export class LumaDriver implements VideoModelDriver {
  id = 'luma-dream';
  name = 'Luma Dream Machine';

  async generate(params: GenerateParams, context?: GenerateRuntimeContext): Promise<GenerateResult> {
    const channel = context?.organizationId
      ? ChannelConfigService.resolve(this.id, {
        organizationId: context.organizationId,
        workspaceId: context.workspaceId
      })
      : null
    const apiUrl = channel?.baseUrl || process.env.LUMA_API_URL;
    const apiKey = channel?.apiKey || process.env.LUMA_API_KEY;

    if (!apiUrl || !apiKey) {
      return {
        success: false,
        status: 'not_implemented',
        operationName: '',
        message: 'Luma provider 未配置 (LUMA_API_URL / LUMA_API_KEY)',
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
          message: 'Luma 生成失败',
          provider: this.id,
          error: `HTTP ${response.status}: ${errorText}`
        };
      }

      const data = await response.json() as any;
      return {
        success: true,
        status: 'ok',
        operationName: data.operationName || data.id || `luma_${Date.now()}`,
        message: data.message || 'Luma 任务已提交至集群',
        provider: this.id
      };
    } catch (error: any) {
      return {
        success: false,
        status: 'error',
        operationName: '',
        message: 'Luma 网络请求失败',
        provider: this.id,
        error: error.message
      };
    }
  }
}
