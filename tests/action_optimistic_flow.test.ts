import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import path from 'path'
import { getExportButtonLabel } from '../apps/frontend/src/utils/appHelpers'

type ExportStatus = 'idle' | 'pending' | 'done' | 'error'

describe('Action + Optimistic 交互流验证', () => {
  it('导出按钮文案应由 pending 状态即时驱动', () => {
    expect(getExportButtonLabel(true, 'idle')).toBe('导出中...')
    expect(getExportButtonLabel(false, 'pending')).toBe('导出中...')
    expect(getExportButtonLabel(false, 'done')).toBe('导出')
  })

  it('App 应同时使用 useActionState 与 useOptimistic 驱动导出状态', () => {
    const appPath = path.resolve(process.cwd(), 'apps/frontend/src/App.tsx')
    const content = readFileSync(appPath, 'utf8')
    expect(content).toContain('useActionState')
    expect(content).toContain('useOptimistic')
    expect(content).toContain('getExportButtonLabel')
  })
})
