import { buildAuthHeaders, resolveApiBase } from '../../../utils/eden'
import { classifyRequestError } from '../../../utils/requestError'

const TRANSIENT_HTTP_STATUS = new Set([429, 502, 503, 504])
const DEFAULT_MAX_RETRIES = 2
const DEFAULT_BASE_DELAY_MS = 300
const DEFAULT_JITTER_MS = 80

export class ApiRequestError extends Error {
  status?: number
  code?: string

  constructor(message: string, status?: number, code?: string) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
  }
}

export interface RequestRetryOptions {
  maxRetries?: number
  baseDelayMs?: number
  jitterMs?: number
  idempotent?: boolean
}

export interface V4RequestOptions {
  retry?: RequestRetryOptions
}

export const wsBaseFromApi = (base: string) => {
  if (base.startsWith('https://')) return base.replace('https://', 'wss://')
  if (base.startsWith('http://')) return base.replace('http://', 'ws://')
  return base
}

export const isTransientHttpStatus = (status: number) =>
  Number.isFinite(status) && TRANSIENT_HTTP_STATUS.has(Math.floor(status))

const resolveHeaders = (init?: RequestInit) => {
  const headers: Record<string, string> = buildAuthHeaders()
  const customHeaders = init?.headers
  if (customHeaders && typeof customHeaders === 'object' && !Array.isArray(customHeaders)) {
    Object.assign(headers, customHeaders as Record<string, string>)
  }

  const method = (init?.method || 'GET').toUpperCase()
  const isFormDataBody = typeof FormData !== 'undefined' && init?.body instanceof FormData
  if (method !== 'GET' && method !== 'HEAD' && !isFormDataBody) {
    const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')
    if (!hasContentType) headers['Content-Type'] = 'application/json'
  }

  return headers
}

const canRetryRequest = (method: string, idempotent: boolean) =>
  method === 'GET' || method === 'HEAD' || (method === 'POST' && idempotent)

const shouldRetryError = (error: unknown) => {
  if (error instanceof ApiRequestError && error.status !== undefined) {
    return isTransientHttpStatus(error.status)
  }
  const info = classifyRequestError(error)
  return info.errorKind === 'network' || info.errorKind === 'timeout'
}

const sleep = async (ms: number) => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

export const requestJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const headers = resolveHeaders(init)
  const response = await fetch(`${resolveApiBase()}${path}`, {
    ...init,
    headers
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiRequestError(
      payload?.error || payload?.repair?.error || `HTTP ${response.status}`,
      response.status,
      typeof payload?.code === 'string' ? payload.code : undefined
    )
  }
  return payload as T
}

export const requestJsonWithRetry = async <T>(
  path: string,
  init?: RequestInit,
  options?: RequestRetryOptions
): Promise<T> => {
  const method = (init?.method || 'GET').toUpperCase()
  const idempotent = Boolean(options?.idempotent)
  if (!canRetryRequest(method, idempotent)) {
    return requestJson<T>(path, init)
  }

  const maxRetries = Math.max(0, Math.floor(options?.maxRetries ?? DEFAULT_MAX_RETRIES))
  const baseDelayMs = Math.max(0, Math.floor(options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS))
  const jitterMs = Math.max(0, Math.floor(options?.jitterMs ?? DEFAULT_JITTER_MS))

  let attempt = 0
  while (true) {
    try {
      return await requestJson<T>(path, init)
    } catch (error) {
      if (attempt >= maxRetries || !shouldRetryError(error)) {
        throw error
      }
      const retryDelay = baseDelayMs * 2 ** attempt
      const jitter = jitterMs > 0 ? Math.floor(Math.random() * (jitterMs + 1)) : 0
      await sleep(retryDelay + jitter)
      attempt += 1
    }
  }
}

const normalizeV4Path = (path: string) => {
  const normalized = path.trim()
  if (!normalized) return '/api/v4'
  if (normalized.startsWith('/api/v4/')) return normalized
  if (normalized === '/api/v4') return normalized
  if (normalized.startsWith('/v4/')) return `/api${normalized}`
  if (normalized === '/v4') return '/api/v4'
  if (normalized.startsWith('/')) return `/api/v4${normalized}`
  return `/api/v4/${normalized}`
}

export const requestV4 = async <T>(
  path: string,
  init?: RequestInit,
  options?: V4RequestOptions
): Promise<T> => {
  const targetPath = normalizeV4Path(path)
  try {
    if (options?.retry) {
      return await requestJsonWithRetry<T>(targetPath, init, options.retry)
    }
    return await requestJson<T>(targetPath, init)
  } catch (error: unknown) {
    if (error instanceof ApiRequestError) {
      throw error
    }
    const { httpStatus } = classifyRequestError(error)
    const codeRaw = (error as { code?: unknown } | null | undefined)?.code
    const code = typeof codeRaw === 'string' && codeRaw.trim() ? codeRaw : undefined
    const fallbackMessage = error instanceof Error && error.message ? error.message : '请求失败'
    throw new ApiRequestError(`v4 请求失败：${fallbackMessage}`, httpStatus, code)
  }
}
