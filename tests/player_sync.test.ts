import { describe, expect, it } from 'bun:test';
import { SyncController } from '../apps/frontend/src/utils/SyncController';

const createMockMedia = () => {
  let paused = true;
  return {
    currentTime: 0,
    paused,
    style: { display: 'none' },
    load: () => {},
    pause() {
      paused = true;
      this.paused = true;
    },
    play() {
      paused = false;
      this.paused = false;
      return Promise.resolve();
    }
  } as any;
};

describe('SyncController Native 同步逻辑验证', () => {
  it('应能驱动可见片段并调整内部时间轴', () => {
    const controller = new SyncController();
    const video = createMockMedia();
    controller.registerVideo('v1', video);

    const stats = controller.sync(2.5, false, [{
      id: 'track-v1',
      type: 'video',
      clips: [{ id: 'v1', start: 2, end: 8, name: 'clip-1' }]
    }]);

    expect(video.style.display).toBe('block');
    expect(video.currentTime).toBe(0.5);
    expect(stats.processed).toBe(1);
    expect(stats.seekAdjusted).toBe(1);
  });

  it('长时间轴高密度场景应执行性能预算控制', () => {
    const controller = new SyncController();
    controller.setPerformanceBudget(30);

    const clips = Array.from({ length: 120 }).map((_, i) => {
      const id = `clip-${i}`;
      controller.registerVideo(id, createMockMedia());
      return { id, start: i, end: i + 1.8, name: id };
    });

    const stats = controller.sync(8.2, false, [{
      id: 'track-v1',
      type: 'video',
      clips
    }]);

    expect(stats.processed).toBeLessThanOrEqual(30);
    expect(stats.skipped).toBeGreaterThan(0);
    expect(controller.getLastSyncStats().processed).toBe(stats.processed);
  });
});
