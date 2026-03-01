import { expect, test } from '@playwright/test'

test('默认布局为两侧功能区预留有效空间', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/')

  const main = page.getByTestId('area-main-layout')
  const left = page.getByTestId('area-left-panel')
  const center = page.getByTestId('area-center-panel')
  const right = page.getByTestId('area-right-panel')

  await expect(main).toBeVisible()
  await expect(left).toBeVisible()
  await expect(center).toBeVisible()
  await expect(right).toBeVisible()

  const mainBox = await main.boundingBox()
  const leftBox = await left.boundingBox()
  const centerBox = await center.boundingBox()
  const rightBox = await right.boundingBox()

  if (!mainBox || !leftBox || !centerBox || !rightBox) {
    throw new Error('布局区域不可测量')
  }

  expect(leftBox.width).toBeGreaterThanOrEqual(280)
  expect(rightBox.width).toBeGreaterThanOrEqual(260)
  expect(centerBox.width / mainBox.width).toBeLessThan(0.58)
})
