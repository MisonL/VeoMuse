import { useCallback, useEffect, useState } from 'react'
import { normalizeVideoSourceInput, parseVideoReferenceInputs } from '../helpers'
import { requestJson } from '../api'
import type {
  AuthProfile,
  CapabilityPayload,
  LabMode,
  VideoGenerationCreatePayload,
  VideoGenerationJob,
  VideoGenerationJobStatus,
  VideoGenerationMode,
  VideoInputSourceType
} from '../types'
import { useVideoGenerationAutoPolling } from './useVideoGenerationAutoPolling'

type ShowToast = (
  message: string,
  type?: 'info' | 'success' | 'error' | 'warning'
) => void

interface UseVideoGenerationManagerParams {
  labMode: LabMode
  authProfile: AuthProfile | null
  capabilities: CapabilityPayload | null
  isCapabilitiesLoading: boolean
  workspaceId: string
  loadCapabilities: () => Promise<void>
  showToast: ShowToast
}

export const useVideoGenerationManager = ({
  labMode,
  authProfile,
  capabilities,
  isCapabilitiesLoading,
  workspaceId,
  loadCapabilities,
  showToast
}: UseVideoGenerationManagerParams) => {
  const [videoGenerationMode, setVideoGenerationMode] =
    useState<VideoGenerationMode>('text_to_video')
  const [videoGenerationModelId, setVideoGenerationModelId] = useState('veo-3.1')
  const [videoGenerationPrompt, setVideoGenerationPrompt] = useState('')
  const [videoGenerationNegativePrompt, setVideoGenerationNegativePrompt] = useState('')
  const [videoGenerationInputSourceType, setVideoGenerationInputSourceType] =
    useState<VideoInputSourceType>('url')
  const [videoGenerationImageInput, setVideoGenerationImageInput] = useState('')
  const [videoGenerationReferenceImagesInput, setVideoGenerationReferenceImagesInput] = useState('')
  const [videoGenerationVideoInput, setVideoGenerationVideoInput] = useState('')
  const [videoGenerationFirstFrameInput, setVideoGenerationFirstFrameInput] = useState('')
  const [videoGenerationLastFrameInput, setVideoGenerationLastFrameInput] = useState('')
  const [videoGenerationListLimit, setVideoGenerationListLimit] = useState('20')
  const [videoGenerationStatusFilter, setVideoGenerationStatusFilter] = useState<
    'all' | VideoGenerationJobStatus
  >('all')
  const [videoGenerationJobs, setVideoGenerationJobs] = useState<VideoGenerationJob[]>([])
  const [videoGenerationCursor, setVideoGenerationCursor] = useState('')
  const [videoGenerationHasMore, setVideoGenerationHasMore] = useState(false)
  const [videoGenerationSelectedJobId, setVideoGenerationSelectedJobId] = useState('')
  const [videoGenerationPollingEnabled, setVideoGenerationPollingEnabled] = useState(true)
  const [videoGenerationLastAutoSyncAt, setVideoGenerationLastAutoSyncAt] = useState('')
  const [isVideoGenerationAutoSyncTicking, setIsVideoGenerationAutoSyncTicking] = useState(false)
  const [isVideoGenerationBusy, setIsVideoGenerationBusy] = useState(false)

  const upsertVideoGenerationJob = useCallback((job: VideoGenerationJob) => {
    setVideoGenerationJobs((prev) => {
      const index = prev.findIndex((item) => item.id === job.id)
      if (index < 0) return [job, ...prev]
      const next = [...prev]
      next[index] = job
      return next
    })
  }, [])

  const createVideoGenerationTask = useCallback(async () => {
    const prompt = videoGenerationPrompt.trim()
    const negativePrompt = videoGenerationNegativePrompt.trim()
    const imageInput = normalizeVideoSourceInput(
      videoGenerationImageInput,
      videoGenerationInputSourceType
    )
    const videoInput = normalizeVideoSourceInput(
      videoGenerationVideoInput,
      videoGenerationInputSourceType
    )
    const firstFrameInput = normalizeVideoSourceInput(
      videoGenerationFirstFrameInput,
      videoGenerationInputSourceType
    )
    const lastFrameInput = normalizeVideoSourceInput(
      videoGenerationLastFrameInput,
      videoGenerationInputSourceType
    )
    const referenceImagesRaw = parseVideoReferenceInputs(videoGenerationReferenceImagesInput).map(
      (value) => normalizeVideoSourceInput(value, videoGenerationInputSourceType)
    )
    const referenceImages = referenceImagesRaw.filter(
      (item): item is NonNullable<typeof item> => item != null
    )

    if (videoGenerationMode === 'text_to_video' && !prompt) {
      showToast('文生视频模式需要填写 Prompt', 'warning')
      return
    }
    if (videoGenerationMode === 'image_to_video' && !imageInput && referenceImages.length === 0) {
      showToast('图生视频模式需要填写图片输入或参考图列表', 'warning')
      return
    }
    if (videoGenerationMode === 'video_extend' && !videoInput) {
      showToast('视频扩展模式需要填写视频输入', 'warning')
      return
    }
    if (
      videoGenerationMode === 'first_last_frame_transition' &&
      (!firstFrameInput || !lastFrameInput)
    ) {
      showToast('首末帧过渡模式需要同时填写首帧与末帧输入', 'warning')
      return
    }
    if (isVideoGenerationBusy) return

    const inputs: VideoGenerationCreatePayload['inputs'] = {}
    if (imageInput) inputs.image = imageInput
    if (referenceImages.length > 0) inputs.referenceImages = referenceImages
    if (videoInput) inputs.video = videoInput
    if (firstFrameInput) inputs.firstFrame = firstFrameInput
    if (lastFrameInput) inputs.lastFrame = lastFrameInput

    const payloadBody: VideoGenerationCreatePayload = {
      modelId: videoGenerationModelId.trim() || undefined,
      generationMode: videoGenerationMode,
      prompt: prompt || undefined,
      text: prompt || undefined,
      negativePrompt: negativePrompt || undefined,
      workspaceId: workspaceId.trim() || undefined,
      inputs: Object.keys(inputs).length > 0 ? inputs : undefined
    }

    setIsVideoGenerationBusy(true)
    try {
      const payload = await requestJson<{
        success: boolean
        job: VideoGenerationJob | null
        providerResult?: { status?: string; message?: string } | null
      }>('/api/video/generations', {
        method: 'POST',
        body: JSON.stringify(payloadBody)
      })
      if (!payload.job) {
        showToast('任务创建成功，但未返回任务对象', 'warning')
        return
      }
      setVideoGenerationSelectedJobId(payload.job.id)
      upsertVideoGenerationJob(payload.job)
      showToast(
        `视频任务已创建：${payload.job.id}（${payload.providerResult?.status || payload.job.status}）`,
        'success'
      )
    } catch (error: unknown) {
      const normalized = error instanceof Error ? error : new Error(String(error))
      showToast(normalized.message || '创建视频任务失败', 'error')
    } finally {
      setIsVideoGenerationBusy(false)
    }
  }, [
    isVideoGenerationBusy,
    showToast,
    upsertVideoGenerationJob,
    videoGenerationFirstFrameInput,
    videoGenerationImageInput,
    videoGenerationInputSourceType,
    videoGenerationLastFrameInput,
    videoGenerationMode,
    videoGenerationModelId,
    videoGenerationNegativePrompt,
    videoGenerationPrompt,
    videoGenerationReferenceImagesInput,
    videoGenerationVideoInput,
    workspaceId
  ])

  const loadVideoGenerationJobs = useCallback(
    async (append = false, options?: { silent?: boolean }) => {
      const limitRaw = videoGenerationListLimit.trim() || '20'
      const limit = Number.parseInt(limitRaw, 10)
      if (!Number.isFinite(limit) || limit <= 0) {
        showToast('视频任务列表 limit 必须是大于 0 的整数', 'warning')
        return
      }

      const cursor = append ? videoGenerationCursor.trim() : ''
      if (append && !cursor) {
        setVideoGenerationHasMore(false)
        return
      }
      if (isVideoGenerationBusy) return

      setIsVideoGenerationBusy(true)
      try {
        const query = new URLSearchParams({
          limit: String(Math.min(limit, 100))
        })
        if (workspaceId.trim()) query.set('workspaceId', workspaceId.trim())
        if (videoGenerationStatusFilter !== 'all') query.set('status', videoGenerationStatusFilter)
        if (cursor) query.set('cursor', cursor)
        if (videoGenerationModelId.trim()) query.set('modelId', videoGenerationModelId.trim())

        const payload = await requestJson<{
          success: boolean
          jobs: VideoGenerationJob[]
          page?: {
            cursor?: string | null
            nextCursor?: string | null
            limit?: number
            hasMore?: boolean
          }
        }>(`/api/video/generations?${query.toString()}`)
        const rows = payload.jobs || []
        setVideoGenerationJobs((prev) => {
          if (!append) return rows
          return [...prev, ...rows.filter((item) => prev.every((existing) => existing.id !== item.id))]
        })

        const inferredCursor = rows.length > 0 ? rows[rows.length - 1]?.createdAt || '' : ''
        const cursorFromPage =
          typeof payload.page?.nextCursor === 'string'
            ? payload.page.nextCursor
            : typeof payload.page?.cursor === 'string'
              ? payload.page.cursor
              : inferredCursor
        const hasMore =
          typeof payload.page?.hasMore === 'boolean'
            ? payload.page.hasMore
            : rows.length >= Math.min(limit, 100)
        setVideoGenerationCursor(cursorFromPage || '')
        setVideoGenerationHasMore(Boolean(cursorFromPage) && hasMore)
        if (!options?.silent) {
          showToast(`已加载 ${rows.length} 条视频任务`, 'success')
        }
      } catch (error: unknown) {
        const normalized = error instanceof Error ? error : new Error(String(error))
        if (!options?.silent) {
          showToast(normalized.message || '加载视频任务失败', 'error')
        }
      } finally {
        setIsVideoGenerationBusy(false)
      }
    },
    [
      isVideoGenerationBusy,
      showToast,
      videoGenerationCursor,
      videoGenerationListLimit,
      videoGenerationModelId,
      videoGenerationStatusFilter,
      workspaceId
    ]
  )

  const queryVideoGenerationJobDetail = useCallback(
    async (jobId?: string, options?: { silent?: boolean }) => {
      const targetJobId = String(jobId || videoGenerationSelectedJobId || '').trim()
      if (!targetJobId) {
        if (!options?.silent) showToast('请先选择任务 ID', 'info')
        return
      }
      if (isVideoGenerationBusy) return
      setIsVideoGenerationBusy(true)
      try {
        const payload = await requestJson<{ success: boolean; job: VideoGenerationJob }>(
          `/api/video/generations/${encodeURIComponent(targetJobId)}`
        )
        if (payload.job) {
          upsertVideoGenerationJob(payload.job)
          setVideoGenerationSelectedJobId(payload.job.id)
        }
        if (!options?.silent) {
          showToast(`任务详情已刷新：${payload.job?.status || '-'}`, 'success')
        }
      } catch (error: unknown) {
        const normalized = error instanceof Error ? error : new Error(String(error))
        if (!options?.silent) {
          showToast(normalized.message || '查询任务详情失败', 'error')
        }
      } finally {
        setIsVideoGenerationBusy(false)
      }
    },
    [isVideoGenerationBusy, showToast, upsertVideoGenerationJob, videoGenerationSelectedJobId]
  )

  const syncVideoGenerationJob = useCallback(
    async (jobId: string, options?: { silent?: boolean }) => {
      const normalizedJobId = jobId.trim()
      if (!normalizedJobId) return
      if (isVideoGenerationBusy) return
      setIsVideoGenerationBusy(true)
      try {
        const payload = await requestJson<{
          success: boolean
          job: VideoGenerationJob
          queryResult?: { state?: string; status?: string } | null
        }>(`/api/video/generations/${encodeURIComponent(normalizedJobId)}/sync`, {
          method: 'POST'
        })
        if (payload.job) {
          setVideoGenerationSelectedJobId(payload.job.id)
          upsertVideoGenerationJob(payload.job)
        }
        if (!options?.silent) {
          showToast(
            `同步完成：${payload.queryResult?.state || payload.job?.status || '-'}`,
            payload.job?.status === 'failed' ? 'warning' : 'success'
          )
        }
      } catch (error: unknown) {
        const normalized = error instanceof Error ? error : new Error(String(error))
        if (!options?.silent) {
          showToast(normalized.message || '同步任务失败', 'error')
        }
      } finally {
        setIsVideoGenerationBusy(false)
      }
    },
    [isVideoGenerationBusy, showToast, upsertVideoGenerationJob]
  )

  const retryVideoGenerationJob = useCallback(
    async (jobId: string) => {
      const normalizedJobId = jobId.trim()
      if (!normalizedJobId) return
      if (isVideoGenerationBusy) return
      setIsVideoGenerationBusy(true)
      try {
        const payload = await requestJson<{
          success: boolean
          job: VideoGenerationJob
          providerResult?: { status?: string } | null
        }>(`/api/video/generations/${encodeURIComponent(normalizedJobId)}/retry`, {
          method: 'POST'
        })
        setVideoGenerationSelectedJobId(payload.job.id)
        upsertVideoGenerationJob(payload.job)
        showToast(
          `重试任务已创建：${payload.job.id}（${payload.providerResult?.status || payload.job.status}）`,
          'success'
        )
      } catch (error: unknown) {
        const normalized = error instanceof Error ? error : new Error(String(error))
        showToast(normalized.message || '重试任务失败', 'error')
      } finally {
        setIsVideoGenerationBusy(false)
      }
    },
    [isVideoGenerationBusy, showToast, upsertVideoGenerationJob]
  )

  const cancelVideoGenerationJob = useCallback(
    async (jobId: string) => {
      const normalizedJobId = jobId.trim()
      if (!normalizedJobId) return
      if (isVideoGenerationBusy) return
      setIsVideoGenerationBusy(true)
      try {
        const payload = await requestJson<{
          success: boolean
          job: VideoGenerationJob
          cancelResult?: { state?: string } | null
        }>(`/api/video/generations/${encodeURIComponent(normalizedJobId)}/cancel`, {
          method: 'POST'
        })
        setVideoGenerationSelectedJobId(payload.job.id)
        upsertVideoGenerationJob(payload.job)
        showToast(
          `取消结果：${payload.cancelResult?.state || payload.job.status}`,
          payload.job.status === 'canceled' ? 'success' : 'info'
        )
      } catch (error: unknown) {
        const normalized = error instanceof Error ? error : new Error(String(error))
        showToast(normalized.message || '取消任务失败', 'error')
      } finally {
        setIsVideoGenerationBusy(false)
      }
    },
    [isVideoGenerationBusy, showToast, upsertVideoGenerationJob]
  )

  const refreshVideoGenerationJobDetail = useCallback(
    async (jobId: string) => {
      await queryVideoGenerationJobDetail(jobId)
    },
    [queryVideoGenerationJobDetail]
  )

  useEffect(() => {
    if (labMode !== 'creative' || !authProfile) return
    if (!capabilities && !isCapabilitiesLoading) {
      void loadCapabilities()
    }
    if (videoGenerationJobs.length === 0) {
      void loadVideoGenerationJobs(false, { silent: true })
    }
  }, [
    authProfile,
    capabilities,
    isCapabilitiesLoading,
    labMode,
    loadCapabilities,
    loadVideoGenerationJobs,
    videoGenerationJobs.length
  ])

  useVideoGenerationAutoPolling({
    labMode,
    authProfile,
    videoGenerationPollingEnabled,
    videoGenerationJobs,
    videoGenerationSelectedJobId,
    isVideoGenerationBusy,
    loadVideoGenerationJobs,
    queryVideoGenerationJobDetail,
    setIsVideoGenerationAutoSyncTicking,
    setVideoGenerationLastAutoSyncAt
  })

  return {
    videoGenerationMode,
    setVideoGenerationMode,
    videoGenerationModelId,
    setVideoGenerationModelId,
    videoGenerationPrompt,
    setVideoGenerationPrompt,
    videoGenerationNegativePrompt,
    setVideoGenerationNegativePrompt,
    videoGenerationInputSourceType,
    setVideoGenerationInputSourceType,
    videoGenerationImageInput,
    setVideoGenerationImageInput,
    videoGenerationReferenceImagesInput,
    setVideoGenerationReferenceImagesInput,
    videoGenerationVideoInput,
    setVideoGenerationVideoInput,
    videoGenerationFirstFrameInput,
    setVideoGenerationFirstFrameInput,
    videoGenerationLastFrameInput,
    setVideoGenerationLastFrameInput,
    videoGenerationListLimit,
    setVideoGenerationListLimit,
    videoGenerationStatusFilter,
    setVideoGenerationStatusFilter,
    videoGenerationJobs,
    videoGenerationCursor,
    videoGenerationHasMore,
    videoGenerationSelectedJobId,
    setVideoGenerationSelectedJobId,
    videoGenerationPollingEnabled,
    setVideoGenerationPollingEnabled,
    videoGenerationLastAutoSyncAt,
    isVideoGenerationAutoSyncTicking,
    isVideoGenerationBusy,
    createVideoGenerationTask,
    loadVideoGenerationJobs,
    queryVideoGenerationJobDetail,
    syncVideoGenerationJob,
    retryVideoGenerationJob,
    cancelVideoGenerationJob,
    refreshVideoGenerationJobDetail
  }
}
