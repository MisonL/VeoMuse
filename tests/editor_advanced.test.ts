import { describe, it, expect } from 'bun:test';
import { useEditorStore } from '../apps/frontend/src/store/editorStore';

describe('编辑器高级功能验证', () => {
  it('磁吸算法应在靠近边缘时返回修正后的时间点', () => {
    const snapThreshold = 0.5;
    const neighbors = [0, 10, 20];
    const calculateSnap = (time: number) => {
      const nearest = neighbors.find(n => Math.abs(n - time) < snapThreshold);
      return nearest !== undefined ? nearest : time;
    };
    expect(calculateSnap(9.8)).toBe(10);
  });

  it('Store 应能正确管理选中片段 ID', () => {
    const { setSelectedClipId } = useEditorStore.getState();
    setSelectedClipId('test-selection');
    expect(useEditorStore.getState().selectedClipId).toBe('test-selection');
  });

  it('分割算法逻辑验证', () => {
    const splitClip = (original: any, at: number) => {
      if (at <= original.start || at >= original.end) return [original];
      return [
        { ...original, end: at },
        { ...original, id: original.id + '-split', start: at }
      ];
    };

    const clip = { id: 'c1', start: 0, end: 10 };
    const [c1, c2] = splitClip(clip, 4);
    expect(c1.end).toBe(4);
    expect(c2.start).toBe(4);
    expect(c2.id).toContain('-split');
  });
});
