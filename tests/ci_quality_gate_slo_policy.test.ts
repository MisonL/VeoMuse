import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import path from 'path'

describe('CI SLO 门禁策略守卫', () => {
  const workflow = readFileSync(
    path.resolve(process.cwd(), '.github/workflows/ci-quality-gate.yml'),
    'utf8'
  )

  it('应通过统一入口执行 release gate 并设置主分支 hard/其他分支 soft', () => {
    expect(workflow).toContain('bun run release:gate')
    expect(workflow).toContain(
      "RELEASE_SLO_MODE: ${{ github.ref == 'refs/heads/main' && 'hard' || 'soft' }}"
    )
  })

  it('应在 CI 中保持 20/10 样本阈值', () => {
    expect(workflow).toMatch(/SLO_GATE_MIN_NON_AI_SAMPLES:\s*['"]20['"]/)
    expect(workflow).toMatch(/SLO_GATE_MIN_JOURNEY_SAMPLES:\s*['"]10['"]/)
  })

  it('应在 release gate 前执行 seed 预热并产出工件', () => {
    expect(workflow).toMatch(/SLO_ADMIN_SEED_ENABLED:\s*['"]true['"]/)
    expect(workflow).toContain('/api/admin/slo/seed')
    expect(workflow).toContain('artifacts/slo-seed.json')
  })
})
