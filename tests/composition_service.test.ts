import { describe, it, expect } from 'bun:test'
import type { TimelineData } from '@veomuse/shared'
import { CompositionService } from '../apps/backend/src/services/CompositionService'

describe('FFmpeg 合成服务验证', () => {
  process.env.NODE_ENV = 'test'

  it('CompositionService 应能正确导出', () => {
    expect(CompositionService).toBeDefined()
    expect(typeof CompositionService.compose).toBe('function')
  })

  it('应能正确解析单轨道多片段数据并返回合成结果', async () => {
    const mockTimelineData: TimelineData = {
      tracks: [
        {
          id: 'track-1',
          name: '主视频轨',
          type: 'video',
          clips: [
            { id: 'c1', start: 0, end: 5, src: 'input1.mp4', name: '片段 1', type: 'video' },
            { id: 'c2', start: 5, end: 10, src: 'input2.mp4', name: '片段 2', type: 'video' }
          ]
        }
      ]
    }

    const result = await CompositionService.compose(mockTimelineData)
    expect(result.success).toBe(true)
    expect(result.outputPath).toContain('.mp4')
  })

  it('应能正确生成带音频和文字描述的合成指令', async () => {
    const complexData: TimelineData = {
      tracks: [
        {
          id: 'v1',
          name: '视频轨',
          type: 'video',
          clips: [{ id: 'cv1', start: 0, end: 5, src: 'v.mp4', name: '视频片段', type: 'video' }]
        },
        {
          id: 'a1',
          name: '音频轨',
          type: 'audio',
          clips: [{ id: 'ca1', start: 0, end: 5, src: 'a.mp3', name: '音频片段', type: 'audio' }]
        },
        {
          id: 't1',
          name: '文字轨',
          type: 'text',
          clips: [
            {
              id: 'ct1',
              start: 1,
              end: 4,
              src: 'text://overlay',
              name: '字幕',
              type: 'text',
              data: { content: 'Test' }
            }
          ]
        }
      ]
    }

    const result = await CompositionService.compose(complexData)
    expect(result.success).toBe(true)
  })

  it('4K HDR 导出应生成带 4K_HDR 前缀的输出文件名', async () => {
    const fourKHdrData: TimelineData = {
      tracks: [
        {
          id: 'v1',
          name: 'HDR 轨道',
          type: 'video',
          clips: [
            { id: 'clip-4k', start: 0, end: 3, src: 'demo.mp4', name: 'HDR 片段', type: 'video' }
          ]
        }
      ],
      exportConfig: { quality: '4k-hdr' }
    }

    const result = await CompositionService.compose(fourKHdrData)

    expect(result.success).toBe(true)
    expect(result.outputPath).toContain('4K_HDR_')
  })

  it('应生成 4K HDR 与空间视频对应的编码参数', () => {
    const hdrOptions = CompositionService.resolveOutputOptions('4k-hdr')
    const spatialOptions = CompositionService.resolveOutputOptions('spatial-vr')

    expect(hdrOptions).toContain('-vf scale=3840:2160')
    expect(hdrOptions).toContain('-color_primaries bt2020')
    expect(spatialOptions).toContain('-metadata:s:v:0 horizontal_disparity=0.05')
    expect(spatialOptions).toContain('-metadata:s:v:1 eye_view=right')
  })
})
