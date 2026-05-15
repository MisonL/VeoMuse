import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import path from 'path'
import { getExportButtonLabel } from '../apps/frontend/src/utils/appHelpers'

type ExportStatus = 'idle' | 'pending' | 'done' | 'error'

describe('Action + Optimistic 交互流验证', () => {
  it('导出按钮文案应由 pending 状态即时驱动', () => {
    expect(getExportButtonLabel(true, 'idle')).toBe('导出中...')
    expect(getExportButtonLabel(false, 'pending')).toBe('导出中...')
    expect(getExportButtonLabel(false, 'done')).toBe('导出项目')
  })

  it('App 与 AppHeader 应共同保留 action、optimistic 与导出按钮文案接线', () => {
    const appPath = path.resolve(process.cwd(), 'apps/frontend/src/App.tsx')
    const headerPath = path.resolve(process.cwd(), 'apps/frontend/src/components/App/AppHeader.tsx')
    const appContent = readFileSync(appPath, 'utf8')
    const headerContent = readFileSync(headerPath, 'utf8')
    expect(appContent).toContain('useActionState')
    expect(appContent).toContain('useOptimistic')
    expect(headerContent).toContain('getExportButtonLabel')
  })
})
