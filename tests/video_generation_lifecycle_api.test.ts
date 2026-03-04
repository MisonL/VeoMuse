import { describe, expect, it } from 'bun:test'
import { app } from '../apps/backend/src/index'
import { VideoOrchestrator } from '../apps/backend/src/services/VideoOrchestrator'
import { VideoGenerationService } from '../apps/backend/src/services/VideoGenerationService'
import { createAuthHeaders, createTestSession } from './helpers/auth'

const MODEL_ID = 'test-video-lifecycle-driver'
const operationState = new Map<
  string,
  {
    queryCount: number
    cancelRequested: boolean
  }
>()
let operationSeq = 0

VideoOrchestrator.registerDriver({
  id: MODEL_ID,
  name: 'Test Video Lifecycle Driver',
  async generate() {
    const operationName = `lifecycle-op-${Date.now()}-${operationSeq++}`
    operationState.set(operationName, {
      queryCount: 0,
      cancelRequested: false
    })
    return {
      success: true,
      status: 'ok',
      operationName,
      message: 'submitted',
      provider: MODEL_ID
    }
  },
  async queryOperation(operationName) {
    const state = operationState.get(operationName)
    if (!state) {
      return {
        success: false,
        status: 'error',
        operationName,
        state: 'failed',
        message: 'operation missing',
        provider: MODEL_ID,
        error: 'operation-missing',
        errorCode: 'OP_MISSING'
      }
    }
    if (state.cancelRequested) {
      return {
        success: true,
        status: 'ok',
        operationName,
        state: 'canceled',
        message: 'canceled by user',
        provider: MODEL_ID
      }
    }
    state.queryCount += 1
    if (state.queryCount === 1) {
      return {
        success: true,
        status: 'ok',
        operationName,
        state: 'processing',
        message: 'processing',
        provider: MODEL_ID
      }
    }
    return {
      success: true,
      status: 'ok',
      operationName,
      state: 'succeeded',
      message: 'done',
      provider: MODEL_ID,
      outputUrl: `https://cdn.local/${operationName}.mp4`
    }
  },
  async cancelOperation(operationName) {
    const state = operationState.get(operationName)
    if (!state) {
      return {
        success: false,
        status: 'error',
        operationName,
        state: 'failed',
        message: 'operation missing',
        provider: MODEL_ID,
        error: 'operation-missing',
        errorCode: 'OP_MISSING'
      }
    }
    state.cancelRequested = true
    return {
      success: true,
      status: 'ok',
      operationName,
      state: 'cancel_requested',
      message: 'cancel accepted',
      provider: MODEL_ID
    }
  },
  getCapabilities() {
    return {
      supportsOperationQuery: true,
      supportsOperationCancel: true,
      supportedGenerationModes: ['text_to_video']
    }
  }
})

describe('视频生成任务生命周期 API', () => {
  it('应支持 sync 流转到 processing/succeeded 并支持 retry', async () => {
    const session = await createTestSession('video-lifecycle-sync')
    const headers = createAuthHeaders(session.accessToken, {
      organizationId: session.organizationId,
      contentTypeJson: true
    })

    const createResp = await app.handle(
      new Request('http://localhost/api/video/generations', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          modelId: MODEL_ID,
          generationMode: 'text_to_video',
          prompt: '生成一段测试视频'
        })
      })
    )
    const createData = (await createResp.json()) as any
    expect(createResp.status).toBe(200)
    expect(createData.success).toBe(true)
    expect(createData.job.status).toBe('submitted')
    expect(typeof createData.job.operationName).toBe('string')
    const jobId = String(createData.job.id)

    const syncResp1 = await app.handle(
      new Request(`http://localhost/api/video/generations/${jobId}/sync`, {
        method: 'POST',
        headers
      })
    )
    const syncData1 = (await syncResp1.json()) as any
    expect(syncResp1.status).toBe(200)
    expect(syncData1.success).toBe(true)
    expect(syncData1.queryResult.state).toBe('processing')
    expect(syncData1.job.status).toBe('processing')

    const syncResp2 = await app.handle(
      new Request(`http://localhost/api/video/generations/${jobId}/sync`, {
        method: 'POST',
        headers
      })
    )
    const syncData2 = (await syncResp2.json()) as any
    expect(syncResp2.status).toBe(200)
    expect(syncData2.success).toBe(true)
    expect(syncData2.queryResult.state).toBe('succeeded')
    expect(syncData2.job.status).toBe('succeeded')
    expect(typeof syncData2.job.finishedAt).toBe('string')
    expect(typeof syncData2.job.durationMs).toBe('number')
    expect(String(syncData2.job.outputUrl || '')).toContain('https://cdn.local/')

    const retryResp = await app.handle(
      new Request(`http://localhost/api/video/generations/${jobId}/retry`, {
        method: 'POST',
        headers
      })
    )
    const retryData = (await retryResp.json()) as any
    expect(retryResp.status).toBe(200)
    expect(retryData.success).toBe(true)
    expect(retryData.job.status).toBe('submitted')
    expect(retryData.job.retryCount).toBeGreaterThanOrEqual(1)
    expect(retryData.providerResult.status).toBe('ok')
  })

  it('应支持 cancel -> cancel_requested -> canceled 状态流转', async () => {
    const session = await createTestSession('video-lifecycle-cancel')
    const headers = createAuthHeaders(session.accessToken, {
      organizationId: session.organizationId,
      contentTypeJson: true
    })

    const createResp = await app.handle(
      new Request('http://localhost/api/video/generations', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          modelId: MODEL_ID,
          generationMode: 'text_to_video',
          prompt: '生成后立即取消'
        })
      })
    )
    const createData = (await createResp.json()) as any
    expect(createResp.status).toBe(200)
    expect(createData.success).toBe(true)
    const jobId = String(createData.job.id)

    const cancelResp = await app.handle(
      new Request(`http://localhost/api/video/generations/${jobId}/cancel`, {
        method: 'POST',
        headers
      })
    )
    const cancelData = (await cancelResp.json()) as any
    expect(cancelResp.status).toBe(200)
    expect(cancelData.success).toBe(true)
    expect(cancelData.cancelResult.state).toBe('cancel_requested')
    expect(cancelData.job.status).toBe('cancel_requested')

    const syncResp = await app.handle(
      new Request(`http://localhost/api/video/generations/${jobId}/sync`, {
        method: 'POST',
        headers
      })
    )
    const syncData = (await syncResp.json()) as any
    expect(syncResp.status).toBe(200)
    expect(syncData.success).toBe(true)
    expect(syncData.queryResult.state).toBe('canceled')
    expect(syncData.job.status).toBe('canceled')
    expect(typeof syncData.job.finishedAt).toBe('string')

    const secondCancelResp = await app.handle(
      new Request(`http://localhost/api/video/generations/${jobId}/cancel`, {
        method: 'POST',
        headers
      })
    )
    const secondCancelData = (await secondCancelResp.json()) as any
    expect(secondCancelResp.status).toBe(400)
    expect(secondCancelData.success).toBe(false)
    expect(String(secondCancelData.error || '')).toContain('不支持取消')
  })

  it('应支持批量自动同步活跃任务并遵守 olderThan 门限', async () => {
    const session = await createTestSession('video-lifecycle-batch-sync')
    const headers = createAuthHeaders(session.accessToken, {
      organizationId: session.organizationId,
      contentTypeJson: true
    })

    const createResp = await app.handle(
      new Request('http://localhost/api/video/generations', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          modelId: MODEL_ID,
          generationMode: 'text_to_video',
          prompt: '自动同步任务'
        })
      })
    )
    const createData = (await createResp.json()) as any
    expect(createResp.status).toBe(200)
    expect(createData.success).toBe(true)
    const jobId = String(createData.job.id)

    const blockedByAge = await VideoGenerationService.syncPendingJobsBatch({
      limit: 10,
      olderThanMs: 60_000,
      organizationId: session.organizationId
    })
    expect(blockedByAge.syncedJobIds.includes(jobId)).toBe(false)

    const firstBatch = await VideoGenerationService.syncPendingJobsBatch({
      limit: 10,
      olderThanMs: 0,
      organizationId: session.organizationId
    })
    expect(firstBatch.scannedCount).toBeGreaterThanOrEqual(1)
    expect(firstBatch.syncedJobIds).toContain(jobId)

    const afterFirstSync = VideoGenerationService.getById(jobId, session.organizationId)
    expect(afterFirstSync?.status).toBe('processing')

    const secondBatch = await VideoGenerationService.syncPendingJobsBatch({
      limit: 10,
      olderThanMs: 0,
      organizationId: session.organizationId
    })
    expect(secondBatch.syncedJobIds).toContain(jobId)

    const afterSecondSync = VideoGenerationService.getById(jobId, session.organizationId)
    expect(afterSecondSync?.status).toBe('succeeded')
    expect(String(afterSecondSync?.outputUrl || '')).toContain('https://cdn.local/')
  })
})
