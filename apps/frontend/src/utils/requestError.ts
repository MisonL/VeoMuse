export type RequestErrorKind =
  | 'network'
  | 'timeout'
  | 'auth'
  | 'permission'
  | 'quota'
  | 'server'
  | 'unknown'

const HTTP_STATUS_PATTERN = /\bHTTP\s+(\d{3})\b/i
const TIMEOUT_HINTS = ['timeout', 'timed out', 'time out', 'aborterror']
const NETWORK_HINTS = ['network', 'failed to fetch', 'fetch failed', 'econn', 'socket', 'dns']

const normalizeStatus = (value: unknown) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return undefined
  const status = Math.floor(parsed)
  if (status < 100 || status > 599) return undefined
  return status
}

export const extractHttpStatusFromError = (error: unknown) => {
  const directStatus = normalizeStatus((error as { status?: unknown } | null | undefined)?.status)
  if (directStatus) return directStatus
  const message = String((error as { message?: unknown } | null | undefined)?.message || '')
  const match = message.match(HTTP_STATUS_PATTERN)
  if (!match) return undefined
  return normalizeStatus(match[1])
}

export const classifyRequestError = (
  error: unknown
): { errorKind: RequestErrorKind; httpStatus?: number } => {
  const status = extractHttpStatusFromError(error)
  const code = String((error as { code?: unknown } | null | undefined)?.code || '')
    .trim()
    .toUpperCase()
  const message = String(
    (error as { message?: unknown } | null | undefined)?.message || ''
  ).toLowerCase()

  if (code === 'QUOTA_EXCEEDED') {
    return { errorKind: 'quota', httpStatus: status }
  }
  if (status === 401) return { errorKind: 'auth', httpStatus: status }
  if (status === 403) return { errorKind: 'permission', httpStatus: status }
  if (status === 429) return { errorKind: 'quota', httpStatus: status }
  if (status === 408 || status === 504) return { errorKind: 'timeout', httpStatus: status }
  if (status !== undefined && status >= 500) return { errorKind: 'server', httpStatus: status }
  if (status !== undefined) return { errorKind: 'unknown', httpStatus: status }

  if (TIMEOUT_HINTS.some((hint) => message.includes(hint))) {
    return { errorKind: 'timeout' }
  }
  if (NETWORK_HINTS.some((hint) => message.includes(hint))) {
    return { errorKind: 'network' }
  }

  return { errorKind: 'unknown' }
}
