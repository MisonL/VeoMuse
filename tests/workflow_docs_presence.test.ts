import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'fs'
import path from 'path'

const repoPath = process.cwd()

const readDoc = (relativePath: string) => {
  const target = path.resolve(repoPath, relativePath)
  expect(existsSync(target)).toBe(true)
  return readFileSync(target, 'utf8')
}

describe('superpowers 与 TDD 工作流文档守卫', () => {
  it('应存在长期工程流程与 superpowers 文档入口', () => {
    readDoc('docs/ENGINEERING_WORKFLOW.md')
    readDoc('docs/TDD_WORKFLOW.md')
    readDoc('docs/superpowers/README.md')
  })

  it('工程流程文档应明确 spec、plan、failing test、implementation、verification 顺序', () => {
    const engineering = readDoc('docs/ENGINEERING_WORKFLOW.md')
    const tdd = readDoc('docs/TDD_WORKFLOW.md')
    const superpowers = readDoc('docs/superpowers/README.md')

    expect(engineering).toContain('spec')
    expect(engineering).toContain('plan')
    expect(engineering).toContain('failing test')
    expect(engineering).toContain('implementation')
    expect(engineering).toContain('verification')

    expect(tdd).toContain('先写失败测试')
    expect(tdd).toContain('禁止先改实现再补测试')

    expect(superpowers).toContain('using-superpowers')
    expect(superpowers).toContain('brainstorming')
    expect(superpowers).toContain('writing-plans')
    expect(superpowers).toContain('test-driven-development')
  })

  it('仓库应落盘 AGENTS.md 作为本地执行约束入口', () => {
    const agents = readDoc('AGENTS.md')

    expect(agents).toContain('沟通语言')
    expect(agents).toContain('Debug-First')
    expect(agents).toContain('spec -> plan -> failing test -> implementation -> verification')
    expect(agents).toContain('git diff --check')
    expect(agents).not.toContain(`<${'任务跟踪文件'}>`)
  })
})
