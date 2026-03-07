import { expect, test } from '@playwright/test'
import { attachPageDebug } from '../helpers/debug'
import { dismissGuideIfPresent } from '../helpers/guide'

test('未登录时协作页关键操作应受限', async ({ page }) => {
  attachPageDebug(page, 'collab-auth-guard')

  await page.goto('/')
  await dismissGuideIfPresent(page)
  await page.getByTestId('btn-mode-color').click()
  await expect(page.getByTestId('area-comparison-lab')).toBeVisible()

  await page.getByTestId('btn-lab-mode-collab').click()

  const createWorkspaceBtn = page.getByTestId('btn-create-workspace')
  await expect(createWorkspaceBtn).toBeDisabled()
  await expect(createWorkspaceBtn).toHaveAttribute('title', '请先登录后再创建工作区')

  await page.getByTestId('btn-toggle-advanced-sections').click()
  await expect(page.getByText('未填写管理员令牌，运维动作按钮已禁用。')).toBeVisible()
  await expect(page.getByRole('button', { name: '查询告警' })).toBeDisabled()
})
