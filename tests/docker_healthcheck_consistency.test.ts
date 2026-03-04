import { describe, expect, it } from 'bun:test'
import fs from 'fs/promises'
import path from 'path'

const COMPOSE_PATH = path.resolve(process.cwd(), 'config/docker/docker-compose.yml')

describe('Docker Compose 健康检查一致性', () => {
  it('frontend 与 backend 都应使用 /api/health', async () => {
    const content = await fs.readFile(COMPOSE_PATH, 'utf8')

    expect(content).toContain('http://127.0.0.1:33117/api/health')
    expect(content).toContain('http://127.0.0.1:18081/api/health')
    expect(content).not.toContain('http://127.0.0.1:18081/ || exit 1')
  })
})
