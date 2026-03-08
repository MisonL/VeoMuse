import './helpers/dom-test-setup'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import {
  clearAuthSession,
  setAccessToken,
  setOrganizationId
} from '../apps/frontend/src/utils/eden'
import { useAuthOrganizationChannelManager } from '../apps/frontend/src/components/Editor/comparison-lab/hooks/useAuthOrganizationChannelManager'

type AuthManagerController = ReturnType<typeof useAuthOrganizationChannelManager>

let latestController: AuthManagerController | null = null
const stableLoadPolicies = async () => {}
const stableShowToast = () => {}
const stableMarkJourneyStep = () => {}
const stableReportJourney = async () => true
const stableResetJourney = () => {}
const fakeApiKey = ['demo', 'channel', 'key'].join('-')

const buildAccessToken = () => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + 3600,
      sub: 'auth-manager-test'
    })
  )
  return `${header}.${payload}.signature`
}

function AuthManagerHarness(props: { workspaceId?: string; showChannelPanel?: boolean }) {
  latestController = useAuthOrganizationChannelManager({
    workspaceId: props.workspaceId || 'ws_1',
    showChannelPanel: props.showChannelPanel || false,
    loadPolicies: stableLoadPolicies,
    showToast: stableShowToast,
    markJourneyStep: stableMarkJourneyStep,
    reportJourney: stableReportJourney,
    resetJourney: stableResetJourney
  })
  return null
}

describe('useAuthOrganizationChannelManager 逻辑回归', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    cleanup()
    latestController = null
    clearAuthSession()
    setAccessToken(buildAccessToken())
    setOrganizationId('org_1')
  })

  afterEach(() => {
    cleanup()
    clearAuthSession()
    globalThis.fetch = originalFetch
  })

  it('保存 workspace 级渠道配置后应清空 apiKey 并刷新 channels/capabilities', async () => {
    const fetchMock = mock((input: string | URL, init?: RequestInit) => {
      const url = String(input)
      const method = String(init?.method || 'GET').toUpperCase()

      if (url.includes('/api/auth/me')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              user: { id: 'user_1', email: 'owner@veomuse.local' },
              organizations: [{ id: 'org_1', name: '组织一' }]
            })
          )
        )
      }

      if (url.includes('/api/workspaces/ws_1/channels/openai-compatible') && method === 'PUT') {
        const body = JSON.parse(String(init?.body || '{}'))
        expect(body.baseUrl).toBe('https://example.com')
        expect(body.apiKey).toBe(fakeApiKey)
        expect(body.extra.model).toBe('gpt-4.1')
        expect(body.extra.path).toBe('/v1/chat/completions')
        expect(body.extra.temperature).toBe(0.7)
        return Promise.resolve(new Response(JSON.stringify({ success: true })))
      }

      if (url.includes('/api/workspaces/ws_1/channels') && method === 'GET') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              configs: [
                {
                  providerId: 'openai-compatible',
                  baseUrl: 'https://example.com',
                  apiKeyMasked: '***',
                  enabled: true,
                  workspaceId: 'ws_1',
                  extra: {
                    model: 'gpt-4.1',
                    path: '/v1/chat/completions',
                    temperature: 0.7
                  }
                }
              ],
              capabilities: { models: {}, services: {}, source: 'workspace' }
            })
          )
        )
      }

      if (url.includes('/api/capabilities?workspaceId=ws_1')) {
        return Promise.resolve(
          new Response(JSON.stringify({ models: {}, services: {}, timestamp: 'workspace-now' }))
        )
      }

      throw new Error(`unexpected fetch: ${url}`)
    })
    globalThis.fetch = fetchMock as typeof fetch

    render(<AuthManagerHarness workspaceId="ws_1" />)

    await waitFor(() => {
      expect(latestController?.authProfile?.id).toBe('user_1')
    })

    await act(async () => {
      latestController?.setActiveChannelScope('workspace')
      latestController?.updateChannelForm('openai-compatible', {
        providerId: 'openai-compatible',
        baseUrl: 'https://example.com',
        apiKey: fakeApiKey,
        model: 'gpt-4.1',
        path: '/v1/chat/completions',
        temperature: '0.7',
        enabled: true,
        scope: 'workspace'
      })
    })
    await waitFor(() => {
      expect(latestController?.channelForms['openai-compatible']?.apiKey).toBe(fakeApiKey)
    })

    await act(async () => {
      await latestController?.saveChannelConfig('openai-compatible')
    })

    await waitFor(() => {
      expect(latestController?.channelForms['openai-compatible']?.apiKey).toBe('')
    })

    const workspaceRefreshCalls = fetchMock.mock.calls.filter(
      ([url, init]) =>
        String(url).includes('/api/workspaces/ws_1/channels') &&
        String((init as RequestInit | undefined)?.method || 'GET').toUpperCase() === 'GET'
    ).length
    const capabilityCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/api/capabilities?workspaceId=ws_1')
    ).length

    expect(workspaceRefreshCalls).toBe(1)
    expect(capabilityCalls).toBe(1)
  })

  it('保存组织配额时应解析表单并回填 quota/usage', async () => {
    const fetchMock = mock((input: string | URL, init?: RequestInit) => {
      const url = String(input)
      const method = String(init?.method || 'GET').toUpperCase()

      if (url.includes('/api/auth/me')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              user: { id: 'user_1', email: 'owner@veomuse.local' },
              organizations: [{ id: 'org_1', name: '组织一' }]
            })
          )
        )
      }

      if (url.includes('/api/organizations/org_1/quota') && method === 'PUT') {
        const body = JSON.parse(String(init?.body || '{}'))
        expect(body.requestLimit).toBe(11)
        expect(body.storageLimitBytes).toBe(2 * 1024 * 1024)
        expect(body.concurrencyLimit).toBe(3)
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              quota: {
                requestLimit: 11,
                storageLimitBytes: 2 * 1024 * 1024,
                concurrencyLimit: 3
              },
              usage: {
                requestCount: 4,
                storageBytes: 512,
                activeRequests: 1,
                lastRequestAt: '2026-03-08T00:00:00.000Z'
              }
            })
          )
        )
      }

      throw new Error(`unexpected fetch: ${url}`)
    })
    globalThis.fetch = fetchMock as typeof fetch

    render(<AuthManagerHarness />)

    await waitFor(() => {
      expect(latestController?.effectiveOrganizationId).toBe('org_1')
    })

    await act(async () => {
      latestController?.setQuotaForm({
        requestLimit: '11',
        storageLimitMb: '2',
        concurrencyLimit: '3'
      })
    })
    await waitFor(() => {
      expect(latestController?.quotaForm.requestLimit).toBe('11')
    })

    await act(async () => {
      await latestController?.saveOrganizationQuota()
    })

    await waitFor(() => {
      expect(latestController?.organizationQuota?.requestLimit).toBe(11)
    })
    expect(latestController?.organizationUsage?.activeRequests).toBe(1)
    expect(latestController?.quotaForm.requestLimit).toBe('11')
    expect(latestController?.quotaForm.storageLimitMb).toBe('2')
    expect(latestController?.quotaForm.concurrencyLimit).toBe('3')
  })
})
