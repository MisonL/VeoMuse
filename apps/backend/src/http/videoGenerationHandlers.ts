import { VideoOrchestrator } from '../services/VideoOrchestrator'
import { OrganizationGovernanceService } from '../services/OrganizationGovernanceService'
import {
  VideoGenerationService,
  VideoGenerationValidationError
} from '../services/VideoGenerationService'
import type { VideoGenerationJobStatus } from '../services/VideoGenerationService'
import type { VideoGenerationInputsInput } from '../services/VideoGenerationService'
import { WorkspaceService } from '../services/WorkspaceService'
import {
  buildQuotaExceededResponse,
  parseBoundedLimit,
  resolveOrganizationContext,
  resolveRuntimeContext,
  resolveVideoGenerationJobContext
} from './context'

type MutableStatus = { status?: number | string }

type GenerationCreateBody = {
  modelId?: string
  generationMode?:
    | 'text_to_video'
    | 'image_to_video'
    | 'first_last_frame_transition'
    | 'video_extend'
  prompt?: string
  text?: string
  negativePrompt?: string
  options?: Record<string, unknown>
  actorId?: string
  consistencyStrength?: number
  syncLip?: boolean
  sync_lip?: boolean
  worldLink?: boolean
  worldId?: string
  workspaceId?: string
  inputs?: VideoGenerationInputsInput
}

type LegacyGenerateBody = {
  text: string
  modelId?: string
  negativePrompt?: string
  options?: Record<string, unknown>
  actorId?: string
  consistencyStrength?: number
  syncLip?: boolean
  sync_lip?: boolean
  worldLink?: boolean
  worldId?: string
  workspaceId?: string
}

type GenerationJobParams = {
  jobId: string
}

type GenerationListQuery = {
  workspaceId?: string
  status?: string
  modelId?: string
  cursor?: string
  limit?: string
}

const resolveGenerationContext = (
  params: GenerationJobParams,
  request: Request,
  set: MutableStatus
) => {
  const resolved = resolveVideoGenerationJobContext(params.jobId, request, set)
  if (!resolved) {
    if (set.status === 404) {
      return { response: { success: false, status: 'error', error: 'Generation job not found' } }
    }
    if (typeof set.status !== 'number' || set.status < 400) {
      set.status = 403
    }
    return { response: { success: false, status: 'error', error: 'Forbidden' } }
  }

  const runtimeContext = resolveRuntimeContext(request, set, resolved.job.workspaceId || undefined)
  if (!runtimeContext) {
    return { response: { success: false, status: 'error', error: 'Forbidden' } }
  }

  return { resolved, runtimeContext }
}

export const handleCreateVideoGeneration = async ({
  body,
  request,
  set
}: {
  body: GenerationCreateBody
  request: Request
  set: MutableStatus
}) => {
  const runtimeContext = resolveRuntimeContext(request, set, body.workspaceId)
  if (!runtimeContext) {
    return { success: false, status: 'error', error: 'Forbidden' }
  }
  try {
    let requestDenied: ReturnType<typeof OrganizationGovernanceService.consumeRequestQuota> | null =
      null
    const submitResult = await OrganizationGovernanceService.withConcurrencyLimit(
      runtimeContext.organizationId,
      async () => {
        const quotaConsumed = OrganizationGovernanceService.consumeRequestQuota(
          runtimeContext.organizationId,
          1
        )
        if (!quotaConsumed.allowed) {
          requestDenied = quotaConsumed
          return null
        }
        return await VideoGenerationService.submit(
          {
            organizationId: runtimeContext.organizationId,
            workspaceId: runtimeContext.workspaceId,
            createdBy: runtimeContext.actorName,
            modelId: body.modelId,
            generationMode: body.generationMode,
            prompt: body.prompt,
            text: body.text,
            negativePrompt: body.negativePrompt,
            options: body.options,
            actorId: body.actorId,
            consistencyStrength: body.consistencyStrength,
            syncLip: body.syncLip,
            sync_lip: body.sync_lip,
            worldLink: body.worldLink,
            worldId: body.worldId,
            inputs: body.inputs
          },
          runtimeContext
        )
      }
    )

    if (requestDenied) {
      set.status = 429
      return buildQuotaExceededResponse('request', requestDenied)
    }

    return {
      success: true,
      job: submitResult?.job || null,
      providerResult: submitResult?.providerResult || null
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error || '')
    if (message.includes('并发配额')) {
      const check = OrganizationGovernanceService.checkConcurrencyAllowed(
        runtimeContext.organizationId
      )
      set.status = 429
      return buildQuotaExceededResponse('concurrency', check)
    }
    set.status = 400
    return {
      success: false,
      status: 'error',
      error: message || 'Invalid video generation payload'
    }
  }
}

export const handleGetVideoGeneration = ({
  params,
  request,
  set
}: {
  params: GenerationJobParams
  request: Request
  set: MutableStatus
}) => {
  const resolved = resolveVideoGenerationJobContext(params.jobId, request, set)
  if (!resolved) {
    if (set.status === 404) {
      return { success: false, status: 'error', error: 'Generation job not found' }
    }
    if (typeof set.status !== 'number' || set.status < 400) set.status = 403
    return { success: false, status: 'error', error: 'Forbidden' }
  }
  return {
    success: true,
    job: resolved.job
  }
}

export const handleRetryVideoGeneration = async ({
  params,
  request,
  set
}: {
  params: GenerationJobParams
  request: Request
  set: MutableStatus
}) => {
  const context = resolveGenerationContext(params, request, set)
  if ('response' in context) return context.response

  try {
    let requestDenied: ReturnType<typeof OrganizationGovernanceService.consumeRequestQuota> | null =
      null
    const retryResult = await OrganizationGovernanceService.withConcurrencyLimit(
      context.runtimeContext.organizationId,
      async () => {
        const quotaConsumed = OrganizationGovernanceService.consumeRequestQuota(
          context.runtimeContext.organizationId,
          1
        )
        if (!quotaConsumed.allowed) {
          requestDenied = quotaConsumed
          return null
        }
        return await VideoGenerationService.retry(
          context.resolved.job.id,
          context.runtimeContext.organizationId,
          context.runtimeContext
        )
      }
    )
    if (requestDenied) {
      set.status = 429
      return buildQuotaExceededResponse('request', requestDenied)
    }
    return {
      success: true,
      job: retryResult?.job || null,
      providerResult: retryResult?.providerResult || null
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error || '')
    if (message.includes('并发配额')) {
      const check = OrganizationGovernanceService.checkConcurrencyAllowed(
        context.runtimeContext.organizationId
      )
      set.status = 429
      return buildQuotaExceededResponse('concurrency', check)
    }
    if (error instanceof VideoGenerationValidationError) {
      set.status = 400
      return {
        success: false,
        status: 'error',
        error: message || 'Video generation retry failed'
      }
    }
    throw error
  }
}

export const handleCancelVideoGeneration = async ({
  params,
  request,
  set
}: {
  params: GenerationJobParams
  request: Request
  set: MutableStatus
}) => {
  const context = resolveGenerationContext(params, request, set)
  if ('response' in context) return context.response

  try {
    const cancelResult = await VideoGenerationService.cancel(
      context.resolved.job.id,
      context.runtimeContext.organizationId,
      context.runtimeContext
    )
    return {
      success: true,
      job: cancelResult.job,
      cancelResult: cancelResult.cancelResult
    }
  } catch (error: unknown) {
    if (error instanceof VideoGenerationValidationError) {
      set.status = 400
      return {
        success: false,
        status: 'error',
        error: error.message || 'Video generation cancel failed'
      }
    }
    throw error
  }
}

export const handleSyncVideoGeneration = async ({
  params,
  request,
  set
}: {
  params: GenerationJobParams
  request: Request
  set: MutableStatus
}) => {
  const context = resolveGenerationContext(params, request, set)
  if ('response' in context) return context.response

  try {
    const syncResult = await VideoGenerationService.syncByJobId(
      context.resolved.job.id,
      context.runtimeContext.organizationId,
      context.runtimeContext
    )
    return {
      success: true,
      job: syncResult.job,
      queryResult: syncResult.queryResult
    }
  } catch (error: unknown) {
    if (error instanceof VideoGenerationValidationError) {
      set.status = 400
      return {
        success: false,
        status: 'error',
        error: error.message || 'Video generation sync failed'
      }
    }
    throw error
  }
}

export const handleListVideoGenerations = ({
  query,
  request,
  set
}: {
  query: GenerationListQuery
  request: Request
  set: MutableStatus
}) => {
  const organizationContext = resolveOrganizationContext(request, set, 'member')
  if (!organizationContext) {
    return { success: false, status: 'error', error: 'Forbidden' }
  }
  const workspaceId = query.workspaceId?.trim()
  const visibleWorkspaceIds = WorkspaceService.listWorkspaceIdsByUser(
    organizationContext.organizationId,
    organizationContext.user.id
  )
  if (workspaceId) {
    const workspace = WorkspaceService.getWorkspace(workspaceId)
    if (!workspace || workspace.organizationId !== organizationContext.organizationId) {
      set.status = 403
      return { success: false, status: 'error', error: 'Workspace not found in organization' }
    }
    const member = WorkspaceService.getMemberByUserId(workspaceId, organizationContext.user.id)
    if (!member) {
      set.status = 403
      return {
        success: false,
        status: 'error',
        error: 'Forbidden: workspace membership required'
      }
    }
  }
  const listed = VideoGenerationService.list({
    organizationId: organizationContext.organizationId,
    workspaceId: workspaceId || undefined,
    visibleWorkspaceIds: workspaceId ? [workspaceId] : visibleWorkspaceIds,
    status: query.status as VideoGenerationJobStatus | undefined,
    modelId: query.modelId?.trim() || undefined,
    cursor: query.cursor?.trim() || undefined,
    limit: parseBoundedLimit(query.limit, 20, 100)
  })
  return {
    success: true,
    jobs: listed.jobs,
    page: listed.page
  }
}

export const handleLegacyVideoGenerate = async ({
  body,
  request,
  set
}: {
  body: LegacyGenerateBody
  request: Request
  set: MutableStatus
}) => {
  const runtimeContext = resolveRuntimeContext(request, set, body.workspaceId)
  if (!runtimeContext) {
    return { success: false, status: 'error', error: 'Forbidden' }
  }
  try {
    let requestDenied: ReturnType<typeof OrganizationGovernanceService.consumeRequestQuota> | null =
      null
    const output = await OrganizationGovernanceService.withConcurrencyLimit(
      runtimeContext.organizationId,
      async () => {
        const quotaConsumed = OrganizationGovernanceService.consumeRequestQuota(
          runtimeContext.organizationId,
          1
        )
        if (!quotaConsumed.allowed) {
          requestDenied = quotaConsumed
          return null
        }

        const driverParams = VideoGenerationService.toDriverParams({
          organizationId: runtimeContext.organizationId,
          workspaceId: runtimeContext.workspaceId,
          createdBy: runtimeContext.actorName,
          modelId: body.modelId,
          text: body.text,
          negativePrompt: body.negativePrompt,
          options: body.options,
          actorId: body.actorId,
          consistencyStrength: body.consistencyStrength,
          syncLip: body.syncLip,
          sync_lip: body.sync_lip,
          worldLink: body.worldLink,
          worldId: body.worldId
        })
        return await VideoOrchestrator.generate(
          body.modelId || 'veo-3.1',
          driverParams,
          runtimeContext
        )
      }
    )

    if (requestDenied) {
      set.status = 429
      return buildQuotaExceededResponse('request', requestDenied)
    }
    return output
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error || '')
    if (message.includes('并发配额')) {
      const check = OrganizationGovernanceService.checkConcurrencyAllowed(
        runtimeContext.organizationId
      )
      set.status = 429
      return buildQuotaExceededResponse('concurrency', check)
    }
    if (error instanceof VideoGenerationValidationError) {
      set.status = 400
      return {
        success: false,
        status: 'error',
        error: message || 'Invalid video generation payload'
      }
    }
    throw error
  }
}
