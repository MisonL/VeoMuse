// apps/backend/src/services/AiDirectorService.ts
import { BaseAiService } from './BaseAiService';
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
  worldId: string;
  scenes: Scene[];
}

export class AiDirectorService extends BaseAiService {
  protected serviceName = 'AI-Director';
  private static instance = new AiDirectorService();

  private static MODEL = 'gemini-3.1-pro-preview';
  private static API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

  // 强化 Prompt，确保 JSON 结构 100% 包含 worldId
  private static SYSTEM_PROMPT = `
你是一位好莱坞顶级的数字导演。请将脚本拆解为 Storyboard JSON。
必须包含字段: 
- storyTitle: 故事标题
- worldId: 全局唯一的场景种子字符串 (8位随机字符)
- scenes: 分镜数组
`;

  static async analyzeScript(script: string): Promise<DirectorResponse> {
    const key = ApiKeyService.getNextKey();
    const url = `${this.API_URL}/${this.MODEL}:generateContent?key=${key}`;

    const { data } = await this.instance.request<any>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${this.SYSTEM_PROMPT}\n\n脚本内容：${script}` }] }],
        generationConfig: { response_mime_type: "application/json", thinking_level: "HIGH" }
      })
    });

    const content = this.instance.parseGeminiJson(data);
    
    // 强制校验与兜底生成，确保链路一致性
    return {
      success: true,
      storyTitle: content.storyTitle || '未命名故事',
      worldId: content.worldId || `w-${Math.random().toString(36).substring(7)}`,
      scenes: content.scenes || []
    };
  }
}
