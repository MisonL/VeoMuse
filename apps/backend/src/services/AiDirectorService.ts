// apps/backend/src/services/AiDirectorService.ts
import { BaseAiService } from './BaseAiService';
import { ApiKeyService } from './ApiKeyService';
import type { DirectorResponse } from '@veomuse/shared';

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

  private static createWorldId(script: string) {
    let hash = 2166136261;
    for (let i = 0; i < script.length; i += 1) {
      hash ^= script.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const token = Math.abs(hash).toString(36).slice(0, 8) || 'offline01';
    return `w-${token}`;
  }

  private static buildOfflineStoryboard(script: string): DirectorResponse {
    const chunks = script
      .split(/[\n。！？!?；;，,]/g)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 4);

    const units = chunks.length ? chunks : [script.trim() || '镜头内容待补充'];
    const duration = Math.max(2, Math.round(12 / units.length));
    const storyTitle = (units[0] || '离线故事').slice(0, 20);

    return {
      success: true,
      storyTitle,
      worldId: this.createWorldId(script),
      scenes: units.map((unit, index) => ({
        title: `镜头 ${index + 1}`,
        videoPrompt: unit,
        audioPrompt: `环境氛围：${unit}`,
        voiceoverText: unit,
        duration
      }))
    };
  }

  static async analyzeScript(script: string): Promise<DirectorResponse> {
    const availableKeys = ApiKeyService.getAvailableKeys();
    if (!availableKeys.length) {
      return this.buildOfflineStoryboard(script);
    }
    const key = ApiKeyService.getNextKey();

    const url = `${this.API_URL}/${this.MODEL}:generateContent?key=${key}`;
    try {
      const { data } = await this.instance.request<any>(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${this.SYSTEM_PROMPT}\n\n脚本内容：${script}` }] }],
          generationConfig: { response_mime_type: "application/json", thinking_level: "HIGH" }
        })
      });

      const content = this.instance.parseGeminiJson(data);
      const offline = this.buildOfflineStoryboard(script);
      const scenes = Array.isArray(content?.scenes) && content.scenes.length
        ? content.scenes
        : offline.scenes;

      return {
        success: true,
        storyTitle: content?.storyTitle || offline.storyTitle,
        worldId: content?.worldId || offline.worldId,
        scenes
      };
    } catch {
      return this.buildOfflineStoryboard(script);
    }
  }
}
