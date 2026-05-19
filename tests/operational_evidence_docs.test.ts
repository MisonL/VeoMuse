import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'fs'
import path from 'path'

const repoPath = process.cwd()

const readFile = (relativePath: string) => {
  const target = path.resolve(repoPath, relativePath)
  expect(existsSync(target)).toBe(true)
  return readFileSync(target, 'utf8')
}

describe('运营证据索引文档', () => {
  it('README 应暴露运营证据入口', () => {
    const readme = readFile('README.md')

    expect(readme).toContain('[docs/OPERATIONAL_EVIDENCE.md](docs/OPERATIONAL_EVIDENCE.md)')
  })

  it('运营证据索引应覆盖发布、部署、验收、真实回归、演练与安全证据', () => {
    const doc = readFile('docs/OPERATIONAL_EVIDENCE.md')

    for (const required of [
      'CI · Quality Gate',
      '.github/workflows/ci-quality-gate.yml',
      'quality-gate-artifacts',
      'artifacts/quality-summary.json',
      'artifacts/slo-report.json',
      'docker-ui-smoke-artifacts',
      'test-results/playwright-docker/',
      'bun run acceptance:deploy -- --base-url http://127.0.0.1:18081',
      'artifacts/deploy-acceptance/<timestamp>/summary.json',
      'E2E_REAL_CHANNELS=true bun run acceptance:real',
      'artifacts/real-acceptance/<timestamp>/summary.json',
      'bun run drill:db-repair',
      'db-repair-drill-artifacts',
      'bun run stress:collab-ws',
      'CI · Security Secrets Scan',
      'gitleaks.sarif'
    ]) {
      expect(doc).toContain(required)
    }
  })

  it('发布检查清单应指向运营证据索引', () => {
    const checklist = readFile('docs/RELEASE_CHECKLIST.md')

    expect(checklist).toContain('docs/OPERATIONAL_EVIDENCE.md')
  })
})
