// apps/backend/src/services/ModelDriver.ts

export interface GenerateParams {
  text: string;
  negativePrompt?: string;
  aspectRatio?: string;
  options?: {
    motionIntensity?: number;
    quality?: 'standard' | 'high' | 'ultra';
    thinkingLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
    creativeScale?: number;
    creativeEffect?: string; // 补齐 Pika 特效属性
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
