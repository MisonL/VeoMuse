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

type ShowToast = (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void

interface UseVideoGenerationManagerParams {
  labMode: LabMode
  authProfile: AuthProfile | null
  capabilities: CapabilityPayload | null
  isCapabilitiesLoading: boolean
  workspaceId: string
  loadCapabilities: () => Promise<void>
  showToast: ShowToast
}

const resolveVideoGenerationErrorMessage = (error: unknown, fallbackMessage: string) => {
  if (error instanceof Error && error.message.trim()) return error.message
  const message = String(error || '').trim()
  return message || fallbackMessage
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

  const showVideoGenerationError = useCallback(
    (error: unknown, fallbackMessage: string, silent = false) => {
      if (silent) return
      showToast(resolveVideoGenerationErrorMessage(error, fallbackMessage), 'error')
    },
    [showToast]
  )
  const upsertVideoGenerationJob = useCallback((job: VideoGenerationJob) => {
    setVideoGenerationJobs((prev) => {
      const index = prev.findIndex((item) => item.id === job.id)
      if (index < 0) return [job, ...prev]
      const next = [...prev]
      next[index] = job
      return next
    })
  }, [])
  const selectAndUpsertVideoGenerationJob = useCallback(
    (job: VideoGenerationJob | null | undefined) => {
      if (!job) return false
      setVideoGenerationSelectedJobId(job.id)
      upsertVideoGenerationJob(job)
      return true
    },
    [upsertVideoGenerationJob]
  )
  const runVideoGenerationTask = useCallback(
    async <T>(
      task: () => Promise<T>,
      options: {
        fallbackMessage: string
        silent?: boolean
      }
    ) => {
      if (isVideoGenerationBusy) return null
      setIsVideoGenerationBusy(true)
      try {
        return await task()
      } catch (error: unknown) {
        showVideoGenerationError(error, options.fallbackMessage, options.silent)
        return null
      } finally {
        setIsVideoGenerationBusy(false)
      }
    },
    [isVideoGenerationBusy, showVideoGenerationError]
  )
  const applyVideoGenerationPage = useCallback(
    (
      rows: VideoGenerationJob[],
      append: boolean,
      limit: number,
      page?: {
        cursor?: string | null
        nextCursor?: string | null
        hasMore?: boolean
      }
    ) => {
      setVideoGenerationJobs((prev) => {
        if (!append) return rows
        return [
          ...prev,
          ...rows.filter((item) => prev.every((existing) => existing.id !== item.id))
        ]
      })

      const inferredCursor = rows.length > 0 ? rows[rows.length - 1]?.createdAt || '' : ''
      const cursorFromPage =
        typeof page?.nextCursor === 'string'
          ? page.nextCursor
          : typeof page?.cursor === 'string'
            ? page.cursor
            : inferredCursor
      const hasMore =
        typeof page?.hasMore === 'boolean' ? page.hasMore : rows.length >= Math.min(limit, 100)
      setVideoGenerationCursor(cursorFromPage || '')
      setVideoGenerationHasMore(Boolean(cursorFromPage) && hasMore)
    },
    []
  )

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

    const payload = await runVideoGenerationTask(
      () =>
        requestJson<{
          success: boolean
          job: VideoGenerationJob | null
          providerResult?: { status?: string; message?: string } | null
        }>('/api/video/generations', {
          method: 'POST',
          body: JSON.stringify(payloadBody)
        }),
      { fallbackMessage: '创建视频任务失败' }
    )
    if (!payload) return
    if (!payload.job) {
      showToast('任务创建成功，但未返回任务对象', 'warning')
      return
    }
    selectAndUpsertVideoGenerationJob(payload.job)
    showToast(
      `视频任务已创建：${payload.job.id}（${payload.providerResult?.status || payload.job.status}）`,
      'success'
    )
  }, [
    isVideoGenerationBusy,
    runVideoGenerationTask,
    selectAndUpsertVideoGenerationJob,
    showToast,
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
      const query = new URLSearchParams({
        limit: String(Math.min(limit, 100))
      })
      if (workspaceId.trim()) query.set('workspaceId', workspaceId.trim())
      if (videoGenerationStatusFilter !== 'all') query.set('status', videoGenerationStatusFilter)
      if (cursor) query.set('cursor', cursor)
      if (videoGenerationModelId.trim()) query.set('modelId', videoGenerationModelId.trim())

      const payload = await runVideoGenerationTask(
        () =>
          requestJson<{
            success: boolean
            jobs: VideoGenerationJob[]
            page?: {
              cursor?: string | null
              nextCursor?: string | null
              limit?: number
              hasMore?: boolean
            }
          }>(`/api/video/generations?${query.toString()}`),
        {
          fallbackMessage: '加载视频任务失败',
          silent: options?.silent
        }
      )
      if (!payload) return
      const rows = payload.jobs || []
      applyVideoGenerationPage(rows, append, limit, payload.page)
      if (!options?.silent) {
        showToast(`已加载 ${rows.length} 条视频任务`, 'success')
      }
    },
    [
      applyVideoGenerationPage,
      runVideoGenerationTask,
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
      const payload = await runVideoGenerationTask(
        () =>
          requestJson<{ success: boolean; job: VideoGenerationJob }>(
            `/api/video/generations/${encodeURIComponent(targetJobId)}`
          ),
        {
          fallbackMessage: '查询任务详情失败',
          silent: options?.silent
        }
      )
      if (!payload) return
      selectAndUpsertVideoGenerationJob(payload.job)
      if (!options?.silent) {
        showToast(`任务详情已刷新：${payload.job?.status || '-'}`, 'success')
      }
    },
    [
      runVideoGenerationTask,
      selectAndUpsertVideoGenerationJob,
      showToast,
      videoGenerationSelectedJobId
    ]
  )

  const syncVideoGenerationJob = useCallback(
    async (jobId: string, options?: { silent?: boolean }) => {
      const normalizedJobId = jobId.trim()
      if (!normalizedJobId) return
      const payload = await runVideoGenerationTask(
        () =>
          requestJson<{
            success: boolean
            job: VideoGenerationJob
            queryResult?: { state?: string; status?: string } | null
          }>(`/api/video/generations/${encodeURIComponent(normalizedJobId)}/sync`, {
            method: 'POST'
          }),
        {
          fallbackMessage: '同步任务失败',
          silent: options?.silent
        }
      )
      if (!payload) return
      selectAndUpsertVideoGenerationJob(payload.job)
      if (!options?.silent) {
        showToast(
          `同步完成：${payload.queryResult?.state || payload.job?.status || '-'}`,
          payload.job?.status === 'failed' ? 'warning' : 'success'
        )
      }
    },
    [runVideoGenerationTask, selectAndUpsertVideoGenerationJob, showToast]
  )

  const retryVideoGenerationJob = useCallback(
    async (jobId: string) => {
      const normalizedJobId = jobId.trim()
      if (!normalizedJobId) return
      const payload = await runVideoGenerationTask(
        () =>
          requestJson<{
            success: boolean
            job: VideoGenerationJob
            providerResult?: { status?: string } | null
          }>(`/api/video/generations/${encodeURIComponent(normalizedJobId)}/retry`, {
            method: 'POST'
          }),
        { fallbackMessage: '重试任务失败' }
      )
      if (!payload) return
      selectAndUpsertVideoGenerationJob(payload.job)
      showToast(
        `重试任务已创建：${payload.job.id}（${payload.providerResult?.status || payload.job.status}）`,
        'success'
      )
    },
    [runVideoGenerationTask, selectAndUpsertVideoGenerationJob, showToast]
  )

  const cancelVideoGenerationJob = useCallback(
    async (jobId: string) => {
      const normalizedJobId = jobId.trim()
      if (!normalizedJobId) return
      const payload = await runVideoGenerationTask(
        () =>
          requestJson<{
            success: boolean
            job: VideoGenerationJob
            cancelResult?: { state?: string } | null
          }>(`/api/video/generations/${encodeURIComponent(normalizedJobId)}/cancel`, {
            method: 'POST'
          }),
        { fallbackMessage: '取消任务失败' }
      )
      if (!payload) return
      selectAndUpsertVideoGenerationJob(payload.job)
      showToast(
        `取消结果：${payload.cancelResult?.state || payload.job.status}`,
        payload.job.status === 'canceled' ? 'success' : 'info'
      )
    },
    [runVideoGenerationTask, selectAndUpsertVideoGenerationJob, showToast]
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
