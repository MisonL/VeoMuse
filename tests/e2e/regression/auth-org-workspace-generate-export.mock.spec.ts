import { expect, test } from '@playwright/test'
import path from 'path'
import { buildTestPassword } from '../../helpers/credentials'
import { waitForAuthSessionReady } from '../helpers/auth'

const fixtureFile = path.resolve(process.cwd(), 'tests/e2e/fixtures/sample.mp4')
const uniq = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

test('@mock 可通过 UI 串通注册 -> 组织 -> 工作区 -> 生成 -> 导出', async ({ page }) => {
  const suffix = uniq()
  const email = `ui_flow_${suffix}@veomuse.test`
  const password = buildTestPassword(suffix)

  await page.route('**/api/ai/director/analyze', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        scenes: [{ title: '链路镜头 1', duration: 4, videoPrompt: 'city sunrise' }],
        worldId: `world_${suffix}`
      })
    })
  })

  await page.route('**/api/video/compose', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        outputPath: `/tmp/e2e-ui-${suffix}.mp4`
      })
    })
  })

  await page.goto('/')
  await page.getByTestId('btn-mode-color').click()
  await expect(page.getByTestId('area-comparison-lab')).toBeVisible()

  await page.getByTestId('btn-open-channel-panel').click()
  await expect(page.getByTestId('area-channel-panel')).toBeVisible()

  if (!(await page.getByTestId('input-register-organization').isVisible())) {
    await page.getByTestId('btn-toggle-register-mode').click()
    await expect(page.getByTestId('input-register-organization')).toBeVisible()
  }

  await page.getByTestId('input-login-email').fill(email)
  await page.getByTestId('input-login-password').fill(password)
  await page.getByTestId('input-register-organization').fill(`UI组织_${suffix}`)
  await page.getByTestId('btn-submit-auth').click()
  await waitForAuthSessionReady(page, 15_000)

  await page.getByTestId('btn-close-channel-panel').click()
  await page.getByTestId('btn-lab-mode-collab').click()
  await page.getByTestId('input-workspace-name').fill(`UI工作区_${suffix}`)
  await page.getByTestId('input-workspace-owner').fill('UI_OWNER')
  await page.getByTestId('btn-create-workspace').click()
  await expect(page.getByTestId('text-workspace-id')).not.toContainText('workspace: -', {
    timeout: 15000
  })

  await page.getByTestId('btn-mode-edit').click()
  await page
    .getByTestId('area-left-panel')
    .getByRole('button', { name: 'AI 导演', exact: true })
    .click()
  await page.getByTestId('input-director-prompt').fill('清晨街景，镜头推进')
  await page.getByTestId('btn-run-director').click()
  await expect(page.locator('.scene-title')).toContainText('链路镜头 1')

  await page
    .getByTestId('area-left-panel')
    .getByRole('button', { name: '素材库', exact: true })
    .click()
  await page.locator('input[name="assetUploadFiles"]').setInputFiles(fixtureFile)
  await expect(page.locator('.asset-tile').first()).toBeVisible({ timeout: 15000 })
  await page.locator('.asset-tile .tile-actions button').first().click()

  await page.getByTestId('btn-export').click()
  await expect(page.locator('.export-feedback-pop.done')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.export-feedback-path')).toContainText(`/tmp/e2e-ui-${suffix}.mp4`)
})
