import { app } from '../../apps/backend/src/index'
import { buildTestPassword } from './credentials'

export const callApi = async (path: string, init?: RequestInit) => {
  const response = await app.handle(new Request(`http://localhost${path}`, init))
  const data = (await response.json().catch(() => null)) as any
  return { response, data }
}

export const createAuthHeaders = (
  accessToken: string,
  options?: {
    organizationId?: string
    contentTypeJson?: boolean
    extra?: Record<string, string>
  }
) => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    ...(options?.extra || {})
  }
  if (options?.organizationId) headers['x-organization-id'] = options.organizationId
  if (options?.contentTypeJson) headers['Content-Type'] = 'application/json'
  return headers
}

export const createTestSession = async (label: string = 'test-user') => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const email = `${label}-${stamp}@example.com`
  const password = buildTestPassword(stamp)
  const register = await callApi('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      organizationName: `${label}-org-${stamp}`
    })
  })
  if (register.response.status !== 200 || !register.data?.session?.accessToken) {
    throw new Error(`createTestSession failed: ${register.data?.error || register.response.status}`)
  }
  return {
    email,
    accessToken: register.data.session.accessToken as string,
    refreshToken: register.data.session.refreshToken as string,
    organizationId: register.data.organizations?.[0]?.id as string,
    userId: register.data.session.user?.id as string
  }
}
