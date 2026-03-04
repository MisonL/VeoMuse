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

export type VideoGenerationOperationState =
  | 'queued'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'cancel_requested'
  | 'canceled'
  | 'unknown'

export interface QueryOperationResult {
  success: boolean
  status: GenerateResult['status']
  operationName: string
  state: VideoGenerationOperationState
  message: string
  provider?: string
  outputUrl?: string
  error?: string
  errorCode?: string
  raw?: Record<string, unknown>
}

export type CancelOperationState = 'cancel_requested' | 'canceled' | 'failed' | 'not_supported'

export interface CancelOperationResult {
  success: boolean
  status: GenerateResult['status']
  operationName: string
  state: CancelOperationState
  message: string
  provider?: string
  error?: string
  errorCode?: string
}

export interface VideoModelDriverCapabilities {
  supportsOperationQuery: boolean
  supportsOperationCancel: boolean
  supportedGenerationModes?: VideoGenerationMode[]
}

export interface VideoModelDriver {
  id: string
  name: string
  generate(params: GenerateParams, context?: GenerateRuntimeContext): Promise<GenerateResult>
  queryOperation?(
    operationName: string,
    context?: GenerateRuntimeContext
  ): Promise<QueryOperationResult>
  cancelOperation?(
    operationName: string,
    context?: GenerateRuntimeContext
  ): Promise<CancelOperationResult>
  getCapabilities?(): VideoModelDriverCapabilities
}
