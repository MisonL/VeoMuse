import { describe, expect, it } from 'bun:test'
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
})
