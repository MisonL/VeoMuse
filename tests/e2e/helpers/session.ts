import type { APIRequestContext, Page } from '@playwright/test'

const API_BASE = process.env.PLAYWRIGHT_API_BASE_URL || 'http://127.0.0.1:33117'

interface SessionPayload {
  accessToken: string
  refreshToken: string
}

interface SeededSession {
  email: string
  password: string
  organizationId: string
  workspaceId?: string
  accessToken: string
  refreshToken: string
}

const uniqueSuffix = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const postJson = async <T>(
  request: APIRequestContext,
  path: string,
  payload: unknown,
  headers?: Record<string, string>
): Promise<T> => {
  const response = await request.post(`${API_BASE}${path}`, {
    data: payload,
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {})
    }
  })

  const data = await response.json().catch(() => ({})) as T & { success?: boolean; error?: string }
  if (!response.ok || (typeof data === 'object' && data !== null && 'success' in data && data.success === false)) {
    const err = (data && typeof data === 'object' && 'error' in data && data.error) ? String(data.error) : `HTTP ${response.status()}`
    throw new Error(`${path} 请求失败: ${err}`)
  }
  return data
}

export const seedAuthSession = async (
  request: APIRequestContext,
  options?: { withWorkspace?: boolean }
): Promise<SeededSession> => {
  const suffix = uniqueSuffix()
  const email = `e2e_${suffix}@veomuse.test`
  const password = `Passw0rd!${suffix}`
  const organizationName = `E2E组织_${suffix}`

  const registerPayload = await postJson<{
    success: boolean
    session: SessionPayload
    organizations: Array<{ id: string; name: string }>
  }>(request, '/api/auth/register', {
    email,
    password,
    organizationName
  })

  const organizationId = registerPayload.organizations?.[0]?.id
  if (!organizationId) {
    throw new Error('未获取到组织 ID')
  }

  const session: SeededSession = {
    email,
    password,
    organizationId,
    accessToken: registerPayload.session.accessToken,
    refreshToken: registerPayload.session.refreshToken
  }

  if (options?.withWorkspace) {
    const workspacePayload = await postJson<{
      success: boolean
      workspace: { id: string }
    }>(request, '/api/workspaces', {
      name: `E2E工作区_${suffix}`,
      ownerName: 'E2E_OWNER',
      organizationId
    }, {
      Authorization: `Bearer ${session.accessToken}`,
      'x-organization-id': organizationId
    })
    session.workspaceId = workspacePayload.workspace.id
  }

  return session
}

export const injectAuthSession = async (page: Page, session: SeededSession) => {
  await page.addInitScript((injected) => {
    window.localStorage.setItem('veomuse-access-token', injected.accessToken)
    window.localStorage.setItem('veomuse-refresh-token', injected.refreshToken)
    window.localStorage.setItem('veomuse-organization-id', injected.organizationId)
  }, {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    organizationId: session.organizationId
  })
}
