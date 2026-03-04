// apps/backend/src/services/ModelDriver.ts

export type VideoGenerationMode =
  | 'text_to_video'
  | 'image_to_video'
  | 'first_last_frame_transition'
  | 'video_extend'

export type VideoInputSourceType = 'url' | 'objectKey'

export interface VideoGenerationInputSource {
  sourceType: VideoInputSourceType
  value: string
  resolvedUrl: string
  mimeType?: string
}

export interface VideoGenerationInputs {
  image?: VideoGenerationInputSource
  referenceImages?: VideoGenerationInputSource[]
  firstFrame?: VideoGenerationInputSource
  lastFrame?: VideoGenerationInputSource
  video?: VideoGenerationInputSource
}

export interface GenerateParams {
  text?: string
  negativePrompt?: string
  aspectRatio?: string
  generationMode?: VideoGenerationMode
  inputs?: VideoGenerationInputs
  options?: {
    motionIntensity?: number
    quality?: 'standard' | 'high' | 'ultra'
    thinkingLevel?: 'LOW' | 'MEDIUM' | 'HIGH'
    creativeScale?: number
    creativeEffect?: string // 补齐 Pika 特效属性
    actorId?: string
    consistencyStrength?: number
    syncLip?: boolean
    worldLink?: boolean
    worldId?: string
    durationSeconds?: number
    numberOfVideos?: number
    resolution?: string
    fps?: number
    generateAudio?: boolean
    [key: string]: unknown
  }
}

export interface GenerateRuntimeContext {
  organizationId?: string
  workspaceId?: string
}

export interface GenerateResult {
  success: boolean
  status: 'ok' | 'degraded' | 'not_implemented' | 'error'
  operationName: string
  message: string
  provider?: string
  error?: string
}

export interface VideoModelDriver {
  id: string
  name: string
  generate(params: GenerateParams, context?: GenerateRuntimeContext): Promise<GenerateResult>
}
