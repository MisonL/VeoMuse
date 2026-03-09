import { expect, test } from '@playwright/test'
import { attachPageDebug } from '../helpers/debug'
import { dismissGuideIfPresent } from '../helpers/guide'

const VIEWPORTS = [
  { width: 1366, height: 900 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 }
]

const COMPACT_CREATIVE_VIEWPORTS = [
  { width: 420, height: 900 },
  { width: 520, height: 900 },
  { width: 600, height: 900 }
]

const COMPACT_COMPARE_VIEWPORTS = [
  { width: 420, height: 900 },
  { width: 520, height: 900 },
  { width: 600, height: 900 }
]

test('主布局三区域在常见桌面分辨率不重叠且关键操作可达', async ({ page }) => {
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport)
    attachPageDebug(page, `layout-no-overlap-${viewport.width}x${viewport.height}`)
    await page.goto('/')
    await dismissGuideIfPresent(page)

    await page.getByTestId('btn-reset-layout').click()
    await page.getByTestId('btn-center-mode-fit').click()

    const left = page.getByTestId('area-left-panel')
    const center = page.getByTestId('area-center-panel')
    const right = page.getByTestId('area-right-panel')
    const headerActions = page.getByTestId('area-header-actions')
    const timeline = page.getByTestId('area-timeline')

    await expect(left).toBeVisible()
    await expect(center).toBeVisible()
    await expect(right).toBeVisible()
    await expect(headerActions).toBeVisible()
    await expect(timeline).toBeVisible()
    await expect(page.getByTestId('btn-center-mode-fit')).toHaveClass(/active/)
    await expect(page.getByTestId('btn-open-channel-access')).toBeVisible()
    await expect(page.getByTestId('select-export-quality')).toBeVisible()
    await expect(page.getByTestId('btn-export')).toBeVisible()

    const leftBox = await left.boundingBox()
    const centerBox = await center.boundingBox()
    const rightBox = await right.boundingBox()
    if (!leftBox || !centerBox || !rightBox) {
      throw new Error(`布局区域 boundingBox 为空，无法验证: ${viewport.width}x${viewport.height}`)
    }

    expect(leftBox.width).toBeGreaterThan(260)
    expect(centerBox.width).toBeGreaterThan(350)
    expect(rightBox.width).toBeGreaterThan(240)
    expect(leftBox.x + leftBox.width).toBeLessThanOrEqual(centerBox.x + 2)
    expect(centerBox.x + centerBox.width).toBeLessThanOrEqual(rightBox.x + 2)

    await expect(page.getByTestId('handle-left-panel')).toBeVisible()
    await expect(page.getByTestId('handle-right-panel')).toBeVisible()
    await expect(page.getByTestId('handle-timeline')).toBeVisible()

    const timelineBody = page.locator('.timeline-body')
    await expect(timelineBody).toBeVisible()
    const timelineBodyBox = await timelineBody.boundingBox()
    expect(timelineBodyBox?.height ?? 0).toBeGreaterThan(80)

    await page.getByTestId('btn-mode-color').click()
    await expect(page.getByTestId('area-comparison-lab')).toBeVisible()
    await expect(page.locator('.lab-stage-marker')).toHaveCount(4)
    await expect(page.locator('.lab-stage-marker.active')).toHaveCount(1)
    await page.getByTestId('btn-lab-mode-creative').click()
    const creativeShell = page.getByTestId('area-creative-shell')
    const videoGenerationCard = creativeShell.locator('.video-generation-card')
    await expect(creativeShell).toBeVisible()
    await expect(
      videoGenerationCard.getByRole('button', {
        name: '提交任务'
      })
    ).toBeVisible()
    await expect(
      videoGenerationCard.getByRole('button', {
        name: '刷新列表'
      })
    ).toBeVisible()
    const videoJobList = page.getByTestId('area-video-generation-job-list')
    await expect(videoJobList).toBeAttached()

    const creativeOverflow = await creativeShell.evaluate((node) => ({
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth
    }))
    expect(creativeOverflow.scrollWidth).toBeLessThanOrEqual(creativeOverflow.clientWidth + 2)
    const creativeBox = await creativeShell.boundingBox()
    expect(creativeBox?.height ?? 0).toBeGreaterThan(120)
    const creativeHero = creativeShell.locator('.creative-hero-stage')
    const creativeHeroMain = creativeShell.locator('.creative-hero-main')
    const creativeHeroSide = creativeShell.locator('.creative-hero-side')
    const promptStage = creativeShell.locator('.video-generation-prompt-stage')
    await expect(creativeHeroMain).toBeVisible()
    await expect(creativeHeroSide).toBeVisible()
    await expect(promptStage.getByTestId('video-generation-focus-panel')).toBeVisible()
    const creativeHeroMetrics = await creativeHero.evaluate((node) => ({
      offsetHeight: (node as HTMLElement).offsetHeight,
      scrollHeight: (node as HTMLElement).scrollHeight
    }))
    expect(creativeHeroMetrics.offsetHeight).toBeGreaterThan(200)
    const creativeHeroMainBox = await creativeHeroMain.boundingBox()
    const creativeHeroSideBox = await creativeHeroSide.boundingBox()
    if (!creativeHeroMainBox || !creativeHeroSideBox) {
      throw new Error(
        `creative hero boundingBox 为空，无法验证: ${viewport.width}x${viewport.height}`
      )
    }
    expect(creativeHeroMainBox.width).toBeGreaterThan(320)
    expect(creativeHeroSideBox.width).toBeGreaterThan(280)
    const creativeHeroIsStacked = Math.abs(creativeHeroMainBox.x - creativeHeroSideBox.x) < 4
    if (creativeHeroIsStacked) {
      expect(creativeHeroMainBox.y + creativeHeroMainBox.height).toBeLessThanOrEqual(
        creativeHeroSideBox.y + 2
      )
    } else {
      expect(creativeHeroMainBox.x + creativeHeroMainBox.width).toBeLessThanOrEqual(
        creativeHeroSideBox.x + 2
      )
    }

    await page.getByTestId('btn-lab-mode-collab').click()
    const collabShell = page.getByTestId('area-collab-shell')
    await expect(collabShell).toBeVisible()
    const collabBox = await collabShell.boundingBox()
    expect(collabBox?.height ?? 0).toBeGreaterThan(120)

    await page.getByTestId('btn-toggle-advanced-sections').click()
    const advancedGrid = collabShell.locator('.collab-advanced-grid')
    await expect(advancedGrid).toBeVisible()
    const advancedOverflow = await advancedGrid.evaluate((node) => ({
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth
    }))
    expect(advancedOverflow.scrollWidth).toBeLessThanOrEqual(advancedOverflow.clientWidth + 2)

    const commentDeskLayout = collabShell.locator('.comment-threads-desk-layout')
    const commentDeskOverflow = await commentDeskLayout.evaluate((node) => ({
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth
    }))
    expect(commentDeskOverflow.scrollWidth).toBeLessThanOrEqual(commentDeskOverflow.clientWidth + 2)

    const advancedStorageStack = collabShell.locator(
      '.collab-advanced-group--storage .collab-advanced-stack'
    )
    await expect(advancedStorageStack).toBeVisible()
    const advancedStorageCards = advancedStorageStack.locator('.collab-card')
    const permissionCardBox = await advancedStorageCards.nth(0).boundingBox()
    const snapshotCardBox = await advancedStorageCards.nth(1).boundingBox()
    if (!permissionCardBox || !snapshotCardBox) {
      throw new Error(
        `collab storage stack boundingBox 为空，无法验证: ${viewport.width}x${viewport.height}`
      )
    }
    const storageCardsAreStacked = Math.abs(permissionCardBox.x - snapshotCardBox.x) < 4
    if (storageCardsAreStacked) {
      expect(permissionCardBox.y + permissionCardBox.height).toBeLessThanOrEqual(
        snapshotCardBox.y + 2
      )
    } else {
      expect(permissionCardBox.x + permissionCardBox.width).toBeLessThanOrEqual(
        snapshotCardBox.x + 2
      )
    }
  }
})

test('creative telemetry strip 在紧凑宽度下应切回单列且不横向溢出', async ({ page }) => {
  for (const viewport of COMPACT_CREATIVE_VIEWPORTS) {
    await page.setViewportSize(viewport)
    attachPageDebug(page, `creative-compact-${viewport.width}x${viewport.height}`)
    await page.goto('/')
    await dismissGuideIfPresent(page)

    await page.getByTestId('btn-reset-layout').click()
    await page.getByTestId('btn-center-mode-fit').click()
    await page.getByTestId('btn-mode-color').click()
    await page.getByTestId('btn-lab-mode-creative').click()

    const creativeShell = page.getByTestId('area-creative-shell')
    const telemetryStrip = creativeShell.locator('.video-generation-telemetry-strip')
    const statusRibbon = telemetryStrip.locator('.video-generation-status-ribbon')
    const quickCheck = telemetryStrip.locator('.video-generation-quick-check')
    const pollingHint = telemetryStrip.getByTestId('video-generation-polling-hint')

    await expect(creativeShell).toBeVisible()
    await expect(statusRibbon).toBeVisible()
    await expect(quickCheck).toBeVisible()
    await expect(pollingHint).toBeVisible()

    const telemetryOverflow = await telemetryStrip.evaluate((node) => ({
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth
    }))
    expect(telemetryOverflow.scrollWidth).toBeLessThanOrEqual(telemetryOverflow.clientWidth + 2)

    const statusRibbonGrid = await statusRibbon.evaluate(
      (node) => getComputedStyle(node as HTMLElement).gridTemplateColumns
    )
    expect(statusRibbonGrid.trim()).not.toContain(' ')

    const quickCheckBox = await quickCheck.boundingBox()
    const pollingHintBox = await pollingHint.boundingBox()
    if (!quickCheckBox || !pollingHintBox) {
      throw new Error(
        `creative telemetry strip boundingBox 为空，无法验证: ${viewport.width}x${viewport.height}`
      )
    }

    const stacked = Math.abs(quickCheckBox.x - pollingHintBox.x) < 4
    expect(stacked).toBe(true)
    expect(quickCheckBox.y + quickCheckBox.height).toBeLessThanOrEqual(pollingHintBox.y + 2)
  }
})

test('compare 模式在紧凑宽度下应切回单列并优先呈现 A/B 结果区', async ({ page }) => {
  for (const viewport of COMPACT_COMPARE_VIEWPORTS) {
    await page.setViewportSize(viewport)
    attachPageDebug(page, `compare-compact-${viewport.width}x${viewport.height}`)
    await page.goto('/')
    await dismissGuideIfPresent(page)

    await page.getByTestId('btn-reset-layout').click()
    await page.getByTestId('btn-center-mode-fit').click()
    await page.getByTestId('btn-mode-color').click()

    const stageShell = page.locator('.comparison-lab-pro .lab-stage-shell')
    const stageSpine = page.locator('.comparison-lab-pro .lab-stage-spine')
    const stageMain = page.locator('.comparison-lab-pro .lab-stage-main')
    const splitEngine = page.locator('.compare-mode-shell .lab-split-engine')
    const commandDeck = page.locator('.compare-mode-shell .compare-command-deck')

    await expect(stageShell).toBeVisible()
    await expect(splitEngine).toBeVisible()
    await expect(commandDeck).toBeVisible()

    const shellGrid = await stageShell.evaluate(
      (node) => getComputedStyle(node as HTMLElement).gridTemplateColumns
    )
    expect(shellGrid.trim()).not.toContain(' ')

    const spineBox = await stageSpine.boundingBox()
    const mainBox = await stageMain.boundingBox()
    const splitBox = await splitEngine.boundingBox()
    const commandBox = await commandDeck.boundingBox()
    if (!spineBox || !mainBox || !splitBox || !commandBox) {
      throw new Error(
        `compare compact boundingBox 为空，无法验证: ${viewport.width}x${viewport.height}`
      )
    }

    const stageStacked = Math.abs(spineBox.x - mainBox.x) < 4
    expect(stageStacked).toBe(true)
    expect(spineBox.y + spineBox.height).toBeLessThanOrEqual(mainBox.y + 2)

    const compareStacked = Math.abs(splitBox.x - commandBox.x) < 4
    expect(compareStacked).toBe(true)
    expect(splitBox.y + splitBox.height).toBeLessThanOrEqual(commandBox.y + 2)

    const splitOverflow = await splitEngine.evaluate((node) => ({
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth
    }))
    expect(splitOverflow.scrollWidth).toBeLessThanOrEqual(splitOverflow.clientWidth + 2)
  }
})

test('移动端头部关键操作与预览叠层在窄屏下应保持可达', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  attachPageDebug(page, 'mobile-header-overlay-smoke')
  await page.goto('/')
  await dismissGuideIfPresent(page)

  await expect(page.getByTestId('btn-open-channel-access')).toBeVisible()
  await expect(page.getByTestId('btn-open-guide')).toBeVisible()
  await expect(page.getByTestId('select-export-quality')).toBeVisible()
  await expect(page.getByTestId('select-preview-aspect')).toBeVisible()
  await expect(page.getByTestId('btn-export')).toBeVisible()

  const headerActions = page.getByTestId('area-header-actions')
  const headerOverflow = await headerActions.evaluate((node) => ({
    scrollWidth: node.scrollWidth,
    clientWidth: node.clientWidth
  }))
  expect(headerOverflow.scrollWidth).toBeLessThanOrEqual(headerOverflow.clientWidth + 2)

  await page.getByTestId('select-preview-aspect').selectOption('21:9')

  const overlayLeft = page.locator('.monitor-overlay-left')
  const previewMeta = page.locator('.preview-meta')
  await expect(overlayLeft).toBeVisible()
  await expect(previewMeta).toBeVisible()

  const overlayLeftBox = await overlayLeft.boundingBox()
  const previewMetaBox = await previewMeta.boundingBox()
  if (!overlayLeftBox || !previewMetaBox) {
    throw new Error('移动端预览叠层 boundingBox 为空，无法验证')
  }

  const stacked = Math.abs(overlayLeftBox.x - previewMetaBox.x) < 4
  if (stacked) {
    expect(overlayLeftBox.y + overlayLeftBox.height).toBeLessThanOrEqual(previewMetaBox.y + 4)
  } else {
    expect(overlayLeftBox.x + overlayLeftBox.width).toBeLessThanOrEqual(previewMetaBox.x + 8)
  }
})

test('右侧系统监控面板应展示关键区块与值守动作', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  attachPageDebug(page, 'telemetry-dashboard-smoke')
  await page.goto('/')
  await dismissGuideIfPresent(page)

  await page.getByRole('button', { name: '系统监控', exact: true }).click()
  await expect(page.getByText('系统值守摘要')).toBeVisible()
  await expect(page.locator('.telemetry-watch-brief-card')).toHaveCount(4)

  await page.getByRole('button', { name: '展开系统监控', exact: true }).click()

  const telemetryDashboard = page.locator('.telemetry-dashboard')
  await expect(telemetryDashboard).toBeVisible()
  await expect(page.locator('.telemetry-command-bar')).toBeVisible()
  await expect(page.locator('.telemetry-command-stat')).toHaveCount(3)
  await expect(page.getByText('播放 FPS 稳定性')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Provider 健康检查' })).toBeVisible()
  await expect(page.getByText('北极星 SLO（24h）')).toBeVisible()
  await expect(page.getByText('项目治理卡片（第二入口）')).toBeVisible()
  await expect(page.getByText('数据库自愈中心')).toBeVisible()
  await expect(page.getByRole('button', { name: '刷新 Provider 状态' })).toBeVisible()
  await expect(page.getByRole('button', { name: '健康检查' })).toBeVisible()
  await expect(page.getByRole('button', { name: '运行配置' })).toBeVisible()
})
