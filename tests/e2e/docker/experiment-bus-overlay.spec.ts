import { expect, test, type Page } from '@playwright/test'
import { attachPageDebug } from '../helpers/debug'
import { dismissGuideIfPresent } from '../helpers/guide'

const assertExperimentBusOverlay = async (page: Page, label: string) => {
  await expect(page.getByTestId('area-comparison-lab')).toHaveAttribute(
    'data-shell-role',
    'experiment-bus'
  )
  const bus = page.getByTestId('experiment-bus')
  await expect(bus).toHaveAttribute('data-visual-system', 'nebula-flow')
  await expect(bus).toContainText('Experiment Bus')
  await expect(bus).toContainText('Compare')
  await expect(bus).toContainText('Govern')
  await expect(bus).toContainText('Ship')

  const metrics = await bus.evaluate((node) => {
    const style = getComputedStyle(node)
    const rect = node.getBoundingClientRect()
    const shell = node.closest('[data-testid="area-comparison-lab"]') as HTMLElement | null
    const shellRect = shell?.getBoundingClientRect()
    return {
      height: rect.height,
      left: shellRect ? rect.left - shellRect.left : rect.left,
      pointerEvents: style.pointerEvents,
      position: style.position,
      top: shellRect ? rect.top - shellRect.top : rect.top,
      width: rect.width
    }
  })

  expect(metrics.position, `${label} position`).toBe('absolute')
  expect(metrics.pointerEvents, `${label} pointer events`).toBe('none')
  expect(metrics.width, `${label} width`).toBeGreaterThanOrEqual(160)
  expect(metrics.height, `${label} height`).toBeGreaterThanOrEqual(24)
  expect(metrics.top, `${label} top offset`).toBeGreaterThanOrEqual(0)
  expect(metrics.left, `${label} left offset`).toBeGreaterThanOrEqual(0)
}

test('Docker 实验室 Experiment Bus 应保持部署态 overlay 几何', async ({ page }) => {
  attachPageDebug(page, 'docker-experiment-bus-overlay')

  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/')
  await dismissGuideIfPresent(page)
  await page.getByTestId('btn-mode-color').click()

  const labModes = ['compare', 'marketplace', 'creative', 'collab'] as const

  for (const mode of labModes) {
    await page.getByTestId(`btn-lab-mode-${mode}`).click()
    await expect(page.getByTestId('area-comparison-lab')).toHaveAttribute('data-lab-mode', mode)
    await assertExperimentBusOverlay(page, `实验室 ${mode} 总线`)
  }
})
