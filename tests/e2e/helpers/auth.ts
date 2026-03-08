import { expect, type Page } from '@playwright/test'

export const waitForAuthSessionReady = async (page: Page, timeout = 45_000) => {
  const channelPanel = page.getByTestId('area-channel-panel')
  const organizationSelect = page.getByTestId('select-organization')
  const logoutButton = page.getByTestId('btn-logout-auth')
  const submitButton = page.getByTestId('btn-submit-auth')
  const registerInput = page.getByTestId('input-register-organization')

  await expect(channelPanel).toBeVisible({ timeout })
  await expect(submitButton).toBeHidden({ timeout })
  await expect(registerInput).toBeHidden({ timeout })
  await expect(organizationSelect).toBeVisible({ timeout })
  await expect(logoutButton).toBeVisible({ timeout })
}
