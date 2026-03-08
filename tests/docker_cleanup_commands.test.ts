import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import path from 'path'

describe('docker 清理命令接入', () => {
  it('根脚本应提供 docker reset 命令', () => {
    const pkg = JSON.parse(readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'))

    expect(pkg?.scripts?.['docker:reset']).toBe(
      'docker compose -f config/docker/docker-compose.yml down --remove-orphans'
    )
    expect(pkg?.scripts?.['docker:reset:volumes']).toBe(
      'docker compose -f config/docker/docker-compose.yml down --volumes --remove-orphans'
    )
  })
})
