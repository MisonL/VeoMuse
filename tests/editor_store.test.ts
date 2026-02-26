import { describe, it, expect } from 'bun:test';
import { useEditorStore } from '../apps/frontend/src/store/editorStore';

describe('EditorStore 状态管理验证 (旗舰版)', () => {
  it('Store 应能正确初始化四轨道模型', () => {
    const state = useEditorStore.getState();
    expect(state.tracks.length).toBe(4);
    expect(state.tracks.map(t => t.type)).toContain('video');
    expect(state.tracks.map(t => t.type)).toContain('audio');
    expect(state.tracks.map(t => t.type)).toContain('mask');
  });

  it('addClip 应能向指定轨道添加片段', () => {
    const { addClip, tracks } = useEditorStore.getState();
    const initialCount = tracks.find(t => t.id === 'track-v1')?.clips.length || 0;
    const newClip: any = { 
      id: 'test-new-clip', 
      start: 0, 
      end: 5, 
      src: 'test.mp4', 
      name: '测试视频',
      type: 'video'
    };
    
    addClip('track-v1', newClip);
    
    const updatedTracks = useEditorStore.getState().tracks;
    const vTrack = updatedTracks.find(t => t.id === 'track-v1');
    expect(vTrack?.clips.length).toBe(initialCount + 1);
  });

  it('updateClip 应能更新片段属性', () => {
    const { updateClip } = useEditorStore.getState();
    // 使用 addClip 任务中添加的片段
    updateClip('track-v1', 'test-new-clip', { name: '已重命名' });
    
    const state = useEditorStore.getState();
    const clip = state.tracks.find(t => t.id === 'track-v1')?.clips.find(c => c.id === 'test-new-clip');
    expect(clip?.name).toBe('已重命名');
  });
});
