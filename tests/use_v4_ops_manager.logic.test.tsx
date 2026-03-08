import './helpers/dom-test-setup'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { clearAuthSession, setAdminToken } from '../apps/frontend/src/utils/eden'
import { useV4OpsManager } from '../apps/frontend/src/components/Editor/comparison-lab/hooks/useV4OpsManager'

type V4OpsController = ReturnType<typeof useV4OpsManager>

let latestController: V4OpsController | null = null

function V4OpsHarness() {
  latestController = useV4OpsManager({
    workspaceId: 'ws_1',
    projectId: 'project_1',
    currentActorName: 'Owner A',
    parseJsonObjectInput: (raw) => {
      try {
        return JSON.parse(raw) as Record<string, unknown>
      } catch {
        return null
      }
    },
    showToast: () => {}
  })
  return null
}

describe('useV4OpsManager 逻辑回归', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    cleanup()
    latestController = null
    clearAuthSession()
    setAdminToken('admin-token')
  })

  afterEach(() => {
    cleanup()
    clearAuthSession()
    globalThis.fetch = originalFetch
  })

  it('应在读取错误预算后回填 policy 字段，并在查询演练后回填 drill 字段', async () => {
    const fetchMock = mock((input: string | URL) => {
      const url = String(input)
      if (url.includes('/api/v4/admin/reliability/error-budget')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              policy: {
                id: 'budget_1',
                scope: 'workspace',
                targetSlo: 0.995,
                windowDays: 14,
                warningThresholdRatio: 0.6,
                alertThresholdRatio: 0.85,
                freezeDeployOnBreach: true
              },
              evaluation: {
                remainingRatio: 0.72,
                remainingMinutes: 320
              }
            })
          )
        )
      }
      if (url.includes('/api/v4/admin/reliability/drills/drill_1')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              drill: {
                id: 'drill_1',
                policyId: 'policy_1',
                environment: 'production',
                triggerType: 'manual',
                status: 'completed',
                summary: 'rollback drill summary',
                plan: { steps: ['pause', 'rollback'] },
                result: { status: 'ok' }
              }
            })
          )
        )
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    globalThis.fetch = fetchMock as typeof fetch

    render(<V4OpsHarness />)

    await act(async () => {
      await latestController?.loadV4ErrorBudget()
    })
    await waitFor(() => {
      expect(latestController?.v4ErrorBudget?.policy.id).toBe('budget_1')
    })
    expect(latestController?.v4ErrorBudgetScope).toBe('workspace')
    expect(latestController?.v4ErrorBudgetTargetSlo).toBe('0.995')
    expect(latestController?.v4ErrorBudgetWindowDays).toBe('14')
    expect(latestController?.v4ErrorBudgetWarningThresholdRatio).toBe('0.6')
    expect(latestController?.v4ErrorBudgetAlertThresholdRatio).toBe('0.85')
    expect(latestController?.v4ErrorBudgetFreezeDeployOnBreach).toBe(true)

    await act(async () => {
      latestController?.setV4RollbackDrillId('drill_1')
    })
    await act(async () => {
      await latestController?.queryV4RollbackDrill()
    })
    await waitFor(() => {
      expect(latestController?.v4RollbackDrillResult?.id).toBe('drill_1')
    })
    expect(latestController?.v4RollbackPolicyId).toBe('policy_1')
    expect(latestController?.v4RollbackEnvironment).toBe('production')
    expect(latestController?.v4RollbackSummary).toBe('rollback drill summary')
    expect(latestController?.v4RollbackPlan).toContain('pause')
    expect(latestController?.v4RollbackResult).toContain('ok')
  })

  it('应加载可靠性告警并在 ACK 后回填本地状态', async () => {
    const fetchMock = mock((input: string | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/api/v4/admin/reliability/alerts?')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              alerts: [
                {
                  id: 'alert_1',
                  level: 'warning',
                  status: 'open',
                  title: 'error budget warning',
                  message: 'warning',
                  acknowledgedAt: null
                }
              ]
            })
          )
        )
      }
      if (url.includes('/api/v4/admin/reliability/alerts/alert_1/ack')) {
        expect(init?.method).toBe('POST')
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              alert: {
                id: 'alert_1',
                level: 'warning',
                status: 'acknowledged',
                title: 'error budget warning',
                message: 'warning',
                acknowledgedAt: '2026-03-08T00:00:00.000Z'
              }
            })
          )
        )
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    globalThis.fetch = fetchMock as typeof fetch

    render(<V4OpsHarness />)

    await act(async () => {
      await latestController?.loadV4ReliabilityAlerts()
    })
    await waitFor(() => {
      expect(latestController?.v4ReliabilityAlerts).toHaveLength(1)
    })

    await act(async () => {
      await latestController?.acknowledgeV4ReliabilityAlert('alert_1')
    })
    await waitFor(() => {
      expect(latestController?.v4ReliabilityAlerts[0]?.status).toBe('acknowledged')
    })
    expect(latestController?.v4ReliabilityAlerts[0]?.acknowledgedAt).toBe(
      '2026-03-08T00:00:00.000Z'
    )
  })
})
