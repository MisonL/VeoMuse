import { expect, test, type Locator, type Page } from '@playwright/test'
import { attachPageDebug } from '../helpers/debug'
import { dismissGuideIfPresent } from '../helpers/guide'

const observeFatalBrowserSignals = (page: Page) => {
  const failures: string[] = []

  page.on('pageerror', (error) => {
    failures.push(`pageerror: ${error?.message || error}`)
  })
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      failures.push(`console.${msg.type()}: ${msg.text()}`)
    }
  })

  return () => {
    expect(failures, failures.join('\n')).toEqual([])
  }
}

const assertNoOverflow = async (locator: Locator, label: string) => {
  const metrics = await locator.evaluate((node) => ({
    clientHeight: node.clientHeight,
    clientWidth: node.clientWidth,
    scrollHeight: node.scrollHeight,
    scrollWidth: node.scrollWidth
  }))

  expect(metrics.scrollWidth, `${label} horizontal overflow`).toBeLessThanOrEqual(
    metrics.clientWidth + 12
  )
  expect(metrics.scrollHeight, `${label} vertical overflow`).toBeLessThanOrEqual(
    metrics.clientHeight + 12
  )
}

const assertVisibleSurface = async (locator: Locator, label: string) => {
  await expect(locator, `${label} should be visible`).toBeVisible()
  const box = await locator.boundingBox()
  expect(box, `${label} bounding box`).not.toBeNull()
  expect(box?.width ?? 0, `${label} width`).toBeGreaterThan(24)
  expect(box?.height ?? 0, `${label} height`).toBeGreaterThan(16)
}

const assertNebulaSurface = async (page: Page, testId: string, label: string) => {
  const surface = page.getByTestId(testId)

  await assertVisibleSurface(surface, label)
  await expect(surface, `${label} visual system`).toHaveAttribute('data-visual-system', 'nebula-flow')
  await assertNoOverflow(surface, label)
}

const assertLabMode = async (page: Page, mode: string, label: string) => {
  await page.getByTestId(`btn-lab-mode-${mode}`).click()
  await expect(page.getByTestId('area-comparison-lab')).toHaveAttribute('data-lab-mode', mode)
  await assertVisibleSurface(page.locator(`#lab-panel-${mode}`), label)
  await assertNoOverflow(page.locator(`#lab-panel-${mode}`), label)
}

test.setTimeout(120_000)

test('Docker Nebula 核心 surface 应在部署态可见且无浏览器告警', async ({ page }) => {
  attachPageDebug(page, 'docker-nebula-core-surfaces')
  const assertNoFatalBrowserSignals = observeFatalBrowserSignals(page)

  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/')
  await dismissGuideIfPresent(page)

  await assertNebulaSurface(page, 'director-flow-bus', '顶部导演总线')
  await assertNebulaSurface(page, 'command-rail-flow', '左侧命令总线')
  await assertNebulaSurface(page, 'director-canvas-launchpad', '导演画布启动台')
  await assertNebulaSurface(page, 'output-dock', '输出停靠区')
  await assertNebulaSurface(page, 'timeline-bus', '时间轴总线')

  await page.getByTestId('btn-mode-audio').click()
  await assertNebulaSurface(page, 'audio-bus', '音频总线')
  await assertVisibleSurface(page.locator('.audio-master-stage'), '音频大师舞台')
  await assertNoOverflow(page.locator('.audio-master-stage'), '音频大师舞台')

  await page.getByTestId('btn-mode-color').click()
  await assertNebulaSurface(page, 'experiment-bus', '实验室总线')
  await assertLabMode(page, 'compare', '实验室 compare 面板')
  await assertLabMode(page, 'marketplace', '实验室 marketplace 面板')
  await assertLabMode(page, 'creative', '实验室 creative 面板')
  await assertLabMode(page, 'collab', '实验室 collab 面板')

  await page.getByTestId('btn-open-channel-panel').click()
  await assertVisibleSurface(page.getByTestId('area-channel-panel'), 'AI 接入弹窗')
  await assertNoOverflow(page.getByTestId('area-channel-panel'), 'AI 接入弹窗')
  await page.getByTestId('btn-close-channel-panel').click()

  await page.getByTestId('area-right-panel').getByRole('button', { name: '监控' }).click()
  await expect(page.getByText('实验值守摘要')).toBeVisible()
  await page.getByRole('button', { name: '展开系统监控', exact: true }).click()
  await assertNebulaSurface(page, 'watch-bus', '系统监控总线')
  await assertVisibleSurface(page.locator('.lab-watch-stage-shell .telemetry-dashboard'), '系统监控页')
  await expect(page.locator('.lab-watch-stage-shell .telemetry-command-bar')).toBeVisible()
  await expect(page.locator('.lab-watch-stage-shell .telemetry-command-stat')).toHaveCount(3)

  assertNoFatalBrowserSignals()
})
