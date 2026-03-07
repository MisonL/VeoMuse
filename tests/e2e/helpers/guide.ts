import type { Page } from '@playwright/test'

export const dismissGuideIfPresent = async (page: Page) => {
  const skipBtn = page.getByRole('button', { name: '跳过' })
  if (await skipBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await skipBtn.click()
  }
}
