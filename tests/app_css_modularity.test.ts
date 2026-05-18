import { describe, expect, it } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'fs'
import path from 'path'

const repoRoot = process.cwd()
const appCssPath = path.join(repoRoot, 'apps/frontend/src/App.css')
const appCssModuleDir = path.join(repoRoot, 'apps/frontend/src/styles/app')
const propertyInspectorCssPath = path.join(
  repoRoot,
  'apps/frontend/src/components/Editor/PropertyInspector.css'
)
const MAX_CSS_MODULE_LINES = 300
const appCssImportLinePattern = /^@import ['"]\.\/styles\/app\/([^'"]+\.css)['"];$/

const readLines = (target: string) => readFileSync(target, 'utf8').split(/\r?\n/)

const readAppCssImports = () => {
  const appCss = readFileSync(appCssPath, 'utf8')
  return readLines(appCssPath)
    .map((line) => appCssImportLinePattern.exec(line.trim()))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => match[1])
}

const readAppCssModules = () =>
  readdirSync(appCssModuleDir)
    .filter((name) => name.endsWith('.css'))
    .sort()

describe('App CSS modularity guard', () => {
  it('App.css should only orchestrate ordered app style modules', () => {
    const appCssLines = readFileSync(appCssPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    expect(appCssLines.length).toBeGreaterThan(0)
    for (const line of appCssLines) {
      expect(appCssImportLinePattern.test(line), `${line} is not an ordered app style import`).toBe(true)
    }
  })

  it('App.css should import every ordered app style module exactly once', () => {
    expect(existsSync(appCssModuleDir)).toBe(true)

    const imports = readAppCssImports()
    const modules = readAppCssModules()

    expect(imports).toEqual(modules)
    expect(new Set(imports).size).toBe(imports.length)
  })

  it('ordered app style modules should stay below the repository file length ceiling', () => {
    expect(existsSync(appCssModuleDir)).toBe(true)

    const modules = readAppCssModules()

    expect(modules.length).toBeGreaterThan(1)

    for (const moduleName of modules) {
      const lines = readLines(path.join(appCssModuleDir, moduleName))
      expect(lines.length, `${moduleName} exceeds ${MAX_CSS_MODULE_LINES} lines`).toBeLessThanOrEqual(
        MAX_CSS_MODULE_LINES
      )
    }
  })

  it('Nebula Flow overrides should use theme-scoped specificity for deployed CSS order', () => {
    const nebulaCss = readFileSync(path.join(appCssModuleDir, '55-app.css'), 'utf8')

    const requiredRuntimeSelectors = [
      "html[data-theme='light'] body .monitor-stage-shell.is-idle .director-canvas-launchpad",
      "html[data-theme='dark'] body .monitor-stage-shell.is-idle .director-canvas-launchpad",
      "html[data-theme='light'] body .monitor-stage-shell.is-idle .empty-action-card.is-ai",
      "html[data-theme='dark'] body .timeline-empty-action.is-ai"
    ]

    for (const selector of requiredRuntimeSelectors) {
      expect(nebulaCss).toContain(selector)
    }
  })

  it('Nebula Flow workstream bridge should remain isolated in the final CSS layer', () => {
    const bridgeCss = readFileSync(path.join(appCssModuleDir, '56-app.css'), 'utf8')

    const requiredBridgeSelectors = [
      '.command-rail-core-badge',
      '.director-route-spine',
      '.timeline-ai-kicker'
    ]

    for (const selector of requiredBridgeSelectors) {
      expect(bridgeCss).toContain(selector)
    }
  })

  it('Nebula Flow inspector console bridge should remain isolated after workstream CSS', () => {
    const inspectorCss = readFileSync(path.join(appCssModuleDir, '57-app.css'), 'utf8')

    const requiredInspectorSelectors = [
      ".panel-right[data-shell-role='inspector-console']",
      '.inspector-console-empty',
      '.inspector-console-spine',
      "html[data-theme='light'] body .panel-right[data-shell-role='inspector-console'] .inspector-console-empty"
    ]

    for (const selector of requiredInspectorSelectors) {
      expect(inspectorCss).toContain(selector)
    }
  })

  it('Nebula Flow inspector console critical visuals should survive lazy inspector CSS order', () => {
    const propertyInspectorCss = readFileSync(propertyInspectorCssPath, 'utf8')

    const requiredLazySelectors = [
      '.property-inspector .inspector-console-empty',
      "[data-theme='dark'] .panel-right .property-inspector .inspector-console-empty",
      "[data-theme='light'] .panel-right .property-inspector .inspector-console-empty"
    ]

    for (const selector of requiredLazySelectors) {
      expect(propertyInspectorCss).toContain(selector)
    }
  })

  it('Nebula Flow director flow header should remain isolated in the final CSS layer', () => {
    const directorFlowCss = readFileSync(path.join(appCssModuleDir, '58-app.css'), 'utf8')

    const requiredDirectorFlowSelectors = [
      ".os-header[data-shell-role='director-flow-command']",
      '.director-flow-bus',
      '.director-flow-steps',
      "html[data-theme='light'] body .os-header[data-shell-role='director-flow-command'] .director-flow-bus"
    ]

    for (const selector of requiredDirectorFlowSelectors) {
      expect(directorFlowCss).toContain(selector)
    }
  })

  it('Nebula Flow output dock should remain isolated in the final CSS layer', () => {
    const outputDockCss = readFileSync(path.join(appCssModuleDir, '59-app.css'), 'utf8')

    const requiredOutputDockSelectors = [
      ".monitor-bottom-bar[data-shell-role='output-dock']",
      '.output-dock-flow',
      '.output-dock-steps',
      "html[data-theme='light'] body .monitor-bottom-bar[data-shell-role='output-dock'] .output-dock-flow"
    ]

    for (const selector of requiredOutputDockSelectors) {
      expect(outputDockCss).toContain(selector)
    }
  })

  it('Nebula Flow timeline bus should remain isolated in the final CSS layer', () => {
    const timelineBusCss = readFileSync(path.join(appCssModuleDir, '60-app.css'), 'utf8')

    const requiredTimelineBusSelectors = [
      ".timeline-container[data-shell-role='timeline-bus']",
      '.timeline-bus-flow',
      '.timeline-bus-steps',
      "html[data-theme='light'] body .timeline-container[data-shell-role='timeline-bus'] .timeline-bus-flow"
    ]

    for (const selector of requiredTimelineBusSelectors) {
      expect(timelineBusCss).toContain(selector)
    }
  })

  it('Nebula Flow command rail flow should remain isolated in the final CSS layer', () => {
    const commandRailCss = readFileSync(path.join(appCssModuleDir, '61-app.css'), 'utf8')

    const requiredCommandRailSelectors = [
      ".panel-left[data-shell-role='command-rail'] .sidebar-tab.is-ai-command",
      ".panel-left[data-shell-role='command-rail']",
      ".panel-left[data-shell-role='command-rail'] .sidebar-content",
      ".panel-left[data-shell-role='command-rail'] .pro-asset-grid",
      '.command-rail-flow',
      '.command-rail-steps',
      "html[data-theme='light'] body .panel-left[data-shell-role='command-rail'] .command-rail-flow"
    ]

    for (const selector of requiredCommandRailSelectors) {
      expect(commandRailCss).toContain(selector)
    }

    expect(commandRailCss).toContain('overflow: hidden !important;')
    expect(commandRailCss).toContain('overflow: auto !important;')
    expect(commandRailCss).toContain('align-content: start !important;')
  })

  it('Nebula Flow audio bus should remain isolated in the final CSS layer', () => {
    const audioBusCss = readFileSync(path.join(appCssModuleDir, '62-app.css'), 'utf8')

    const requiredAudioBusSelectors = [
      ".audio-master-stage[data-shell-role='audio-bus']",
      '.audio-bus-flow',
      '.audio-bus-steps',
      "html[data-theme='light'] body .audio-master-stage[data-shell-role='audio-bus'] .audio-bus-flow"
    ]

    for (const selector of requiredAudioBusSelectors) {
      expect(audioBusCss).toContain(selector)
    }
  })

  it('Nebula Flow watch bus should remain isolated in the final CSS layer', () => {
    const watchBusCss = readFileSync(path.join(appCssModuleDir, '63-app.css'), 'utf8')

    const requiredWatchBusSelectors = [
      ".lab-watch-stage-shell[data-shell-role='watch-bus']",
      '.watch-bus-flow',
      '.watch-bus-steps',
      "html[data-theme='light'] body .lab-watch-stage-shell[data-shell-role='watch-bus'] .watch-bus-flow"
    ]

    for (const selector of requiredWatchBusSelectors) {
      expect(watchBusCss).toContain(selector)
    }
  })

  it('Nebula Flow experiment bus should remain isolated in the final CSS layer', () => {
    const experimentBusCss = readFileSync(path.join(appCssModuleDir, '64-app.css'), 'utf8')

    const requiredExperimentBusSelectors = [
      ".comparison-lab-pro[data-shell-role='experiment-bus']",
      '.experiment-bus-flow',
      '.experiment-bus-steps',
      "html[data-theme='light'] body .comparison-lab-pro[data-shell-role='experiment-bus'] .experiment-bus-flow"
    ]

    for (const selector of requiredExperimentBusSelectors) {
      expect(experimentBusCss).toContain(selector)
    }
  })
})
