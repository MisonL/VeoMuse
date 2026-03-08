import { describe, expect, it } from 'bun:test'
import {
  buildComposeDownCommand,
  buildComposeUpCommand,
  buildWebSocketUpgradeRequest,
  extractReferencedJavaScriptAssetPaths,
  extractStaticAssetPaths,
  filterJavaScriptAssetPaths,
  hasImmutableCacheControl,
  HELP_TEXT,
  LAB_ENTRY_MARKERS,
  normalizeBaseUrl,
  parseArgs,
  parseHttpStatusCode,
  REQUIRED_SECURITY_HEADERS,
  TELEMETRY_ENTRY_MARKERS,
  validateBaseUrl,
  resolveJavaScriptAssetUrl,
  resolveWebSocketProbeScheme,
  resolveMissingLabEntryMarkers,
  resolveMissingTelemetryEntryMarkers,
  resolveMissingSecurityHeaders
} from '../scripts/docker_smoke_check'
import { readFileSync } from 'fs'
import path from 'path'

describe('docker smoke 脚本辅助逻辑', () => {
  it('应解析参数并规范化 baseUrl', () => {
    const parsed = parseArgs([
      '--compose-file',
      'config/docker/docker-compose.yml',
      '--base-url=http://127.0.0.1:18081/',
      '--wait-timeout',
      '240',
      '--keep-up',
      '--no-build'
    ])

    expect(parsed.showHelp).toBe(false)
    expect(parsed.options.composeFile).toBe('config/docker/docker-compose.yml')
    expect(parsed.options.baseUrl).toBe('http://127.0.0.1:18081')
    expect(parsed.options.waitTimeoutSec).toBe(240)
    expect(parsed.options.keepUp).toBe(true)
    expect(parsed.options.noBuild).toBe(true)
    expect(normalizeBaseUrl('http://127.0.0.1:18081/')).toBe('http://127.0.0.1:18081')
    expect(validateBaseUrl('https://veomuse.test/')).toBe('https://veomuse.test')
  })

  it('应拒绝非法 baseUrl、未知参数与非法等待时间', () => {
    expect(() => parseArgs(['--unknown-flag'])).toThrow('未知参数')
    expect(() => parseArgs(['--wait-timeout', '0'])).toThrow('--wait-timeout 需要正整数')
    expect(() => parseArgs(['--compose-file'])).toThrow('--compose-file 缺少参数值')
    expect(() => parseArgs(['--base-url', 'veomuse.test'])).toThrow(
      '--base-url 需要合法的 http/https URL'
    )
    expect(() => parseArgs(['--base-url', 'ftp://veomuse.test'])).toThrow(
      '--base-url 仅支持 http/https'
    )
  })

  it('应暴露稳定的帮助文案与 compose 命令构造', () => {
    expect(HELP_TEXT).toContain('Docker Smoke Check')
    expect(HELP_TEXT).toContain('--keep-up')
    expect(HELP_TEXT).toContain('前端实验室/系统监控入口 bundle 标识')

    expect(
      buildComposeUpCommand(
        ['docker', 'compose', '-f', 'config/docker/docker-compose.yml'],
        {
          noBuild: false,
          waitTimeoutSec: 180
        },
        true
      )
    ).toEqual([
      'docker',
      'compose',
      '-f',
      'config/docker/docker-compose.yml',
      'up',
      '-d',
      '--build',
      '--wait',
      '--wait-timeout',
      '180'
    ])

    expect(
      buildComposeUpCommand(
        ['docker-compose', '-f', 'config/docker/docker-compose.yml'],
        {
          noBuild: true,
          waitTimeoutSec: 240
        },
        false
      )
    ).toEqual(['docker-compose', '-f', 'config/docker/docker-compose.yml', 'up', '-d'])

    expect(
      buildComposeDownCommand(['docker', 'compose', '-f', 'config/docker/docker-compose.yml'])
    ).toEqual([
      'docker',
      'compose',
      '-f',
      'config/docker/docker-compose.yml',
      'down',
      '--volumes',
      '--remove-orphans'
    ])
  })

  it('应从首页 HTML 提取静态资源路径并识别缓存头', () => {
    const html = `
      <html>
        <head>
          <link rel="stylesheet" href="/assets/index-abc123.css" />
          <script type="module" src="/assets/index-xyz789.js"></script>
        </head>
      </html>
    `

    expect(extractStaticAssetPaths(html)).toEqual([
      '/assets/index-abc123.css',
      '/assets/index-xyz789.js'
    ])

    const headers = new Headers({
      'cache-control': 'public, immutable, max-age=31536000'
    })
    expect(hasImmutableCacheControl(headers)).toBe(true)
  })

  it('应过滤 JS 资源并识别实验室入口标识', () => {
    const assetPaths = [
      '/assets/index-abc123.css',
      '/assets/index-main.js',
      '/assets/lab-chunk.js?import'
    ]
    expect(filterJavaScriptAssetPaths(assetPaths)).toEqual([
      '/assets/index-main.js',
      '/assets/lab-chunk.js?import'
    ])

    const fullBundle = `
      ${LAB_ENTRY_MARKERS.join('\n')}
      data-testid="area-comparison-lab"
    `
    expect(resolveMissingLabEntryMarkers(fullBundle)).toEqual([])

    const splitBundles = [
      'lab-tab-compare lab-tab-marketplace 双通道比对 策略治理',
      'lab-tab-creative lab-tab-collab 创意闭环 协作平台'
    ]
    expect(resolveMissingLabEntryMarkers(splitBundles)).toEqual([])
    expect(resolveMissingLabEntryMarkers('lab-tab-compare 双通道比对')).toContain('lab-tab-collab')
  })

  it('应暴露系统监控入口标识常量', () => {
    expect(TELEMETRY_ENTRY_MARKERS).toContain('系统监控')
    expect(TELEMETRY_ENTRY_MARKERS).toContain('ops watch / live audit')
    expect(TELEMETRY_ENTRY_MARKERS).toContain('系统监控与当前创作工位并行值守')
  })

  it('应识别系统监控入口标识缺失与 split bundle 拼接通过', () => {
    const fullBundle = `
      ${TELEMETRY_ENTRY_MARKERS.join('\n')}
      data-active-tab="lab"
    `
    expect(resolveMissingTelemetryEntryMarkers(fullBundle)).toEqual([])

    const splitBundles = [
      '系统监控 系统监控正在值守',
      '系统监控与当前创作工位并行值守 ops watch / live audit'
    ]
    expect(resolveMissingTelemetryEntryMarkers(splitBundles)).toEqual([])

    const missing = resolveMissingTelemetryEntryMarkers('系统监控 ops watch / live audit')
    expect(missing).toContain('系统监控正在值守')
    expect(missing).toContain('系统监控与当前创作工位并行值守')
  })

  it('应从入口脚本中递归识别拆包 JS 依赖', () => {
    const scriptContent = `
      import "./rolldown-runtime-COnpUsM8.js";
      const deps = ["assets/ComparisonLab-CsDQSHwk.js", "assets/motion-BCuQe_zR.js"];
      void import("./VideoEditor-BaxlPraU.js");
    `

    expect(extractReferencedJavaScriptAssetPaths(scriptContent)).toEqual([
      './rolldown-runtime-COnpUsM8.js',
      'assets/ComparisonLab-CsDQSHwk.js',
      'assets/motion-BCuQe_zR.js',
      './VideoEditor-BaxlPraU.js'
    ])

    expect(
      resolveJavaScriptAssetUrl(
        'http://127.0.0.1:18081',
        'http://127.0.0.1:18081/assets/index-main.js',
        'assets/ComparisonLab-CsDQSHwk.js'
      )
    ).toBe('http://127.0.0.1:18081/assets/ComparisonLab-CsDQSHwk.js')

    expect(
      resolveJavaScriptAssetUrl(
        'http://127.0.0.1:18081',
        'http://127.0.0.1:18081/assets/index-main.js',
        './VideoEditor-BaxlPraU.js'
      )
    ).toBe('http://127.0.0.1:18081/assets/VideoEditor-BaxlPraU.js')
  })

  it('应识别缺失安全头并构造 WebSocket 升级请求', () => {
    const headers = new Headers({
      'content-security-policy': "default-src 'self'",
      'x-frame-options': 'SAMEORIGIN',
      'x-content-type-options': 'nosniff'
    })

    expect(resolveMissingSecurityHeaders(headers, REQUIRED_SECURITY_HEADERS)).toEqual([
      'referrer-policy',
      'permissions-policy',
      'cross-origin-opener-policy',
      'cross-origin-resource-policy'
    ])

    const request = buildWebSocketUpgradeRequest(
      new URL('ws://127.0.0.1:18081/ws/generation?source=docker-smoke')
    )
    expect(request).toContain('GET /ws/generation?source=docker-smoke HTTP/1.1')
    expect(request).toContain('Upgrade: websocket')
    expect(request).toContain('Sec-WebSocket-Version: 13')
    expect(resolveWebSocketProbeScheme('http://127.0.0.1:18081')).toBe('ws')
    expect(resolveWebSocketProbeScheme('https://veomuse.example.com')).toBe('wss')
  })

  it('应从原始 HTTP 响应中解析状态码', () => {
    expect(parseHttpStatusCode('HTTP/1.1 101 Switching Protocols\r\n\r\n')).toBe(101)
    expect(parseHttpStatusCode('HTTP/1.1 200 OK\r\n\r\n')).toBe(200)
    expect(parseHttpStatusCode('invalid')).toBeNull()
  })

  it('runSmokeCheck 应串入系统监控入口探测调用', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'scripts/docker_smoke_check.ts'),
      'utf8'
    )
    expect(source).toContain('runDeploymentAcceptanceProbes')
    expect(source).toContain("loggerPrefix: '[docker-smoke]'")
  })
})
