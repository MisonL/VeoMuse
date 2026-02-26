// apps/backend/src/services/VideoOrchestrator.ts
import type { VideoModelDriver, GenerateParams, GenerateResult } from './ModelDriver';

export class VideoOrchestrator {
  private static drivers: Map<string, VideoModelDriver> = new Map();

  static registerDriver(driver: VideoModelDriver) {
    console.log(`📡 Model Orchestrator: 已注册模型驱动 [${driver.id}] - ${driver.name}`);
    this.drivers.set(driver.id, driver);
  }

  static async generate(modelId: string, params: GenerateParams): Promise<GenerateResult> {
    const driver = this.drivers.get(modelId);
    
    if (!driver) {
      throw new Error(`未找到模型驱动: ${modelId}。请确认驱动已注册。`);
    }

    console.log(`🚀 分发生成任务到驱动: ${driver.name}`);
    return await driver.generate(params);
  }

  static getAvailableModels() {
    return Array.from(this.drivers.values()).map(d => ({ id: d.id, name: d.name }));
  }
}
