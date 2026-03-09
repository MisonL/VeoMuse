import { expect, test } from '@playwright/test'
import path from 'path'
import { buildTestPassword } from '../../helpers/credentials'
import { waitForAuthSessionReady } from '../helpers/auth'

const fixtureFile = path.resolve(process.cwd(), 'tests/e2e/fixtures/sample.mp4')
const uniq = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

test('@real 可通过真实链路串通注册 -> 组织 -> 工作区 -> 生成 -> 导出', async ({ page }) => {
  test.skip(
    process.env.E2E_REAL_CHANNELS !== 'true' || !process.env.GEMINI_API_KEYS?.trim(),
    '未启用真实渠道 E2E（需设置 E2E_REAL_CHANNELS=true 且配置 GEMINI_API_KEYS）'
  )
  test.setTimeout(180_000)

  const suffix = uniq()
  const email = `ui_real_${suffix}@veomuse.test`
  const password = buildTestPassword(suffix)

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
  await page.getByTestId('input-register-organization').fill(`真实组织_${suffix}`)
  await page.getByTestId('btn-submit-auth').click()
  await waitForAuthSessionReady(page, 20_000)

  await page.getByTestId('btn-close-channel-panel').click()
  await page.getByTestId('btn-lab-mode-collab').click()
  await page.getByTestId('input-workspace-name').fill(`真实工作区_${suffix}`)
  await page.getByTestId('input-workspace-owner').fill('REAL_OWNER')
  await page.getByTestId('btn-create-workspace').click()
  await expect(page.getByTestId('text-workspace-id')).not.toContainText('workspace: -', {
    timeout: 20000
  })

  await page.getByTestId('btn-mode-edit').click()
  await page
    .getByTestId('area-left-panel')
    .getByRole('button', { name: 'AI 导演', exact: true })
    .click()
  await page.getByTestId('input-director-prompt').fill('夜景广告短片，三镜头叙事')
  await page.getByTestId('btn-run-director').click()
  await expect(page.locator('.scene-title').first()).toBeVisible({ timeout: 60000 })

  await page
    .getByTestId('area-left-panel')
    .getByRole('button', { name: '素材库', exact: true })
    .click()
  await page.locator('input[name="assetUploadFiles"]').setInputFiles(fixtureFile)
  await expect(page.locator('.asset-tile').first()).toBeVisible({ timeout: 15000 })
  await page.locator('.asset-tile .tile-actions button').first().click()

  await page.getByTestId('btn-export').click()
  await expect(page.locator('.export-feedback-pop.done')).toBeVisible({ timeout: 30000 })
  await expect(page.locator('.export-feedback-path')).not.toHaveText('', { timeout: 30000 })
})
