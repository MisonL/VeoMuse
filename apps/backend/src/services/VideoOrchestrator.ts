// apps/backend/src/services/VideoOrchestrator.ts
import type {
  VideoModelDriver,
  GenerateParams,
  GenerateResult,
  GenerateRuntimeContext
} from './ModelDriver'
import { TelemetryService } from './TelemetryService'

export class VideoOrchestrator {
  private static drivers: Map<string, VideoModelDriver> = new Map()

  static registerDriver(driver: VideoModelDriver) {
    console.log(`📡 Model Orchestrator: 已注册模型驱动 [${driver.id}] - ${driver.name}`)
    this.drivers.set(driver.id, driver)
  }

  static async generate(
    modelId: string,
    params: GenerateParams,
    context?: GenerateRuntimeContext
  ): Promise<GenerateResult> {
    const driver = this.drivers.get(modelId)

    if (!driver) {
      throw new Error(`未找到模型驱动: ${modelId}。请确认驱动已注册。`)
    }

    console.log(`🚀 分发生成任务到驱动: ${driver.name}`)
    const start = Date.now()
    try {
      const result = await driver.generate(params, context)
      TelemetryService.getInstance().recordApiCall({
        service: `MODEL-${modelId}`,
        durationMs: Date.now() - start,
        success: result.success && result.status === 'ok',
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

  static getAvailableModels() {
    return Array.from(this.drivers.values()).map((d) => ({ id: d.id, name: d.name }))
  }
}
