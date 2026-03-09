import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync, readdirSync } from 'fs'
import path from 'path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import App from '../apps/frontend/src/App'
import {
  buildGuideCardStyle,
  buildGuideHighlightStyle,
  computeCenterPanelFitWidth,
  computeCenterPanelMinWidth,
  getExportButtonLabel,
  resolveExportFeedbackSubtitle,
  resolveExportFeedbackTitle
} from '../apps/frontend/src/utils/appHelpers'

const collectSourceFiles = (dir: string): string[] => {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return collectSourceFiles(fullPath)
    return entry.isFile() && fullPath.endsWith('.tsx') ? [fullPath] : []
  })
}

const readAppSourceBundle = () => {
  const sourceRoot = path.resolve(process.cwd(), 'apps/frontend/src')
  const files = [
    path.join(sourceRoot, 'App.tsx'),
    ...collectSourceFiles(path.join(sourceRoot, 'components/App'))
  ].sort()
  return {
    files,
    content: files.map((file) => readFileSync(file, 'utf8')).join('\n')
  }
}

describe('App 运行态关键分支（DOM/SSR）', () => {
  it('应输出模式切换与导出关键 DOM 结构', () => {
    const html = renderToStaticMarkup(createElement(App))
    expect(html).toContain('data-testid="btn-mode-edit"')
    expect(html).toContain('data-testid="btn-mode-color"')
    expect(html).toContain('data-testid="btn-mode-audio"')
    expect(html).toContain('data-testid="btn-export"')
    expect(html).toContain('data-testid="area-timeline"')
    expect(html).toContain('<main')
    expect(html).toContain('aria-valuenow="336"')
    expect(html).toContain('aria-valuenow="292"')
    expect(html).toContain('aria-valuenow="352"')
  })

  it('导出流程文案分支应可稳定命中', () => {
    expect(getExportButtonLabel(true, 'idle', 0)).toBe('导出中...')
    expect(getExportButtonLabel(false, 'pending', 55.4)).toBe('导出中 55%')
    expect(getExportButtonLabel(false, 'done', 100)).toBe('导出')

    expect(resolveExportFeedbackTitle('validating')).toBe('准备素材中')
    expect(resolveExportFeedbackTitle('composing')).toBe('渲染时间轴中')
    expect(resolveExportFeedbackTitle('packaging')).toBe('封装输出中')
    expect(resolveExportFeedbackTitle('done')).toBe('导出完成')
    expect(resolveExportFeedbackTitle('error')).toBe('导出失败')

    expect(resolveExportFeedbackSubtitle('pending', '4K HDR')).toBe('规格：4K HDR')
    expect(resolveExportFeedbackSubtitle('done', '标准导出')).toBe('输出文件已生成')
    expect(
      resolveExportFeedbackSubtitle('error', '标准导出', '  网络   抖动，请  稍后重试  ')
    ).toBe('网络 抖动，请 稍后重试')
    expect(resolveExportFeedbackSubtitle('idle', '标准导出', 'ignored')).toBe('')
  })

  it('引导流程定位样式分支应覆盖空值与越界', () => {
    expect(buildGuideHighlightStyle(null)).toBeUndefined()
    expect(buildGuideHighlightStyle({ top: 90, left: 120, width: 200, height: 100 })).toEqual({
      top: '84px',
      left: '114px',
      width: '212px',
      height: '112px'
    })

    expect(buildGuideCardStyle(null, { width: 1200, height: 720 })).toBeUndefined()
    expect(
      buildGuideCardStyle(
        { top: 650, left: 1160, width: 80, height: 40 },
        { width: 1280, height: 760 }
      )
    ).toEqual({
      top: '416px',
      left: '948px'
    })
  })

  it('模式切换相关尺寸计算应覆盖 edit/color/audio 分支', () => {
    expect(computeCenterPanelMinWidth(true, 'fit', 'edit')).toBe(420)
    expect(computeCenterPanelMinWidth(true, 'fit', 'color')).toBe(420)
    expect(computeCenterPanelMinWidth(true, 'focus', 'audio')).toBe(376)

    expect(
      computeCenterPanelFitWidth({
        activeMode: 'color',
        centerMode: 'focus',
        centerPanelMinWidth: 360,
        isDesktopLayout: true,
        previewFrameWidth: 0
      })
    ).toBe(912)
    expect(
      computeCenterPanelFitWidth({
        activeMode: 'audio',
        centerMode: 'fit',
        centerPanelMinWidth: 320,
        isDesktopLayout: true,
        previewFrameWidth: 0
      })
    ).toBe(620)
    expect(
      computeCenterPanelFitWidth({
        activeMode: 'edit',
        centerMode: 'fit',
        centerPanelMinWidth: 340,
        isDesktopLayout: false,
        previewFrameWidth: 960
      })
    ).toBe(560)
  })

  it('App 应保留导出守卫、引导与模式分支实现', () => {
    const { files, content } = readAppSourceBundle()
    expect(
      files.some((file) => file.includes(`${path.sep}components${path.sep}App${path.sep}`))
    ).toBe(true)
    expect(content).toContain('if (!hasRenderableClips)')
    expect(content).toContain("window.localStorage.getItem(GUIDE_STORAGE_KEY) === 'done'")
    expect(content).toContain("activeMode === 'edit' ? (")
    expect(content).toContain(") : activeMode === 'color' ? (")
  })

  it('主壳样式应避免默认横向溢出并压缩移动端时间轴', () => {
    const cssPath = path.resolve(process.cwd(), 'apps/frontend/src/App.css')
    const css = readFileSync(cssPath, 'utf8')
    expect(css).toContain('width: 100%;')
    expect(css).toContain('box-sizing: border-box;')
    expect(css).not.toContain('width: 100vw;')
    expect(css).toContain('overflow-x: hidden;')
    expect(css).toContain('min-height: 220px;')
    expect(css).toContain('min-height: 180px;')
  })
})
