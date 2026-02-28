import path from 'path';
import fs from 'fs/promises';
import { BaseAiService } from './BaseAiService';

export class TtsService extends BaseAiService {
  protected serviceName = 'AI-TTS';
  private static instance = new TtsService();

  static async synthesize(text: string): Promise<{ success: boolean; status: 'ok' | 'not_implemented' | 'error'; audioUrl?: string; message?: string; error?: string }> {
    const apiUrl = process.env.TTS_API_URL;
    const apiKey = process.env.TTS_API_KEY;

    if (!apiUrl || !apiKey) {
      return {
        success: false,
        status: 'not_implemented',
        message: 'TTS provider 未配置 (TTS_API_URL / TTS_API_KEY)'
      };
    }

    const timestamp = Date.now();
    const fileName = `voice_${timestamp}.mp3`;
    const outputDir = path.resolve(process.cwd(), '../../uploads/audio');
    
    try { await fs.mkdir(outputDir, { recursive: true }); } catch (e) {}
    
    const outputPath = path.join(outputDir, fileName);

    try {
      const { data } = await this.instance.request<any>(`${apiUrl.replace(/\/$/, '')}/synthesize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({ text })
      });
      if (data.audioBase64) {
        await fs.writeFile(outputPath, Buffer.from(data.audioBase64, 'base64'));
        return {
          success: true,
          status: 'ok',
          audioUrl: `/uploads/audio/${fileName}`
        };
      }

      if (typeof data.audioUrl === 'string' && data.audioUrl.length > 0) {
        return {
          success: true,
          status: 'ok',
          audioUrl: data.audioUrl
        };
      }

      return {
        success: false,
        status: 'error',
        message: 'TTS 响应缺少 audioBase64/audioUrl'
      };
    } catch (error: any) {
      return {
        success: false,
        status: 'error',
        message: 'TTS 网络请求失败',
        error: error.message
      };
    };
  }
}
