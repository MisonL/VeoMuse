import { describe, expect, it } from 'bun:test'
import {
  buildWebSocketUpgradeRequest,
  extractReferencedJavaScriptAssetPaths,
  extractStaticAssetPaths,
  filterJavaScriptAssetPaths,
  hasImmutableCacheControl,
  LAB_ENTRY_MARKERS,
  normalizeBaseUrl,
  parseArgs,
  parseHttpStatusCode,
  REQUIRED_SECURITY_HEADERS,
  resolveJavaScriptAssetUrl,
  resolveMissingLabEntryMarkers,
  resolveMissingSecurityHeaders
} from '../scripts/docker_smoke_check'

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
  })

  it('应从原始 HTTP 响应中解析状态码', () => {
    expect(parseHttpStatusCode('HTTP/1.1 101 Switching Protocols\r\n\r\n')).toBe(101)
    expect(parseHttpStatusCode('HTTP/1.1 200 OK\r\n\r\n')).toBe(200)
    expect(parseHttpStatusCode('invalid')).toBeNull()
  })
})
