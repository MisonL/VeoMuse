import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';

describe('主题系统物理层验证 (Phase 1)', () => {
  const cssPath = path.resolve(process.cwd(), 'apps/frontend/src/theme.css');

  it('theme.css 文件应物理存在', () => {
    let exists = false;
    try {
      readFileSync(cssPath);
      exists = true;
    } catch (e) {}
    expect(exists).toBe(true);
  });

  it('theme.css 应定义核心 Apple Pro 视觉变量', () => {
    const content = readFileSync(cssPath, 'utf8');
    
    // 验证背景与面板层级
    expect(content).toContain('--ap-bg');
    expect(content).toContain('--ap-panel');
    expect(content).toContain('--ap-card');
    
    // 验证强调色与边框
    expect(content).toContain('--ap-accent');
    expect(content).toContain('--ap-border');
    
    // 验证文字与圆角
    expect(content).toContain('--ap-text');
    expect(content).toContain('--ap-radius');
  });

  it('应定义玻璃面板 (Glass Panels) 专用变量', () => {
    const content = readFileSync(cssPath, 'utf8');
    expect(content).toContain('--ap-blur');
    expect(content).toContain('--ap-saturate');
  });
});
