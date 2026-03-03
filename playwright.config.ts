import { defineConfig, devices } from '@playwright/test'

const FRONTEND_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:42873'
const BACKEND_URL = process.env.PLAYWRIGHT_API_BASE_URL || 'http://127.0.0.1:33117'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 12_000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  outputDir: 'test-results/playwright',
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: FRONTEND_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    testIdAttribute: 'data-testid',
    ignoreHTTPSErrors: true
  },
  projects: [
    {
      name: 'smoke-chromium',
      testDir: './tests/e2e/smoke',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 }
      }
    },
    {
      name: 'regression-chromium',
      testDir: './tests/e2e/regression',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1366, height: 768 }
      }
    }
  ],
  webServer: [
    {
      command: 'bun run --cwd apps/backend dev',
      url: `${BACKEND_URL}/api/health`,
      name: 'backend',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe'
    },
    {
      command:
        'env -u NO_COLOR PLAYWRIGHT_TEST=true bun run --cwd apps/frontend dev --host 127.0.0.1 --port 42873',
      url: FRONTEND_URL,
      name: 'frontend',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe'
    }
  ]
})
