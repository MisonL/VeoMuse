// apps/backend/src/services/AudioAnalysisService.ts
import { BaseAiService } from './BaseAiService';

export interface AudioBeats {
  success?: boolean;
  status?: 'ok' | 'not_implemented';
  message?: string;
  bpm: number;
  beats: number[]; // 强拍时间戳列表 (s)
}

export class AudioAnalysisService extends BaseAiService {
  protected serviceName = 'AI-Audio-Analyzer';
  private static instance = new AudioAnalysisService();

  static async analyze(audioUrl: string): Promise<AudioBeats> {
    const apiUrl = process.env.AUDIO_ANALYSIS_API_URL;
    const apiKey = process.env.AUDIO_ANALYSIS_API_KEY;

    if (!apiUrl || !apiKey) {
      return {
        success: false,
        status: 'not_implemented',
        message: 'Audio Analysis provider 未配置 (AUDIO_ANALYSIS_API_URL / AUDIO_ANALYSIS_API_KEY)',
        bpm: 0,
        beats: []
      };
    }

    try {
      const { data } = await this.instance.request<any>(`${apiUrl.replace(/\/$/, '')}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({ audioUrl })
      });

      return {
        success: true,
        status: 'ok',
        bpm: Number(data.bpm || 0),
        beats: Array.isArray(data.beats) ? data.beats : []
      } as AudioBeats;
    } catch (error: any) {
      throw new Error(`音频分析失败: ${error.message}`);
    }
  }
}
