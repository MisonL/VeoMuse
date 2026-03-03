// apps/backend/src/services/BaseAiService.ts
import { TelemetryService } from './TelemetryService'
import { ProviderHttpClient, ProviderHttpError } from './providers/ProviderHttpClient'

export interface PerformanceMetrics {
  durationMs: number
  timestamp: string
  endpoint: string
}

export abstract class BaseAiService {
  protected abstract serviceName: string

  protected async request<T>(
    url: string,
    options: RequestInit,
    retries: number = 3
  ): Promise<{ data: T; metrics: PerformanceMetrics }> {
    const startTime = performance.now()
    try {
      const { data } = await ProviderHttpClient.requestJson<T>(url, options, {
        maxRetries: Math.max(0, retries - 1)
      })
      const endTime = performance.now()
      const durationMs = Math.round(endTime - startTime)

      const metrics: PerformanceMetrics = {
        durationMs,
        timestamp: new Date().toISOString(),
        endpoint: url.split('?')[0] || url
      }

      // 推送到遥测系统
      TelemetryService.getInstance().recordApiCall({
        service: this.serviceName,
        durationMs,
        success: true,
        timestamp: metrics.timestamp
      })

      console.log(`📊 [Metrics] ${this.serviceName}: ${durationMs}ms | ${metrics.endpoint}`)
      return { data, metrics }
    } catch (error: any) {
      // 失败也推送遥测
      TelemetryService.getInstance().recordApiCall({
        service: this.serviceName,
        durationMs: Math.round(performance.now() - startTime),
        success: false,
        timestamp: new Date().toISOString()
      })

      if (error instanceof ProviderHttpError) {
        throw new Error(`[${this.serviceName}] ${error.code} (${error.traceId}): ${error.message}`)
      }
      throw error || new Error(`[${this.serviceName}] 请求失败`)
    }
  }

  protected parseGeminiJson(data: any): any {
    try {
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) throw new Error('AI 返回格式异常: 缺少 content.parts.text')
      return JSON.parse(text)
    } catch (e: any) {
      throw new Error(`解析 AI 响应失败: ${e.message}`)
    }
  }
}
