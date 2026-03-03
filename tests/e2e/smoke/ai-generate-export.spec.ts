import { expect, test } from '@playwright/test'
import path from 'path'
import { injectAuthSession, seedAuthSession } from '../helpers/session'
import { attachPageDebug } from '../helpers/debug'

const fixtureFile = path.resolve(process.cwd(), 'tests/e2e/fixtures/sample.mp4')

test('可完成导演生成并导出（稳定桩）', async ({ page, request }) => {
  attachPageDebug(page, 'ai-generate-export')
  const session = await seedAuthSession(request, { withWorkspace: true })
  await injectAuthSession(page, session)

  await page.route('**/api/ai/director/analyze', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        scenes: [{ title: '镜头 1', duration: 4, videoPrompt: 'city night' }],
        worldId: 'world_e2e'
      })
    })
  })

  await page.route('**/api/video/compose', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        outputPath: '/tmp/e2e-output.mp4'
      })
    })
  })

  await page.goto('/')
  await expect(page.getByTestId('area-left-panel')).toBeVisible()

  await page.getByRole('button', { name: 'AI 导演' }).click()
  await page.getByTestId('input-director-prompt').fill('夜景追车，镜头快速推进')
  await page.getByTestId('btn-run-director').click()

  await expect(page.locator('.scene-title')).toContainText('镜头 1')

  await page.getByRole('button', { name: '媒体资源' }).click()
  await page.locator('input[name="assetUploadFiles"]').setInputFiles(fixtureFile)
  await expect(page.locator('.asset-tile')).toHaveCount(1, { timeout: 15000 })
  await page.locator('.asset-tile .tile-actions button').first().click()

  await page.getByTestId('btn-export').click()
  await expect(page.locator('.export-feedback-pop.done')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.export-feedback-path')).toContainText('/tmp/e2e-output.mp4')
})
