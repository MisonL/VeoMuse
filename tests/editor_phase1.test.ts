import { describe, it, expect } from 'bun:test';
import { useEditorStore } from '../apps/frontend/src/store/editorStore';

describe('Phase 1 最终验证：时间轴数据流', () => {
  it('Store 应能正确注入初始片段并反映在状态中', () => {
    const store = useEditorStore.getState();
    store.addClip('track-1', {
      id: 'verify-clip',
      start: 10,
      end: 20,
      src: 'verify.mp4',
      name: '验证片段'
    });
    
    const track = useEditorStore.getState().tracks.find(t => t.id === 'track-1');
    expect(track?.clips.some(c => c.id === 'verify-clip')).toBe(true);
  });

  it('时间更新逻辑应保持毫秒级精度', () => {
    const { setCurrentTime } = useEditorStore.getState();
    setCurrentTime(12.3456);
    expect(useEditorStore.getState().currentTime).toBe(12.3456);
  });
});
