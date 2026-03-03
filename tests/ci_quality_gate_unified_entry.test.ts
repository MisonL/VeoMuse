import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import path from 'path'

describe('CI 统一入口守卫', () => {
  const workflow = readFileSync(
    path.resolve(process.cwd(), '.github/workflows/ci-quality-gate.yml'),
    'utf8'
  )

  it('应保留必要安装步骤', () => {
    expect(workflow).toContain('bun install --frozen-lockfile')
    expect(workflow).toContain('bunx playwright install --with-deps chromium')
  })

  it('应使用独立 SLO 端口避免与 Playwright 后端 webServer 端口冲突', () => {
    expect(workflow).toContain('SLO_GATE_API_BASE: http://127.0.0.1:33118')
    expect(workflow).toContain('PORT=33118 bun run --cwd apps/backend dev')
  })

  it('应上传完整质量门禁工件，并在缺失时报错', () => {
    const requiredArtifacts = [
      'playwright-report/',
      'test-results/playwright/',
      'artifacts/slo-report.json',
      'artifacts/slo-seed.json',
      'artifacts/backend-slo.log',
      'artifacts/quality-summary.json'
    ]

    for (const item of requiredArtifacts) {
      expect(workflow).toContain(item)
    }
    expect(workflow).toContain('if-no-files-found: error')
    expect(workflow).toContain('if [ ! -f artifacts/quality-summary.json ]; then')
  })

  it('应移除旧分散步骤并使用统一入口执行', () => {
    expect(workflow).toContain('Run unified release gate (PR soft / main hard)')
    expect(workflow).toContain('bun run release:gate')
    expect(workflow).not.toContain('bun run e2e:smoke')
    expect(workflow).not.toContain('bun run e2e:regression:mock')
    expect(workflow).not.toContain('bun run scripts/slo_gate.ts --mode')
  })
})
