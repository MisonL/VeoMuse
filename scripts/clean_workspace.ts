import fs from 'fs/promises'
import path from 'path'

const EXPECTED_ROOT_PACKAGE_NAME = '@veomuse/root'

const ensureWorkspaceRoot = async (rootDir: string) => {
  const packageJsonPath = path.join(rootDir, 'package.json')
  const raw = await fs.readFile(packageJsonPath, 'utf8')
  const parsed = JSON.parse(raw) as { name?: string; workspaces?: unknown }
  const workspaces = Array.isArray(parsed.workspaces) ? parsed.workspaces : []
  if (parsed.name !== EXPECTED_ROOT_PACKAGE_NAME || workspaces.length === 0) {
    throw new Error(
      `[clean] 安全校验失败：当前目录不是 VeoMuse 根目录（cwd=${rootDir}，name=${String(parsed.name || '')}）`
    )
  }
}

const removeTarget = async (rootDir: string, relativePath: string) => {
  const target = path.join(rootDir, relativePath)
  await fs.rm(target, { recursive: true, force: true })
  console.log(`[clean] removed: ${relativePath}`)
}

const run = async () => {
  const rootDir = process.cwd()
  await ensureWorkspaceRoot(rootDir)

  const targets = [
    'node_modules',
    'apps/backend/node_modules',
    'apps/frontend/node_modules',
    'packages/shared/node_modules',
    'apps/backend/dist',
    'apps/frontend/dist'
  ]

  for (const target of targets) {
    await removeTarget(rootDir, target)
  }

  console.log('[clean] done')
}

await run()
