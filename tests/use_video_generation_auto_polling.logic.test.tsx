import './helpers/dom-test-setup'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { useVideoGenerationAutoPolling } from '../apps/frontend/src/components/Editor/comparison-lab/hooks/useVideoGenerationAutoPolling'

type PollingControllerProps = React.ComponentProps<typeof VideoGenerationAutoPollingHarness>

const defaultProps: PollingControllerProps = {
  labMode: 'creative',
  authProfile: { id: 'user_1', email: 'boss@example.com' },
  videoGenerationPollingEnabled: true,
  videoGenerationJobs: [
    {
      id: 'job_active',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      modelId: 'veo-3.1',
      generationMode: 'text_to_video',
      request: { prompt: 'city chase' },
      status: 'processing',
      providerStatus: 'running',
      operationName: 'op_1',
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  videoGenerationSelectedJobId: 'job_active',
  isVideoGenerationBusy: false,
  loadVideoGenerationJobs: async () => {},
  queryVideoGenerationJobDetail: async () => {},
  setIsVideoGenerationAutoSyncTicking: () => {},
  setVideoGenerationLastAutoSyncAt: () => {}
}

function VideoGenerationAutoPollingHarness(props: PollingControllerProps) {
  useVideoGenerationAutoPolling(props)
  return null
}

describe('useVideoGenerationAutoPolling 逻辑回归', () => {
  const originalSetInterval = globalThis.setInterval
  const originalClearInterval = globalThis.clearInterval
  let intervalCallback: (() => void | Promise<void>) | null = null

  beforeEach(() => {
    cleanup()
    intervalCallback = null
    globalThis.setInterval = ((handler: TimerHandler, _timeout?: number) => {
      intervalCallback = () => {
        if (typeof handler === 'function') {
          return handler()
        }
      }
      return 1 as any
    }) as typeof setInterval
    globalThis.clearInterval = mock(() => {}) as typeof clearInterval
  })

  afterEach(() => {
    cleanup()
    globalThis.setInterval = originalSetInterval
    globalThis.clearInterval = originalClearInterval
  })

  it('满足条件时应立即静默轮询，并按 6 秒注册后续轮询', async () => {
    const loadVideoGenerationJobs = mock(() => Promise.resolve())
    const queryVideoGenerationJobDetail = mock(() => Promise.resolve())
    const setIsVideoGenerationAutoSyncTicking = mock(() => {})
    const setVideoGenerationLastAutoSyncAt = mock(() => {})

    await act(async () => {
      render(
        <VideoGenerationAutoPollingHarness
          {...defaultProps}
          loadVideoGenerationJobs={loadVideoGenerationJobs}
          queryVideoGenerationJobDetail={queryVideoGenerationJobDetail}
          setIsVideoGenerationAutoSyncTicking={setIsVideoGenerationAutoSyncTicking}
          setVideoGenerationLastAutoSyncAt={setVideoGenerationLastAutoSyncAt}
        />
      )
      await Promise.resolve()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(loadVideoGenerationJobs).toHaveBeenCalledWith(false, { silent: true })
    })
    await waitFor(() => {
      expect(queryVideoGenerationJobDetail).toHaveBeenCalledWith('job_active', { silent: true })
    })
    expect(setIsVideoGenerationAutoSyncTicking).toHaveBeenCalledWith(true)
    expect(setIsVideoGenerationAutoSyncTicking).toHaveBeenCalledWith(false)
    expect(setVideoGenerationLastAutoSyncAt).toHaveBeenCalledTimes(1)
    expect(typeof setVideoGenerationLastAutoSyncAt.mock.calls[0]?.[0]).toBe('string')
    expect(intervalCallback).not.toBeNull()
  })

  it('忙碌中或无活跃任务时不应执行自动刷新', async () => {
    const loadVideoGenerationJobs = mock(() => Promise.resolve())
    const queryVideoGenerationJobDetail = mock(() => Promise.resolve())
    const setIsVideoGenerationAutoSyncTicking = mock(() => {})
    const setVideoGenerationLastAutoSyncAt = mock(() => {})

    const view = render(
      <VideoGenerationAutoPollingHarness
        {...defaultProps}
        isVideoGenerationBusy={true}
        loadVideoGenerationJobs={loadVideoGenerationJobs}
        queryVideoGenerationJobDetail={queryVideoGenerationJobDetail}
        setIsVideoGenerationAutoSyncTicking={setIsVideoGenerationAutoSyncTicking}
        setVideoGenerationLastAutoSyncAt={setVideoGenerationLastAutoSyncAt}
      />
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(loadVideoGenerationJobs).toHaveBeenCalledTimes(0)
    expect(queryVideoGenerationJobDetail).toHaveBeenCalledTimes(0)
    expect(setIsVideoGenerationAutoSyncTicking).toHaveBeenCalledTimes(0)
    expect(setVideoGenerationLastAutoSyncAt).toHaveBeenCalledTimes(0)
    expect(intervalCallback).not.toBeNull()

    view.rerender(
      <VideoGenerationAutoPollingHarness
        {...defaultProps}
        videoGenerationJobs={[]}
        videoGenerationSelectedJobId=""
        loadVideoGenerationJobs={loadVideoGenerationJobs}
        queryVideoGenerationJobDetail={queryVideoGenerationJobDetail}
        setIsVideoGenerationAutoSyncTicking={setIsVideoGenerationAutoSyncTicking}
        setVideoGenerationLastAutoSyncAt={setVideoGenerationLastAutoSyncAt}
      />
    )

    intervalCallback = null
    await act(async () => {
      await Promise.resolve()
    })
    expect(intervalCallback).toBeNull()
  })
})
