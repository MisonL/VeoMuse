import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import path from 'path'

const readDoc = (relativePath: string) =>
  readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

describe('外部验收文档入口守卫', () => {
  it('DEPLOYMENT 应暴露 acceptance:deploy 与 acceptance:real 入口', () => {
    const content = readDoc('docs/DEPLOYMENT.md')

    expect(content).toContain('bun run acceptance:deploy')
    expect(content).toContain('bun run acceptance:real')
    expect(content).toContain('artifacts/deploy-acceptance/<timestamp>/summary.json')
    expect(content).toContain('artifacts/real-acceptance/<timestamp>/summary.json')
  })

  it('RELEASE_CHECKLIST 与 REMAINING_TASKS 应把后置验收切到新入口脚本', () => {
    const checklist = readDoc('docs/RELEASE_CHECKLIST.md')
    const remaining = readDoc('docs/REMAINING_TASKS.md')

    expect(checklist).toContain('bun run acceptance:deploy')
    expect(checklist).toContain('bun run acceptance:real')
    expect(remaining).toContain('bun run acceptance:deploy -- --base-url <target_url>')
    expect(remaining).toContain('bun run acceptance:real')
  })
})
