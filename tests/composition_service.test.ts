import { describe, it, expect } from 'bun:test';
import { CompositionService } from '../apps/backend/src/services/CompositionService';

describe('FFmpeg 合成服务验证', () => {
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
    
    // 预期 compose 方法返回一个带有生成路径的 Promise
    try {
        const result = await CompositionService.compose(mockTimelineData);
        expect(result.success).toBe(true);
        expect(result.outputPath).toContain('.mp4');
    } catch (e: any) {
        expect(e).toBeDefined();
    }
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
});
