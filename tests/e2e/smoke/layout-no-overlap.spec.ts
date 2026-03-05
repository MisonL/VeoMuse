import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { attachPageDebug } from '../helpers/debug'

const VIEWPORTS = [
  { width: 1366, height: 900 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 }
]

const dismissGuideIfPresent = async (page: Page) => {
  const skipBtn = page.getByRole('button', { name: '跳过' })
  if (await skipBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await skipBtn.click()
  }
}

test('主布局三区域在常见桌面分辨率不重叠且关键操作可达', async ({ page }) => {
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport)
    attachPageDebug(page, `layout-no-overlap-${viewport.width}x${viewport.height}`)
    await page.goto('/')
    await dismissGuideIfPresent(page)

    await page.getByTestId('btn-reset-layout').click()
    await page.getByTestId('btn-center-mode-fit').click()

    const left = page.getByTestId('area-left-panel')
    const center = page.getByTestId('area-center-panel')
    const right = page.getByTestId('area-right-panel')
    const headerActions = page.getByTestId('area-header-actions')
    const timeline = page.getByTestId('area-timeline')

    await expect(left).toBeVisible()
    await expect(center).toBeVisible()
    await expect(right).toBeVisible()
    await expect(headerActions).toBeVisible()
    await expect(timeline).toBeVisible()
    await expect(page.getByTestId('btn-center-mode-fit')).toHaveClass(/active/)
    await expect(page.getByTestId('btn-open-channel-access')).toBeVisible()
    await expect(page.getByTestId('select-export-quality')).toBeVisible()
    await expect(page.getByTestId('btn-export')).toBeVisible()

    const leftBox = await left.boundingBox()
    const centerBox = await center.boundingBox()
    const rightBox = await right.boundingBox()
    if (!leftBox || !centerBox || !rightBox) {
      throw new Error(`布局区域 boundingBox 为空，无法验证: ${viewport.width}x${viewport.height}`)
    }

    expect(leftBox.width).toBeGreaterThan(260)
    expect(centerBox.width).toBeGreaterThan(350)
    expect(rightBox.width).toBeGreaterThan(240)
    expect(leftBox.x + leftBox.width).toBeLessThanOrEqual(centerBox.x + 2)
    expect(centerBox.x + centerBox.width).toBeLessThanOrEqual(rightBox.x + 2)

    await expect(page.getByTestId('handle-left-panel')).toBeVisible()
    await expect(page.getByTestId('handle-right-panel')).toBeVisible()
    await expect(page.getByTestId('handle-timeline')).toBeVisible()

    await page.getByTestId('btn-mode-color').click()
    await expect(page.getByTestId('area-comparison-lab')).toBeVisible()
    await page.getByTestId('btn-lab-mode-creative').click()
    const creativeShell = page.getByTestId('area-creative-shell')
    const videoGenerationCard = creativeShell.locator('.video-generation-card')
    await expect(creativeShell).toBeVisible()
    await expect(
      videoGenerationCard.getByRole('button', {
        name: '提交任务'
      })
    ).toBeVisible()
    await expect(
      videoGenerationCard.getByRole('button', {
        name: '刷新列表'
      })
    ).toBeVisible()
    const videoJobList = page.getByTestId('area-video-generation-job-list')
    await expect(videoJobList).toBeAttached()

    const creativeOverflow = await creativeShell.evaluate((node) => ({
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth
    }))
    expect(creativeOverflow.scrollWidth).toBeLessThanOrEqual(creativeOverflow.clientWidth + 2)
  }
})
