import { describe, it, expect, beforeAll } from 'bun:test';
import { Elysia, t } from 'elysia';
import { CompositionService } from '../apps/backend/src/services/CompositionService';

// 模拟待添加的路由
const app = new Elysia()
  .post('/api/video/compose', async ({ body }: { body: any }) => {
    try {
      return await CompositionService.compose(body.timelineData);
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }, {
    body: t.Object({
      timelineData: t.Any()
    })
  });

describe('Video Composition API 连通性验证', () => {
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
    
    // 在真实应用还未挂载这个路由时，将得到 404
    // 在模拟 app 下应当得到预期成功返回
    const data = await response.json() as any;
    expect(response.status).toBe(200);
    expect(data.success).toBe(true); 
  });
});
