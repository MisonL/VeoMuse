import { expect, test } from '@playwright/test'
import { buildTestPassword } from '../../helpers/credentials'
import { attachPageDebug } from '../helpers/debug'

const uniq = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

test('可通过实验室 UI 完成注册、登录、创建工作区', async ({ page }) => {
  attachPageDebug(page, 'auth-org-workspace-create')
  const suffix = uniq()
  const email = `ui_${suffix}@veomuse.test`
  const password = buildTestPassword(suffix)

  await page.goto('/')
  await page.getByTestId('btn-mode-color').click()
  await expect(page.getByTestId('area-comparison-lab')).toBeVisible()

  await page.getByTestId('btn-open-channel-panel').click()
  await expect(page.getByTestId('area-channel-panel')).toBeVisible()

  if (!await page.getByTestId('input-register-organization').isVisible()) {
    await page.getByTestId('btn-toggle-register-mode').click()
    await expect(page.getByTestId('input-register-organization')).toBeVisible()
  }

  await page.getByTestId('input-login-email').fill(email)
  await page.getByTestId('input-login-password').fill(password)
  await page.getByTestId('input-register-organization').fill(`UI组织_${suffix}`)
  await page.getByTestId('btn-submit-auth').click()

  await expect(page.getByTestId('select-organization')).toBeVisible({ timeout: 15000 })

  await page.getByTestId('btn-close-channel-panel').click()
  await page.getByTestId('btn-lab-mode-collab').click()

  await page.getByTestId('input-workspace-name').fill(`UI工作区_${suffix}`)
  await page.getByTestId('input-workspace-owner').fill('UI_OWNER')
  await page.getByTestId('btn-create-workspace').click()

  await expect(page.getByTestId('text-workspace-id')).not.toContainText('workspace: -', { timeout: 15000 })
})
