import path from 'path'
import { fileURLToPath } from 'url'

const BACKEND_RUNTIME_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(BACKEND_RUNTIME_DIR, '../../../..')

export const resolveRepoPath = (...segments: string[]) => path.resolve(REPO_ROOT, ...segments)

export const resolveUploadsRoot = () => {
  const fromEnv = process.env.UPLOADS_PATH?.trim()
  return fromEnv ? path.resolve(fromEnv) : resolveRepoPath('uploads')
}

export const resolveUploadsPath = (...segments: string[]) =>
  path.join(resolveUploadsRoot(), ...segments)

export const resolveLocalStorageRoot = () => {
  const fromEnv = process.env.LOCAL_STORAGE_ROOT?.trim()
  return fromEnv ? path.resolve(fromEnv) : resolveUploadsPath('workspace')
}
