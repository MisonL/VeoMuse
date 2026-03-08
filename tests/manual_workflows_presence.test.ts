import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'fs'
import path from 'path'

const repoPath = process.cwd()

const readWorkflow = (relativePath: string) => {
  const workflowPath = path.resolve(repoPath, relativePath)
  expect(existsSync(workflowPath)).toBe(true)
  return readFileSync(workflowPath, 'utf8')
}

describe('手动 workflows 存在性与关键字段守卫', () => {
  it('e2e-real-manual workflow 应存在并包含真实回归与环境守卫', () => {
    const workflow = readWorkflow('.github/workflows/e2e-real-manual.yml')

    expect(workflow).toContain('workflow_dispatch')
    expect(workflow).toContain('schedule:')
    expect(workflow).toContain("cron: '0 4 * * 1'")
    expect(workflow).toContain('uses: oven-sh/setup-bun@v2')
    expect(workflow).toContain('run: bun install')
    expect(workflow).toContain('id: guard')
    expect(workflow).toContain('echo "enabled=${enabled}" >> "$GITHUB_OUTPUT"')
    expect(workflow).toContain('if [ "${E2E_REAL_CHANNELS}" != "true" ]; then')
    expect(workflow).toContain('if [ -z "${GEMINI_API_KEYS}" ]; then')
    expect(workflow).toContain('if [ "${GITHUB_EVENT_NAME}" = "schedule" ]; then')
    expect(workflow).toContain('Scheduled run blocked: ${reason}')
    expect(workflow).toContain('Manual run blocked: ${reason}')
    expect(workflow).toContain("if: ${{ steps.guard.outputs.enabled == 'true' }}")
    expect(workflow).toContain("if: ${{ !cancelled() && steps.guard.outputs.enabled == 'true' }}")
    expect(workflow).toContain('run: bun run e2e:regression:real -- --workers=1')
    expect(workflow).toContain('uses: actions/upload-artifact@v4')
    expect(workflow).toContain('playwright-report/')
    expect(workflow).toContain('if-no-files-found: error')
  })

  it('db-repair-drill-manual workflow 应存在并包含 drill 命令与工件上传策略', () => {
    const workflow = readWorkflow('.github/workflows/db-repair-drill-manual.yml')

    expect(workflow).toContain('workflow_dispatch')
    expect(workflow).toContain('schedule:')
    expect(workflow).toContain("cron: '0 3 * * 1'")
    expect(workflow).toContain('uses: oven-sh/setup-bun@v2')
    expect(workflow).toContain('run: bun install')
    expect(workflow).toContain('bun run drill:db-repair | tee artifacts/db-repair-drill.log')
    expect(workflow).toContain('data/drills/')
    expect(workflow).toContain('artifacts/db-repair-drill.log')
    expect(workflow).toContain('artifacts/*.log')
    expect(workflow).toContain('if-no-files-found: warn')
  })

  it('stress-manual workflow 应存在并包含 stress 命令与工件上传策略', () => {
    const workflow = readWorkflow('.github/workflows/stress-manual.yml')

    expect(workflow).toContain('workflow_dispatch')
    expect(workflow).toContain('uses: oven-sh/setup-bun@v2')
    expect(workflow).toContain('run: bun install')
    expect(workflow).toContain('bun run stress:collab-ws | tee artifacts/stress-collab-ws.log')
    expect(workflow).toContain('artifacts/stress-collab-ws.log')
    expect(workflow).toContain('artifacts/stress*')
    expect(workflow).toContain('artifacts/*.log')
    expect(workflow).toContain('if-no-files-found: warn')
  })

  it('docker-persistence-manual workflow 应存在并包含 keep-up drill、日志上传与环境清理', () => {
    const workflow = readWorkflow('.github/workflows/docker-persistence-manual.yml')

    expect(workflow).toContain('workflow_dispatch')
    expect(workflow).toContain('uses: oven-sh/setup-bun@v2')
    expect(workflow).toContain('run: bun install --frozen-lockfile')
    expect(workflow).toContain('bun run docker:drill:persistence -- --wait-timeout 240 --keep-up')
    expect(workflow).toContain('docker compose -f config/docker/docker-compose.yml logs --tail 200')
    expect(workflow).toContain('docker-persistence-drill-artifacts')
    expect(workflow).toContain('artifacts/docker-persistence-drill.log')
    expect(workflow).toContain('artifacts/docker-persistence-compose.log')
    expect(workflow).toContain('artifacts/docker-persistence-compose-ps.log')
    expect(workflow).toContain('run: bun run docker:reset')
  })
})
