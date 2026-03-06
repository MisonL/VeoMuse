import { afterEach, describe, expect, it } from 'bun:test'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

const createdDirs: string[] = []

const makeRecord = (file: string, covered: number, total: number) =>
  ['TN:', `SF:${file}`, `LF:${total}`, `LH:${covered}`, 'end_of_record'].join('\n')

const runGuardWithLcov = async (records: string[]) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'veomuse-target-coverage-'))
  createdDirs.push(tempDir)

  const lcovFile = path.join(tempDir, 'lcov.info')
  await fs.writeFile(lcovFile, `${records.join('\n')}\n`, 'utf8')

  const proc = Bun.spawn(
    ['bun', 'run', 'scripts/target_coverage_guard.ts', '--coverage-file', lcovFile],
    {
      cwd: process.cwd(),
      env: process.env,
      stdout: 'pipe',
      stderr: 'pipe'
    }
  )
  const exitCode = await proc.exited
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  return { exitCode, stdout, stderr }
}

afterEach(async () => {
  while (createdDirs.length > 0) {
    const dir = createdDirs.pop()
    if (!dir) continue
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  }
})

describe('target_coverage_guard 脚本', () => {
  it('覆盖率达标时应 exit 0', async () => {
    const app = path.resolve(process.cwd(), 'apps/frontend/src/App.tsx')
    const admin = path.resolve(process.cwd(), 'apps/frontend/src/store/adminMetricsStore.ts')
    const journey = path.resolve(process.cwd(), 'apps/frontend/src/store/journeyTelemetryStore.ts')
    const creative = path.resolve(
      process.cwd(),
      'apps/frontend/src/components/Editor/comparison-lab/modes/CreativeModePanel.tsx'
    )
    const collab = path.resolve(
      process.cwd(),
      'apps/frontend/src/components/Editor/comparison-lab/modes/CollabModePanel.tsx'
    )
    const telemetry = path.resolve(
      process.cwd(),
      'apps/frontend/src/components/Editor/TelemetryDashboard.tsx'
    )

    const result = await runGuardWithLcov([
      makeRecord(app, 70, 100),
      makeRecord(admin, 60, 100),
      makeRecord(journey, 30, 50),
      makeRecord(creative, 35, 100),
      makeRecord(collab, 35, 100),
      makeRecord(telemetry, 40, 100)
    ])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('target coverage guard passed')
    expect(result.stdout).toContain('apps/frontend/src/App.tsx')
  })

  it('覆盖率低于阈值时应 exit 1 并打印缺失项', async () => {
    const app = path.resolve(process.cwd(), 'apps/frontend/src/App.tsx')
    const admin = path.resolve(process.cwd(), 'apps/frontend/src/store/adminMetricsStore.ts')
    const journey = path.resolve(process.cwd(), 'apps/frontend/src/store/journeyTelemetryStore.ts')
    const creative = path.resolve(
      process.cwd(),
      'apps/frontend/src/components/Editor/comparison-lab/modes/CreativeModePanel.tsx'
    )
    const collab = path.resolve(
      process.cwd(),
      'apps/frontend/src/components/Editor/comparison-lab/modes/CollabModePanel.tsx'
    )
    const telemetry = path.resolve(
      process.cwd(),
      'apps/frontend/src/components/Editor/TelemetryDashboard.tsx'
    )

    const result = await runGuardWithLcov([
      makeRecord(app, 69, 100),
      makeRecord(admin, 60, 100),
      makeRecord(journey, 60, 100),
      makeRecord(creative, 35, 100),
      makeRecord(collab, 35, 100),
      makeRecord(telemetry, 40, 100)
    ])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('target coverage guard failed')
    expect(result.stderr).toContain('覆盖率未达标: apps/frontend/src/App.tsx')
  })

  it('LCOV 缺失目标文件时应 exit 1', async () => {
    const app = path.resolve(process.cwd(), 'apps/frontend/src/App.tsx')
    const admin = path.resolve(process.cwd(), 'apps/frontend/src/store/adminMetricsStore.ts')
    const creative = path.resolve(
      process.cwd(),
      'apps/frontend/src/components/Editor/comparison-lab/modes/CreativeModePanel.tsx'
    )
    const collab = path.resolve(
      process.cwd(),
      'apps/frontend/src/components/Editor/comparison-lab/modes/CollabModePanel.tsx'
    )
    const telemetry = path.resolve(
      process.cwd(),
      'apps/frontend/src/components/Editor/TelemetryDashboard.tsx'
    )

    const result = await runGuardWithLcov([
      makeRecord(app, 80, 100),
      makeRecord(admin, 80, 100),
      makeRecord(creative, 80, 100),
      makeRecord(collab, 80, 100),
      makeRecord(telemetry, 80, 100)
    ])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('缺失覆盖项: apps/frontend/src/store/journeyTelemetryStore.ts')
  })
})
