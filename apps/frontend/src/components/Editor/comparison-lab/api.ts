import { buildAuthHeaders, resolveApiBase } from '../../../utils/eden'

export const wsBaseFromApi = (base: string) => {
  if (base.startsWith('https://')) return base.replace('https://', 'wss://')
  if (base.startsWith('http://')) return base.replace('http://', 'ws://')
  return base
}

export const requestJson = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const headers: Record<string, string> = buildAuthHeaders()
  const customHeaders = init?.headers
  if (customHeaders && typeof customHeaders === 'object' && !Array.isArray(customHeaders)) {
    Object.assign(headers, customHeaders as Record<string, string>)
  }
  const method = (init?.method || 'GET').toUpperCase()
  const isFormDataBody = typeof FormData !== 'undefined' && init?.body instanceof FormData
  if (method !== 'GET' && method !== 'HEAD' && !isFormDataBody) {
    const hasContentType = Object.keys(headers).some(key => key.toLowerCase() === 'content-type')
    if (!hasContentType) headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${resolveApiBase()}${path}`, {
    ...init,
    headers
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.error || payload?.repair?.error || `HTTP ${response.status}`)
  }
  return payload as T
}
