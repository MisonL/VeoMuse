import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import path from 'path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import App, {
  buildGuideCardStyle,
  buildGuideHighlightStyle,
  computeCenterPanelFitWidth,
  computeCenterPanelMinWidth,
  getExportButtonLabel,
  resolveExportFeedbackSubtitle,
  resolveExportFeedbackTitle
} from '../apps/frontend/src/App'

describe('App 运行态关键分支（DOM/SSR）', () => {
  it('应输出模式切换与导出关键 DOM 结构', () => {
    const html = renderToStaticMarkup(createElement(App))
    expect(html).toContain('data-testid="btn-mode-edit"')
    expect(html).toContain('data-testid="btn-mode-color"')
    expect(html).toContain('data-testid="btn-mode-audio"')
    expect(html).toContain('data-testid="btn-export"')
    expect(html).toContain('data-testid="area-timeline"')
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
    expect(computeCenterPanelMinWidth(true, 'fit', 'edit')).toBe(340)
    expect(computeCenterPanelMinWidth(true, 'fit', 'color')).toBe(340)
    expect(computeCenterPanelMinWidth(true, 'focus', 'audio')).toBe(376)

    expect(
      computeCenterPanelFitWidth({
        activeMode: 'color',
        centerMode: 'focus',
        centerPanelMinWidth: 340,
        isDesktopLayout: true,
        previewFrameWidth: 0
      })
    ).toBe(816)
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
    ).toBe(520)
  })

  it('App 应保留导出守卫、引导与模式分支实现', () => {
    const appPath = path.resolve(process.cwd(), 'apps/frontend/src/App.tsx')
    const content = readFileSync(appPath, 'utf8')
    expect(content).toContain('if (!hasRenderableClips)')
    expect(content).toContain("window.localStorage.getItem(GUIDE_STORAGE_KEY) === 'done'")
    expect(content).toContain("activeMode === 'edit' ? (")
    expect(content).toContain(") : activeMode === 'color' ? (")
  })
})
