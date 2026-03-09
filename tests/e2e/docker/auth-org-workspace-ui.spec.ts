import { expect, test } from '@playwright/test'
import { buildTestPassword } from '../../helpers/credentials'
import { waitForAuthSessionReady } from '../helpers/auth'
import { attachPageDebug } from '../helpers/debug'
import { dismissGuideIfPresent } from '../helpers/guide'

const uniq = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

test.setTimeout(120_000)

test('Docker UI smoke 应串通注册、工作区创建与关键值守入口', async ({ page }) => {
  attachPageDebug(page, 'docker-ui-auth-org-workspace')
  const suffix = uniq()
  const email = `docker_ui_${suffix}@veomuse.test`
  const password = buildTestPassword(suffix)
  const organizationName = `Docker组织_${suffix}`
  const workspaceName = `Docker工作区_${suffix}`

  await page.goto('/')
  await dismissGuideIfPresent(page)
  await page.getByTestId('btn-reset-layout').click()
  await page.getByTestId('btn-center-mode-fit').click()

  await page.getByTestId('btn-mode-color').click()
  await expect(page.getByTestId('area-comparison-lab')).toBeVisible()
  await expect(page.locator('.lab-stage-marker')).toHaveCount(4)

  await page.getByTestId('btn-open-channel-panel').click()
  await expect(page.getByTestId('area-channel-panel')).toBeVisible()

  if (!(await page.getByTestId('input-register-organization').isVisible())) {
    await page.getByTestId('btn-toggle-register-mode').click()
    await expect(page.getByTestId('input-register-organization')).toBeVisible()
  }

  await page.getByTestId('input-login-email').fill(email)
  await page.getByTestId('input-login-password').fill(password)
  await page.getByTestId('input-register-organization').fill(organizationName)
  await page.getByTestId('btn-submit-auth').click()
  await waitForAuthSessionReady(page, 45_000)

  await page.getByTestId('btn-close-channel-panel').click()
  await page.getByTestId('btn-lab-mode-collab').click()
  await expect(page.getByTestId('area-collab-shell')).toBeVisible()

  await page.getByTestId('input-workspace-name').fill(workspaceName)
  await page.getByTestId('input-workspace-owner').fill('DOCKER_OWNER')
  await page.getByTestId('btn-create-workspace').scrollIntoViewIfNeeded()
  await page.getByTestId('btn-create-workspace').evaluate((node) => {
    ;(node as HTMLButtonElement).click()
  })
  await expect(page.getByTestId('text-workspace-id')).not.toContainText('workspace: -', {
    timeout: 20_000
  })

  await page.getByTestId('btn-lab-mode-creative').click()
  await expect(page.getByTestId('area-creative-shell')).toBeVisible()
  await expect(page.getByText('创意闭环引擎')).toBeVisible()

  await page.getByRole('button', { name: '系统监控', exact: true }).click()
  await expect(page.getByText('实验值守摘要')).toBeVisible()
  await expect(page.locator('.telemetry-watch-brief-card')).toHaveCount(4)

  await page.getByRole('button', { name: '展开系统监控', exact: true }).click()
  await expect(page.locator('.telemetry-dashboard')).toBeVisible()
  await expect(page.locator('.telemetry-command-bar')).toBeVisible()
  await expect(page.locator('.telemetry-command-stat')).toHaveCount(3)
  await expect(page.getByText('Provider 健康检查')).toBeVisible()
  await expect(page.getByText('数据库自愈中心')).toBeVisible()

  await page.getByTestId('btn-mode-color').click()
  await page.getByTestId('btn-open-channel-access').click()
  await expect(page.getByTestId('area-channel-panel')).toBeVisible()
})
