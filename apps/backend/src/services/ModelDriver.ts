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
    actorId?: string;
    consistencyStrength?: number;
    syncLip?: boolean;
    worldLink?: boolean;
    worldId?: string;
  };
}

export interface GenerateResult {
  success: boolean;
  status: 'ok' | 'degraded' | 'not_implemented' | 'error';
  operationName: string;
  message: string;
  provider?: string;
  error?: string;
}

export interface VideoModelDriver {
  id: string;
  name: string;
  generate(params: GenerateParams): Promise<GenerateResult>;
}
