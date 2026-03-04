import { describe, expect, it } from 'bun:test'
import {
  isVideoGenerationActiveStatus,
  resolveGeminiQuickCheck,
  resolveVideoGenerationRequiredInputs,
  resolveVideoGenerationStatusText,
  sortVideoGenerationJobsForWorkbench,
  type VideoGenerationJob
} from '../apps/frontend/src/components/Editor/comparison-lab/types'

describe('视频工作台类型分支', () => {
  it('resolveVideoGenerationRequiredInputs: 四种模式应返回预期必填输入', () => {
    expect(resolveVideoGenerationRequiredInputs('text_to_video')).toEqual([])
    expect(resolveVideoGenerationRequiredInputs('image_to_video')).toEqual([
      'image_or_referenceImages'
    ])
    expect(resolveVideoGenerationRequiredInputs('video_extend')).toEqual(['video'])
    expect(resolveVideoGenerationRequiredInputs('first_last_frame_transition')).toEqual([
      'firstFrame',
      'lastFrame'
    ])
  })

  it('resolveGeminiQuickCheck: 应覆盖 unknown/ready/missing 状态', () => {
    expect(resolveGeminiQuickCheck(null)).toEqual({
      status: 'unknown',
      title: 'Gemini 可用性未知',
      description: '先点击“Gemini 快速自检”刷新 /api/capabilities。'
    })

    expect(resolveGeminiQuickCheck({ models: { 'veo-3.1': true } })).toEqual({
      status: 'ready',
      title: 'Gemini Veo 3.1 已就绪',
      description: '可直接创建视频生成任务。'
    })

    expect(resolveGeminiQuickCheck({ models: { 'veo-3.1': false } })).toEqual({
      status: 'missing',
      title: 'Gemini Veo 3.1 未就绪',
      description: '请在渠道接入面板配置 Gemini Key/Endpoint 后重试。'
    })
  })

  it('视频任务状态文本与活跃状态判定应稳定', () => {
    expect(resolveVideoGenerationStatusText('processing')).toBe('生成中')
    expect(resolveVideoGenerationStatusText('cancel_requested')).toBe('取消中')
    expect(isVideoGenerationActiveStatus('queued')).toBe(true)
    expect(isVideoGenerationActiveStatus('processing')).toBe(true)
    expect(isVideoGenerationActiveStatus('failed')).toBe(false)
    expect(isVideoGenerationActiveStatus('canceled')).toBe(false)
  })

  it('工作台排序应优先活跃状态，再按更新时间倒序', () => {
    const jobs: VideoGenerationJob[] = [
      {
        id: 'job-c',
        organizationId: 'org',
        workspaceId: null,
        modelId: 'veo-3.1',
        generationMode: 'text_to_video',
        request: {},
        status: 'succeeded',
        providerStatus: 'ok',
        operationName: 'op-c',
        result: {},
        errorMessage: null,
        createdBy: 'tester',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:20.000Z'
      },
      {
        id: 'job-a',
        organizationId: 'org',
        workspaceId: null,
        modelId: 'veo-3.1',
        generationMode: 'text_to_video',
        request: {},
        status: 'processing',
        providerStatus: 'ok',
        operationName: 'op-a',
        result: {},
        errorMessage: null,
        createdBy: 'tester',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:10.000Z'
      },
      {
        id: 'job-b',
        organizationId: 'org',
        workspaceId: null,
        modelId: 'veo-3.1',
        generationMode: 'text_to_video',
        request: {},
        status: 'processing',
        providerStatus: 'ok',
        operationName: 'op-b',
        result: {},
        errorMessage: null,
        createdBy: 'tester',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:30.000Z'
      },
      {
        id: 'job-d',
        organizationId: 'org',
        workspaceId: null,
        modelId: 'veo-3.1',
        generationMode: 'text_to_video',
        request: {},
        status: 'failed',
        providerStatus: 'error',
        operationName: 'op-d',
        result: {},
        errorMessage: 'provider failed',
        createdBy: 'tester',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:40.000Z'
      }
    ]

    expect(sortVideoGenerationJobsForWorkbench(jobs).map((job) => job.id)).toEqual([
      'job-b',
      'job-a',
      'job-d',
      'job-c'
    ])
  })
})
