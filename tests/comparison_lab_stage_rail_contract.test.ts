import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import path from 'path'

describe('ComparisonLab 阶段 rail 键盘导航契约', () => {
  it('应显式处理 Arrow/Home/End 导航并在切换后回焦到目标 tab', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'apps/frontend/src/components/Editor/ComparisonLab.tsx'),
      'utf8'
    )

    expect(source).toContain("event.key === 'ArrowRight'")
    expect(source).toContain("event.key === 'ArrowLeft'")
    expect(source).toContain("event.key === 'Home'")
    expect(source).toContain("event.key === 'End'")
    expect(source).toContain('focusStageButton(nextMode)')
    expect(source).toContain('onKeyDown={(event) => handleStageKeyDown(event, stageIndex)}')
  })
})
