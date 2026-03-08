import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import path from 'path'

describe('docker UI smoke 接入', () => {
  it('根脚本应提供 docker:ui-smoke 命令', () => {
    const pkg = JSON.parse(readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'))
    expect(pkg?.scripts?.['docker:ui-smoke']).toBe(
      'env -u NO_COLOR PLAYWRIGHT_BASE_URL=http://127.0.0.1:18081 PLAYWRIGHT_API_BASE_URL=http://127.0.0.1:18081 bunx playwright test -c playwright.docker.config.ts --project=docker-smoke-chromium --workers=1'
    )
  })

  it('docker Playwright 配置应直接命中容器服务而非本地 webServer', () => {
    const config = readFileSync(path.resolve(process.cwd(), 'playwright.docker.config.ts'), 'utf8')
    expect(config).toContain("testDir: './tests/e2e/docker'")
    expect(config).toContain("PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:18081'")
    expect(config).toContain("name: 'docker-smoke-chromium'")
    expect(config).not.toContain('webServer:')
  })

  it('docker UI smoke 用例应覆盖注册、工作区创建与系统监控入口', () => {
    const spec = readFileSync(
      path.resolve(process.cwd(), 'tests/e2e/docker/auth-org-workspace-ui.spec.ts'),
      'utf8'
    )
    expect(spec).toContain('Docker UI smoke 应串通注册、工作区创建与关键值守入口')
    expect(spec).toContain("page.getByTestId('btn-open-channel-panel')")
    expect(spec).toContain("page.getByTestId('text-workspace-id')")
    expect(spec).toContain("page.locator('.telemetry-command-bar')")
    expect(spec).toContain("page.getByTestId('btn-open-channel-access')")
  })
})
