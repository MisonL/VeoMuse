import type { Page } from '@playwright/test'

export const attachPageDebug = (page: Page, label: string) => {
  page.on('pageerror', (error) => {
    console.error(`[pw:${label}:pageerror] ${error?.message || error}`)
  })
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    console.error(`[pw:${label}:console:error] ${msg.text()}`)
  })
  page.on('requestfailed', (request) => {
    const url = request.url()
    if (!url.includes('@react-refresh') && !url.includes('/src/main.tsx')) return
    console.error(`[pw:${label}:requestfailed] ${request.method()} ${url} -> ${request.failure()?.errorText || 'failed'}`)
  })
  page.on('response', (response) => {
    const url = response.url()
    if (!url.includes('@react-refresh') && !url.includes('/src/main.tsx')) return
    if (response.status() >= 400) {
      console.error(`[pw:${label}:response] ${response.status()} ${url}`)
    }
  })
}
