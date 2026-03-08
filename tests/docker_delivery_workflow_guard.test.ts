import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'fs'
import path from 'path'

const repoPath = process.cwd()

const readWorkflow = (relativePath: string) => {
  const workflowPath = path.resolve(repoPath, relativePath)
  expect(existsSync(workflowPath)).toBe(true)
  return readFileSync(workflowPath, 'utf8')
}

describe('docker 交付 workflow 守卫', () => {
  it('ci quality gate 应保留 main-only docker smoke，并串入 docker UI smoke 后置 job', () => {
    const workflow = readWorkflow('.github/workflows/ci-quality-gate.yml')

    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).toContain('docker-smoke-main:')
    expect(workflow).toContain(
      "if: ${{ github.event_name == 'push' && github.ref == 'refs/heads/main' }}"
    )
    expect(workflow).toContain('run: bun run docker:smoke -- --wait-timeout 240')
    expect(workflow).toContain('docker-ui-smoke-main:')
    expect(workflow).toContain('needs: docker-smoke-main')
    expect(workflow).toContain('bunx playwright install --with-deps chromium')
    expect(workflow).toContain('bun run docker:smoke -- --wait-timeout 240 --keep-up')
    expect(workflow).toContain('run: bun run docker:ui-smoke')
    expect(workflow).toContain('docker-ui-smoke-artifacts')
    expect(workflow).toContain('test-results/playwright-docker/')
    expect(workflow).toContain('run: bun run docker:reset')
  })
})
