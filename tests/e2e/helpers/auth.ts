import { expect, type Page } from '@playwright/test'

export const waitForAuthSessionReady = async (page: Page, timeout = 45_000) => {
  await page.waitForFunction(
    () => {
      const accessToken = window.localStorage.getItem('veomuse-access-token') || ''
      const organizationId = window.localStorage.getItem('veomuse-organization-id') || ''
      return accessToken.trim().length > 0 && organizationId.trim().length > 0
    },
    undefined,
    { timeout }
  )

  const organizationSelect = page.getByTestId('select-organization')
  const logoutButton = page.getByTestId('btn-logout-auth')

  await Promise.any([
    expect(organizationSelect).toBeVisible({ timeout }),
    expect(logoutButton).toBeVisible({ timeout })
  ])
}
