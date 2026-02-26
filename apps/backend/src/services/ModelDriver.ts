// apps/backend/src/services/ModelDriver.ts

export interface GenerateParams {
  text: string;
  negativePrompt?: string;
  aspectRatio?: string;
  // 模型特有参数映射
  options?: {
    motionIntensity?: number; // 运镜强度 (0-10)
    quality?: 'standard' | 'high' | 'ultra'; // 渲染质量
    thinkingLevel?: 'LOW' | 'MEDIUM' | 'HIGH'; // 推理等级
    creativeScale?: number; // 创意权重
  };
}

export interface GenerateResult {
  success: boolean;
  operationName: string;
  message: string;
}

export interface VideoModelDriver {
  id: string;
  name: string;
  generate(params: GenerateParams): Promise<GenerateResult>;
}
