// apps/backend/src/services/VideoOrchestrator.ts
import type {
  VideoModelDriver,
  GenerateParams,
  GenerateResult,
  GenerateRuntimeContext,
  QueryOperationResult,
  CancelOperationResult,
  VideoModelDriverCapabilities
} from './ModelDriver'
import { TelemetryService } from './TelemetryService'

export class VideoOrchestrator {
  private static drivers: Map<string, VideoModelDriver> = new Map()

  static registerDriver(driver: VideoModelDriver) {
    console.log(`📡 Model Orchestrator: 已注册模型驱动 [${driver.id}] - ${driver.name}`)
    this.drivers.set(driver.id, driver)
  }

  private static resolveDriver(modelId: string): VideoModelDriver {
    const driver = this.drivers.get(modelId)
    if (!driver) {
      throw new Error(`未找到模型驱动: ${modelId}。请确认驱动已注册。`)
    }
    return driver
  }

  static async generate(
    modelId: string,
    params: GenerateParams,
    context?: GenerateRuntimeContext
  ): Promise<GenerateResult> {
    const driver = this.resolveDriver(modelId)

    console.log(`🚀 分发生成任务到驱动: ${driver.name}`)
    const start = Date.now()
    try {
      const result = await driver.generate(params, context)
      TelemetryService.getInstance().recordApiCall({
        service: `MODEL-${modelId}`,
        durationMs: Date.now() - start,
        success: result.success && (result.status === 'ok' || result.status === 'degraded'),
        timestamp: new Date().toISOString()
      })
      return result
    } catch (error) {
      TelemetryService.getInstance().recordApiCall({
        service: `MODEL-${modelId}`,
        durationMs: Date.now() - start,
        success: false,
        timestamp: new Date().toISOString()
      })
      throw error
    }
  }

  static async queryOperation(
    modelId: string,
    operationName: string,
    context?: GenerateRuntimeContext
  ): Promise<QueryOperationResult> {
    const driver = this.resolveDriver(modelId)
    const normalizedOperationName = String(operationName || '').trim()
    if (!normalizedOperationName) {
      return {
        success: false,
        status: 'error',
        operationName: '',
        state: 'unknown',
        message: 'operationName 不能为空',
        provider: modelId,
        error: 'operationName is required'
      }
    }
    if (!driver.queryOperation) {
      return {
        success: false,
        status: 'not_implemented',
        operationName: normalizedOperationName,
        state: 'unknown',
        message: `${driver.name} 暂不支持状态查询`,
        provider: modelId,
        error: 'operation-query-not-supported'
      }
    }

    const start = Date.now()
    try {
      const result = await driver.queryOperation(normalizedOperationName, context)
      TelemetryService.getInstance().recordApiCall({
        service: `MODEL-${modelId}-QUERY`,
        durationMs: Date.now() - start,
        success: result.success,
        timestamp: new Date().toISOString()
      })
      return result
    } catch (error: any) {
      TelemetryService.getInstance().recordApiCall({
        service: `MODEL-${modelId}-QUERY`,
        durationMs: Date.now() - start,
        success: false,
        timestamp: new Date().toISOString()
      })
      return {
        success: false,
        status: 'error',
        operationName: normalizedOperationName,
        state: 'unknown',
        message: '驱动状态查询异常',
        provider: modelId,
        error: String(error?.message || error || 'unknown query error')
      }
    }
  }

  static async cancelOperation(
    modelId: string,
    operationName: string,
    context?: GenerateRuntimeContext
  ): Promise<CancelOperationResult> {
    const driver = this.resolveDriver(modelId)
    const normalizedOperationName = String(operationName || '').trim()
    if (!normalizedOperationName) {
      return {
        success: false,
        status: 'error',
        operationName: '',
        state: 'failed',
        message: 'operationName 不能为空',
        provider: modelId,
        error: 'operationName is required'
      }
    }
    if (!driver.cancelOperation) {
      return {
        success: false,
        status: 'not_implemented',
        operationName: normalizedOperationName,
        state: 'not_supported',
        message: `${driver.name} 暂不支持取消任务`,
        provider: modelId,
        error: 'operation-cancel-not-supported'
      }
    }

    const start = Date.now()
    try {
      const result = await driver.cancelOperation(normalizedOperationName, context)
      TelemetryService.getInstance().recordApiCall({
        service: `MODEL-${modelId}-CANCEL`,
        durationMs: Date.now() - start,
        success: result.success,
        timestamp: new Date().toISOString()
      })
      return result
    } catch (error: any) {
      TelemetryService.getInstance().recordApiCall({
        service: `MODEL-${modelId}-CANCEL`,
        durationMs: Date.now() - start,
        success: false,
        timestamp: new Date().toISOString()
      })
      return {
        success: false,
        status: 'error',
        operationName: normalizedOperationName,
        state: 'failed',
        message: '驱动取消任务异常',
        provider: modelId,
        error: String(error?.message || error || 'unknown cancel error')
      }
    }
  }

  static getCapabilities(modelId: string): VideoModelDriverCapabilities {
    const driver = this.resolveDriver(modelId)
    if (driver.getCapabilities) {
      return driver.getCapabilities()
    }
    return {
      supportsOperationQuery: Boolean(driver.queryOperation),
      supportsOperationCancel: Boolean(driver.cancelOperation)
    }
  }

  static getAvailableModels() {
    return Array.from(this.drivers.values()).map((d) => ({ id: d.id, name: d.name }))
  }
}
