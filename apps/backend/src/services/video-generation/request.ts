import type {
  GenerateParams,
  VideoGenerationInputs,
  VideoGenerationMode
} from '../ModelDriver'
import {
  DEFAULT_MODEL_ID,
  isPlainObject,
  normalizeGenerationMode,
  normalizeInputs,
  normalizePrompt,
  throwValidationError,
  toNullableString,
  type DriverOptions,
  type VideoGenerationCreateInput
} from '../videoGenerationShared'

export interface NormalizedGenerationRequest {
  modelId: string
  generationMode: VideoGenerationMode
  text: string
  negativePrompt?: string
  options: DriverOptions
  inputs?: VideoGenerationInputs
}

export interface StoredGenerationRequestPayload {
  modelId?: string
  generationMode?: VideoGenerationMode
  prompt?: string
  text?: string
  negativePrompt?: string | null
  inputs?: VideoGenerationInputs | null
  options?: DriverOptions
}

export const normalizeGenerationRequest = (
  input: VideoGenerationCreateInput
): NormalizedGenerationRequest => {
  const workspaceId = String(input.workspaceId || '').trim() || undefined
  const modelId = String(input.modelId || DEFAULT_MODEL_ID).trim() || DEFAULT_MODEL_ID
  const generationMode = normalizeGenerationMode(input.generationMode)
  const text = normalizePrompt(input.prompt, input.text)
  const negativePrompt = toNullableString(input.negativePrompt) || undefined
  const inputs = normalizeInputs(input.inputs, workspaceId)
  const rawOptions = isPlainObject(input.options) ? input.options : {}
  const options: DriverOptions = {
    ...rawOptions,
    actorId: toNullableString(input.actorId) || undefined,
    consistencyStrength:
      typeof input.consistencyStrength === 'number' && Number.isFinite(input.consistencyStrength)
        ? input.consistencyStrength
        : undefined,
    syncLip: input.syncLip ?? input.sync_lip ?? undefined,
    worldLink: typeof input.worldLink === 'boolean' ? input.worldLink : undefined,
    worldId: toNullableString(input.worldId) || undefined
  }

  if (generationMode === 'text_to_video' && !text) {
    throwValidationError('text_to_video 模式需要 text/prompt')
  }

  if (generationMode === 'image_to_video') {
    if (!inputs?.image && !(inputs?.referenceImages && inputs.referenceImages.length)) {
      throwValidationError('image_to_video 模式需要 inputs.image 或 inputs.referenceImages')
    }
  }

  if (generationMode === 'first_last_frame_transition') {
    if (!inputs?.firstFrame || !inputs?.lastFrame) {
      throwValidationError(
        'first_last_frame_transition 模式需要 inputs.firstFrame 与 inputs.lastFrame'
      )
    }
  }

  if (generationMode === 'video_extend' && !inputs?.video) {
    throwValidationError('video_extend 模式需要 inputs.video')
  }

  return {
    modelId,
    generationMode,
    text,
    negativePrompt,
    options,
    inputs
  }
}

export const toVideoGenerationDriverParams = (
  input: VideoGenerationCreateInput
): GenerateParams => {
  const normalized = normalizeGenerationRequest(input)
  return {
    text: normalized.text,
    generationMode: normalized.generationMode,
    negativePrompt: normalized.negativePrompt,
    inputs: normalized.inputs,
    options: normalized.options
  }
}
