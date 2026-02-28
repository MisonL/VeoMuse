import { describe, it, expect, beforeAll } from 'bun:test';
import { app } from '../apps/backend/src/index';

describe('Video Composition API 连通性验证', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
  });

  it('应能正确处理视频合成请求', async () => {
    const mockTimelineData = {
      tracks: [
        { id: 'track-1', clips: [{ id: 'c1', start: 0, end: 5, src: 'input1.mp4' }] }
      ]
    };

    const response = await app.handle(
      new Request('http://localhost/api/video/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timelineData: mockTimelineData })
      })
    );
    
    const data = await response.json() as any;
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('应支持空间视频导出参数', async () => {
    const mockTimelineData = {
      tracks: [
        { id: 'track-1', clips: [{ id: 'c1', start: 0, end: 5, src: 'input1.mp4' }] }
      ],
      exportConfig: { quality: 'spatial-vr' }
    };

    const response = await app.handle(
      new Request('http://localhost/api/video/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timelineData: mockTimelineData })
      })
    );

    const data = await response.json() as any;
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.outputPath).toContain('.mp4');
  });
});
