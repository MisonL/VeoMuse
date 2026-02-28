import { BaseAiService } from './BaseAiService';

export interface StyleTransferParams {
  clipId: string;
  style: string;
  referenceModel?: 'luma-dream' | 'kling-v1' | 'veo-3.1';
}

export interface StyleTransferResult {
  success: boolean;
  status: 'ok' | 'not_implemented' | 'error';
  operationId: string;
  style?: string;
  message?: string;
  error?: string;
}

export class StyleTransferService extends BaseAiService {
  protected serviceName = 'AI-Style-Transfer';
  private static instance = new StyleTransferService();

  static async transfer(params: StyleTransferParams): Promise<StyleTransferResult> {
    const apiUrl = process.env.ALCHEMY_API_URL;
    const apiKey = process.env.ALCHEMY_API_KEY;

    if (!apiUrl || !apiKey) {
      return {
        success: false,
        status: 'not_implemented',
        operationId: '',
        style: params.style,
        message: 'Style Transfer provider 未配置 (ALCHEMY_API_URL / ALCHEMY_API_KEY)'
      };
    }

    try {
      const { data } = await this.instance.request<any>(`${apiUrl.replace(/\/$/, '')}/style-transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          clipId: params.clipId,
          style: params.style,
          referenceModel: params.referenceModel || 'luma-dream'
        })
      });
      return {
        success: true,
        status: 'ok',
        operationId: data.operationId || `style_${Date.now()}`,
        style: params.style,
        message: data.message || '风格迁移任务已提交'
      };
    } catch (error: any) {
      return {
        success: false,
        status: 'error',
        operationId: '',
        style: params.style,
        message: 'Style Transfer 网络请求失败',
        error: error.message
      };
    }
  }
}
