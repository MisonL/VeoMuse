// apps/backend/src/services/AiDirectorService.ts
import { ApiKeyService } from './ApiKeyService';

export interface Scene {
  title: string;
  videoPrompt: string;
  audioPrompt: string;
  voiceoverText: string;
  duration: number;
}

export interface DirectorResponse {
  success: boolean;
  storyTitle: string;
  worldId: string; // 旗舰版新增：全局场景标识
  scenes: Scene[];
}

export class AiDirectorService {
  private static MODEL = 'gemini-3.1-pro-preview';
  private static API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

  private static SYSTEM_PROMPT = `
你是一位好莱坞顶级的数字导演。
你的任务是将用户提供的故事脚本，拆解为专业分镜列表。

关键要求：
1. 全场景一致性：你必须为整个故事生成一个唯一的 worldId (一个 8 位随机字符串) 和一段全局环境描述。
2. 镜头连续性：确保每个分镜的视觉风格严格统一。

请以 JSON 格式返回，包含字段: storyTitle, worldId, scenes。
`;

  static async analyzeScript(script: string): Promise<DirectorResponse> {
    const key = ApiKeyService.getNextKey();
    const url = `${this.API_URL}/${this.MODEL}:generateContent?key=${key}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${this.SYSTEM_PROMPT}\n\n脚本：${script}` }] }],
          generationConfig: { response_mime_type: "application/json", thinking_level: "HIGH" }
        })
      });

      const data = await response.json() as any;
      const content = JSON.parse(data.candidates[0].content.parts[0].text);

      return {
        success: true,
        storyTitle: content.storyTitle,
        worldId: content.worldId || `w-${Math.random().toString(36).substring(7)}`,
        scenes: content.scenes
      };
    } catch (error: any) {
      throw new Error(`导演分析失败: ${error.message}`);
    }
  }
}
