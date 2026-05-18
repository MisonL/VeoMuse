import { describe, expect, it } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'fs'
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
    expect(agents).toContain('实施计划与实施记录写入 `docs/superpowers/plans/`')
    expect(agents).toContain('任务完成后，原 plan 文件应回写为实施记录')
    expect(agents).not.toContain(`<${'任务跟踪文件'}>`)
  })

  it('superpowers README 应索引所有已落盘 spec 与 plan 记录', () => {
    const readme = readDoc('docs/superpowers/README.md')
    const indexedDirs = ['docs/superpowers/specs', 'docs/superpowers/plans']

    for (const dir of indexedDirs) {
      const files = readdirSync(path.resolve(repoPath, dir))
        .filter((name) => name.endsWith('.md'))
        .sort()

      for (const file of files) {
        expect(readme).toContain(`${dir}/${file}`)
      }
    }
  })

  it('superpowers README 索引名称应匹配目标文档标题', () => {
    const readme = readDoc('docs/superpowers/README.md')
    const links = [...readme.matchAll(/- ([^：\n]+)：`(docs\/superpowers\/(?:specs|plans)\/[^`]+\.md)`/g)]

    expect(links.length).toBeGreaterThan(0)

    for (const [, label, target] of links) {
      const targetTitle = readDoc(target)
        .split('\n')
        .find((line) => line.startsWith('# '))

      expect(targetTitle).toBeDefined()
      expect(targetTitle).toContain(label)
    }
  })
})
