// apps/backend/src/services/AiClipService.ts
import { ApiKeyService } from './ApiKeyService';

export interface CutPoint {
  time: number; // 建议剪切的时间点 (s)
  reason: string; // 为什么在这里剪切的理由
}

export interface AiClipSuggestion {
  cutPoints: CutPoint[];
}

export class AiClipService {
  private static MODEL = 'gemini-3.1-pro-preview';
  private static API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

  private static SYSTEM_PROMPT = `
你是一位世界顶级的电影剪辑师。
你的任务是根据视频的内容描述和总时长，给出专业的剪辑打点建议。
这些打点用于指导用户在何处进行画面切换或加入特效，以增强视觉节奏感。

输入格式：
- 视频描述: [描述]
- 视频时长: [时长，秒]

输出要求：
请以 JSON 格式返回，必须包含一个 cutPoints 数组，每个元素包含：
- time (数字): 建议的剪切时间点（秒），需在总时长范围内。
- reason (字符串): 简短的剪切理由，例如“动作高潮”、“场景转换”、“音乐强拍”。

输出示例：
{
  "cutPoints": [
    { "time": 2.5, "reason": "动作起始" },
    { "time": 5.0, "reason": "场景切换" }
  ]
}
`;

  static async suggestCuts(description: string, durationSeconds: number): Promise<AiClipSuggestion> {
    const key = ApiKeyService.getNextKey();
    const url = `${this.API_URL}/${this.MODEL}:generateContent?key=${key}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `${this.SYSTEM_PROMPT}\n\n- 视频描述: ${description}\n- 视频时长: ${durationSeconds}` }]
          }],
          generationConfig: {
            response_mime_type: "application/json",
            // @ts-ignore
            thinking_level: "HIGH" 
          }
        })
      });

      if (!response.ok) {
        throw new Error(`AI 剪辑服务响应失败: ${response.status}`);
      }

      const data = await response.json() as any;
      const contentText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!contentText) {
         throw new Error("AI 剪辑服务返回格式异常");
      }

      const parsed = JSON.parse(contentText);
      return parsed as AiClipSuggestion;

    } catch (error: any) {
      console.error('❌ AI 智能剪辑打点失败:', error.message);
      throw new Error(`AI 剪辑引擎暂时无法响应: ${error.message}`);
    }
  }
}
