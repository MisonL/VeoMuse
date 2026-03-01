import { expect, test } from '@playwright/test'

test('布局模式切换到聚焦后中心区扩展', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/')

  const shell = page.getByTestId('area-workspace-shell')
  const center = page.getByTestId('area-center-panel')

  const before = (await center.boundingBox())?.width ?? 0
  expect(before).toBeGreaterThan(320)

  await page.getByTestId('btn-center-mode-focus').click()
  await expect(shell).toHaveAttribute('data-layout-mode', 'focus')

  await expect.poll(async () => (await center.boundingBox())?.width ?? 0).toBeGreaterThan(before + 8)

  await page.getByTestId('btn-center-mode-fit').click()
  await expect(shell).toHaveAttribute('data-layout-mode', 'fit')
})
