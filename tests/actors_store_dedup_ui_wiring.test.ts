import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import path from 'path'

const read = (relative: string) => readFileSync(path.resolve(process.cwd(), relative), 'utf8')

describe('演员数据共享缓存接线验证', () => {
  it('AssetPanel 与 PropertyInspector 应使用共享 actorsStore，而非各自拉取 actors.get', () => {
    const assetPanel = read('apps/frontend/src/components/Editor/AssetPanel.tsx')
    const inspector = read('apps/frontend/src/components/Editor/PropertyInspector.tsx')

    expect(assetPanel).toContain("useActorsStore")
    expect(inspector).toContain("useActorsStore")
    expect(assetPanel.includes('api.api.ai.actors.get')).toBe(false)
    expect(inspector.includes('api.api.ai.actors.get')).toBe(false)
  })

  it('actorsStore 应具备并发去重入口', () => {
    const store = read('apps/frontend/src/store/actorsStore.ts')
    expect(store).toContain('inFlightFetch')
    expect(store).toContain('fetchActors')
  })
})
