export type ProviderErrorCode =
  | 'timeout'
  | 'network_error'
  | 'upstream_4xx'
  | 'upstream_5xx'
  | 'invalid_payload'
  | 'unknown_error'

export interface ProviderRequestOptions {
  timeoutMs?: number
  maxRetries?: number
  retryDelayMs?: number
  retryBackoff?: number
}

export interface ProviderRequestMeta {
  traceId: string
  attemptCount: number
  durationMs: number
  statusCode: number | null
}

export interface ProviderHealthProbe {
  reachable: boolean
  statusCode: number | null
  latencyMs: number | null
  error?: string
  errorCode?: ProviderErrorCode
  traceId: string
}

export class ProviderHttpError extends Error {
  code: ProviderErrorCode
  statusCode: number | null
  traceId: string

  constructor(
    message: string,
    code: ProviderErrorCode,
    statusCode: number | null,
    traceId: string
  ) {
    super(message)
    this.name = 'ProviderHttpError'
    this.code = code
    this.statusCode = statusCode
    this.traceId = traceId
  }
}

const DEFAULT_TIMEOUT_MS = 12_000
const DEFAULT_MAX_RETRIES = 2
const DEFAULT_RETRY_DELAY_MS = 300
const DEFAULT_RETRY_BACKOFF = 2

const sleep = async (ms: number) => {
  if (ms <= 0) return
  await new Promise<void>((resolve) => setTimeout(resolve, ms))
}

const buildTraceId = () => `prov_${crypto.randomUUID()}`

const shouldRetry = (statusCode: number | null, code: ProviderErrorCode) => {
  if (code === 'timeout' || code === 'network_error') return true
  if (statusCode === null) return false
  return statusCode === 408 || statusCode === 429 || statusCode >= 500
}

const mapHttpCode = (statusCode: number): ProviderErrorCode => {
  if (statusCode >= 500) return 'upstream_5xx'
  return 'upstream_4xx'
}

const withTimeoutSignal = (timeoutMs: number, signal?: AbortSignal) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs)

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason)
    } else {
      signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true })
    }
  }

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId)
  }
}

export class ProviderHttpClient {
  static async requestJson<T>(
    url: string,
    init: RequestInit,
    options?: ProviderRequestOptions
  ): Promise<{ data: T; meta: ProviderRequestMeta }> {
    const timeoutMs = Math.max(500, Math.floor(options?.timeoutMs ?? DEFAULT_TIMEOUT_MS))
    const maxRetries = Math.max(0, Math.floor(options?.maxRetries ?? DEFAULT_MAX_RETRIES))
    const retryDelayMs = Math.max(0, Math.floor(options?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS))
    const retryBackoff = Math.max(1, Math.floor(options?.retryBackoff ?? DEFAULT_RETRY_BACKOFF))

    const startedAt = performance.now()
    let attempt = 0
    let lastError: ProviderHttpError | null = null

    while (attempt <= maxRetries) {
      const traceId = buildTraceId()
      const timeout = withTimeoutSignal(timeoutMs, init.signal ?? undefined)
      try {
        const response = await fetch(url, {
          ...init,
          signal: timeout.signal,
          headers: {
            ...(init.headers || {}),
            'x-provider-trace-id': traceId
          }
        })

        if (!response.ok) {
          const errorText = await response.text().catch(() => '')
          const errorCode = mapHttpCode(response.status)
          throw new ProviderHttpError(
            `HTTP ${response.status}: ${errorText || 'upstream error'}`,
            errorCode,
            response.status,
            traceId
          )
        }

        let payload: T
        try {
          payload = (await response.json()) as T
        } catch {
          throw new ProviderHttpError(
            '上游响应不是合法 JSON',
            'invalid_payload',
            response.status,
            traceId
          )
        }

        timeout.clear()
        return {
          data: payload,
          meta: {
            traceId,
            attemptCount: attempt + 1,
            durationMs: Math.round(performance.now() - startedAt),
            statusCode: response.status
          }
        }
      } catch (error: unknown) {
        timeout.clear()

        const normalized = (() => {
          if (error instanceof ProviderHttpError) return error
          const message = error instanceof Error ? error.message : String(error || 'unknown error')
          const aborted = /abort|timeout/i.test(message)
          const code: ProviderErrorCode = aborted ? 'timeout' : 'network_error'
          return new ProviderHttpError(message, code, null, traceId)
        })()

        lastError = normalized
        if (attempt >= maxRetries || !shouldRetry(normalized.statusCode, normalized.code)) {
          break
        }

        const delay = retryDelayMs * retryBackoff ** attempt
        await sleep(delay)
        attempt += 1
      }
    }

    if (!lastError) {
      lastError = new ProviderHttpError('请求失败', 'unknown_error', null, buildTraceId())
    }
    throw lastError
  }

  static async probe(
    baseUrl: string,
    headers?: Record<string, string>
  ): Promise<ProviderHealthProbe> {
    const normalized = String(baseUrl || '')
      .trim()
      .replace(/\/+$/, '')
    if (!normalized) {
      return {
        reachable: false,
        statusCode: null,
        latencyMs: null,
        error: 'baseUrl is empty',
        errorCode: 'unknown_error',
        traceId: buildTraceId()
      }
    }

    const candidates = [`${normalized}/health`, normalized]

    for (const url of candidates) {
      const traceId = buildTraceId()
      const startedAt = performance.now()
      const timeout = withTimeoutSignal(3_500)
      try {
        const response = await fetch(url, {
          method: 'GET',
          signal: timeout.signal,
          headers: {
            ...(headers || {}),
            'x-provider-trace-id': traceId
          }
        })
        timeout.clear()
        return {
          reachable: response.ok,
          statusCode: response.status,
          latencyMs: Math.round(performance.now() - startedAt),
          traceId,
          ...(response.ok
            ? {}
            : {
                error: `HTTP ${response.status}`,
                errorCode: mapHttpCode(response.status)
              })
        }
      } catch (error: unknown) {
        timeout.clear()
        const message = error instanceof Error ? error.message : String(error || 'unknown error')
        const aborted = /abort|timeout/i.test(message)
        const errorCode: ProviderErrorCode = aborted ? 'timeout' : 'network_error'
        if (url === candidates[candidates.length - 1]) {
          return {
            reachable: false,
            statusCode: null,
            latencyMs: Math.round(performance.now() - startedAt),
            error: message,
            errorCode,
            traceId
          }
        }
      }
    }

    return {
      reachable: false,
      statusCode: null,
      latencyMs: null,
      error: 'probe failed',
      errorCode: 'unknown_error',
      traceId: buildTraceId()
    }
  }
}
