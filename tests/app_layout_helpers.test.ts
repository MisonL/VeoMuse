import { describe, expect, it } from 'bun:test'
import {
  buildGuideCardStyle,
  buildGuideHighlightStyle,
  buildPreviewFrameStyle,
  buildShellLayoutVars,
  computeLeftPanelWidthAfterDrag,
  computeRightPanelWidthAfterDrag,
  computeCenterPanelFitWidth,
  computeCenterPanelMinWidth,
  computeTimelineHeightAfterDrag,
  deriveCurrentMetrics,
  getNextClipTimeFromTracks,
  hasRenderableClipsFromTracks,
  normalizeDesktopPanelWidthsPure,
  resolveExportFeedbackSubtitle,
  resolveExportFeedbackTitle,
  resolveExportQualityLabel
} from '../apps/frontend/src/App'

describe('App 布局与状态辅助函数', () => {
  it('hasRenderableClipsFromTracks 应识别可渲染轨道', () => {
    expect(hasRenderableClipsFromTracks([])).toBe(false)
    expect(
      hasRenderableClipsFromTracks([
        { type: 'text', clips: [{ start: 0, src: 'abc' }] },
        { type: 'mask', clips: [{ start: 1, src: 'def' }] },
        { type: 'video', clips: [{ start: 2, src: '   ' }] }
      ])
    ).toBe(false)
    expect(
      hasRenderableClipsFromTracks([
        { type: 'video', clips: [{ start: 3, src: 'file:///ok.mp4' }] }
      ])
    ).toBe(true)
  })

  it('deriveCurrentMetrics 应按指标生成展示文案', () => {
    expect(deriveCurrentMetrics(undefined)).toEqual({ gpu: 0, ram: '0 / 0', cache: '0%' })
    expect(
      deriveCurrentMetrics({
        system: {
          renderLoad: 42.7,
          memory: {
            total: 8 * 1024 ** 3,
            usage: 0.314
          }
        }
      })
    ).toEqual({ gpu: 43, ram: '8.0GB', cache: '31%' })
    expect(
      deriveCurrentMetrics({
        system: {
          renderLoad: Number.NaN,
          memory: {
            total: 0,
            usage: 0
          }
        }
      })
    ).toEqual({ gpu: 0, ram: '0.0GB', cache: '0%' })
  })

  it('getNextClipTimeFromTracks 应返回大于当前时间的最小起点', () => {
    const tracks = [
      { clips: [{ start: 10 }, { start: 2 }, { start: 6 }] },
      { clips: [{ start: 7 }, { start: 2 }] }
    ]
    expect(getNextClipTimeFromTracks(2, tracks)).toBe(6)
    expect(getNextClipTimeFromTracks(9, tracks)).toBe(10)
    expect(getNextClipTimeFromTracks(10, tracks)).toBe(0)
  })

  it('导出标题与副标题应按状态映射', () => {
    expect(resolveExportQualityLabel('standard')).toBe('标准导出')
    expect(resolveExportQualityLabel('4k-hdr')).toBe('4K HDR')
    expect(resolveExportQualityLabel('spatial-vr')).toBe('空间视频')

    expect(resolveExportFeedbackTitle('idle')).toBe('等待导出')
    expect(resolveExportFeedbackTitle('validating')).toBe('准备素材中')
    expect(resolveExportFeedbackTitle('composing')).toBe('渲染时间轴中')
    expect(resolveExportFeedbackTitle('packaging')).toBe('封装输出中')
    expect(resolveExportFeedbackTitle('done')).toBe('导出完成')
    expect(resolveExportFeedbackTitle('error')).toBe('导出失败')

    expect(resolveExportFeedbackSubtitle('pending', '4K HDR')).toBe('规格：4K HDR')
    expect(resolveExportFeedbackSubtitle('done', '4K HDR')).toBe('输出文件已生成')
    expect(resolveExportFeedbackSubtitle('error', '4K HDR', '  导出   失败  请重试  ')).toBe(
      '导出 失败 请重试'
    )
    expect(resolveExportFeedbackSubtitle('idle', '4K HDR')).toBe('')
  })

  it('中心区尺寸计算应按模式与布局返回结果', () => {
    expect(computeCenterPanelMinWidth(false, 'fit', 'edit')).toBe(340)
    expect(computeCenterPanelMinWidth(true, 'fit', 'color')).toBe(378)
    expect(computeCenterPanelMinWidth(true, 'fit', 'audio')).toBe(348)
    expect(computeCenterPanelMinWidth(true, 'fit', 'edit')).toBe(360)
    expect(computeCenterPanelMinWidth(true, 'focus', 'audio')).toBe(376)
    expect(computeCenterPanelMinWidth(true, 'focus', 'edit')).toBe(396)

    expect(
      computeCenterPanelFitWidth({
        activeMode: 'edit',
        centerMode: 'fit',
        centerPanelMinWidth: 340,
        isDesktopLayout: false,
        previewFrameWidth: 0
      })
    ).toBe(520)
    expect(
      computeCenterPanelFitWidth({
        activeMode: 'color',
        centerMode: 'focus',
        centerPanelMinWidth: 360,
        isDesktopLayout: true,
        previewFrameWidth: 0
      })
    ).toBe(816)
    expect(
      computeCenterPanelFitWidth({
        activeMode: 'edit',
        centerMode: 'focus',
        centerPanelMinWidth: 380,
        isDesktopLayout: true,
        previewFrameWidth: 900
      })
    ).toBe(796)
  })

  it('样式构造函数应输出可直接渲染的 CSS 变量', () => {
    const vars = buildShellLayoutVars({
      centerMode: 'focus',
      centerPanelFitWidth: 778.6,
      centerPanelMinWidth: 420,
      leftPanelPx: 280,
      rightPanelPx: 360,
      timelinePx: 260
    }) as Record<string, string>
    expect(vars['--left-panel-w']).toBe('280px')
    expect(vars['--right-panel-w']).toBe('360px')
    expect(vars['--center-panel-fit-w']).toBe('779px')
    expect(vars['--left-panel-flex']).toBe('1.36fr')
    expect(vars['--timeline-h']).toBe('260px')

    expect(buildPreviewFrameStyle({ width: 0, height: 100 })).toBeUndefined()
    expect(buildPreviewFrameStyle({ width: 200, height: 120 })).toEqual({
      width: '200px',
      height: '120px'
    })
  })

  it('面板尺寸算法应在约束下收敛并按拖拽方向计算', () => {
    expect(
      normalizeDesktopPanelWidthsPure({
        mainWidth: 0,
        centerPanelMinWidth: 420,
        leftPanelPx: 260,
        rightPanelPx: 320
      })
    ).toBeNull()
    expect(
      normalizeDesktopPanelWidthsPure({
        mainWidth: 1180,
        centerPanelMinWidth: 420,
        leftPanelPx: 420,
        rightPanelPx: 420
      })
    ).toEqual({
      leftPanelPx: 320,
      rightPanelPx: 420
    })

    expect(
      computeLeftPanelWidthAfterDrag({
        delta: 80,
        mainWidth: 1180,
        currentLeft: 260,
        currentRight: 320,
        centerPanelMinWidth: 420
      })
    ).toBe(340)
    expect(
      computeLeftPanelWidthAfterDrag({
        delta: 200,
        mainWidth: 900,
        currentLeft: 260,
        currentRight: 320,
        centerPanelMinWidth: 420
      })
    ).toBe(300)
    expect(
      computeRightPanelWidthAfterDrag({
        delta: 60,
        mainWidth: 1180,
        currentLeft: 300,
        currentRight: 360,
        centerPanelMinWidth: 420
      })
    ).toBe(300)
    expect(
      computeRightPanelWidthAfterDrag({
        delta: -200,
        mainWidth: 900,
        currentLeft: 300,
        currentRight: 360,
        centerPanelMinWidth: 420
      })
    ).toBe(280)
    expect(
      computeTimelineHeightAfterDrag({
        delta: 50,
        shellHeight: 1080,
        timelinePx: 320
      })
    ).toBe(270)
    expect(
      computeTimelineHeightAfterDrag({
        delta: -800,
        shellHeight: 600,
        timelinePx: 320
      })
    ).toBe(220)
  })

  it('引导样式计算应处理越界与空值', () => {
    expect(buildGuideHighlightStyle(undefined)).toBeUndefined()
    expect(
      buildGuideHighlightStyle({
        top: 100,
        left: 200,
        width: 300,
        height: 150
      })
    ).toEqual({
      top: '94px',
      left: '194px',
      width: '312px',
      height: '162px'
    })

    expect(buildGuideCardStyle(undefined, { width: 1200, height: 800 })).toBeUndefined()
    expect(
      buildGuideCardStyle(
        { top: 700, left: 1100, width: 160, height: 48 },
        { width: 1280, height: 820 }
      )
    ).toEqual({
      top: '466px',
      left: '948px'
    })
    expect(
      buildGuideCardStyle({ top: 20, left: 1, width: 100, height: 20 }, { width: 500, height: 300 })
    ).toEqual({
      top: '54px',
      left: '12px'
    })
  })
})
