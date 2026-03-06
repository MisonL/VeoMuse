import { describe, expect, it } from 'bun:test'
import {
  buildWebSocketUpgradeRequest,
  extractStaticAssetPaths,
  hasImmutableCacheControl,
  normalizeBaseUrl,
  parseArgs,
  parseHttpStatusCode,
  REQUIRED_SECURITY_HEADERS,
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
