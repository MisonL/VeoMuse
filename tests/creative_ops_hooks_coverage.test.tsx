import './helpers/dom-test-setup'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { useV4CreativeOps } from '../apps/frontend/src/components/Editor/comparison-lab/hooks/useV4CreativeOps'
import { useVideoGenerationManager } from '../apps/frontend/src/components/Editor/comparison-lab/hooks/useVideoGenerationManager'

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

const flushAsyncWork = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const buildVideoJob = (patch: Record<string, unknown> = {}) => ({
  id: 'job_1',
  organizationId: 'org_1',
  workspaceId: 'ws_1',
  modelId: 'veo-3.1',
  generationMode: 'text_to_video',
  request: { prompt: 'city at night' },
  status: 'processing',
  providerStatus: 'running',
  operationName: 'operations/job_1',
  result: null,
  errorMessage: null,
  outputUrl: null,
  startedAt: null,
  finishedAt: null,
  durationMs: null,
  retryCount: 0,
  cancelRequestedAt: null,
  lastSyncedAt: null,
  createdBy: 'user_1',
  createdAt: '2026-04-24T00:00:00.000Z',
  updatedAt: '2026-04-24T00:00:00.000Z',
  ...patch
})

type VideoManagerState = ReturnType<typeof useVideoGenerationManager>
type V4CreativeOpsState = ReturnType<typeof useV4CreativeOps>

let videoManagerState: VideoManagerState | null = null
let v4CreativeOpsState: V4CreativeOpsState | null = null

const VideoGenerationHarness = (props: {
  showToast: (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void
  loadCapabilities: () => Promise<void>
}) => {
  videoManagerState = useVideoGenerationManager({
    labMode: 'compare',
    authProfile: { id: 'user_1', email: 'ops@example.com' },
    capabilities: {} as any,
    isCapabilitiesLoading: false,
    workspaceId: 'ws_1',
    loadCapabilities: props.loadCapabilities,
    showToast: props.showToast
  })
  return null
}

const V4CreativeOpsHarness = (props: {
  showToast: (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void
}) => {
  v4CreativeOpsState = useV4CreativeOps({
    projectId: 'project_1',
    currentActorName: '导演 A',
    parseJsonObjectInput: (raw, fieldName) => {
      try {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>
        }
        props.showToast(`${fieldName} 必须是 JSON 对象`, 'warning')
        return null
      } catch {
        props.showToast(`${fieldName} 不是合法 JSON`, 'warning')
        return null
      }
    },
    showToast: props.showToast
  })
  return null
}

describe('创意操作 hooks 覆盖补强', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    cleanup()
    videoManagerState = null
    v4CreativeOpsState = null
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    globalThis.fetch = originalFetch
  })

  it('useVideoGenerationManager 应覆盖创建、分页、详情、同步、重试与取消路径', async () => {
    const showToast = mock(() => {})
    const loadCapabilities = mock(() => Promise.resolve())
    const fetchMock = mock((input: string | URL, init?: RequestInit) => {
      const url = String(input)
      const method = String(init?.method || 'GET').toUpperCase()
      if (url.includes('/api/video/generations/job_1/sync')) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            job: buildVideoJob({ status: 'succeeded' }),
            queryResult: { state: 'done' }
          })
        )
      }
      if (url.includes('/api/video/generations/job_1/retry')) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            job: buildVideoJob({ id: 'job_retry', status: 'queued' }),
            providerResult: { status: 'queued' }
          })
        )
      }
      if (url.includes('/api/video/generations/job_1/cancel')) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            job: buildVideoJob({ status: 'canceled' }),
            cancelResult: { state: 'canceled' }
          })
        )
      }
      if (url.includes('/api/video/generations/job_1')) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            job: buildVideoJob({ status: 'succeeded' })
          })
        )
      }
      if (url.includes('/api/video/generations') && method === 'POST') {
        return Promise.resolve(
          jsonResponse({
            success: true,
            job: buildVideoJob({ status: 'queued' }),
            providerResult: { status: 'queued' }
          })
        )
      }
      if (url.includes('/api/video/generations')) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            jobs: [buildVideoJob()],
            page: { nextCursor: 'cursor_2', hasMore: true }
          })
        )
      }
      return Promise.resolve(jsonResponse({ success: true }))
    })
    globalThis.fetch = fetchMock as any

    await act(async () => {
      render(<VideoGenerationHarness showToast={showToast} loadCapabilities={loadCapabilities} />)
      await flushAsyncWork()
    })

    expect(loadCapabilities).toHaveBeenCalledTimes(0)
    await act(async () => {
      await videoManagerState?.loadVideoGenerationJobs(false, { silent: true })
      await flushAsyncWork()
    })
    expect(videoManagerState?.videoGenerationJobs).toHaveLength(1)
    expect(videoManagerState?.videoGenerationHasMore).toBe(true)

    await act(async () => {
      await videoManagerState?.createVideoGenerationTask()
    })
    expect(showToast).toHaveBeenCalledWith('文生视频模式需要填写 Prompt', 'warning')

    await act(async () => {
      videoManagerState?.setVideoGenerationPrompt('city at night')
      videoManagerState?.setVideoGenerationNegativePrompt('low quality')
      await flushAsyncWork()
    })
    await act(async () => {
      await videoManagerState?.createVideoGenerationTask()
      await videoManagerState?.loadVideoGenerationJobs(true)
      await videoManagerState?.queryVideoGenerationJobDetail('job_1')
      await videoManagerState?.syncVideoGenerationJob('job_1')
      await videoManagerState?.retryVideoGenerationJob('job_1')
      await videoManagerState?.cancelVideoGenerationJob('job_1')
      await videoManagerState?.refreshVideoGenerationJobDetail('job_1')
    })

    expect(videoManagerState?.videoGenerationSelectedJobId).toBe('job_1')
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('视频任务已创建'), 'success')
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('同步完成'), 'success')
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('取消结果'), 'success')

    await act(async () => {
      videoManagerState?.setVideoGenerationListLimit('0')
      await flushAsyncWork()
    })
    await act(async () => {
      await videoManagerState?.loadVideoGenerationJobs(false)
    })

    expect(showToast).toHaveBeenCalledWith('视频任务列表 limit 必须是大于 0 的整数', 'warning')
  })

  it('useV4CreativeOps 应覆盖 workflow、batch job 与 asset reuse 主路径', async () => {
    const showToast = mock(() => {})
    const fetchMock = mock((input: string | URL, init?: RequestInit) => {
      const url = String(input)
      const method = String(init?.method || 'GET').toUpperCase()
      if (url.includes('/api/v4/creative/prompt-workflows/wf_1/run')) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            run: { id: 'run_1', workflowId: 'wf_1', status: 'queued', createdAt: '2026-04-24' }
          })
        )
      }
      if (url.includes('/api/v4/creative/prompt-workflows/wf_1/runs')) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            runs: [
              { id: 'run_2', workflowId: 'wf_1', status: 'succeeded', createdAt: '2026-04-24' }
            ],
            page: { nextCursor: 'run_cursor', hasMore: true }
          })
        )
      }
      if (url.includes('/api/v4/creative/prompt-workflows') && method === 'POST') {
        return Promise.resolve(
          jsonResponse({
            success: true,
            workflow: {
              id: 'wf_1',
              name: '默认 Workflow',
              description: '',
              createdAt: '2026-04-24'
            }
          })
        )
      }
      if (url.includes('/api/v4/creative/prompt-workflows')) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            workflows: [
              { id: 'wf_1', name: '默认 Workflow', description: '', createdAt: '2026-04-24' }
            ]
          })
        )
      }
      if (url.includes('/api/v4/creative/batch-jobs/batch_1')) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            job: { id: 'batch_1', status: 'succeeded', jobType: 'render.batch' }
          })
        )
      }
      if (url.includes('/api/v4/creative/batch-jobs')) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            job: { id: 'batch_1', status: 'queued', jobType: 'render.batch' }
          })
        )
      }
      if (url.includes('/api/v4/assets/asset_1/reuse')) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            record: {
              id: 'reuse_1',
              assetId: 'asset_1',
              sourceProjectId: 'project_1',
              targetProjectId: 'project_2'
            }
          })
        )
      }
      if (url.includes('/api/v4/assets/reuse-history')) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            records: [
              {
                id: 'reuse_2',
                assetId: 'asset_2',
                sourceProjectId: 'project_1',
                targetProjectId: 'project_2'
              }
            ]
          })
        )
      }
      return Promise.resolve(jsonResponse({ success: true }))
    })
    globalThis.fetch = fetchMock as any

    await act(async () => {
      render(<V4CreativeOpsHarness showToast={showToast} />)
      await flushAsyncWork()
    })

    await act(async () => {
      await v4CreativeOpsState?.runV4Workflow()
    })
    expect(showToast).toHaveBeenCalledWith('请先选择 workflow', 'info')

    await act(async () => {
      await v4CreativeOpsState?.refreshV4Workflows()
      await flushAsyncWork()
    })
    await waitFor(() => {
      expect(v4CreativeOpsState?.v4SelectedWorkflowId).toBe('wf_1')
    })

    await act(async () => {
      await v4CreativeOpsState?.createV4Workflow()
      v4CreativeOpsState?.setV4SelectedWorkflowId('wf_1')
      v4CreativeOpsState?.setV4WorkflowRunPayload('{"topic":"launch"}')
      await flushAsyncWork()
    })
    await waitFor(() => {
      expect(v4CreativeOpsState?.v4SelectedWorkflowId).toBe('wf_1')
    })
    await act(async () => {
      await v4CreativeOpsState?.runV4Workflow()
      await v4CreativeOpsState?.queryV4WorkflowRuns(false)
      await flushAsyncWork()
    })
    expect(
      fetchMock.mock.calls.some((args) => String(args[0]).includes('/prompt-workflows/wf_1/runs'))
    ).toBe(true)
    await act(async () => {
      await v4CreativeOpsState?.queryV4WorkflowRuns(true)
    })

    await act(async () => {
      v4CreativeOpsState?.setV4BatchJobPayload(
        '{"workflowRunId":"run_1","createdBy":"导演 A","items":[{"itemKey":"shot_1","input":{"prompt":"wide"}}],"payload":{"quality":"high"}}'
      )
      await flushAsyncWork()
    })
    await act(async () => {
      await v4CreativeOpsState?.createV4BatchJob()
      await flushAsyncWork()
    })
    expect(v4CreativeOpsState?.v4BatchJobId).toBe('batch_1')

    await act(async () => {
      await v4CreativeOpsState?.queryV4BatchJob()
    })

    await act(async () => {
      v4CreativeOpsState?.setV4AssetReuseSourceId('asset_1')
      v4CreativeOpsState?.setV4AssetReuseTargetId('project_2')
      v4CreativeOpsState?.setV4AssetReuseNote('复用镜头')
      await flushAsyncWork()
    })
    await act(async () => {
      await v4CreativeOpsState?.callV4AssetReuse()
      await v4CreativeOpsState?.queryV4AssetReuseHistory()
    })

    await waitFor(() => {
      expect(v4CreativeOpsState?.v4BatchJobStatus?.status).toBe('succeeded')
    })
    await waitFor(() => {
      expect(v4CreativeOpsState?.v4AssetReuseResult?.id).toBe('reuse_1')
    })
    await waitFor(() => {
      expect(v4CreativeOpsState?.v4AssetReuseHistoryRecords).toHaveLength(1)
    })
    expect(showToast).toHaveBeenCalledWith('v4 Workflow 创建成功', 'success')
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Batch Job'), 'success')
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Asset Reuse'), 'success')
  })
})
