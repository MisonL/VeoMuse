import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'fs'
import path from 'path'

const repoPath = process.cwd()

const readFile = (relativePath: string) => {
  const target = path.resolve(repoPath, relativePath)
  expect(existsSync(target)).toBe(true)
  return readFileSync(target, 'utf8')
}

describe('V3.2 北极星指标运营化文档', () => {
  it('需求文档应指向北极星运营矩阵', () => {
    const requirements = readFile('docs/requirements/PROJECT_REQUIREMENTS.md')

    expect(requirements).toContain('docs/NORTH_STAR_OPERATIONS.md')
  })

  it('北极星运营矩阵应覆盖所有 V3.2 NS 指标并声明覆盖状态', () => {
    const doc = readFile('docs/NORTH_STAR_OPERATIONS.md')

    for (const required of [
      '关键主链路端到端成功率 >= 99.5%',
      '非 AI API P95 响应时间 <= 400ms',
      '新用户首次完成创建工作区到导出平均步骤 <= 8',
      '数据库损坏修复演练脚本每周稳定通过',
      '主分支安全门禁全绿',
      '自动覆盖',
      '手动复验',
      '证据产物',
      'artifacts/slo-report.json',
      'bun run e2e:smoke -- --workers=1 --retries=0',
      'bun run drill:db-repair',
      'CI · Security Secrets Scan',
      'CI · Quality Gate'
    ]) {
      expect(doc).toContain(required)
    }
  })

  it('暂未自动覆盖的指标不得写成已自动通过', () => {
    const doc = readFile('docs/NORTH_STAR_OPERATIONS.md')

    expect(doc).toContain('| 新用户首次完成创建工作区到导出平均步骤 <= 8 | 手动复验 |')
    expect(doc).not.toContain('| 新用户首次完成创建工作区到导出平均步骤 <= 8 | 自动覆盖 |')
  })
})
