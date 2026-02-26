// apps/backend/src/services/InpaintService.ts
import { ApiKeyService } from './ApiKeyService';

export interface RepairAdvice {
  fixPrompt: string;
  technique: string;
  reason: string;
}

export class InpaintService {
  private static MODEL = 'gemini-3.1-pro-preview';
  private static API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

  private static SYSTEM_PROMPT = `
你是一位顶级的视频修复专家和生成式 AI 专家。
你的任务是根据视频中出现的不连贯点或错误描述，给出一个精准的修复 Prompt。

请以 JSON 格式返回，包含:
- fixPrompt (字符串): 用于重新生成该片段的增强提示词。
- technique (字符串): 建议使用的修复技术（如：Inpainting, Frame Interpolation, Redraw）。
- reason (字符串): 为什么目前画面出现问题的原因分析。
`;

  static async getRepairAdvice(problemDescription: string): Promise<RepairAdvice> {
    const key = ApiKeyService.getNextKey();
    const url = `${this.API_URL}/${this.MODEL}:generateContent?key=${key}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `${this.SYSTEM_PROMPT}

问题描述：${problemDescription}` }]
          }],
          generationConfig: {
            response_mime_type: "application/json",
            thinking_level: "HIGH"
          }
        })
      });

      if (!response.ok) throw new Error(`InpaintService 响应失败: ${response.status}`);

      const data = await response.json() as any;
      const content = JSON.parse(data.candidates[0].content.parts[0].text);

      return content as RepairAdvice;

    } catch (error: any) {
      console.error('❌ AI 修复建议失败:', error.message);
      throw new Error(`AI 修复引擎暂时无法响应: ${error.message}`);
    }
  }
}
