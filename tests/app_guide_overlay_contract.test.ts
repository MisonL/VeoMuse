import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import path from 'path'

describe('AppGuideOverlay 焦点管理契约', () => {
  it('应显式处理初始聚焦、Tab 圈定、Escape 关闭与焦点恢复', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'apps/frontend/src/components/App/AppGuideOverlay.tsx'),
      'utf8'
    )

    expect(source).toContain('previousFocusedElementRef')
    expect(source).toContain('primaryActionRef.current?.focus()')
    expect(source).toContain("event.key === 'Escape'")
    expect(source).toContain("event.key !== 'Tab'")
    expect(source).toContain('previousFocusedElementRef.current?.focus()')
  })
})
