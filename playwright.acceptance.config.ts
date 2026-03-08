import { defineConfig, devices } from '@playwright/test'
import { GUIDE_STORAGE_KEY } from './apps/frontend/src/utils/appHelpers'

const FRONTEND_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:18081'
const PLAYWRIGHT_OUTPUT_DIR =
  process.env.PLAYWRIGHT_OUTPUT_DIR || 'test-results/playwright-acceptance'
const PLAYWRIGHT_HTML_OUTPUT_DIR = process.env.PLAYWRIGHT_HTML_OUTPUT_DIR

const EXTERNAL_STORAGE_STATE = {
  cookies: [],
  origins: [
    {
      origin: FRONTEND_URL,
      localStorage: [{ name: GUIDE_STORAGE_KEY, value: 'done' }]
    }
  ]
}

export default defineConfig({
  testDir: './tests/e2e/regression',
  timeout: 180_000,
  expect: {
    timeout: 20_000
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  outputDir: PLAYWRIGHT_OUTPUT_DIR,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never', outputFolder: PLAYWRIGHT_HTML_OUTPUT_DIR }]]
    : [['list'], ['html', { open: 'never', outputFolder: PLAYWRIGHT_HTML_OUTPUT_DIR }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: FRONTEND_URL,
    storageState: EXTERNAL_STORAGE_STATE,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    testIdAttribute: 'data-testid',
    ignoreHTTPSErrors: true
  },
  projects: [
    {
      name: 'external-regression-chromium'
    }
  ]
})
