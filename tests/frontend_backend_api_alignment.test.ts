import { describe, expect, it } from 'bun:test'
import fs from 'fs/promises'
import path from 'path'

const FRONTEND_SRC_DIR = path.resolve(process.cwd(), 'apps/frontend/src')
const ROUTE_REGISTRY_PATH = path.resolve(process.cwd(), 'docs/api-routes.generated.json')
const FRONTEND_API_HELPER_PATH = path.normalize(
  'apps/frontend/src/components/Editor/comparison-lab/api.ts'
)

const listSourceFiles = async (dir: string): Promise<string[]> => {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) return listSourceFiles(fullPath)
      if (/\.(ts|tsx)$/.test(entry.name)) return [fullPath]
      return []
    })
  )
  return files.flat()
}

const normalizeDynamicEndpoint = (endpoint: string) => {
  const normalized =
    endpoint
      .replace(/\$\{[^}]+\}/g, ':param')
      .replace(/:([A-Za-z0-9_]+)/g, ':param')
      .replace(/\?.*$/g, '')
      .replace(/\/+$/g, '') || '/'
  return normalized
}

const normalizeV4Endpoint = (endpoint: string) => {
  const normalized = endpoint.trim()
  if (!normalized) return '/api/v4'
  if (normalized.startsWith('/api/v4/')) return normalized
  if (normalized === '/api/v4') return normalized
  if (normalized.startsWith('/v4/')) return `/api${normalized}`
  if (normalized === '/v4') return '/api/v4'
  if (normalized.startsWith('/')) return `/api/v4${normalized}`
  return `/api/v4/${normalized}`
}

const endpointMatchesRoute = (endpoint: string, route: string) => {
  const normalizedEndpoint = normalizeDynamicEndpoint(endpoint)
  const normalizedRoute = normalizeDynamicEndpoint(route)
  if (normalizedEndpoint === normalizedRoute) return true
  const routePattern = new RegExp(
    `^${normalizedRoute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:param/g, '[^/]+')}$`
  )
  return routePattern.test(normalizedEndpoint)
}

const collectFrontendApiEndpoints = async () => {
  const files = await listSourceFiles(FRONTEND_SRC_DIR)
  const endpoints = new Map<string, string[]>()

  const addEndpoint = (file: string, endpoint: string, reason: string) => {
    const normalized = normalizeDynamicEndpoint(endpoint)
    if (!normalized.startsWith('/api/')) return
    const refs = endpoints.get(normalized) || []
    refs.push(`${path.relative(process.cwd(), file)} (${reason})`)
    endpoints.set(normalized, refs)
  }

  await Promise.all(
    files.map(async (file) => {
      const relativePath = path.normalize(path.relative(process.cwd(), file))
      if (relativePath === FRONTEND_API_HELPER_PATH) return
      const content = await fs.readFile(file, 'utf8')

      for (const match of content.matchAll(/['"`]([^'"`]*\/api\/[^'"`]*)['"`]/g)) {
        addEndpoint(file, match[1] || '', 'literal')
      }

      for (const match of content.matchAll(
        /requestV4(?:<[\s\S]*?>)?\s*\(\s*([`'"])([\s\S]*?)\1/g
      )) {
        addEndpoint(file, normalizeV4Endpoint(match[2] || ''), 'requestV4')
      }
    })
  )

  return endpoints
}

describe('前后端 API 契约对齐', () => {
  it('前端源码中使用的 API 路径都应存在于后端路由注册表', async () => {
    const registry = JSON.parse(await fs.readFile(ROUTE_REGISTRY_PATH, 'utf8')) as string[]
    const endpoints = await collectFrontendApiEndpoints()
    const missing = [...endpoints.entries()]
      .filter(([endpoint]) => !registry.some((route) => endpointMatchesRoute(endpoint, route)))
      .map(([endpoint, refs]) => ({ endpoint, refs }))

    expect(endpoints.size).toBeGreaterThan(40)
    expect(missing).toEqual([])
  })
})
