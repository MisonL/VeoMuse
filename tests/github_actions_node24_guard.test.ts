import { describe, expect, it } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'fs'
import path from 'path'

const repoPath = process.cwd()
const workflowsDir = path.resolve(repoPath, '.github/workflows')
const requiredNode24Env = "FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: 'true'"

const readWorkflow = (fileName: string) => {
  const workflowPath = path.join(workflowsDir, fileName)
  expect(existsSync(workflowPath)).toBe(true)
  return readFileSync(workflowPath, 'utf8')
}

const listWorkflowFiles = () =>
  readdirSync(workflowsDir)
    .filter((name) => name.endsWith('.yml'))
    .sort()

describe('GitHub Actions Node 24 兼容策略', () => {
  it('所有 workflow 均应显式启用 Node 24 JavaScript actions 运行时', () => {
    const workflowFiles = listWorkflowFiles()

    expect(workflowFiles).toEqual([
      'ci-quality-gate.yml',
      'db-repair-drill-manual.yml',
      'docker-persistence-manual.yml',
      'e2e-real-manual.yml',
      'security-secrets-scan.yml',
      'stress-manual.yml'
    ])

    for (const fileName of workflowFiles) {
      const workflow = readWorkflow(fileName)
      expect(workflow, `${fileName} should opt into Node 24 actions`).toContain(requiredNode24Env)
    }
  })

  it('Quality Gate 和 Docker Delivery 应保留现有执行入口', () => {
    const workflow = readWorkflow('ci-quality-gate.yml')

    expect(workflow).toContain('name: CI · Quality Gate')
    expect(workflow).toContain('name: Release Gate')
    expect(workflow).toContain('name: Docker Delivery')
    expect(workflow).toContain('bun run release:gate')
    expect(workflow).toContain('bun run docker:smoke -- --wait-timeout 420 --keep-up')
    expect(workflow).toContain('bun run docker:ui-smoke')
  })
})
