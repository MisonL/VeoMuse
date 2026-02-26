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

  private static SYSTEM_PROMPT = `你是一位好莱坞顶级的数字导演。请将故事脚本拆解为专业分镜 JSON (storyTitle, worldId, scenes)。`;

  static async analyzeScript(script: string): Promise<DirectorResponse> {
    const key = ApiKeyService.getNextKey();
    const url = `${this.API_URL}/${this.MODEL}:generateContent?key=${key}`;

    const { data } = await this.instance.request<any>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${this.SYSTEM_PROMPT}\n\n脚本：${script}` }] }],
        generationConfig: { response_mime_type: "application/json", thinking_level: "HIGH" }
      })
    });

    const content = this.instance.parseGeminiJson(data);
    return {
      success: true,
      storyTitle: content.storyTitle,
      worldId: content.worldId || `w-${Math.random().toString(36).substring(7)}`,
      scenes: content.scenes
    };
  }
}
