import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import path from 'path'

const readDockerfile = (relativePath: string) =>
  readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

describe('docker 构建依赖安装策略守卫', () => {
  it('backend Dockerfile 应只安装后端生产依赖并启用 bun cache mount', () => {
    const content = readDockerfile('config/docker/backend.Dockerfile')

    expect(content).toContain('--mount=type=cache,target=/root/.bun/install/cache')
    expect(content).toContain(
      "bun install --frozen-lockfile --production --filter '@veomuse/backend'"
    )
    expect(content).not.toContain('--network-concurrency=16')
    expect(content).not.toContain('--no-verify')
  })

  it('frontend Dockerfile 应只安装前端 workspace 依赖并启用 bun cache mount', () => {
    const content = readDockerfile('config/docker/frontend.Dockerfile')

    expect(content).toContain('--mount=type=cache,target=/root/.bun/install/cache')
    expect(content).toContain("bun install --frozen-lockfile --filter '@veomuse/frontend'")
    expect(content).not.toContain('--network-concurrency=16')
    expect(content).not.toContain('--no-verify')
  })
})
