import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import path from 'path'

const repoPath = process.cwd()

const readConfig = (fileName: string) => readFileSync(path.resolve(repoPath, fileName), 'utf8')

describe('Playwright CI reporter 守卫', () => {
  it.each(['playwright.config.ts', 'playwright.docker.config.ts'])(
    '%s 不应在 CI 中启用 GitHub annotation reporter',
    (fileName) => {
      const config = readConfig(fileName)

      expect(config).not.toContain("['github']")
      expect(config).toContain("['list']")
      expect(config).toContain("['html', { open: 'never' }]")
    }
  )
})
