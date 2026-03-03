import { describe, expect, it } from 'bun:test'
import { app } from '../apps/backend/src/index'
import { createAuthHeaders, createTestSession } from './helpers/auth'

type PolicyCreatePatch = {
  name?: string
  description?: string
  priority?: 'quality' | 'speed' | 'cost'
  maxBudgetUsd?: number
  allowedModels?: string[]
  weights?: {
    quality?: number
    speed?: number
    cost?: number
    reliability?: number
  }
}

const createPolicy = async (
  session: Awaited<ReturnType<typeof createTestSession>>,
  patch: PolicyCreatePatch = {}
) => {
  const response = await app.handle(
    new Request('http://localhost/api/models/policies', {
      method: 'POST',
      headers: createAuthHeaders(session.accessToken, {
        organizationId: session.organizationId,
        contentTypeJson: true
      }),
      body: JSON.stringify({
        name: patch.name || '策略沙箱告警测试策略',
        description: patch.description || '用于批量模拟与告警配置接口草稿校验',
        priority: patch.priority || 'quality',
        maxBudgetUsd: patch.maxBudgetUsd ?? 1.5,
        allowedModels: patch.allowedModels || ['sora-preview', 'luma-dream', 'pika-1.5'],
        weights: patch.weights || {
          quality: 0.62,
          speed: 0.12,
          cost: 0.08,
          reliability: 0.18
        }
      })
    })
  )
  const data = (await response.json()) as any
  expect(response.status).toBe(200)
  expect(data.success).toBe(true)
  expect(typeof data.policy?.id).toBe('string')
  return data.policy.id as string
}

describe('模型策略沙箱与告警接口', () => {
  it('simulate-batch 应返回场景结果与状态统计', async () => {
    const session = await createTestSession('policy-sandbox-batch')
    const policyId = await createPolicy(session)

    const response = await app.handle(
      new Request(`http://localhost/api/models/policies/${policyId}/sandbox/simulate-batch`, {
        method: 'POST',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          scenarios: [
            {
              prompt: '写实商业广告镜头，8秒',
              budgetUsd: 1.2,
              priority: 'quality'
            },
            {
              prompt: '快节奏产品演示，8秒',
              budgetUsd: 0.5,
              priority: 'cost'
            },
            {
              prompt: '电影级叙事镜头，8秒',
              budgetUsd: 0.5,
              priority: 'quality'
            }
          ]
        })
      })
    )

    const data = (await response.json()) as any
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)

    const result = data.result || {}
    expect(Array.isArray(result.results)).toBe(true)
    expect(result.results.length).toBe(3)
    expect(result.results.every((item: any) => item?.decision?.policyId === policyId)).toBe(true)
    expect(typeof result.summary?.ok).toBe('number')
    expect(typeof result.summary?.warning).toBe('number')
    expect(typeof result.summary?.critical).toBe('number')
    expect(typeof result.summary?.degraded).toBe('number')

    const total =
      Number(result.summary.ok || 0) +
      Number(result.summary.warning || 0) +
      Number(result.summary.critical || 0) +
      Number(result.summary.degraded || 0)
    expect(total).toBe(result.results.length)
  })

  it('update/get alerts config 应支持更新并返回边界兜底后的阈值', async () => {
    const session = await createTestSession('policy-alert-config')
    const policyId = await createPolicy(session)

    const updateResp = await app.handle(
      new Request(`http://localhost/api/models/policies/${policyId}/alerts/config`, {
        method: 'PUT',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          enabled: true,
          channels: ['dashboard', 'email', 'email'],
          warningThresholdRatio: 1.3,
          criticalThresholdRatio: -0.2
        })
      })
    )

    const updateData = (await updateResp.json()) as any
    expect(updateResp.status).toBe(200)
    expect(updateData.success).toBe(true)
    const config = updateData.config as any
    expect(config.policyId).toBe(policyId)
    expect(config.enabled).toBe(true)
    expect(Array.isArray(config.channels)).toBe(true)
    expect(config.channels.includes('dashboard')).toBe(true)
    expect(config.channels.includes('email')).toBe(true)
    expect(config.warningThresholdRatio).toBeGreaterThanOrEqual(0)
    expect(config.warningThresholdRatio).toBeLessThanOrEqual(1)
    expect(config.criticalThresholdRatio).toBeGreaterThanOrEqual(0)
    expect(config.criticalThresholdRatio).toBeLessThanOrEqual(1)

    const getResp = await app.handle(
      new Request(`http://localhost/api/models/policies/${policyId}/alerts?limit=10`, {
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId
        })
      })
    )
    const getData = (await getResp.json()) as any
    expect(getResp.status).toBe(200)
    expect(getData.success).toBe(true)
    expect(getData.config?.policyId).toBe(policyId)
    expect(Array.isArray(getData.config?.channels)).toBe(true)
    expect(getData.config?.warningThresholdRatio).toBeGreaterThanOrEqual(0)
    expect(getData.config?.warningThresholdRatio).toBeLessThanOrEqual(1)
    expect(getData.config?.criticalThresholdRatio).toBeGreaterThanOrEqual(0)
    expect(getData.config?.criticalThresholdRatio).toBeLessThanOrEqual(1)
  })

  it('list alerts 应返回 warning/critical/degraded 事件', async () => {
    const session = await createTestSession('policy-alert-events')

    const policyWarning = await createPolicy(session, {
      name: '告警-警告',
      allowedModels: ['sora-preview']
    })
    const policyCritical = await createPolicy(session, {
      name: '告警-严重',
      allowedModels: ['sora-preview']
    })
    const policyDegraded = await createPolicy(session, {
      name: '告警-降级',
      allowedModels: ['sora-preview', 'pika-1.5']
    })

    const simulateCases = [
      {
        policyId: policyWarning,
        prompt: '高质量广告镜头，8秒',
        budgetUsd: 1.2,
        priority: 'quality',
        expectedStatus: 'warning'
      },
      {
        policyId: policyCritical,
        prompt: '超紧预算镜头，8秒',
        budgetUsd: 0.5,
        priority: 'quality',
        expectedStatus: 'critical'
      },
      {
        policyId: policyDegraded,
        prompt: '电影级风格镜头，8秒',
        budgetUsd: 0.5,
        priority: 'quality',
        expectedStatus: 'degraded'
      }
    ] as const

    for (const item of simulateCases) {
      const resp = await app.handle(
        new Request(`http://localhost/api/models/policies/${item.policyId}/simulate`, {
          method: 'POST',
          headers: createAuthHeaders(session.accessToken, {
            organizationId: session.organizationId,
            contentTypeJson: true
          }),
          body: JSON.stringify({
            prompt: item.prompt,
            budgetUsd: item.budgetUsd,
            priority: item.priority
          })
        })
      )
      const data = (await resp.json()) as any
      expect(resp.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.decision?.budgetGuard?.status).toBe(item.expectedStatus)
    }

    for (const item of simulateCases) {
      const listResp = await app.handle(
        new Request(`http://localhost/api/models/policies/${item.policyId}/alerts?limit=20`, {
          headers: createAuthHeaders(session.accessToken, {
            organizationId: session.organizationId
          })
        })
      )
      const listData = (await listResp.json()) as any
      expect(listResp.status).toBe(200)
      expect(listData.success).toBe(true)

      const alerts = Array.isArray(listData.alerts) ? listData.alerts : []
      expect(alerts.length).toBeGreaterThan(0)

      const statuses = new Set(alerts.map((entry: any) => String(entry?.status || '')))
      expect(statuses.has(item.expectedStatus)).toBe(true)
    }
  })
})
