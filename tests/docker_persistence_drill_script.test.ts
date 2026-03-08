import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import path from 'path'
import {
  buildBackendUploadPersistenceProbeCommand,
  buildComposeDownCommand,
  buildComposeRestartCommand,
  buildComposeUpCommand,
  DEFAULT_COMPOSE_FILE,
  DEFAULT_WAIT_TIMEOUT_SEC,
  DRILL_SNAPSHOT_KIND,
  HELP_TEXT,
  normalizeBaseUrl,
  parseArgs,
  RESTARTED_COMPOSE_SERVICES,
  resolveContainerUploadPath,
  validateBaseUrl
} from '../scripts/docker_persistence_drill'

describe('docker persistence drill 脚本辅助逻辑', () => {
  it('应解析参数并规范化 baseUrl', () => {
    const parsed = parseArgs([
      '--compose-file',
      'config/docker/docker-compose.yml',
      '--base-url=http://127.0.0.1:18081/',
      '--wait-timeout',
      '360',
      '--keep-up',
      '--no-build'
    ])

    expect(parsed.showHelp).toBe(false)
    expect(parsed.options.composeFile).toBe('config/docker/docker-compose.yml')
    expect(parsed.options.baseUrl).toBe('http://127.0.0.1:18081')
    expect(parsed.options.waitTimeoutSec).toBe(360)
    expect(parsed.options.keepUp).toBe(true)
    expect(parsed.options.noBuild).toBe(true)
    expect(normalizeBaseUrl('http://127.0.0.1:18081/')).toBe('http://127.0.0.1:18081')
    expect(validateBaseUrl('https://veomuse.test/')).toBe('https://veomuse.test')
  })

  it('应拒绝非法 baseUrl、未知参数与非法等待时间', () => {
    expect(() => parseArgs(['--unknown-flag'])).toThrow('未知参数')
    expect(() => parseArgs(['--wait-timeout', '0'])).toThrow('--wait-timeout 需要正整数')
    expect(() => parseArgs(['--compose-file'])).toThrow('--compose-file 缺少参数值')
    expect(() => parseArgs(['--base-url', 'veomuse.test'])).toThrow(
      '--base-url 需要合法的 http/https URL'
    )
    expect(() => parseArgs(['--base-url', 'ftp://veomuse.test'])).toThrow(
      '--base-url 仅支持 http/https'
    )
  })

  it('应暴露稳定的帮助文案、默认值与重启目标', () => {
    expect(DEFAULT_COMPOSE_FILE).toBe('config/docker/docker-compose.yml')
    expect(DEFAULT_WAIT_TIMEOUT_SEC).toBe(240)
    expect(DRILL_SNAPSHOT_KIND).toBe('docker-persistence-drill')
    expect(RESTARTED_COMPOSE_SERVICES).toEqual(['veomuse-backend', 'veomuse-frontend'])
    expect(HELP_TEXT).toContain('Docker Persistence Drill')
    expect(HELP_TEXT).toContain('restart backend/frontend')
    expect(HELP_TEXT).toContain('创建项目快照')
  })

  it('应构造 compose up/down/restart 命令与后端文件持久化探针', () => {
    const composePrefix = ['docker', 'compose', '-f', 'config/docker/docker-compose.yml']
    expect(
      buildComposeUpCommand(composePrefix, { noBuild: false, waitTimeoutSec: 240 }, true)
    ).toEqual([
      'docker',
      'compose',
      '-f',
      'config/docker/docker-compose.yml',
      'up',
      '-d',
      '--build',
      '--wait',
      '--wait-timeout',
      '240'
    ])

    expect(buildComposeDownCommand(composePrefix)).toEqual([
      'docker',
      'compose',
      '-f',
      'config/docker/docker-compose.yml',
      'down',
      '--volumes',
      '--remove-orphans'
    ])

    expect(buildComposeRestartCommand(composePrefix, RESTARTED_COMPOSE_SERVICES)).toEqual([
      'docker',
      'compose',
      '-f',
      'config/docker/docker-compose.yml',
      'restart',
      'veomuse-backend',
      'veomuse-frontend'
    ])

    expect(resolveContainerUploadPath('ws_1/proj_1/file.bin')).toBe(
      '/app/uploads/workspace/ws_1/proj_1/file.bin'
    )
    expect(
      buildBackendUploadPersistenceProbeCommand(composePrefix, 'ws_1/proj_1/file.bin')
    ).toEqual([
      'docker',
      'compose',
      '-f',
      'config/docker/docker-compose.yml',
      'exec',
      '-T',
      'veomuse-backend',
      'sh',
      '-lc',
      "test -f '/app/uploads/workspace/ws_1/proj_1/file.bin' && wc -c < '/app/uploads/workspace/ws_1/proj_1/file.bin'"
    ])
  })

  it('runPersistenceDrill 应按关键顺序执行建数、重启与复检', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'scripts/docker_persistence_drill.ts'),
      'utf8'
    )

    const orderedMarkers = [
      'await runCommand(buildComposeUpCommand(composePrefix, options, composeRuntime.supportsWait))',
      'await runInitialDrillFlow(summary.baseUrl)',
      'await restartApplicationServices(composePrefix)',
      'await assertPostRestartReadiness(summary.baseUrl, composePrefix, waitTimeoutMs)',
      'await assertPersistedProjectState(summary.baseUrl, runtimeState.identity, runtimeState)',
      'await assertPersistedUploadOnBackend(composePrefix, runtimeState.upload)'
    ]

    let lastIndex = -1
    for (const marker of orderedMarkers) {
      const nextIndex = source.indexOf(marker)
      expect(nextIndex).toBeGreaterThan(lastIndex)
      lastIndex = nextIndex
    }

    expect(source).toContain('const createProjectSnapshot = async')
    expect(source).toContain('const uploadDrillAsset = async')
    expect(source).toContain('const loginDrillIdentity = async')
    expect(source).toContain('--- DOCKER PERSISTENCE DRILL SUMMARY ---')
  })
})
