// apps/backend/src/services/LipSyncService.ts
import { BaseAiService } from './BaseAiService';

export class LipSyncService extends BaseAiService {
  protected serviceName = 'AI-Lip-Sync';
  private static instance = new LipSyncService();

  static async sync(videoUrl: string, audioUrl: string, precision: string = 'high'): Promise<any> {
    const apiUrl = process.env.LIP_SYNC_API_URL;
    const apiKey = process.env.LIP_SYNC_API_KEY;

    if (!apiUrl || !apiKey) {
      return {
        success: false,
        status: 'not_implemented',
        message: 'Lip Sync provider 未配置 (LIP_SYNC_API_URL / LIP_SYNC_API_KEY)'
      };
    }

    try {
      const { data } = await this.instance.request<any>(`${apiUrl.replace(/\/$/, '')}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({ videoUrl, audioUrl, precision })
      });

      return {
        success: true,
        status: 'ok',
        syncedVideoUrl: data.syncedVideoUrl,
        operationId: data.operationId || `lip_${Date.now()}`
      };
    } catch (error: any) {
      return {
        success: false,
        status: 'error',
        message: 'Lip Sync 失败',
        error: error.message
      };
    }
  }
}
