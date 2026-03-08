import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import path from 'path'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import App from '../apps/frontend/src/App'
import { getExportButtonLabel } from '../apps/frontend/src/utils/appHelpers'
import ResizeHandle from '../apps/frontend/src/components/Common/ResizeHandle'
import ThemeSwitcher from '../apps/frontend/src/components/Common/ThemeSwitcher'
import WorkspaceShell from '../apps/frontend/src/components/Layout/WorkspaceShell'

describe('前端 SSR 覆盖补强', () => {
  it('App 应可在 SSR 下渲染主壳与关键区域', () => {
    const html = renderToString(createElement(App))
    expect(html.length).toBeGreaterThan(1000)
    expect(html).toContain('pro-master-shell')
    expect(html).toContain('timecode')
  })

  it('导出按钮文案应按状态返回', () => {
    expect(getExportButtonLabel(true, 'idle')).toBe('导出中...')
    expect(getExportButtonLabel(false, 'pending', 38)).toContain('38%')
    expect(getExportButtonLabel(false, 'done')).toBe('导出')
  })

  it('常用组件应可在 SSR 下正常输出', () => {
    const handleHtml = renderToString(
      createElement(ResizeHandle, {
        axis: 'x',
        ariaLabel: '调整面板宽度',
        onDrag: () => {},
        hint: '拖动调整',
        guideKey: 'left'
      })
    )
    expect(handleHtml).toContain('resize-handle')
    expect(handleHtml).toContain('role=\"separator\"')

    const themeHtml = renderToString(createElement(ThemeSwitcher))
    expect(themeHtml).toContain('theme-switcher-pro')
    expect(themeHtml).toContain('亮色')

    const shellHtml = renderToString(
      createElement(WorkspaceShell, {
        layoutMode: 'desktop',
        topBarDensity: 'comfortable',
        children: createElement('div', null, 'workspace-content')
      })
    )
    expect(shellHtml).toContain('workspace-content')
    expect(shellHtml).toContain('data-layout-mode=\"desktop\"')
  })

  it('index.html 应包含正式产品元信息', () => {
    const indexHtml = readFileSync(path.resolve(process.cwd(), 'apps/frontend/index.html'), 'utf8')
    expect(indexHtml).toContain('<html lang="zh-CN">')
    expect(indexHtml).toContain('<title>VeoMuse Pro | 旗舰 AI 视频总线</title>')
    expect(indexHtml).toContain('name="description"')
  })
})
