import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { app } from '../apps/backend/src/index'
import { buildTestPassword } from './helpers/credentials'

const MULTI_TENANT_CHANNEL_TEST_TIMEOUT_MS = 120_000
const NATIVE_RESPONSE_CTOR_PROMISE = Bun.fetch('data:text/plain,ok').then(
  (response) => response.constructor as typeof Response
)
const ORIGINAL_FETCH = globalThis.fetch
const NATIVE_FETCH = ((input: RequestInfo | URL, init?: RequestInit) =>
  Bun.fetch(input as any, init as any)) as typeof fetch

const callApi = async (path: string, init?: RequestInit) => {
  const response = await app.handle(new Request(`http://localhost${path}`, init))
  const data = (await response.json()) as any
  return { response, data }
}

const hasInvalidUrlHint = (value: unknown) => {
  const message = String(value || '').toLowerCase()
  return (
    message.includes('invalid url') ||
    message.includes('url is invalid') ||
    message.includes('invalid endpoint')
  )
}

const waitForServerReady = async (url: string) => {
  let lastError: unknown = null
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await Bun.fetch(url)
      if (response.status >= 200 && response.status < 500) return
    } catch (error) {
      lastError = error
    }
    await Bun.sleep(20)
  }
  throw new Error(
    `mock server 启动超时: ${String((lastError as any)?.message || lastError || 'unknown')}`
  )
}

describe('多租户渠道与权限回归', () => {
  beforeEach(() => {
    // 避免受其他测试遗留 fetch mock 影响，强制恢复为 Bun 原生实现。
    globalThis.fetch = NATIVE_FETCH
  })

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH
  })

  it(
    '应隔离组织数据并支持工作区渠道覆写命中',
    async () => {
      const stamp = Date.now()
      const password = buildTestPassword(`tenant-a-${stamp}`)

      const registerA = await callApi('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `tenant-a-${stamp}@example.com`,
          password,
          organizationName: `组织A-${stamp}`
        })
      })
      expect(registerA.response.status).toBe(200)
      expect(registerA.data.success).toBe(true)

      const registerB = await callApi('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `tenant-b-${stamp}@example.com`,
          password,
          organizationName: `组织B-${stamp}`
        })
      })
      expect(registerB.response.status).toBe(200)
      expect(registerB.data.success).toBe(true)

      const registerOrgMember = await callApi('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `tenant-org-member-${stamp}@example.com`,
          password,
          organizationName: `组织Member-${stamp}`
        })
      })
      expect(registerOrgMember.response.status).toBe(200)
      expect(registerOrgMember.data.success).toBe(true)
      const orgMemberEmail = `tenant-org-member-${stamp}@example.com`

      const tokenA = registerA.data.session.accessToken as string
      const tokenB = registerB.data.session.accessToken as string
      const tokenOrgMember = registerOrgMember.data.session.accessToken as string
      const orgA = registerA.data.organizations[0]?.id as string
      const orgB = registerB.data.organizations[0]?.id as string

      const saveOrgConfig = await callApi(`/api/organizations/${orgA}/channels/veo-3.1`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${tokenA}`,
          'Content-Type': 'application/json',
          'x-organization-id': orgA
        },
        body: JSON.stringify({
          baseUrl: 'http://[::1',
          apiKey: 'org-level-key',
          enabled: true
        })
      })
      expect(saveOrgConfig.response.status).toBe(200)
      expect(saveOrgConfig.data.success).toBe(true)

      const saveOrgBConfig = await callApi(`/api/organizations/${orgB}/channels/veo-3.1`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${tokenB}`,
          'Content-Type': 'application/json',
          'x-organization-id': orgB
        },
        body: JSON.stringify({
          baseUrl: 'http://[orgb-invalid-url',
          apiKey: 'org-b-only-key',
          enabled: true
        })
      })
      expect(saveOrgBConfig.response.status).toBe(200)
      expect(saveOrgBConfig.data.success).toBe(true)

      const createWorkspace = await callApi('/api/workspaces', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenA}`,
          'Content-Type': 'application/json',
          'x-organization-id': orgA
        },
        body: JSON.stringify({
          name: `租户A工作区-${stamp}`,
          ownerName: `Owner-${stamp}`,
          organizationId: orgA
        })
      })
      expect(createWorkspace.response.status).toBe(200)
      expect(createWorkspace.data.success).toBe(true)
      const workspaceId = createWorkspace.data.workspace.id as string

      const addOrgMemberResp = await callApi(`/api/organizations/${orgA}/members`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenA}`,
          'Content-Type': 'application/json',
          'x-organization-id': orgA
        },
        body: JSON.stringify({
          email: orgMemberEmail,
          role: 'member'
        })
      })
      expect(addOrgMemberResp.response.status).toBe(200)
      expect(addOrgMemberResp.data.success).toBe(true)

      const saveWorkspaceOverride = await callApi(
        `/api/workspaces/${workspaceId}/channels/veo-3.1`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${tokenA}`,
            'Content-Type': 'application/json',
            'x-organization-id': orgA
          },
          body: JSON.stringify({
            baseUrl: 'http://127.0.0.1:1',
            apiKey: 'workspace-key',
            enabled: true
          })
        }
      )
      expect(saveWorkspaceOverride.response.status).toBe(200)
      expect(saveWorkspaceOverride.data.success).toBe(true)

      const listOrgChannels = await callApi(`/api/organizations/${orgA}/channels`, {
        headers: {
          Authorization: `Bearer ${tokenA}`,
          'x-organization-id': orgA
        }
      })
      expect(listOrgChannels.response.status).toBe(200)
      const orgConfig = listOrgChannels.data.configs.find(
        (item: any) => item.providerId === 'veo-3.1'
      )
      expect(orgConfig.baseUrl).toBe('http://[::1')
      expect(orgConfig.workspaceId).toBeNull()

      const listWorkspaceChannels = await callApi(`/api/workspaces/${workspaceId}/channels`, {
        headers: {
          Authorization: `Bearer ${tokenA}`,
          'x-organization-id': orgA
        }
      })
      expect(listWorkspaceChannels.response.status).toBe(200)
      const workspaceConfig = listWorkspaceChannels.data.configs.find(
        (item: any) => item.providerId === 'veo-3.1'
      )
      expect(workspaceConfig.baseUrl).toBe('http://127.0.0.1:1')
      expect(workspaceConfig.workspaceId).toBe(workspaceId)

      const forbiddenCrossTenant = await callApi(`/api/organizations/${orgA}/channels`, {
        headers: {
          Authorization: `Bearer ${tokenB}`,
          'x-organization-id': orgB
        }
      })
      expect(forbiddenCrossTenant.response.status).toBe(403)

      const orgMemberListOrgChannels = await callApi(`/api/organizations/${orgA}/channels`, {
        headers: {
          Authorization: `Bearer ${tokenOrgMember}`,
          'x-organization-id': orgA
        }
      })
      expect(orgMemberListOrgChannels.response.status).toBe(200)

      const orgMemberListWorkspaceChannels = await callApi(
        `/api/workspaces/${workspaceId}/channels`,
        {
          headers: {
            Authorization: `Bearer ${tokenOrgMember}`,
            'x-organization-id': orgA
          }
        }
      )
      expect(orgMemberListWorkspaceChannels.response.status).toBe(403)

      const orgMemberWriteWorkspaceChannels = await callApi(
        `/api/workspaces/${workspaceId}/channels/veo-3.1`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${tokenOrgMember}`,
            'Content-Type': 'application/json',
            'x-organization-id': orgA
          },
          body: JSON.stringify({
            enabled: false
          })
        }
      )
      expect(orgMemberWriteWorkspaceChannels.response.status).toBe(403)

      const generateWithOrgConfig = await callApi('/api/video/generate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenA}`,
          'Content-Type': 'application/json',
          'x-organization-id': orgA
        },
        body: JSON.stringify({
          modelId: 'veo-3.1',
          text: 'org scoped request'
        })
      })
      expect(generateWithOrgConfig.response.status).toBe(200)
      expect(generateWithOrgConfig.data.status).toBe('error')
      expect(hasInvalidUrlHint(generateWithOrgConfig.data.error)).toBe(true)

      const generateWithWorkspaceOverride = await callApi('/api/video/generate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenA}`,
          'Content-Type': 'application/json',
          'x-organization-id': orgA,
          'x-workspace-id': workspaceId
        },
        body: JSON.stringify({
          modelId: 'veo-3.1',
          workspaceId,
          text: 'workspace override request'
        })
      })
      expect(generateWithWorkspaceOverride.response.status).toBe(200)
      expect(generateWithWorkspaceOverride.data.status).toBe('error')
      expect(hasInvalidUrlHint(generateWithWorkspaceOverride.data.error)).toBe(false)

      const generateOnOrgB = await callApi('/api/video/generate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenB}`,
          'Content-Type': 'application/json',
          'x-organization-id': orgB
        },
        body: JSON.stringify({
          modelId: 'veo-3.1',
          text: 'org B request'
        })
      })
      expect(generateOnOrgB.response.status).toBe(200)
      expect(generateOnOrgB.data.status).toBe('error')
      expect(hasInvalidUrlHint(generateOnOrgB.data.error)).toBe(true)
    },
    MULTI_TENANT_CHANNEL_TEST_TIMEOUT_MS
  )

  it(
    '应支持 OpenAI 兼容渠道并命中工作区覆写',
    async () => {
      const stamp = Date.now()
      const password = buildTestPassword(`tenant-openai-${stamp}`)
      const orgCalls: Array<{ path: string; auth: string; body: any }> = []
      const workspaceCalls: Array<{ path: string; auth: string; body: any }> = []
      const NativeResponse = await NATIVE_RESPONSE_CTOR_PROMISE

      const createMockServer = (
        label: string,
        calls: Array<{ path: string; auth: string; body: any }>
      ) =>
        Bun.serve({
          hostname: '127.0.0.1',
          port: 0,
          async fetch(request) {
            const url = new URL(request.url)
            if (url.pathname === '/_health') {
              return new NativeResponse('ok', { status: 200 })
            }
            const payload = await request.json().catch(() => ({}))
            calls.push({
              path: url.pathname,
              auth: request.headers.get('authorization') || '',
              body: payload
            })
            return new NativeResponse(
              JSON.stringify({
                id: `${label}-op-${Date.now()}`,
                choices: [
                  {
                    index: 0,
                    message: {
                      role: 'assistant',
                      content: `${label}-ok`
                    }
                  }
                ]
              }),
              {
                headers: { 'Content-Type': 'application/json' }
              }
            )
          }
        })

      const orgServer = createMockServer('org', orgCalls)
      const workspaceServer = createMockServer('workspace', workspaceCalls)

      try {
        await Promise.all([
          waitForServerReady(`http://127.0.0.1:${orgServer.port}/_health`),
          waitForServerReady(`http://127.0.0.1:${workspaceServer.port}/_health`)
        ])

        const register = await callApi('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: `openai-compatible-${stamp}@example.com`,
            password,
            organizationName: `OpenAI渠道组织-${stamp}`
          })
        })
        expect(register.response.status).toBe(200)
        expect(register.data.success).toBe(true)

        const token = register.data.session.accessToken as string
        const orgId = register.data.organizations[0]?.id as string

        const workspaceCreated = await callApi('/api/workspaces', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'x-organization-id': orgId
          },
          body: JSON.stringify({
            name: `OpenAI渠道工作区-${stamp}`,
            ownerName: `Owner-${stamp}`,
            organizationId: orgId
          })
        })
        expect(workspaceCreated.response.status).toBe(200)
        const workspaceId = workspaceCreated.data.workspace.id as string

        const saveOrgChannel = await callApi(
          `/api/organizations/${orgId}/channels/openai-compatible`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              'x-organization-id': orgId
            },
            body: JSON.stringify({
              baseUrl: `http://127.0.0.1:${orgServer.port}`,
              apiKey: 'org-openai-compatible-key',
              enabled: true,
              extra: {
                model: 'org-model',
                path: '/v1/chat/completions',
                temperature: 0.4
              }
            })
          }
        )
        expect(saveOrgChannel.response.status).toBe(200)
        expect(saveOrgChannel.data.success).toBe(true)

        const saveWorkspaceChannel = await callApi(
          `/api/workspaces/${workspaceId}/channels/openai-compatible`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              'x-organization-id': orgId
            },
            body: JSON.stringify({
              baseUrl: `http://127.0.0.1:${workspaceServer.port}`,
              apiKey: 'workspace-openai-compatible-key',
              enabled: true,
              extra: {
                model: 'workspace-model',
                path: '/api/chat',
                temperature: 0.9
              }
            })
          }
        )
        expect(saveWorkspaceChannel.response.status).toBe(200)
        expect(saveWorkspaceChannel.data.success).toBe(true)

        const listWorkspaceChannels = await callApi(`/api/workspaces/${workspaceId}/channels`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'x-organization-id': orgId
          }
        })
        expect(listWorkspaceChannels.response.status).toBe(200)
        const workspaceConfig = listWorkspaceChannels.data.configs.find(
          (item: any) => item.providerId === 'openai-compatible'
        )
        expect(workspaceConfig.workspaceId).toBe(workspaceId)
        expect(workspaceConfig.extra.model).toBe('workspace-model')
        expect(workspaceConfig.extra.path).toBe('/api/chat')

        const orgGenerate = await callApi('/api/video/generate', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'x-organization-id': orgId
          },
          body: JSON.stringify({
            modelId: 'openai-compatible',
            text: 'org scoped prompt'
          })
        })
        expect(orgGenerate.response.status).toBe(200)
        expect(orgGenerate.data.status).toBe('ok')
        expect(String(orgGenerate.data.operationName)).toContain('org-op-')

        const workspaceGenerate = await callApi('/api/video/generate', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'x-organization-id': orgId,
            'x-workspace-id': workspaceId
          },
          body: JSON.stringify({
            modelId: 'openai-compatible',
            text: 'workspace scoped prompt',
            workspaceId
          })
        })
        expect(workspaceGenerate.response.status).toBe(200)
        expect(workspaceGenerate.data.status).toBe('ok')
        expect(String(workspaceGenerate.data.operationName)).toContain('workspace-op-')

        expect(orgCalls.length).toBeGreaterThan(0)
        expect(orgCalls[0].path).toBe('/v1/chat/completions')
        expect(orgCalls[0].auth).toBe('Bearer org-openai-compatible-key')
        expect(orgCalls[0].body.model).toBe('org-model')
        expect(Array.isArray(orgCalls[0].body.messages)).toBe(true)

        expect(workspaceCalls.length).toBeGreaterThan(0)
        expect(workspaceCalls[0].path).toBe('/api/chat')
        expect(workspaceCalls[0].auth).toBe('Bearer workspace-openai-compatible-key')
        expect(workspaceCalls[0].body.model).toBe('workspace-model')
        expect(workspaceCalls[0].body.temperature).toBe(0.9)
      } finally {
        orgServer.stop(true)
        workspaceServer.stop(true)
      }
    },
    MULTI_TENANT_CHANNEL_TEST_TIMEOUT_MS
  )

  it(
    '渠道测试应支持复用已保存密钥（组织级与工作区覆写）',
    async () => {
      const stamp = Date.now()
      const password = buildTestPassword(`tenant-test-${stamp}`)

      const register = await callApi('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `channel-test-${stamp}@example.com`,
          password,
          organizationName: `渠道测试组织-${stamp}`
        })
      })
      expect(register.response.status).toBe(200)
      expect(register.data.success).toBe(true)

      const token = register.data.session.accessToken as string
      const orgId = register.data.organizations[0]?.id as string

      const workspaceCreated = await callApi('/api/workspaces', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-organization-id': orgId
        },
        body: JSON.stringify({
          name: `渠道测试工作区-${stamp}`,
          ownerName: `Owner-${stamp}`,
          organizationId: orgId
        })
      })
      expect(workspaceCreated.response.status).toBe(200)
      const workspaceId = workspaceCreated.data.workspace.id as string

      const saveOrgChannel = await callApi(
        `/api/organizations/${orgId}/channels/openai-compatible`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'x-organization-id': orgId
          },
          body: JSON.stringify({
            baseUrl: 'https://api.example.com',
            apiKey: `org-key-${stamp}`,
            enabled: true,
            extra: {
              model: 'org-model',
              path: '/v1/chat/completions'
            }
          })
        }
      )
      expect(saveOrgChannel.response.status).toBe(200)
      expect(saveOrgChannel.data.success).toBe(true)

      const saveWorkspaceChannel = await callApi(
        `/api/workspaces/${workspaceId}/channels/openai-compatible`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'x-organization-id': orgId
          },
          body: JSON.stringify({
            baseUrl: 'https://workspace.example.com',
            apiKey: `workspace-key-${stamp}`,
            enabled: true,
            extra: {
              model: 'workspace-model',
              path: '/v1/chat/completions'
            }
          })
        }
      )
      expect(saveWorkspaceChannel.response.status).toBe(200)
      expect(saveWorkspaceChannel.data.success).toBe(true)

      const testOrgSavedConfig = await callApi('/api/channels/test', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-organization-id': orgId
        },
        body: JSON.stringify({
          providerId: 'openai-compatible'
        })
      })
      expect(testOrgSavedConfig.response.status).toBe(200)
      expect(testOrgSavedConfig.data.success).toBe(true)
      expect(String(testOrgSavedConfig.data.message || '')).toContain('组织级已保存配置')

      const testWorkspaceSavedConfig = await callApi('/api/channels/test', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-organization-id': orgId
        },
        body: JSON.stringify({
          providerId: 'openai-compatible',
          workspaceId
        })
      })
      expect(testWorkspaceSavedConfig.response.status).toBe(200)
      expect(testWorkspaceSavedConfig.data.success).toBe(true)
      expect(String(testWorkspaceSavedConfig.data.message || '')).toContain('工作区级已保存配置')
    },
    MULTI_TENANT_CHANNEL_TEST_TIMEOUT_MS
  )
})
