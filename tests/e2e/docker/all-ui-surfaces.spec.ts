import { expect, test, type Locator, type Page } from '@playwright/test'
import { attachPageDebug } from '../helpers/debug'
import { dismissGuideIfPresent } from '../helpers/guide'

const STATIC_RESOURCE_TYPES = new Set(['document', 'script', 'stylesheet', 'font', 'image'])

const observeFatalBrowserSignals = (page: Page) => {
  const failures: string[] = []

  page.on('pageerror', (error) => {
    failures.push(`pageerror: ${error?.message || error}`)
  })
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    failures.push(`console.error: ${msg.text()}`)
  })
  page.on('requestfailed', (request) => {
    if (!STATIC_RESOURCE_TYPES.has(request.resourceType())) return
    failures.push(
      `request failed: ${request.method()} ${request.url()} -> ${
        request.failure()?.errorText || 'failed'
      }`
    )
  })
  page.on('response', (response) => {
    const status = response.status()
    const resourceType = response.request().resourceType()
    if (status >= 500 || (status === 404 && STATIC_RESOURCE_TYPES.has(resourceType))) {
      failures.push(`bad response: ${status} ${response.url()}`)
    }
  })

  return () => {
    expect(failures, failures.join('\n')).toEqual([])
  }
}

const assertVisibleBox = async (locator: Locator, label: string) => {
  await expect(locator, `${label} should be visible`).toBeVisible()
  const box = await locator.boundingBox()
  expect(box, `${label} boundingBox should exist`).not.toBeNull()
  expect(box?.width ?? 0, `${label} width`).toBeGreaterThan(8)
  expect(box?.height ?? 0, `${label} height`).toBeGreaterThan(8)
}

const assertNoHorizontalOverflow = async (locator: Locator, label: string) => {
  const metrics = await locator.evaluate((node) => ({
    clientWidth: node.clientWidth,
    scrollWidth: node.scrollWidth
  }))
  expect(metrics.scrollWidth, `${label} horizontal overflow`).toBeLessThanOrEqual(
    metrics.clientWidth + 3
  )
}

const assertNoVerticalOverflow = async (locator: Locator, label: string) => {
  const metrics = await locator.evaluate((node) => ({
    clientHeight: node.clientHeight,
    scrollHeight: node.scrollHeight
  }))
  expect(metrics.scrollHeight, `${label} vertical overflow`).toBeLessThanOrEqual(
    metrics.clientHeight + 3
  )
}

const assertReadableTextContrast = async (locator: Locator, label: string) => {
  const metrics = await locator.evaluate((node) => {
    const parseRgb = (color: string) => {
      const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([^)]+))?\)/.exec(color)
      if (!match) return null
      return {
        alpha: match[4] ? Number(match[4]) : 1,
        blue: Number(match[3]),
        green: Number(match[2]),
        red: Number(match[1])
      }
    }

    const relativeLuminance = (channel: number) => {
      const normalized = channel / 255
      return normalized <= 0.03928
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4
    }

    const contrastRatio = (foreground: string, background: string) => {
      const fg = parseRgb(foreground)
      const bg = parseRgb(background)
      if (!fg || !bg || bg.alpha < 0.95) return 0

      const fgLuminance =
        0.2126 * relativeLuminance(fg.red) +
        0.7152 * relativeLuminance(fg.green) +
        0.0722 * relativeLuminance(fg.blue)
      const bgLuminance =
        0.2126 * relativeLuminance(bg.red) +
        0.7152 * relativeLuminance(bg.green) +
        0.0722 * relativeLuminance(bg.blue)
      const lighter = Math.max(fgLuminance, bgLuminance)
      const darker = Math.min(fgLuminance, bgLuminance)
      return (lighter + 0.05) / (darker + 0.05)
    }

    const style = getComputedStyle(node)
    const rect = node.getBoundingClientRect()
    return {
      backgroundColor: style.backgroundColor,
      color: style.color,
      contrast: contrastRatio(style.color, style.backgroundColor),
      height: rect.height,
      text: node.textContent?.trim() ?? '',
      width: rect.width
    }
  })

  expect(metrics.text, `${label} text`).not.toBe('')
  expect(metrics.width, `${label} width`).toBeGreaterThanOrEqual(40)
  expect(metrics.height, `${label} height`).toBeGreaterThanOrEqual(40)
  expect(metrics.contrast, `${label} contrast`).toBeGreaterThanOrEqual(4.5)
}

const assertInteractionTargetSize = async (locator: Locator, label: string) => {
  await expect(locator, `${label} should be visible`).toBeVisible()
  const box = await locator.boundingBox()
  expect(box, `${label} boundingBox should exist`).not.toBeNull()
  expect(box?.width ?? 0, `${label} width`).toBeGreaterThanOrEqual(40)
  expect(box?.height ?? 0, `${label} height`).toBeGreaterThanOrEqual(40)
}

const assertVisibleHeightAtLeast = async (locator: Locator, minHeight: number, label: string) => {
  const metrics = await locator.evaluate((node) => ({
    clientHeight: node.clientHeight,
    rectHeight: node.getBoundingClientRect().height
  }))
  expect(metrics.clientHeight, `${label} client height`).toBeGreaterThanOrEqual(minHeight)
  expect(metrics.rectHeight, `${label} rendered height`).toBeGreaterThanOrEqual(minHeight)
}

const assertStageNavigationReadable = async (page: Page, label: string) => {
  const markerMetrics = await page.locator('.comparison-lab-pro .lab-stage-marker').evaluateAll(
    (nodes) =>
      nodes.map((node) => {
        const copy = node.querySelector('.lab-stage-marker-copy') as HTMLElement | null
        const text = node.querySelector('.lab-stage-marker-label') as HTMLElement | null
        return {
          copyWidth: copy?.getBoundingClientRect().width ?? 0,
          gridTemplateColumns: getComputedStyle(node).gridTemplateColumns,
          markerWidth: node.getBoundingClientRect().width,
          textWidth: text?.getBoundingClientRect().width ?? 0
        }
      })
  )

  expect(markerMetrics, `${label} stage marker count`).toHaveLength(4)
  for (const [index, metrics] of markerMetrics.entries()) {
    expect(metrics.markerWidth, `${label} stage marker ${index + 1} width`).toBeGreaterThanOrEqual(
      120
    )
    expect(metrics.copyWidth, `${label} stage marker ${index + 1} copy width`).toBeGreaterThanOrEqual(
      56
    )
    expect(metrics.textWidth, `${label} stage marker ${index + 1} text width`).toBeGreaterThan(24)
    expect(metrics.gridTemplateColumns, `${label} stage marker ${index + 1} columns`).not.toContain(
      '0px'
    )
  }
}

const assertDocumentFitsViewport = async (page: Page, label: string) => {
  const metrics = await page.evaluate(() => {
    const root = document.documentElement
    const body = document.body
    return {
      clientHeight: root.clientHeight,
      clientWidth: root.clientWidth,
      scrollHeight: Math.max(root.scrollHeight, body.scrollHeight),
      scrollWidth: Math.max(root.scrollWidth, body.scrollWidth)
    }
  })

  expect(metrics.scrollWidth, `${label} document horizontal scroll`).toBeLessThanOrEqual(
    metrics.clientWidth + 3
  )
  expect(metrics.scrollHeight, `${label} document vertical scroll`).toBeLessThanOrEqual(
    metrics.clientHeight + 3
  )
}

const assertShellSurfaces = async (page: Page, label: string) => {
  await assertVisibleBox(page.getByTestId('area-top-header'), `${label} header`)
  await assertVisibleBox(page.getByTestId('area-left-panel'), `${label} left panel`)
  await assertVisibleBox(page.getByTestId('area-center-panel'), `${label} center panel`)
  await assertVisibleBox(page.getByTestId('area-right-panel'), `${label} right panel`)
  await assertVisibleBox(page.getByTestId('area-timeline'), `${label} timeline`)
  await assertNoHorizontalOverflow(page.getByTestId('area-header-actions'), `${label} header`)
  await assertNoHorizontalOverflow(page.getByTestId('area-left-panel'), `${label} left panel`)
  await assertNoHorizontalOverflow(page.getByTestId('area-center-panel'), `${label} center panel`)
  await assertNoHorizontalOverflow(page.getByTestId('area-right-panel'), `${label} right panel`)
  await assertDocumentFitsViewport(page, label)
}

const assertTimelineEmptyHintIsIntegrated = async (page: Page, label: string) => {
  const metrics = await page.locator('.timeline-empty-hint').evaluate((node) => {
    const style = getComputedStyle(node)
    const rect = node.getBoundingClientRect()
    const alphaMatch = /rgba?\([^,]+,[^,]+,[^,]+(?:,\s*([^)]+))?\)/.exec(style.backgroundColor)
    const backgroundAlpha = alphaMatch?.[1] ? Number(alphaMatch[1]) : 1

    return {
      backdropFilter: style.backdropFilter,
      backgroundAlpha,
      borderTopStyle: style.borderTopStyle,
      boxShadow: style.boxShadow,
      height: rect.height,
      pointerEvents: style.pointerEvents,
      width: rect.width
    }
  })

  expect(metrics.backgroundAlpha, `${label} timeline empty background alpha`).toBeLessThanOrEqual(
    0.08
  )
  expect(metrics.borderTopStyle, `${label} timeline empty border style`).toBe('none')
  expect(metrics.boxShadow, `${label} timeline empty shadow`).toBe('none')
  expect(metrics.backdropFilter, `${label} timeline empty blur`).toBe('none')
  expect(metrics.pointerEvents, `${label} timeline empty pointer events`).toBe('none')
  expect(metrics.width, `${label} timeline empty width`).toBeLessThanOrEqual(360)
  expect(metrics.height, `${label} timeline empty height`).toBeLessThanOrEqual(56)
}

const assertTimelineEmptyActionsAreReachable = async (page: Page, label: string) => {
  const metrics = await page.locator('.timeline-body-refined').evaluate((timeline) => {
    const hint = timeline.querySelector('.timeline-empty-hint') as HTMLElement | null
    const actions = timeline.querySelector('.timeline-empty-cta-rail') as HTMLElement | null
    const buttons = [...timeline.querySelectorAll('.timeline-empty-cta-rail button')]

    if (!hint || !actions) {
      return {
        actionsBottomGap: -1,
        actionsTop: -1,
        buttonHeights: [],
        buttonWidths: [],
        gap: Number.POSITIVE_INFINITY,
        hasActions: false,
        hasHint: Boolean(hint),
        timelineHeight: timeline.getBoundingClientRect().height
      }
    }

    const timelineRect = timeline.getBoundingClientRect()
    const hintRect = hint.getBoundingClientRect()
    const actionRect = actions.getBoundingClientRect()

    return {
      actionsBottomGap: timelineRect.bottom - actionRect.bottom,
      actionsTop: actionRect.top - timelineRect.top,
      buttonHeights: buttons.map((button) => button.getBoundingClientRect().height),
      buttonWidths: buttons.map((button) => button.getBoundingClientRect().width),
      gap: actionRect.top - hintRect.bottom,
      hasActions: true,
      hasHint: true,
      timelineHeight: timelineRect.height
    }
  })

  expect(metrics.hasHint, `${label} timeline empty hint`).toBe(true)
  expect(metrics.hasActions, `${label} timeline empty actions`).toBe(true)
  expect(metrics.gap, `${label} timeline empty action proximity`).toBeLessThanOrEqual(18)
  expect(metrics.actionsTop, `${label} timeline empty action top`).toBeGreaterThanOrEqual(24)
  expect(metrics.actionsBottomGap, `${label} timeline empty action bottom gap`).toBeGreaterThanOrEqual(
    24
  )
  expect(metrics.buttonWidths, `${label} timeline empty action count`).toHaveLength(2)
  for (const [index, width] of metrics.buttonWidths.entries()) {
    expect(width, `${label} timeline empty action ${index + 1} width`).toBeGreaterThanOrEqual(40)
  }
  for (const [index, height] of metrics.buttonHeights.entries()) {
    expect(height, `${label} timeline empty action ${index + 1} height`).toBeGreaterThanOrEqual(34)
  }
}

const assertLightPreviewHasMonitorDepth = async (page: Page, label: string) => {
  const metrics = await page.getByTestId('area-preview-host').evaluate((host) => {
    const parseColor = (color: string) => {
      const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([^)]+))?\)/.exec(color)
      if (!match) return null
      return {
        alpha: match[4] ? Number(match[4]) : 1,
        blue: Number(match[3]),
        green: Number(match[2]),
        red: Number(match[1])
      }
    }

    const frame = host.querySelector('[data-testid="area-preview-frame"]') ?? host
    const visibleSurface = frame.querySelector('.player-empty-state') ?? frame
    const emptyOverlay = host.querySelector('.monitor-empty-overlay') ?? host
    const primaryAction = emptyOverlay.querySelector('.empty-actions button:first-of-type') ?? emptyOverlay
    const secondaryAction = emptyOverlay.querySelector('.empty-actions button:nth-of-type(2)') ?? emptyOverlay
    const style = getComputedStyle(frame)
    const surfaceStyle = getComputedStyle(visibleSurface)
    const overlayStyle = getComputedStyle(emptyOverlay)
    const primaryActionStyle = getComputedStyle(primaryAction)
    const secondaryActionStyle = getComputedStyle(secondaryAction)
    const bg = parseColor(style.backgroundColor)
    const border = parseColor(style.borderTopColor)
    const surfaceBg = parseColor(surfaceStyle.backgroundColor)
    const overlayBg = parseColor(overlayStyle.backgroundColor)
    const primaryActionBg = parseColor(primaryActionStyle.backgroundColor)
    const secondaryActionBg = parseColor(secondaryActionStyle.backgroundColor)
    const luminance = bg
      ? 0.2126 * bg.red + 0.7152 * bg.green + 0.0722 * bg.blue
      : Number.POSITIVE_INFINITY
    const surfaceLuminance = surfaceBg
      ? 0.2126 * surfaceBg.red + 0.7152 * surfaceBg.green + 0.0722 * surfaceBg.blue
      : Number.POSITIVE_INFINITY
    const overlayLuminance = overlayBg
      ? 0.2126 * overlayBg.red + 0.7152 * overlayBg.green + 0.0722 * overlayBg.blue
      : Number.POSITIVE_INFINITY
    const primaryActionLuminance = primaryActionBg
      ? 0.2126 * primaryActionBg.red + 0.7152 * primaryActionBg.green + 0.0722 * primaryActionBg.blue
      : Number.POSITIVE_INFINITY
    const secondaryActionLuminance = secondaryActionBg
      ? 0.2126 * secondaryActionBg.red +
        0.7152 * secondaryActionBg.green +
        0.0722 * secondaryActionBg.blue
      : Number.POSITIVE_INFINITY

    return {
      backgroundColor: style.backgroundColor,
      borderAlpha: border?.alpha ?? 0,
      luminance,
      overlayBackgroundColor: overlayStyle.backgroundColor,
      overlayOpacity: overlayBg?.alpha ?? 0,
      overlayLuminance,
      primaryActionBackgroundColor: primaryActionStyle.backgroundColor,
      primaryActionLuminance,
      secondaryActionBackgroundColor: secondaryActionStyle.backgroundColor,
      secondaryActionLuminance,
      surfaceBackgroundColor: surfaceStyle.backgroundColor,
      surfaceLuminance,
      surfaceOpacity: surfaceBg?.alpha ?? 0
    }
  })

  expect(metrics.luminance, `${label} preview background luminance`).toBeLessThanOrEqual(80)
  expect(metrics.borderAlpha, `${label} preview border alpha`).toBeGreaterThanOrEqual(0.3)
  expect(metrics.surfaceOpacity, `${label} visible preview surface opacity`).toBeGreaterThanOrEqual(
    0.9
  )
  expect(metrics.surfaceLuminance, `${label} visible preview surface minimum luminance`).toBeGreaterThanOrEqual(
    44
  )
  expect(metrics.surfaceLuminance, `${label} visible preview surface luminance`).toBeLessThanOrEqual(
    80
  )
  expect(metrics.overlayLuminance, `${label} preview overlay luminance`).toBeLessThanOrEqual(80)
  expect(metrics.overlayOpacity, `${label} preview overlay opacity`).toBeLessThanOrEqual(0.22)
  expect(metrics.primaryActionLuminance, `${label} primary action background luminance`).toBeLessThanOrEqual(
    170
  )
  expect(
    Math.abs(metrics.primaryActionLuminance - metrics.secondaryActionLuminance),
    `${label} empty action visual hierarchy`
  ).toBeGreaterThanOrEqual(18)
}

test.setTimeout(120_000)

test('Docker 实验室 compare 模式不应出现首屏内部裁切', async ({ page }) => {
  attachPageDebug(page, 'docker-lab-compare-layout')
  const assertNoFatalBrowserSignals = observeFatalBrowserSignals(page)

  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/')
  await dismissGuideIfPresent(page)

  await page.getByTestId('btn-mode-color').click()
  await page.getByTestId('btn-lab-mode-compare').click()
  await expect(page.getByTestId('area-comparison-lab')).toHaveAttribute(
    'data-lab-mode',
    'compare'
  )

  await assertNoVerticalOverflow(
    page.locator('.comparison-lab-pro .lab-stage-main'),
    '实验室 compare 主工位'
  )
  await assertNoVerticalOverflow(
    page.locator('.comparison-lab-pro .lab-panel-stack'),
    '实验室 compare 内容栈'
  )
  await assertNoVerticalOverflow(
    page.locator('.comparison-lab-pro .lab-stage-spine'),
    '实验室 compare 阶段导航'
  )
  await assertNoVerticalOverflow(
    page.locator('.comparison-lab-pro .empty-pane').first(),
    '实验室 compare A 通道空预览'
  )
  await assertNoVerticalOverflow(
    page.locator('.comparison-lab-pro .empty-pane').nth(1),
    '实验室 compare B 通道空预览'
  )
  await assertInteractionTargetSize(
    page.getByRole('button', { name: '导出对比报告', exact: true }),
    '实验室 compare 导出按钮'
  )
  await assertInteractionTargetSize(
    page.getByTestId('btn-open-channel-panel'),
    '实验室 compare 渠道接入按钮'
  )
  await assertInteractionTargetSize(page.locator('.comparison-lab-pro .sync-toggle'), '实验室 compare 同步开关')
  await assertInteractionTargetSize(page.getByLabel('A 通道模型'), '实验室 compare A 模型选择器')
  await assertInteractionTargetSize(page.getByLabel('A 通道素材'), '实验室 compare A 素材选择器')
  await assertInteractionTargetSize(
    page.getByRole('button', { name: '推荐 A 通道', exact: true }),
    '实验室 compare 推荐 A 按钮'
  )
  await assertInteractionTargetSize(page.getByLabel('B 通道模型'), '实验室 compare B 模型选择器')
  await assertInteractionTargetSize(page.getByLabel('B 通道素材'), '实验室 compare B 素材选择器')
  await assertInteractionTargetSize(
    page.getByRole('button', { name: '推荐 B 通道', exact: true }),
    '实验室 compare 推荐 B 按钮'
  )
  await assertDocumentFitsViewport(page, '实验室 compare 模式')

  assertNoFatalBrowserSignals()
})

test('Docker 实验室长流程模式应保留可操作内容视窗', async ({ page }) => {
  attachPageDebug(page, 'docker-lab-long-mode-layout')
  const assertNoFatalBrowserSignals = observeFatalBrowserSignals(page)

  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/')
  await dismissGuideIfPresent(page)

  await page.getByTestId('btn-mode-color').click()

  const longFlowModes = [
    { mode: 'marketplace', panel: '#lab-panel-marketplace' },
    { mode: 'creative', panel: '#lab-panel-creative' },
    { mode: 'collab', panel: '#lab-panel-collab' }
  ] as const

  for (const surface of longFlowModes) {
    await page.getByTestId(`btn-lab-mode-${surface.mode}`).click()
    await expect(page.getByTestId('area-comparison-lab')).toHaveAttribute(
      'data-lab-mode',
      surface.mode
    )
    await assertVisibleHeightAtLeast(
      page.locator('.comparison-lab-pro .lab-panel-stack'),
      240,
      `实验室 ${surface.mode} 内容视窗`
    )
    await assertVisibleHeightAtLeast(
      page.locator(surface.panel),
      240,
      `实验室 ${surface.mode} 活动面板`
    )
    await assertStageNavigationReadable(page, `实验室 ${surface.mode}`)
    await assertDocumentFitsViewport(page, `实验室 ${surface.mode} 长流程模式`)
  }

  assertNoFatalBrowserSignals()
})

test('Docker 部署态所有 WebUI 子页面入口应可达且不破版', async ({ page }) => {
  attachPageDebug(page, 'docker-all-ui-surfaces')
  const assertNoFatalBrowserSignals = observeFatalBrowserSignals(page)

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await dismissGuideIfPresent(page)
  await page.locator('#btn-theme-light').click()

  await assertShellSurfaces(page, '剪辑页初始态')
  await assertTimelineEmptyHintIsIntegrated(page, '剪辑页初始态')
  await assertTimelineEmptyActionsAreReachable(page, '剪辑页初始态')
  await assertLightPreviewHasMonitorDepth(page, '剪辑页初始态')

  await page.getByTestId('select-preview-aspect').selectOption('21:9')
  await expect(page.getByTestId('area-preview-frame')).toHaveAttribute('data-aspect-ratio', '21:9')

  const sidebar = page.locator('.sidebar-tabs')
  const leftPanel = page.getByTestId('area-left-panel')
  await sidebar.getByRole('button', { name: '素材库', exact: true }).click()
  await expect(page.locator('.pro-asset-panel[data-mode="assets"]')).toBeVisible()
  await expect(page.getByLabel('搜索素材')).toBeVisible()
  await expect(page.getByTestId('btn-import-assets')).toBeVisible()
  await assertNoHorizontalOverflow(leftPanel, '素材库面板')

  await sidebar.getByRole('button', { name: 'AI 导演', exact: true }).click()
  await expect(page.locator('.pro-asset-panel[data-mode="director"]')).toBeVisible()
  await expect(page.getByTestId('input-director-prompt')).toBeVisible()
  await expect(page.getByTestId('btn-run-director')).toBeVisible()
  await assertReadableTextContrast(page.getByTestId('btn-run-director'), 'AI 导演主操作按钮')
  await assertNoHorizontalOverflow(leftPanel, 'AI 导演面板')

  await sidebar.getByRole('button', { name: '演员库', exact: true }).click()
  await expect(page.locator('.pro-asset-panel[data-mode="actors"]')).toBeVisible()
  await expect(page.getByPlaceholder('演员名称，例如：都市女主角')).toBeVisible()
  await expect(page.getByRole('button', { name: '新增演员', exact: true })).toBeVisible()
  await assertReadableTextContrast(page.getByRole('button', { name: '新增演员', exact: true }), '演员库主操作按钮')
  await assertNoHorizontalOverflow(leftPanel, '演员库面板')

  await sidebar.getByRole('button', { name: '动捕实验室', exact: true }).click()
  await expect(page.locator('.pro-asset-panel[data-mode="motion"]')).toBeVisible()
  await expect(page.getByRole('button', { name: '启动动捕', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '同步至演员', exact: true })).toBeVisible()
  await assertReadableTextContrast(page.getByRole('button', { name: '启动动捕', exact: true }), '动捕启动按钮')
  await assertReadableTextContrast(page.getByRole('button', { name: '同步至演员', exact: true }), '动捕同步按钮')
  await assertNoHorizontalOverflow(leftPanel, '动捕实验室面板')

  await page.getByTestId('btn-mode-audio').click()
  await expect(sidebar.getByRole('button', { name: '素材库', exact: true })).toBeVisible()
  await expect(sidebar.getByRole('button', { name: 'AI 导演', exact: true })).toHaveCount(0)
  await expect(sidebar.getByRole('button', { name: '演员库', exact: true })).toHaveCount(0)
  await expect(sidebar.getByRole('button', { name: '动捕实验室', exact: true })).toHaveCount(0)
  await assertShellSurfaces(page, '音频大师页')
  await assertVisibleBox(page.locator('.audio-master-stage'), '音频大师舞台')
  await expect(page.getByText('音频母带引擎已就绪')).toBeVisible()
  await expect(page.getByRole('button', { name: '导入音频素材', exact: true })).toBeVisible()
  await expect(page.getByTestId('audio-master-status-tower')).toBeVisible()
  await expect(page.getByTestId('audio-master-lanes')).toBeVisible()
  await expect(page.locator('.timeline-empty-hint')).toContainText('母带轨空置')
  await expect(page.locator('.timeline-empty-hint')).toContainText(
    '导入音频素材后，时间轴会承接节拍、响度与交付检查'
  )
  await expect(page.locator('.timeline-empty-hint')).not.toContainText('AI 导演启动编排')
  await assertNoHorizontalOverflow(page.locator('.audio-master-stage'), '音频大师舞台')

  await page.getByTestId('btn-mode-color').click()
  await expect(sidebar.getByRole('button', { name: '素材库', exact: true })).toBeVisible()
  await expect(sidebar.getByRole('button', { name: 'AI 导演', exact: true })).toHaveCount(0)
  await expect(sidebar.getByRole('button', { name: '演员库', exact: true })).toHaveCount(0)
  await expect(sidebar.getByRole('button', { name: '动捕实验室', exact: true })).toHaveCount(0)
  await expect(page.getByTestId('area-comparison-lab')).toBeVisible()
  await expect(page.locator('.timeline-empty-hint')).toContainText('实验轨空置')
  await expect(page.locator('.timeline-empty-hint')).toContainText(
    '完成双通道比对后，时间轴会承接选定片段与实验结论'
  )
  await expect(page.locator('.timeline-empty-hint')).not.toContainText('AI 导演启动编排')
  await assertShellSurfaces(page, '实验室页')

  await page.getByTestId('btn-open-channel-panel').click()
  await assertVisibleBox(page.getByTestId('area-channel-panel'), 'AI 接入弹窗')
  await expect(page.getByTestId('input-login-email')).toBeVisible()
  await expect(page.getByTestId('input-login-password')).toBeVisible()
  await assertNoHorizontalOverflow(page.getByTestId('area-channel-panel'), 'AI 接入弹窗')
  await page.getByTestId('btn-close-channel-panel').click()
  await expect(page.getByTestId('area-channel-panel-mask')).toBeHidden()

  const labSurfaces = [
    {
      mode: 'compare',
      panel: '#lab-panel-compare',
      markers: ['统一设置本轮对比组合', 'A 通道待装载', 'B 通道待装载']
    },
    {
      mode: 'marketplace',
      panel: '#lab-panel-marketplace',
      markers: ['策略治理中心', '路由模拟', '策略执行记录']
    },
    {
      mode: 'creative',
      panel: '#lab-panel-creative',
      markers: ['创意闭环引擎', '提交任务', '刷新列表']
    },
    {
      mode: 'collab',
      panel: '#lab-panel-collab',
      markers: ['团队空间', '邀请与加入', '高级功能']
    }
  ] as const

  for (const surface of labSurfaces) {
    await page.getByTestId(`btn-lab-mode-${surface.mode}`).click()
    await expect(page.getByTestId('area-comparison-lab')).toHaveAttribute(
      'data-lab-mode',
      surface.mode
    )
    const panel = page.locator(surface.panel)
    await assertVisibleBox(panel, `实验室 ${surface.mode} 面板`)
    for (const marker of surface.markers) {
      const markerLocator = panel.getByText(marker, { exact: true })
      expect(await markerLocator.count(), `marker should exist: ${marker}`).toBeGreaterThan(0)
      await expect(markerLocator.first()).toBeVisible()
    }
    if (surface.mode === 'compare') {
      await assertNoVerticalOverflow(
        page.locator('.comparison-lab-pro .lab-stage-main'),
        '实验室 compare 主工位'
      )
      await assertNoVerticalOverflow(
        page.locator('.comparison-lab-pro .lab-panel-stack'),
        '实验室 compare 内容栈'
      )
    }
    await assertNoHorizontalOverflow(panel, `实验室 ${surface.mode} 面板`)
    await assertDocumentFitsViewport(page, `实验室 ${surface.mode} 面板`)
  }

  await page.getByTestId('btn-toggle-advanced-sections').click()
  await expect(page.getByTestId('collab-advanced-watchboard')).toBeVisible()
  await expect(page.getByTestId('project-governance-watchboard')).toBeVisible()
  await expect(page.getByTestId('permission-merge-watchboard')).toBeVisible()
  await expect(page.getByTestId('ops-watchboard')).toBeVisible()
  await expect(page.getByTestId('storage-snapshot-watchboard')).toBeVisible()
  await assertNoHorizontalOverflow(page.locator('.collab-advanced-grid'), '协作高级功能区')

  await page.getByTestId('area-right-panel').getByRole('button', { name: '监控' }).click()
  await expect(page.getByText('实验值守摘要')).toBeVisible()
  await expect(page.locator('.telemetry-watch-brief-card')).toHaveCount(4)
  await page.getByRole('button', { name: '展开系统监控', exact: true }).click()
  await assertVisibleBox(page.locator('.lab-watch-stage-shell .telemetry-dashboard'), '系统监控页')
  await expect(page.locator('.telemetry-command-stat')).toHaveCount(6)
  await expect(page.getByRole('heading', { name: 'Provider 健康检查' })).toBeVisible()
  await expect(page.getByText('数据库自愈中心')).toBeVisible()
  await assertShellSurfaces(page, '系统监控页')

  assertNoFatalBrowserSignals()
})
