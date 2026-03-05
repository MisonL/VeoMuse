import { useEffect } from 'react'
import { isVideoGenerationActiveStatus } from '../types'
import type { AuthProfile, LabMode, VideoGenerationJob } from '../types'

interface UseVideoGenerationAutoPollingParams {
  labMode: LabMode
  authProfile: AuthProfile | null
  videoGenerationPollingEnabled: boolean
  videoGenerationJobs: VideoGenerationJob[]
  videoGenerationSelectedJobId: string
  isVideoGenerationBusy: boolean
  loadVideoGenerationJobs: (append?: boolean, options?: { silent?: boolean }) => Promise<void>
  queryVideoGenerationJobDetail: (
    jobId?: string,
    options?: { silent?: boolean }
  ) => Promise<void>
  setIsVideoGenerationAutoSyncTicking: (value: boolean) => void
  setVideoGenerationLastAutoSyncAt: (value: string) => void
}

export const useVideoGenerationAutoPolling = ({
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
}: UseVideoGenerationAutoPollingParams) => {
  useEffect(() => {
    if (labMode !== 'creative' || !authProfile || !videoGenerationPollingEnabled) return
    const trackedJobs = videoGenerationJobs.filter((job) =>
      isVideoGenerationActiveStatus(job.status)
    )
    const selectedJobId = String(videoGenerationSelectedJobId || '').trim()
    if (trackedJobs.length === 0 && !selectedJobId) return

    const tick = async () => {
      if (isVideoGenerationBusy) return
      setIsVideoGenerationAutoSyncTicking(true)
      try {
        await loadVideoGenerationJobs(false, { silent: true })
        if (selectedJobId) {
          await queryVideoGenerationJobDetail(selectedJobId, { silent: true })
        }
        setVideoGenerationLastAutoSyncAt(new Date().toISOString())
      } finally {
        setIsVideoGenerationAutoSyncTicking(false)
      }
    }

    void tick()
    const timer = window.setInterval(() => {
      void tick()
    }, 6_000)

    return () => {
      window.clearInterval(timer)
    }
  }, [
    authProfile,
    isVideoGenerationBusy,
    labMode,
    loadVideoGenerationJobs,
    queryVideoGenerationJobDetail,
    setIsVideoGenerationAutoSyncTicking,
    setVideoGenerationLastAutoSyncAt,
    videoGenerationJobs,
    videoGenerationPollingEnabled,
    videoGenerationSelectedJobId
  ])
}
