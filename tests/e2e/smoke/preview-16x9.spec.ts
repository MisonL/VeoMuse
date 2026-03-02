import { expect, test } from '@playwright/test'
import { attachPageDebug } from '../helpers/debug'

const TARGET_RATIO = 16 / 9

test('预览区保持 16:9 比例', async ({ page }) => {
  attachPageDebug(page, 'preview-16x9')
  await page.goto('/')
  await page.getByTestId('btn-mode-edit').click()

  const preview = page.getByTestId('area-preview-frame')
  await expect(preview).toBeVisible()
  await expect(preview).toHaveAttribute('data-aspect-ratio', '16:9')

  const box = await preview.boundingBox()
  if (!box) throw new Error('预览区域不可测量')

  const ratio = box.width / box.height
  expect(Math.abs(ratio - TARGET_RATIO)).toBeLessThan(0.08)
  expect(box.width).toBeGreaterThan(320)
  expect(box.height).toBeGreaterThan(180)
})
