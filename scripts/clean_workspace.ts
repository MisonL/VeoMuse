import fs from 'fs/promises'
import path from 'path'

const EXPECTED_ROOT_PACKAGE_NAME = '@veomuse/root'
const RUNTIME_ONLY_FLAG = '--runtime-only'
const UPLOAD_ROOT_KEEP_FILES = new Set(['.gitkeep'])

const FULL_CLEAN_TARGETS = [
  'node_modules',
  'apps/backend/node_modules',
  'apps/frontend/node_modules',
  'packages/shared/node_modules',
  'apps/backend/dist',
  'apps/frontend/dist'
]

const RUNTIME_CLEAN_TARGETS = [
  'coverage',
  'playwright-report',
  'test-results',
  'artifacts',
  'uploads/imports',
  'uploads/workspace',
  'uploads/generated',
  'uploads/audio'
]

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

const ensureDirectory = async (rootDir: string, relativePath: string) => {
  const target = path.join(rootDir, relativePath)
  await fs.mkdir(target, { recursive: true })
}

const ensureFile = async (rootDir: string, relativePath: string) => {
  const target = path.join(rootDir, relativePath)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, '', 'utf8')
}

const clearUploadRootFiles = async (rootDir: string) => {
  const uploadDir = path.join(rootDir, 'uploads')
  let entries: Array<{ isDirectory: () => boolean; name: string }>
  try {
    entries = await fs.readdir(uploadDir, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }

  for (const entry of entries) {
    if (entry.isDirectory() || UPLOAD_ROOT_KEEP_FILES.has(entry.name)) continue
    await fs.rm(path.join(uploadDir, entry.name), { force: true })
    console.log(`[clean] removed: uploads/${entry.name}`)
  }
}

const run = async () => {
  const rootDir = process.cwd()
  await ensureWorkspaceRoot(rootDir)

  const args = process.argv.slice(2)
  const unknownArgs = args.filter((arg) => arg !== RUNTIME_ONLY_FLAG)
  if (unknownArgs.length > 0) {
    throw new Error(`[clean] unsupported arguments: ${unknownArgs.join(', ')}`)
  }

  const targets = args.includes(RUNTIME_ONLY_FLAG)
    ? RUNTIME_CLEAN_TARGETS
    : [...FULL_CLEAN_TARGETS, ...RUNTIME_CLEAN_TARGETS]

  for (const target of targets) {
    await removeTarget(rootDir, target)
  }

  await ensureDirectory(rootDir, 'uploads')
  await clearUploadRootFiles(rootDir)
  await ensureFile(rootDir, 'uploads/.gitkeep')

  console.log('[clean] done')
}

await run()
