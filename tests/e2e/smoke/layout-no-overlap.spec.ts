import { expect, test } from '@playwright/test'

test('主布局三区域不重叠且可交互', async ({ page }) => {
  await page.goto('/')

  const left = page.getByTestId('area-left-panel')
  const center = page.getByTestId('area-center-panel')
  const right = page.getByTestId('area-right-panel')

  await expect(left).toBeVisible()
  await expect(center).toBeVisible()
  await expect(right).toBeVisible()
  await expect(page.getByTestId('area-header-actions')).toBeVisible()
  await expect(page.getByTestId('area-timeline')).toBeVisible()

  const leftBox = await left.boundingBox()
  const centerBox = await center.boundingBox()
  const rightBox = await right.boundingBox()

  if (!leftBox || !centerBox || !rightBox) {
    throw new Error('布局区域 boundingBox 为空，无法验证')
  }

  expect(leftBox.width).toBeGreaterThan(240)
  expect(centerBox.width).toBeGreaterThan(320)
  expect(rightBox.width).toBeGreaterThan(220)

  expect(leftBox.x + leftBox.width).toBeLessThanOrEqual(centerBox.x + 2)
  expect(centerBox.x + centerBox.width).toBeLessThanOrEqual(rightBox.x + 2)

  await expect(page.getByTestId('handle-left-panel')).toBeVisible()
  await expect(page.getByTestId('handle-right-panel')).toBeVisible()
})
