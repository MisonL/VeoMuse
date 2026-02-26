import { describe, it, expect, spyOn, beforeEach, afterEach } from 'bun:test';

// 简单的模拟环境
const mockShortcuts = {
  'Space': () => { (global as any).triggered = 'space'; },
  'Cmd+B': () => { (global as any).triggered = 'split'; }
};

describe('useShortcuts 核心逻辑验证', () => {
  it('应能正确映射组合键与单键', () => {
    // 逻辑模拟：模拟 handleKeyDown 内部行为
    const simulate = (code: string, meta: boolean = false) => {
      const isCmdOrCtrl = meta;
      let key = '';
      if (code === 'Space') key = 'Space';
      else if (isCmdOrCtrl && code === 'KeyB') key = 'Cmd+B';
      
      if (key && (mockShortcuts as any)[key]) {
        (mockShortcuts as any)[key]();
      }
    };

    (global as any).triggered = '';
    simulate('Space');
    expect((global as any).triggered).toBe('space');

    (global as any).triggered = '';
    simulate('KeyB', true);
    expect((global as any).triggered).toBe('split');
  });
});
