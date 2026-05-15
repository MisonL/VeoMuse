import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import path from 'path'
describe('亮色主题与视觉令牌验证', () => {
  const readThemeCss = () =>
    readFileSync(path.resolve(process.cwd(), 'apps/frontend/src/theme.css'), 'utf8')

  const readAppCss = () =>
    readFileSync(path.resolve(process.cwd(), 'apps/frontend/src/App.css'), 'utf8')

  const readAssetPanelCss = () =>
    readFileSync(path.resolve(process.cwd(), 'apps/frontend/src/components/Editor/AssetPanel.css'), 'utf8')

  const readThemeBlock = (content: string, selector: string) => {
    const start = content.lastIndexOf(selector)
    if (start < 0) return ''
    const bodyStart = content.indexOf('{', start)
    if (bodyStart < 0) return ''
    const bodyEnd = content.indexOf('}', bodyStart)
    if (bodyEnd < 0) return ''
    return content.slice(bodyStart + 1, bodyEnd)
  }

  const readCssVariable = (block: string, variableName: string) => {
    const match = new RegExp(`${variableName}:\\s*([^;]+);`).exec(block)
    return match?.[1]?.trim() || ''
  }

  it('ThemeStore 源码默认模式应为 dark', () => {
    const storePath = path.resolve(process.cwd(), 'apps/frontend/src/store/themeStore.ts')
    const content = readFileSync(storePath, 'utf8')
    expect(content).toContain("mode: 'dark'")
  })

  it('theme.css 应以亮色变量为默认并提供 dark 覆盖', () => {
    const cssPath = path.resolve(process.cwd(), 'apps/frontend/src/theme.css')
    const content = readFileSync(cssPath, 'utf8')
    expect(content).toContain(':root')
    expect(content).toContain('color-scheme: light')
    expect(content).toContain("[data-theme='dark']")
    expect(content).toContain('--ap-accent')
    expect(content).toContain('--ap-transition-fast')
  })

  it('light 与 dark 主题应使用一致的 Pro 工作台圆角比例', () => {
    const content = readThemeCss()
    const lightBlock = readThemeBlock(content, ":root,\n[data-theme='light']")
    const darkBlock = readThemeBlock(content, "[data-theme='dark']")

    expect(readCssVariable(lightBlock, '--ap-radius')).toBe('16px')
    expect(readCssVariable(lightBlock, '--ap-radius-inner')).toBe('10px')
    expect(readCssVariable(darkBlock, '--ap-radius')).toBe('16px')
    expect(readCssVariable(darkBlock, '--ap-radius-inner')).toBe('10px')
  })

  it('light 主题必须显式覆盖桌面工作台的深色硬编码表面', () => {
    const content = readAppCss()
    const lightCorrectionStart = content.indexOf('Graphite studio light correction 2026-04-27')
    expect(lightCorrectionStart).toBeGreaterThan(0)

    const lightCorrection = content.slice(lightCorrectionStart)
    const requiredLightSelectors = [
      "[data-theme='light'] .os-header",
      "[data-theme='light'] .panel-left",
      "[data-theme='light'] .panel-right",
      "[data-theme='light'] .timeline-container",
      "[data-theme='light'] .monitor-core",
      "[data-theme='light'] .preview-frame",
      "[data-theme='light'] .monitor-bottom-bar",
      "[data-theme='light'] .header-select-compact",
      "[data-theme='light'] .pro-asset-panel",
      "[data-theme='light'] .pro-inspector-inner",
      "[data-theme='light'] .timeline-body-refined",
      "[data-theme='light'] .monitor-empty-overlay",
    ]

    for (const selector of requiredLightSelectors) {
      expect(lightCorrection).toContain(selector)
    }
    expect(lightCorrection).not.toContain('background-color: #101315')
    expect(lightCorrection).not.toContain('background-color: #111518')
    expect(lightCorrection).not.toContain('background-color: #15191b')
  })

  it('light 主题时间轴必须显式提供刻度与网格对比', () => {
    const content = readAppCss()
    const readabilityStart = content.indexOf('Studio readability correction 2026-04-27')
    expect(readabilityStart).toBeGreaterThan(0)

    const readabilityCorrection = content.slice(readabilityStart)
    const requiredTimelineSelectors = [
      "[data-theme='light'] .timeline-editor-time-area",
      "[data-theme='light'] .timeline-editor-time-unit",
      "[data-theme='light'] .timeline-editor-time-unit-scale",
      "[data-theme='light'] .timeline-editor",
      "[data-theme='light'] .timeline-editor-edit-area",
      "[data-theme='light'] .pro-nle-container .timeline-editor-time-area",
      "[data-theme='light'] .pro-nle-container .timeline-editor-edit-area",
      "[data-theme='light'] .timeline-empty-hint",
      "[data-theme='light'] .timeline-empty-hint p",
    ]

    for (const selector of requiredTimelineSelectors) {
      expect(readabilityCorrection).toContain(selector)
    }

    expect(readabilityCorrection).toContain('rgba(56, 45, 31')
    expect(readabilityCorrection).not.toContain('color: rgba(255, 255, 255')
  })

  it('light 主题时间轴编辑区覆盖必须高于后加载组件样式', () => {
    const content = readAppCss()
    const readabilityStart = content.indexOf('Studio readability correction 2026-04-27')
    expect(readabilityStart).toBeGreaterThan(0)

    const readabilityCorrection = content.slice(readabilityStart)
    const highSpecificitySelectors = [
      "html[data-theme='light'] body .pro-nle-container .timeline-editor-edit-area",
      "html[data-theme='dark'] body .pro-nle-container .timeline-editor-edit-area",
    ]

    for (const selector of highSpecificitySelectors) {
      expect(readabilityCorrection).toContain(selector)
    }
  })

  it('桌面主工作台关键点击目标不应低于 40px', () => {
    const content = readAppCss()
    const readabilityStart = content.indexOf('Studio readability correction 2026-04-27')
    expect(readabilityStart).toBeGreaterThan(0)

    const readabilityCorrection = content.slice(readabilityStart)
    const requiredControlSelectors = [
      '.tool-btn-lite',
      '.transport-btn-small',
      '.monitor-actions-group .action-pill',
      '.mode-tab',
      '.os-header .mode-tab',
      '.theme-btn',
      '.header-select-compact',
      '.export-btn-compact',
      '.sidebar-tab',
      '.panel-left .sidebar-tab',
      '.inspector-tabs-lite button',
      '.panel-right .inspector-tabs-lite button',
    ]

    for (const selector of requiredControlSelectors) {
      expect(readabilityCorrection).toContain(selector)
    }

    expect(readabilityCorrection).toContain('min-width: 40px !important')
    expect(readabilityCorrection).toContain('min-height: 40px !important')
    expect(readabilityCorrection).toContain('height: 40px !important')
  })

  it('light 主题左侧选中页签不应被通用浅色按钮规则覆盖', () => {
    const content = readAppCss()
    const readabilityStart = content.indexOf('Studio readability correction 2026-04-27')
    expect(readabilityStart).toBeGreaterThan(0)

    const readabilityCorrection = content.slice(readabilityStart)
    const activeSidebarSelector = "[data-theme='light'] .panel-left .sidebar-tab.active"
    const activeSelectorIndex = readabilityCorrection.indexOf(activeSidebarSelector)
    const genericSelectorIndex = readabilityCorrection.indexOf("[data-theme='light'] .sidebar-tab")

    expect(activeSelectorIndex).toBeGreaterThan(genericSelectorIndex)
    expect(readabilityCorrection).toContain(activeSidebarSelector)
    expect(readabilityCorrection).toContain('color: #f6fbfa !important')
  })

  it('dark 主题必须显式加强监看空态与时间轴层级', () => {
    const content = readAppCss()
    const readabilityStart = content.indexOf('Studio readability correction 2026-04-27')
    expect(readabilityStart).toBeGreaterThan(0)

    const readabilityCorrection = content.slice(readabilityStart)
    const requiredDarkSelectors = [
      "[data-theme='dark'] .preview-frame",
      "[data-theme='dark'] .monitor-stage-shell.is-idle .preview-frame",
      "[data-theme='dark'] .monitor-empty-overlay",
      "[data-theme='dark'] .empty-hero strong",
      "[data-theme='dark'] .empty-hero p",
      "[data-theme='dark'] .timeline-editor-time-area",
      "[data-theme='dark'] .timeline-editor-time-unit",
      "[data-theme='dark'] .timeline-editor-time-unit-scale",
      "[data-theme='dark'] .timeline-editor",
      "[data-theme='dark'] .timeline-editor-edit-area",
      "[data-theme='dark'] .pro-nle-container .timeline-editor-time-area",
      "[data-theme='dark'] .pro-nle-container .timeline-editor-edit-area",
      "[data-theme='dark'] .timeline-empty-hint",
    ]

    for (const selector of requiredDarkSelectors) {
      expect(readabilityCorrection).toContain(selector)
    }

    expect(readabilityCorrection).toContain('rgba(159, 214, 222')
    expect(readabilityCorrection).toContain('#f6fbfa')
  })

  it('Claude 视觉审查修复应降低暗色素材区割裂、容器噪声与时间轴浮层感', () => {
    const content = readAppCss()
    const correctionStart = content.indexOf('Claude visual audit correction 2026-04-28')
    expect(correctionStart).toBeGreaterThan(0)

    const correction = content.slice(correctionStart)
    const requiredSelectors = [
      "[data-theme='dark'] .panel-left .pro-asset-panel",
      "[data-theme='dark'] .panel-left .pro-asset-grid",
      "[data-theme='dark'] .panel-left .asset-search-bar",
      "[data-theme='dark'] .panel-left .pro-empty-state-v2",
      "[data-theme='dark'] .panel-left .asset-empty-state",
      "[data-theme='dark'] .panel-left",
      "[data-theme='dark'] .panel-right",
      "[data-theme='dark'] .timeline-container",
      '.timeline-empty-hint',
      '.timeline-body.is-idle .timeline-empty-state',
    ]
    const requiredHighSpecificitySelectors = [
      "html[data-theme='light'] body .timeline-empty-hint",
      "html[data-theme='dark'] body .timeline-empty-hint",
      "html[data-theme='light'] body .timeline-body.is-idle .timeline-empty-state",
      "html[data-theme='dark'] body .timeline-body.is-idle .timeline-empty-state",
    ]

    for (const selector of requiredSelectors) {
      expect(correction).toContain(selector)
    }

    for (const selector of requiredHighSpecificitySelectors) {
      expect(correction).toContain(selector)
    }

    expect(correction).toContain('box-shadow: none !important')
    expect(correction).toContain('border-radius: 4px !important')
    expect(correction).toContain('backdrop-filter: none !important')
  })

  it('App 不应再内联注入主题变量块', () => {
    const appPath = path.resolve(process.cwd(), 'apps/frontend/src/App.tsx')
    const content = readFileSync(appPath, 'utf8')
    expect(content.includes('<style>{`')).toBe(false)
    expect(content).toContain("import './App.css'")
  })

  it('Gemini 视觉审查修复应覆盖禁用态与窄侧栏布局密度', () => {
    const appCss = readAppCss()
    const assetPanelCss = readAssetPanelCss()
    const correctionStart = appCss.indexOf('Gemini UI audit correction 2026-04-29')
    expect(correctionStart).toBeGreaterThan(0)

    const correction = appCss.slice(correctionStart)
    const requiredDisabledSelectors = [
      '.tool-btn-lite:disabled',
      '.pro-btn-primary:disabled',
      '.pro-btn-secondary:disabled',
      '.quick-actions-refined',
    ]

    for (const selector of requiredDisabledSelectors) {
      expect(correction).toContain(selector)
    }

    const appDisabledStart = correction.indexOf('.tool-btn-lite:disabled')
    expect(appDisabledStart).toBeGreaterThanOrEqual(0)
    const appDisabledRule = correction.slice(
      appDisabledStart,
      correction.indexOf('}', appDisabledStart)
    )
    expect(appDisabledRule).toContain('cursor: not-allowed')
    expect(appDisabledRule).not.toContain('pointer-events: none')
    expect(correction).toContain('flex-wrap: wrap')
    const motionDisabledStart = assetPanelCss.indexOf('.motion-btn:disabled')
    expect(motionDisabledStart).toBeGreaterThan(0)
    const motionDisabledRule = assetPanelCss.slice(
      motionDisabledStart,
      assetPanelCss.indexOf('}', motionDisabledStart)
    )
    expect(motionDisabledRule).toContain('opacity: 0.68')
    expect(motionDisabledRule).toContain('cursor: not-allowed')
    expect(motionDisabledRule).not.toContain('pointer-events: none')
    expect(assetPanelCss).toContain('.scene-add-btn:disabled')
    expect(readThemeBlock(assetPanelCss, '.scene-add-btn:disabled')).not.toContain(
      'pointer-events: none'
    )
    expect(assetPanelCss).toContain('repeat(auto-fit, minmax(120px, 1fr))')
  })
})
