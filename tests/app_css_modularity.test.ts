import { describe, expect, it } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'fs'
import path from 'path'

const repoRoot = process.cwd()
const appCssPath = path.join(repoRoot, 'apps/frontend/src/App.css')
const appCssModuleDir = path.join(repoRoot, 'apps/frontend/src/styles/app')
const MAX_CSS_MODULE_LINES = 300

const readLines = (target: string) => readFileSync(target, 'utf8').split(/\r?\n/)

const readAppCssImports = () => {
  const appCss = readFileSync(appCssPath, 'utf8')
  return [...appCss.matchAll(/^@import ['"]\.\/styles\/app\/([^'"]+\.css)['"];$/gm)]
    .map((match) => match[1])
}

const readAppCssModules = () =>
  readdirSync(appCssModuleDir)
    .filter((name) => name.endsWith('.css'))
    .sort()

describe('App CSS modularity guard', () => {
  it('App.css should only orchestrate ordered app style modules', () => {
    const appCss = readFileSync(appCssPath, 'utf8')
    const nonImportLines = appCss
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('@import '))

    expect(nonImportLines).toEqual([])
    expect(appCss).toContain("@import './styles/app/")
  })

  it('App.css should import every ordered app style module exactly once', () => {
    expect(existsSync(appCssModuleDir)).toBe(true)

    const imports = readAppCssImports()
    const modules = readAppCssModules()

    expect(imports).toEqual(modules)
    expect(new Set(imports).size).toBe(imports.length)
  })

  it('ordered app style modules should stay below the repository file length ceiling', () => {
    expect(existsSync(appCssModuleDir)).toBe(true)

    const modules = readAppCssModules()

    expect(modules.length).toBeGreaterThan(1)

    for (const moduleName of modules) {
      const lines = readLines(path.join(appCssModuleDir, moduleName))
      expect(lines.length, `${moduleName} exceeds ${MAX_CSS_MODULE_LINES} lines`).toBeLessThanOrEqual(
        MAX_CSS_MODULE_LINES
      )
    }
  })
})
