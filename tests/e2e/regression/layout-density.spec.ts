import { expect, test } from '@playwright/test'

const luminanceFromRgb = (rgb: string) => {
  const channels = rgb.match(/\d+(\.\d+)?/g)?.slice(0, 3).map(Number)
  if (!channels || channels.length < 3) return 1

  const [r, g, b] = channels.map((value) => {
    const normalized = value / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4)
  })

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

test('默认剪辑工作台应为无滚动的专业暗色布局', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/')

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  const header = page.getByTestId('area-top-header')
  const main = page.getByTestId('area-main-layout')
  const left = page.getByTestId('area-left-panel')
  const center = page.getByTestId('area-center-panel')
  const right = page.getByTestId('area-right-panel')
  const preview = page.getByTestId('area-preview-frame')
  const timeline = page.getByTestId('area-timeline')

  await expect(header).toBeVisible()
  await expect(main).toBeVisible()
  await expect(left).toBeVisible()
  await expect(center).toBeVisible()
  await expect(right).toBeVisible()
  await expect(preview).toBeVisible()
  await expect(timeline).toBeVisible()

  const documentMetrics = await page.evaluate(() => {
    const root = document.documentElement
    const body = document.body
    return {
      clientHeight: root.clientHeight,
      clientWidth: root.clientWidth,
      scrollHeight: Math.max(root.scrollHeight, body.scrollHeight),
      scrollWidth: Math.max(root.scrollWidth, body.scrollWidth)
    }
  })
  expect(documentMetrics.scrollHeight).toBeLessThanOrEqual(documentMetrics.clientHeight + 3)
  expect(documentMetrics.scrollWidth).toBeLessThanOrEqual(documentMetrics.clientWidth + 3)

  const headerBox = await header.boundingBox()
  const mainBox = await main.boundingBox()
  const leftBox = await left.boundingBox()
  const centerBox = await center.boundingBox()
  const rightBox = await right.boundingBox()
  const previewBox = await preview.boundingBox()
  const timelineBox = await timeline.boundingBox()

  if (!headerBox || !mainBox || !leftBox || !centerBox || !rightBox || !previewBox || !timelineBox) {
    throw new Error('布局区域不可测量')
  }

  expect(headerBox.height).toBeLessThanOrEqual(64)
  expect(leftBox.width).toBeGreaterThanOrEqual(260)
  expect(rightBox.width).toBeGreaterThanOrEqual(220)
  expect(centerBox.width / mainBox.width).toBeGreaterThanOrEqual(0.54)
  expect((leftBox.width + rightBox.width) / mainBox.width).toBeLessThanOrEqual(0.46)
  expect(timelineBox.height).toBeGreaterThanOrEqual(170)

  const previewRatio = previewBox.width / previewBox.height
  expect(Math.abs(previewRatio - 16 / 9)).toBeLessThan(0.09)
  expect(previewBox.height).toBeGreaterThanOrEqual(300)

  const sidebarTabMetrics = await page.locator('.panel-left .sidebar-tab').evaluateAll((tabs) =>
    tabs.map((tab) => ({
      label: tab.textContent?.trim() || '',
      clientWidth: tab.clientWidth,
      scrollWidth: tab.scrollWidth,
      clientHeight: tab.clientHeight,
      scrollHeight: tab.scrollHeight
    }))
  )

  for (const tab of sidebarTabMetrics) {
    expect(tab.scrollWidth, `${tab.label} 页签不应横向裁切`).toBeLessThanOrEqual(tab.clientWidth + 1)
    expect(tab.scrollHeight, `${tab.label} 页签不应纵向裁切`).toBeLessThanOrEqual(tab.clientHeight + 1)
  }

  const inspectorTabMetrics = await page.locator('.panel-right .inspector-tabs-lite button').evaluateAll((tabs) =>
    tabs.map((tab) => ({
      label: tab.textContent?.trim() || '',
      clientWidth: tab.clientWidth,
      scrollWidth: tab.scrollWidth,
      clientHeight: tab.clientHeight,
      scrollHeight: tab.scrollHeight
    }))
  )

  for (const tab of inspectorTabMetrics) {
    expect(tab.scrollWidth, `${tab.label} 属性页签不应横向裁切`).toBeLessThanOrEqual(tab.clientWidth + 1)
    expect(tab.scrollHeight, `${tab.label} 属性页签不应纵向裁切`).toBeLessThanOrEqual(tab.clientHeight + 1)
  }

  const sidebarPressedState = await page.locator('.panel-left .sidebar-tab').evaluateAll((tabs) =>
    tabs.map((tab) => ({
      label: tab.textContent?.trim() || '',
      pressed: tab.getAttribute('aria-pressed'),
      active: tab.classList.contains('active')
    }))
  )
  expect(sidebarPressedState).toContainEqual({ label: '素材库', pressed: 'true', active: true })
  for (const tab of sidebarPressedState.filter((item) => !item.active)) {
    expect(tab.pressed, `${tab.label} 页签应暴露未选中状态`).toBe('false')
  }

  const inspectorPressedState = await page.locator('.panel-right .inspector-tabs-lite button').evaluateAll((tabs) =>
    tabs.map((tab) => ({
      label: tab.textContent?.trim() || '',
      pressed: tab.getAttribute('aria-pressed'),
      active: tab.classList.contains('active')
    }))
  )
  expect(inspectorPressedState).toContainEqual({ label: '属性', pressed: 'true', active: true })
  for (const tab of inspectorPressedState.filter((item) => !item.active)) {
    expect(tab.pressed, `${tab.label} 属性页签应暴露未选中状态`).toBe('false')
  }

  const surfaceColors = await page.evaluate(() => {
    const selectors = [
      { selector: '.pro-master-shell', maxLuminance: 0.24 },
      { selector: '.os-header', maxLuminance: 0.24 },
      { selector: '.panel-left', maxLuminance: 0.24 },
      { selector: '.panel-right', maxLuminance: 0.24 },
      { selector: '.timeline-container', maxLuminance: 0.24 },
      { selector: '.os-header .mode-tab:not(.active)', maxLuminance: 0.32 },
      { selector: '.asset-search-bar', maxLuminance: 0.32 },
      { selector: '.cat-btn:not(.active)', maxLuminance: 0.32 },
      { selector: '.asset-intel-strip', maxLuminance: 0.32 },
      { selector: '.pro-empty-state-v2', maxLuminance: 0.32 },
      { selector: '.pro-inspector-inner', maxLuminance: 0.32 },
      { selector: '.inspector-empty-lite', maxLuminance: 0.32 }
    ]

    return selectors.map(({ selector, maxLuminance }) => {
      const node = document.querySelector(selector)
      return {
        selector,
        maxLuminance,
        backgroundColor: node ? getComputedStyle(node).backgroundColor : ''
      }
    })
  })

  for (const surface of surfaceColors) {
    expect(surface.backgroundColor, `${surface.selector} 应有可测背景色`).not.toBe('')
    expect(luminanceFromRgb(surface.backgroundColor), `${surface.selector} 不应仍是浅米色`).toBeLessThan(
      surface.maxLuminance
    )
  }
})
