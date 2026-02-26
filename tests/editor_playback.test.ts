import { describe, it, expect } from 'bun:test';
import { useEditorStore } from '../apps/frontend/src/store/editorStore';

describe('编辑器播放状态验证', () => {
  it('默认状态应该是不在播放', () => {
    expect(useEditorStore.getState().isPlaying).toBe(false);
  });

  it('togglePlay 应能切换播放状态', () => {
    const { togglePlay } = useEditorStore.getState();
    togglePlay();
    expect(useEditorStore.getState().isPlaying).toBe(true);
    togglePlay();
    expect(useEditorStore.getState().isPlaying).toBe(false);
  });
});
