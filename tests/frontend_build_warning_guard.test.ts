import { describe, expect, it } from 'bun:test'

describe('前端构建告警守卫', () => {
  it('构建输出不应包含 PLUGIN_TIMINGS 告警', async () => {
    const proc = Bun.spawn(['bun', 'run', '--cwd', 'apps/frontend', 'build'], {
      cwd: process.cwd(),
      env: {
        ...process.env
      },
      stdout: 'pipe',
      stderr: 'pipe'
    })

    const exitCode = await proc.exited
    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const output = `${stdout}\n${stderr}`

    expect(exitCode).toBe(0)
    expect(output.includes('[PLUGIN_TIMINGS]')).toBe(false)
  }, 120000)
})
