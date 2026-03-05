import path from 'path'
import { describe, expect, it } from 'bun:test'
import {
  parseConfig,
  resolveStressOutputPath,
  resolveStressProfile
} from '../scripts/collab_ws_stress'

const envOf = (input: Record<string, string | undefined>) => input as NodeJS.ProcessEnv

describe('协作压测脚本配置解析', () => {
  it('应解析压测 profile 并回落到 default', () => {
    expect(resolveStressProfile('short')).toBe('short')
    expect(resolveStressProfile('long')).toBe('long')
    expect(resolveStressProfile('')).toBe('default')
    expect(resolveStressProfile('unknown')).toBe('default')
  })

  it('short profile 应使用短压默认参数', () => {
    const config = parseConfig(
      envOf({
        COLLAB_STRESS_PROFILE: 'short'
      })
    )

    expect(config.profile).toBe('short')
    expect(config.clients).toBe(8)
    expect(config.rounds).toBe(6)
    expect(config.ackTimeoutMs).toBe(4500)
  })

  it('long profile 允许通过环境变量覆盖参数', () => {
    const config = parseConfig(
      envOf({
        COLLAB_STRESS_PROFILE: 'long',
        COLLAB_STRESS_CLIENTS: '30',
        COLLAB_STRESS_ROUNDS: '80',
        COLLAB_STRESS_ACK_TIMEOUT_MS: '9000'
      })
    )

    expect(config.profile).toBe('long')
    expect(config.clients).toBe(30)
    expect(config.rounds).toBe(80)
    expect(config.ackTimeoutMs).toBe(9000)
  })

  it('应支持按时长驱动压测配置', () => {
    const config = parseConfig(
      envOf({
        COLLAB_STRESS_PROFILE: 'short',
        COLLAB_STRESS_DURATION_MINUTES: '1440'
      })
    )

    expect(config.profile).toBe('short')
    expect(config.durationMinutes).toBe(1440)
    expect(config.rounds).toBe(6)
  })

  it('应解析压测报告输出路径并转为绝对路径', () => {
    const cwd = '/tmp/veomuse-stress'
    const defaultPath = resolveStressOutputPath(undefined, cwd)
    const customPath = resolveStressOutputPath('reports/ws-summary.json', cwd)

    expect(defaultPath).toBe(path.resolve(cwd, 'artifacts/collab-ws-stress-summary.json'))
    expect(customPath).toBe(path.resolve(cwd, 'reports/ws-summary.json'))
  })
})
