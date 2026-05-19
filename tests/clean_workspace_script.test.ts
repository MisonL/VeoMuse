import { describe, expect, it } from 'bun:test'
import { mkdtempSync, readFileSync } from 'fs'
import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import os from 'os'
import path from 'path'
import { spawnSync } from 'child_process'

const readRootFile = (relativePath: string) =>
  readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

describe('仓库清理脚本守卫', () => {
  it('clean_workspace 应覆盖主要历史运行产物目录', () => {
    const source = readRootFile('scripts/clean_workspace.ts')

    const requiredTargets = [
      'coverage',
      'playwright-report',
      'test-results',
      'artifacts',
      'uploads/imports'
    ]

    for (const target of requiredTargets) {
      expect(source).toContain(target)
    }
  })

  it('clean_workspace 应清理 uploads 下所有运行期产物但保留目录骨架', () => {
    const source = readRootFile('scripts/clean_workspace.ts')

    const requiredUploadTargets = [
      'uploads/imports',
      'uploads/workspace',
      'uploads/generated',
      'uploads/audio'
    ]

    for (const target of requiredUploadTargets) {
      expect(source).toContain(target)
    }
    expect(source).toContain('clearUploadRootFiles')
    expect(source).toContain("ensureFile(rootDir, 'uploads/.gitkeep')")
  })

  it('clean_workspace 应保留根目录安全校验并明确保护 uploads 根目录', () => {
    const source = readRootFile('scripts/clean_workspace.ts')

    expect(source).toContain('EXPECTED_ROOT_PACKAGE_NAME')
    expect(source).toContain('安全校验失败')
    expect(source).not.toContain("removeTarget(rootDir, 'uploads')")
  })

  it('package.json 应继续通过统一入口暴露 clean 命令', () => {
    const pkg = JSON.parse(readRootFile('package.json')) as {
      scripts?: Record<string, string>
    }

    expect(pkg.scripts?.clean).toBe('bun run scripts/clean_workspace.ts')
  })

  it('clean_workspace --runtime-only 应只清理运行期产物且保留依赖目录', async () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'veomuse-clean-'))
    try {
      await writeFile(
        path.join(tempRoot, 'package.json'),
        JSON.stringify({ name: '@veomuse/root', workspaces: ['apps/*'] }),
        'utf8'
      )
      await mkdir(path.join(tempRoot, 'node_modules'), { recursive: true })
      await mkdir(path.join(tempRoot, 'apps/frontend/dist'), { recursive: true })
      await mkdir(path.join(tempRoot, 'uploads/imports'), { recursive: true })
      await mkdir(path.join(tempRoot, 'uploads/workspace'), { recursive: true })
      await writeFile(path.join(tempRoot, 'node_modules/keep.txt'), 'keep', 'utf8')
      await writeFile(path.join(tempRoot, 'apps/frontend/dist/bundle.js'), 'build', 'utf8')
      await writeFile(path.join(tempRoot, 'uploads/image.jpg'), 'runtime', 'utf8')
      await writeFile(path.join(tempRoot, 'uploads/imports/a.txt'), 'runtime', 'utf8')
      await writeFile(path.join(tempRoot, 'uploads/workspace/a.txt'), 'runtime', 'utf8')

      const result = spawnSync(
        process.execPath,
        [path.resolve('scripts/clean_workspace.ts'), '--runtime-only'],
        {
          cwd: tempRoot,
          encoding: 'utf8'
        }
      )

      expect(result.status, result.stderr).toBe(0)
      expect(await readFile(path.join(tempRoot, 'node_modules/keep.txt'), 'utf8')).toBe('keep')
      expect(await readFile(path.join(tempRoot, 'apps/frontend/dist/bundle.js'), 'utf8')).toBe(
        'build'
      )
      expect(await readFile(path.join(tempRoot, 'uploads/.gitkeep'), 'utf8')).toBe('')
      expect(Bun.file(path.join(tempRoot, 'uploads/image.jpg')).exists()).resolves.toBe(false)
      expect(Bun.file(path.join(tempRoot, 'uploads/imports/a.txt')).exists()).resolves.toBe(false)
      expect(Bun.file(path.join(tempRoot, 'uploads/workspace/a.txt')).exists()).resolves.toBe(false)
    } finally {
      await rm(tempRoot, { recursive: true, force: true })
    }
  })
})
