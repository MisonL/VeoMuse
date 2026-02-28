import { describe, expect, it } from 'bun:test';
import {
  filterTimelineActionsByWindow,
  getTimelineVirtualWindow,
  shouldEnableTimelineVirtualization
} from '../apps/frontend/src/utils/timelineVirtualization';

describe('时间轴虚拟化策略验证', () => {
  it('仅在长时间轴 + 高密度片段场景启用虚拟化', () => {
    expect(shouldEnableTimelineVirtualization(30, 120)).toBe(false);
    expect(shouldEnableTimelineVirtualization(100, 60)).toBe(false);
    expect(shouldEnableTimelineVirtualization(100, 120)).toBe(true);
  });

  it('应只渲染窗口内可见片段', () => {
    const clips = [
      { start: 0, end: 4 },
      { start: 10, end: 16 },
      { start: 50, end: 70 },
      { start: 92, end: 110 }
    ];
    const visible = filterTimelineActionsByWindow(clips, 20, 80);
    expect(visible.length).toBe(1);
    expect(visible[0].start).toBe(50);
  });

  it('窗口边界应按当前时间与总时长安全裁剪', () => {
    expect(getTimelineVirtualWindow(10, 120)).toEqual({ windowStart: 0, windowEnd: 55 });
    expect(getTimelineVirtualWindow(110, 120)).toEqual({ windowStart: 85, windowEnd: 120 });
  });
});
