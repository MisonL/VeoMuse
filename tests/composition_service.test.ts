import { describe, it, expect } from 'bun:test';
import { CompositionService } from '../apps/backend/src/services/CompositionService';

describe('FFmpeg 合成服务验证', () => {
  process.env.NODE_ENV = 'test';

  it('CompositionService 应能正确导出', () => {
    expect(CompositionService).toBeDefined();
    expect(typeof CompositionService.compose).toBe('function');
  });

  it('应能正确解析单轨道多片段数据并返回合成结果', async () => {
    const mockTimelineData = {
      tracks: [
        {
          id: 'track-1',
          clips: [
            { id: 'c1', start: 0, end: 5, src: 'input1.mp4' },
            { id: 'c2', start: 5, end: 10, src: 'input2.mp4' }
          ]
        }
      ]
    };
    
    const result = await CompositionService.compose(mockTimelineData);
    expect(result.success).toBe(true);
    expect(result.outputPath).toContain('.mp4');
  });

  it('应能正确生成带音频和文字描述的合成指令', async () => {
    const complexData = {
      tracks: [
        { id: 'v1', type: 'video', clips: [{ id: 'cv1', start: 0, end: 5, src: 'v.mp4' }] },
        { id: 'a1', type: 'audio', clips: [{ id: 'ca1', start: 0, end: 5, src: 'a.mp3' }] },
        { id: 't1', type: 'text', clips: [{ id: 'ct1', start: 1, end: 4, data: { content: 'Test' } }] }
      ]
    };
    
    // @ts-ignore
    const result = await CompositionService.compose(complexData);
    expect(result.success).toBe(true);
  });

  it('4K HDR 导出应生成带 4K_HDR 前缀的输出文件名', async () => {
    const result = await CompositionService.compose({
      tracks: [{ id: 'v1', type: 'video', clips: [{ id: 'clip-4k', start: 0, end: 3, src: 'demo.mp4' }] }],
      exportConfig: { quality: '4k-hdr' }
    } as any);

    expect(result.success).toBe(true);
    expect(result.outputPath).toContain('4K_HDR_');
  });

  it('应生成 4K HDR 与空间视频对应的编码参数', () => {
    const hdrOptions = CompositionService.resolveOutputOptions('4k-hdr');
    const spatialOptions = CompositionService.resolveOutputOptions('spatial-vr');

    expect(hdrOptions).toContain('-vf scale=3840:2160');
    expect(hdrOptions).toContain('-color_primaries bt2020');
    expect(spatialOptions).toContain('-metadata:s:v:0 horizontal_disparity=0.05');
    expect(spatialOptions).toContain('-metadata:s:v:1 eye_view=right');
  });
});
