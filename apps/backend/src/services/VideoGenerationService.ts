import type { GenerateParams, GenerateRuntimeContext } from './ModelDriver'
import {
  type VideoGenerationCancelResult,
  type VideoGenerationCreateInput,
  type VideoGenerationJob,
  type VideoGenerationListQuery,
  type VideoGenerationListResult,
  type VideoGenerationRetryResult,
  type VideoGenerationSubmitResult,
  type VideoGenerationSyncBatchOptions,
  type VideoGenerationSyncBatchResult,
  type VideoGenerationSyncResult
} from './videoGenerationShared'
import {
  normalizeGenerationRequest,
  toVideoGenerationDriverParams,
  type NormalizedGenerationRequest
} from './video-generation/request'
import {
  cancelVideoGenerationJob,
  retryVideoGenerationJob,
  submitVideoGenerationJob
} from './video-generation/commands'
import { getVideoGenerationJobById, listVideoGenerationJobs } from './video-generation/queries'
import {
  syncPendingVideoGenerationJobsBatch,
  syncVideoGenerationJobById
} from './video-generation/sync'

export {
  VideoGenerationValidationError,
  type VideoGenerationInputsInput,
  type VideoGenerationJob,
  type VideoGenerationJobStatus,
  type VideoGenerationListQuery,
  type VideoGenerationListResult,
  type VideoGenerationCreateInput
} from './videoGenerationShared'

export class VideoGenerationService {
  static normalizeRequest(input: VideoGenerationCreateInput): NormalizedGenerationRequest {
    return normalizeGenerationRequest(input)
  }

  static toDriverParams(input: VideoGenerationCreateInput): GenerateParams {
    return toVideoGenerationDriverParams(input)
  }

  static async submit(
    input: VideoGenerationCreateInput,
    runtimeContext?: GenerateRuntimeContext
  ): Promise<VideoGenerationSubmitResult> {
    return submitVideoGenerationJob(input, runtimeContext)
  }

  static async syncByJobId(
    jobId: string,
    organizationId: string,
    runtimeContext?: GenerateRuntimeContext
  ): Promise<VideoGenerationSyncResult> {
    return syncVideoGenerationJobById(jobId, organizationId, runtimeContext)
  }

  static async retry(
    jobId: string,
    organizationId: string,
    runtimeContext?: GenerateRuntimeContext
  ): Promise<VideoGenerationRetryResult> {
    return retryVideoGenerationJob(jobId, organizationId, runtimeContext)
  }

  static async cancel(
    jobId: string,
    organizationId: string,
    runtimeContext?: GenerateRuntimeContext
  ): Promise<VideoGenerationCancelResult> {
    return cancelVideoGenerationJob(jobId, organizationId, runtimeContext)
  }

  static getById(id: string, organizationId: string): VideoGenerationJob | null {
    return getVideoGenerationJobById(id, organizationId)
  }

  static list(query: VideoGenerationListQuery): VideoGenerationListResult {
    return listVideoGenerationJobs(query)
  }

  static async syncPendingJobsBatch(
    options: VideoGenerationSyncBatchOptions = {}
  ): Promise<VideoGenerationSyncBatchResult> {
    return syncPendingVideoGenerationJobsBatch(options)
  }
}
