import { treaty } from '@elysiajs/eden'
import type { App } from '@veomuse/backend'

const ADMIN_TOKEN_STORAGE_KEY = 'veomuse-admin-token'

export const resolveApiBase = () => {
  if (import.meta.env.VITE_API_BASE_URL) return import.meta.env.VITE_API_BASE_URL as string
  if (import.meta.env.PROD && typeof window !== 'undefined') return window.location.origin
  return 'http://localhost:33117'
}

// 创建类型安全的 Eden Client (Treaty 2.0+ 模式)
export const api = treaty<App>(resolveApiBase())

export const getAdminToken = () => {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || ''
}

export const setAdminToken = (token: string) => {
  if (typeof window === 'undefined') return
  const value = token.trim()
  if (!value) localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY)
  else localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, value)
}

const buildAdminHeaders = (
  extraHeaders?: Record<string, string>,
  options?: { withJsonContentType?: boolean }
) => {
  const headers: Record<string, string> = {
    ...(extraHeaders || {})
  }
  if (options?.withJsonContentType) {
    const hasContentType = Object.keys(headers).some(key => key.toLowerCase() === 'content-type')
    if (!hasContentType) headers['Content-Type'] = 'application/json'
  }
  const token = getAdminToken().trim()
  if (token) headers['x-admin-token'] = token
  return headers
}

export const adminGetJson = async <T = any>(path: string) => {
  const response = await fetch(`${resolveApiBase()}${path}`, {
    method: 'GET',
    headers: buildAdminHeaders()
  })
  let payload: any = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  if (!response.ok) {
    throw new Error(payload?.error || `HTTP ${response.status}`)
  }
  return payload as T
}

export const adminPostJson = async <T = any>(path: string, body: unknown) => {
  const response = await fetch(`${resolveApiBase()}${path}`, {
    method: 'POST',
    headers: buildAdminHeaders(undefined, { withJsonContentType: true }),
    body: JSON.stringify(body ?? {})
  })
  let payload: any = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  if (!response.ok) {
    throw new Error(payload?.error || payload?.repair?.error || `HTTP ${response.status}`)
  }
  return payload as T
}

/**
 * 辅助函数：从 Eden Treaty 错误对象中提取友好的错误消息
 */
export const getErrorMessage = (error: any): string => {
  if (!error) return '未知错误';
  if (error.value && typeof error.value === 'object' && 'error' in error.value) {
    return error.value.error;
  }
  return error.message || '服务器响应异常';
};
