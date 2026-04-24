import { describe, expect, it } from 'bun:test'
import path from 'path'
import {
  resolveLocalStorageRoot,
  resolveRepoPath,
  resolveUploadsPath,
  resolveUploadsRoot
} from '../apps/backend/src/runtime/paths'

const restoreEnv = (key: string, value: string | undefined) => {
  if (value === undefined) delete process.env[key]
  else process.env[key] = value
}

describe('后端 runtime 路径解析', () => {
  it('默认路径应固定到仓库内，而不依赖当前工作目录', () => {
    const originalCwd = process.cwd()
    const originalUploadsPath = process.env.UPLOADS_PATH
    const originalLocalStorageRoot = process.env.LOCAL_STORAGE_ROOT
    delete process.env.UPLOADS_PATH
    delete process.env.LOCAL_STORAGE_ROOT

    try {
      const repoUploads = path.resolve(originalCwd, 'uploads')
      expect(resolveRepoPath('uploads')).toBe(repoUploads)
      expect(resolveUploadsRoot()).toBe(repoUploads)
      expect(resolveUploadsPath('workspace')).toBe(path.join(repoUploads, 'workspace'))
      expect(resolveLocalStorageRoot()).toBe(path.join(repoUploads, 'workspace'))

      process.chdir(path.resolve(originalCwd, 'apps/backend'))
      expect(resolveUploadsRoot()).toBe(repoUploads)
      expect(resolveLocalStorageRoot()).toBe(path.join(repoUploads, 'workspace'))
    } finally {
      process.chdir(originalCwd)
      restoreEnv('UPLOADS_PATH', originalUploadsPath)
      restoreEnv('LOCAL_STORAGE_ROOT', originalLocalStorageRoot)
    }
  })

  it('显式环境变量应覆盖默认 uploads 与 workspace 存储路径', () => {
    const originalUploadsPath = process.env.UPLOADS_PATH
    const originalLocalStorageRoot = process.env.LOCAL_STORAGE_ROOT
    process.env.UPLOADS_PATH = './custom-uploads'
    process.env.LOCAL_STORAGE_ROOT = './custom-workspace'

    try {
      expect(resolveUploadsRoot()).toBe(path.resolve('./custom-uploads'))
      expect(resolveUploadsPath('imports')).toBe(path.resolve('./custom-uploads/imports'))
      expect(resolveLocalStorageRoot()).toBe(path.resolve('./custom-workspace'))
    } finally {
      restoreEnv('UPLOADS_PATH', originalUploadsPath)
      restoreEnv('LOCAL_STORAGE_ROOT', originalLocalStorageRoot)
    }
  })
})
