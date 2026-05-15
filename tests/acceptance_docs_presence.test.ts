import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import path from 'path'

const readDoc = (relativePath: string) =>
  readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

describe('长期文档入口守卫', () => {
  it('DEPLOYMENT 应保留 acceptance:deploy 与 acceptance:real 入口', () => {
    const content = readDoc('docs/DEPLOYMENT.md')

    expect(content).toContain('bun run acceptance:deploy')
    expect(content).toContain('E2E_REAL_CHANNELS=true bun run acceptance:real')
    expect(content).toContain('artifacts/deploy-acceptance/<timestamp>/summary.json')
    expect(content).toContain('artifacts/real-acceptance/<timestamp>/summary.json')
  })

  it('README、DEPLOYMENT、RELEASE_CHECKLIST 不应再把阶段性结项文档当主入口', () => {
    const readme = readDoc('README.md')
    const deployment = readDoc('docs/DEPLOYMENT.md')
    const checklist = readDoc('docs/RELEASE_CHECKLIST.md')

    const disallowedReferences = [
      'RD_CLOSURE_2026-03-07.md',
      'LOCAL_CLOSURE_2026-03-09.md',
      'DELIVERY_CLOSURE_2026-03-09.md',
      'DOCKER_ACCEPTANCE_2026-03-09.md',
      'REMAINING_TASKS.md'
    ]

    for (const ref of disallowedReferences) {
      expect(readme).not.toContain(ref)
      expect(deployment).not.toContain(ref)
      expect(checklist).not.toContain(ref)
    }
  })

  it('README 与 RELEASE_CHECKLIST 应引用新的工程流程入口', () => {
    const readme = readDoc('README.md')
    const checklist = readDoc('docs/RELEASE_CHECKLIST.md')

    expect(readme).toContain('docs/ENGINEERING_WORKFLOW.md')
    expect(readme).toContain('docs/TDD_WORKFLOW.md')
    expect(readme).toContain('docs/superpowers/README.md')
    expect(checklist).toContain('docs/ENGINEERING_WORKFLOW.md')
    expect(checklist).toContain('docs/TDD_WORKFLOW.md')
  })
})
