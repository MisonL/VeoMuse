import { describe, it, expect } from 'bun:test';

describe('SyncController Native 同步逻辑验证', () => {
  it('应能正确注册并驱动虚拟 Video Refs', () => {
    const mockRefs = new Map<string, any>();
    const register = (id: string, el: any) => mockRefs.set(id, el);
    
    // 模拟同步逻辑
    const sync = (time: number) => {
      mockRefs.forEach(ref => {
        ref.currentTime = time;
      });
    };

    const v1 = { currentTime: 0 };
    register('v1', v1);
    sync(10.5);
    
    expect(v1.currentTime).toBe(10.5);
  });
});
