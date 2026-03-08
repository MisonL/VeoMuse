import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import path from 'path'

const readCompose = () =>
  readFileSync(path.resolve(process.cwd(), 'config/docker/docker-compose.yml'), 'utf8')

describe('docker compose 交付护栏', () => {
  it('应保留 smoke 所需的核心服务、依赖顺序与健康检查', () => {
    const compose = readCompose()

    expect(compose).toContain('name: veomuse')
    expect(compose).toContain('veomuse-redis:')
    expect(compose).toContain('veomuse-backend:')
    expect(compose).toContain('veomuse-frontend:')
    expect(compose).toContain('condition: service_healthy')
    expect(compose).toContain("fetch('http://127.0.0.1:33117/api/health')")
    expect(compose).toContain('wget -q -O /dev/null http://127.0.0.1:18081/api/health')
  })

  it('应保留 smoke 所需的端口、卷与数据库持久化挂载', () => {
    const compose = readCompose()

    expect(compose).toContain("46379")
    expect(compose).toContain("33117")
    expect(compose).toContain("'18081:18081'")
    expect(compose).toContain('veomuse-uploads:/app/uploads')
    expect(compose).toContain('veomuse-data:/app/data')
    expect(compose).toContain('VEOMUSE_DB_PATH=/app/data/veomuse.sqlite')
    expect(compose).toContain('name: veomuse-uploads')
    expect(compose).toContain('name: veomuse-data')
  })
})
