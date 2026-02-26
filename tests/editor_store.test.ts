// tests/editor_store.test.ts
import { describe, it, expect } from 'bun:test';
import { useEditorStore } from '../apps/frontend/src/store/editorStore';

describe('EditorStore 状态管理验证', () => {
  it('Store 应能正确初始化默认轨道', () => {
    const state = useEditorStore.getState();
    expect(state.tracks.length).toBe(2);
    expect(state.tracks[0].name).toBe('主视频轨道');
  });

  it('addClip 应能向指定轨道添加片段', () => {
    const { addClip, tracks } = useEditorStore.getState();
    const initialCount = tracks[0].clips.length;
    const newClip = { 
      id: 'c1', 
      start: 0, 
      end: 5, 
      src: 'test.mp4', 
      name: '测试视频' 
    };
    
    addClip('track-1', newClip);
    
    const updatedTracks = useEditorStore.getState().tracks;
    expect(updatedTracks[0].clips.length).toBe(initialCount + 1);
    expect(updatedTracks[0].clips.find(c => c.id === 'c1')?.name).toBe('测试视频');
  });

  it('setCurrentTime 应能更新当前时间', () => {
    const { setCurrentTime } = useEditorStore.getState();
    setCurrentTime(10.5);
    expect(useEditorStore.getState().currentTime).toBe(10.5);
  });

  it('updateClip 应能更新片段的起始和结束时间', () => {
    const { updateClip, tracks } = useEditorStore.getState();
    // 假设初始有一个 id 为 demo-initial 的片段在 track-1
    updateClip('track-1', 'demo-initial', { start: 5, end: 15 });
    
    const clip = useEditorStore.getState().tracks[0].clips.find(c => c.id === 'demo-initial');
    expect(clip?.start).toBe(5);
    expect(clip?.end).toBe(15);
  });

  it('removeClip 应能删除指定片段', () => {
    const { removeClip } = useEditorStore.getState();
    removeClip('track-1', 'demo-initial');
    
    const clip = useEditorStore.getState().tracks[0].clips.find(c => c.id === 'demo-initial');
    expect(clip).toBeUndefined();
  });
});
