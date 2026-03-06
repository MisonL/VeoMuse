// apps/backend/src/services/BaseAiService.ts
import { TelemetryService } from './TelemetryService'
import { ProviderHttpClient, ProviderHttpError } from './providers/ProviderHttpClient'

export interface PerformanceMetrics {
  durationMs: number
  timestamp: string
  endpoint: string
}

export interface GeminiGenerateContentPart {
  text?: string
}

export interface GeminiGenerateContentContent {
  parts?: GeminiGenerateContentPart[]
}

export interface GeminiGenerateContentCandidate {
  content?: GeminiGenerateContentContent
}

export interface GeminiGenerateContentResponse {
  candidates?: GeminiGenerateContentCandidate[]
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return fallback
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null

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
    } catch (error: unknown) {
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
      if (error instanceof Error) {
        throw error
      }
      throw new Error(`[${this.serviceName}] ${getErrorMessage(error, '请求失败')}`)
    }
  }

  protected parseGeminiJson<T>(data: unknown): T {
    try {
      const dataRecord = asRecord(data)
      const candidates = dataRecord?.candidates
      const firstCandidate = Array.isArray(candidates) ? asRecord(candidates[0]) : null
      const content = asRecord(firstCandidate?.content)
      const firstPart = Array.isArray(content?.parts) ? asRecord(content.parts[0]) : null
      const text = typeof firstPart?.text === 'string' ? firstPart.text : undefined
      if (!text) throw new Error('AI 返回格式异常: 缺少 content.parts.text')
      return JSON.parse(text) as T
    } catch (error: unknown) {
      throw new Error(`解析 AI 响应失败: ${getErrorMessage(error, 'unknown parse error')}`)
    }
  }
}
