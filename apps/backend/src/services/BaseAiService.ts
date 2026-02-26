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

        const data = await response.json() as T;
        const endTime = performance.now();
        const durationMs = Math.round(endTime - startTime);

        const metrics: PerformanceMetrics = {
          durationMs,
          timestamp: new Date().toISOString(),
          endpoint: url.split('?')[0]
        };

        console.log(`📊 [Metrics] ${this.serviceName}: ${durationMs}ms | ${metrics.endpoint}`);
        return { data, metrics };

      } catch (error: any) {
        lastError = error;
        console.warn(`⚠️ [${this.serviceName}] 第 ${i + 1} 次重试失败: ${error.message}`);
        // 指数退避等待
        await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
      }
    }

    throw lastError || new Error(`[${this.serviceName}] 请求在 ${retries} 次重试后失败`);
  }

  // 子类实现具体的 API 逻辑
}
