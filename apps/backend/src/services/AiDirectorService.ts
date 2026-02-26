// apps/backend/src/services/AiDirectorService.ts
import { ApiKeyService } from './ApiKeyService';

export interface Scene {
  title: string;
  videoPrompt: string;
  audioPrompt: string;
  voiceoverText: string;
  duration: number; // 建议时长 (s)
}

export interface DirectorResponse {
  success: boolean;
  storyTitle: string;
  scenes: Scene[];
}

export class AiDirectorService {
  private static MODEL = 'gemini-3.1-pro-preview';
  private static API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

  private static SYSTEM_PROMPT = `
你是一位好莱坞顶级的数字导演和编剧。
你的任务是将用户提供的一个故事脚本，拆解为适合 AI 生成的专业分镜列表（Storyboard）。

请以 JSON 格式返回，包含:
- storyTitle (字符串): 故事标题。
- scenes (数组): 包含以下字段:
    - title (字符串): 该镜头的简短名称。
    - videoPrompt (字符串): 该镜头的详细视频生成提示词。
    - audioPrompt (字符串): 推荐的配乐风格描述。
    - voiceoverText (字符串): 该镜头对应的配音文案（若有）。
    - duration (数字): 该镜头的时长（秒），通常为 3-10 秒。

逻辑要求：
1. 连贯性：镜头间的衔接要自然。
2. 完整性：从脚本的开始到结束都要覆盖。
`;

  static async analyzeScript(script: string): Promise<DirectorResponse> {
    const key = ApiKeyService.getNextKey();
    const url = `${this.API_URL}/${this.MODEL}:generateContent?key=${key}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `${this.SYSTEM_PROMPT}

故事脚本：${script}` }]
          }],
          generationConfig: {
            response_mime_type: "application/json",
            thinking_level: "HIGH" // 导演任务需要极高的逻辑推理
          }
        })
      });

      if (!response.ok) throw new Error(`导演服务响应失败: ${response.status}`);

      const data = await response.json() as any;
      const content = JSON.parse(data.candidates[0].content.parts[0].text);

      return {
        success: true,
        storyTitle: content.storyTitle,
        scenes: content.scenes
      };

    } catch (error: any) {
      console.error('❌ AI 导演分析失败:', error.message);
      throw new Error(`AI 导演引擎暂时无法响应: ${error.message}`);
    }
  }
}
