// apps/backend/src/services/BaseAiService.ts
import { ApiKeyService } from './ApiKeyService';

export interface PerformanceMetrics {
  durationMs: number;
  timestamp: string;
  endpoint: string;
}

export abstract class BaseAiService {
  protected abstract serviceName: string;

  protected async request<T>(
    url: string, 
    options: RequestInit, 
    retries: number = 3
  ): Promise<{ data: T; metrics: PerformanceMetrics }> {
    const startTime = performance.now();
    let lastError: Error | null = null;

    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`[${this.serviceName}] HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json() as any;
        const endTime = performance.now();
        const durationMs = Math.round(endTime - startTime);

        const metrics: PerformanceMetrics = {
          durationMs,
          timestamp: new Date().toISOString(),
          endpoint: url.split('?')[0] || url // 修复：增加回退值处理 undefined
        };

        console.log(`📊 [Metrics] ${this.serviceName}: ${durationMs}ms | ${metrics.endpoint}`);
        return { data, metrics };

      } catch (error: any) {
        lastError = error;
        console.warn(`⚠️ [${this.serviceName}] 第 ${i + 1} 次重试失败: ${error.message}`);
        if (i < retries - 1) {
          await new Promise(r => setTimeout(r, Math.pow(2, i) * 500));
        }
      }
    }

    throw lastError || new Error(`[${this.serviceName}] 请求失败`);
  }

  protected parseGeminiJson(data: any): any {
    try {
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("AI 返回格式异常: 缺少 content.parts.text");
      return JSON.parse(text);
    } catch (e: any) {
      throw new Error(`解析 AI 响应失败: ${e.message}`);
    }
  }
}
