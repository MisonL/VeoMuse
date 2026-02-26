// apps/backend/src/services/MusicAdviceService.ts
import { ApiKeyService } from './ApiKeyService';

export interface MusicAdvice {
  mood: string;
  genre: string;
  tempo: 'slow' | 'medium' | 'fast';
  description: string;
}

export class MusicAdviceService {
  private static MODEL = 'gemini-3.1-pro-preview';
  private static API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

  private static SYSTEM_PROMPT = `
你是一位顶级的电影配乐大师。
你的任务是根据一段视频的视觉描述，给出最专业、最匹配的背景音乐 (BGM) 建议。

请以 JSON 格式返回，包含字段:
- mood (字符串): 音乐的氛围（如：Epic, Cinematic, Calm, Energetic）。
- genre (字符串): 音乐风格（如：Electronic, Orchestral, Lo-fi）。
- tempo (字符串): 节奏快慢，必须为: "slow", "medium", "fast" 之一。
- description (字符串): 一句对该音乐风格的详细描述。
`;

  static async getAdvice(videoDescription: string): Promise<MusicAdvice> {
    const key = ApiKeyService.getNextKey();
    const url = `${this.API_URL}/${this.MODEL}:generateContent?key=${key}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `${this.SYSTEM_PROMPT}

视频描述：${videoDescription}` }]
          }],
          generationConfig: {
            response_mime_type: "application/json",
            thinking_level: "MEDIUM" // 音乐分析需要一定的感性推理
          }
        })
      });

      if (!response.ok) {
        throw new Error(`AI 音乐顾问响应失败: ${response.status}`);
      }

      const data = await response.json() as any;
      const content = JSON.parse(data.candidates[0].content.parts[0].text);

      return content as MusicAdvice;

    } catch (error: any) {
      console.error('❌ AI 音乐建议获取失败:', error.message);
      throw new Error(`AI 音乐顾问暂时无法响应: ${error.message}`);
    }
  }
}
