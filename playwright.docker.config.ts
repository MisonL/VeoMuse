import { defineConfig, devices } from '@playwright/test'
import { GUIDE_STORAGE_KEY } from './apps/frontend/src/utils/appHelpers'

const FRONTEND_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:18081'

const DOCKER_STORAGE_STATE = {
  cookies: [],
  origins: [
    {
      origin: FRONTEND_URL,
      localStorage: [{ name: GUIDE_STORAGE_KEY, value: 'done' }]
    }
  ]
}

export default defineConfig({
  testDir: './tests/e2e/docker',
  timeout: 90_000,
  expect: {
    timeout: 15_000
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  outputDir: 'test-results/playwright-docker',
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: FRONTEND_URL,
    storageState: DOCKER_STORAGE_STATE,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    testIdAttribute: 'data-testid',
    ignoreHTTPSErrors: true
  },
  projects: [
    {
      name: 'docker-smoke-chromium'
    }
  ]
})
