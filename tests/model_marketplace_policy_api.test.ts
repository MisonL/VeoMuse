import { describe, expect, it } from 'bun:test'
import { app } from '../apps/backend/src/index'
import { createAuthHeaders, createTestSession } from './helpers/auth'

describe('模型策略治理 API', () => {
  it('应支持策略创建、更新、模拟与执行记录查询', async () => {
    const session = await createTestSession('policy-api')
    const createResp = await app.handle(
      new Request('http://localhost/api/models/policies', {
        method: 'POST',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          name: '测试策略',
          description: '仅允许 veo 与 runway',
          priority: 'quality',
          maxBudgetUsd: 1.2,
          allowedModels: ['veo-3.1', 'runway-gen3'],
          weights: {
            quality: 0.6,
            speed: 0.1,
            cost: 0.1,
            reliability: 0.2
          }
        })
      })
    )
    const createData = await createResp.json() as any
    expect(createResp.status).toBe(200)
    expect(createData.success).toBe(true)
    expect(createData.policy?.id).toContain('policy_')
    expect(createData.policy.allowedModels.includes('veo-3.1')).toBe(true)

    const policyId = createData.policy.id as string

    const listResp = await app.handle(new Request('http://localhost/api/models/policies', {
      headers: createAuthHeaders(session.accessToken, { organizationId: session.organizationId })
    }))
    const listData = await listResp.json() as any
    expect(listResp.status).toBe(200)
    expect(listData.success).toBe(true)
    expect(listData.policies.some((item: any) => item.id === policyId)).toBe(true)

    const patchResp = await app.handle(
      new Request(`http://localhost/api/models/policies/${policyId}`, {
        method: 'PATCH',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          enabled: true,
          priority: 'cost',
          maxBudgetUsd: 0.8
        })
      })
    )
    const patchData = await patchResp.json() as any
    expect(patchResp.status).toBe(200)
    expect(patchData.success).toBe(true)
    expect(patchData.policy.priority).toBe('cost')
    expect(patchData.policy.maxBudgetUsd).toBe(0.8)

    const simulateResp = await app.handle(
      new Request(`http://localhost/api/models/policies/${policyId}/simulate`, {
        method: 'POST',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          prompt: '写实风格商业广告镜头，8秒',
          budgetUsd: 0.9
        })
      })
    )
    const simulateData = await simulateResp.json() as any
    expect(simulateResp.status).toBe(200)
    expect(simulateData.success).toBe(true)
    expect(simulateData.decision.policyId).toBe(policyId)
    expect(Array.isArray(simulateData.decision.candidates)).toBe(true)
    expect(Array.isArray(simulateData.decision.scoreBreakdown)).toBe(true)

    const execResp = await app.handle(
      new Request(`http://localhost/api/models/policies/${policyId}/executions?limit=10&offset=0`, {
        headers: createAuthHeaders(session.accessToken, { organizationId: session.organizationId })
      })
    )
    const execData = await execResp.json() as any
    expect(execResp.status).toBe(200)
    expect(execData.success).toBe(true)
    expect(Array.isArray(execData.executions)).toBe(true)
    expect(execData.executions.length).toBeGreaterThan(0)
    expect(execData.executions[0].policyId).toBe(policyId)
    expect(typeof execData.page?.total).toBe('number')
    expect(typeof execData.page?.hasMore).toBe('boolean')

    const invalidFallbackResp = await app.handle(
      new Request('http://localhost/api/models/policies', {
        method: 'POST',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          name: '非法回退策略',
          priority: 'quality',
          fallbackPolicyId: 'policy-not-exists'
        })
      })
    )
    const invalidFallbackData = await invalidFallbackResp.json() as any
    expect(invalidFallbackResp.status).toBe(400)
    expect(invalidFallbackData.success).toBe(false)

    const cycleAToBResp = await app.handle(
      new Request('http://localhost/api/models/policies', {
        method: 'POST',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          name: '循环-A',
          priority: 'quality'
        })
      })
    )
    const cycleAData = await cycleAToBResp.json() as any
    const cycleBResp = await app.handle(
      new Request('http://localhost/api/models/policies', {
        method: 'POST',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          name: '循环-B',
          priority: 'quality',
          fallbackPolicyId: cycleAData.policy.id
        })
      })
    )
    const cycleBData = await cycleBResp.json() as any
    expect(cycleBResp.status).toBe(200)

    const cyclePatchResp = await app.handle(
      new Request(`http://localhost/api/models/policies/${cycleAData.policy.id}`, {
        method: 'PATCH',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          fallbackPolicyId: cycleBData.policy.id
        })
      })
    )
    const cyclePatchData = await cyclePatchResp.json() as any
    expect(cyclePatchResp.status).toBe(400)
    expect(cyclePatchData.success).toBe(false)
  })

  it('应在预算接近阈值时返回 warning 预算告警', async () => {
    const session = await createTestSession('policy-budget-warning')
    const createResp = await app.handle(
      new Request('http://localhost/api/models/policies', {
        method: 'POST',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          name: '预算阈值告警策略',
          priority: 'quality',
          maxBudgetUsd: 1,
          allowedModels: ['luma-dream'],
          weights: {
            quality: 0.5,
            speed: 0.2,
            cost: 0.1,
            reliability: 0.2
          }
        })
      })
    )
    const createData = await createResp.json() as any
    expect(createResp.status).toBe(200)
    const policyId = createData.policy.id as string

    const simulateResp = await app.handle(
      new Request(`http://localhost/api/models/policies/${policyId}/simulate`, {
        method: 'POST',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          prompt: '电影级夜景镜头，8秒',
          budgetUsd: 0.642,
          priority: 'quality'
        })
      })
    )
    const simulateData = await simulateResp.json() as any
    expect(simulateResp.status).toBe(200)
    expect(simulateData.success).toBe(true)
    expect(simulateData.decision.recommendedModelId).toBe('luma-dream')
    expect(simulateData.decision.budgetGuard?.status).toBe('warning')
    expect(simulateData.decision.budgetGuard?.autoDegraded).toBe(false)
  })

  it('应在预算超限时触发自动降级并返回 degraded 状态', async () => {
    const session = await createTestSession('policy-budget-degrade')
    const createResp = await app.handle(
      new Request('http://localhost/api/models/policies', {
        method: 'POST',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          name: '预算自动降级策略',
          priority: 'quality',
          maxBudgetUsd: 1,
          allowedModels: ['sora-preview', 'pika-1.5'],
          weights: {
            quality: 0.65,
            speed: 0.1,
            cost: 0.05,
            reliability: 0.2
          }
        })
      })
    )
    const createData = await createResp.json() as any
    expect(createResp.status).toBe(200)
    const policyId = createData.policy.id as string

    const simulateResp = await app.handle(
      new Request(`http://localhost/api/models/policies/${policyId}/simulate`, {
        method: 'POST',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          prompt: '写实产品短片，8秒',
          budgetUsd: 0.5,
          priority: 'quality'
        })
      })
    )
    const simulateData = await simulateResp.json() as any
    expect(simulateResp.status).toBe(200)
    expect(simulateData.success).toBe(true)
    expect(simulateData.decision.recommendedModelId).toBe('pika-1.5')
    expect(simulateData.decision.budgetGuard?.status).toBe('degraded')
    expect(simulateData.decision.budgetGuard?.autoDegraded).toBe(true)
    expect(String(simulateData.decision.reason || '')).toContain('自动降级')
  })

  it('应在预算保护场景优先回退到 fallback 策略', async () => {
    const session = await createTestSession('policy-budget-fallback')

    const fallbackResp = await app.handle(
      new Request('http://localhost/api/models/policies', {
        method: 'POST',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          name: 'Fallback-Runway',
          priority: 'cost',
          maxBudgetUsd: 1.2,
          allowedModels: ['runway-gen3'],
          weights: {
            quality: 0.2,
            speed: 0.2,
            cost: 0.4,
            reliability: 0.2
          }
        })
      })
    )
    const fallbackData = await fallbackResp.json() as any
    expect(fallbackResp.status).toBe(200)
    const fallbackPolicyId = fallbackData.policy.id as string

    const primaryResp = await app.handle(
      new Request('http://localhost/api/models/policies', {
        method: 'POST',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          name: 'Primary-Sora',
          priority: 'quality',
          maxBudgetUsd: 1.2,
          allowedModels: ['sora-preview'],
          fallbackPolicyId: fallbackPolicyId,
          weights: {
            quality: 0.7,
            speed: 0.1,
            cost: 0.05,
            reliability: 0.15
          }
        })
      })
    )
    const primaryData = await primaryResp.json() as any
    expect(primaryResp.status).toBe(200)
    const primaryPolicyId = primaryData.policy.id as string

    const simulateResp = await app.handle(
      new Request(`http://localhost/api/models/policies/${primaryPolicyId}/simulate`, {
        method: 'POST',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          prompt: '电影质感广告镜头，8秒',
          budgetUsd: 0.8,
          priority: 'quality'
        })
      })
    )
    const simulateData = await simulateResp.json() as any
    expect(simulateResp.status).toBe(200)
    expect(simulateData.success).toBe(true)
    expect(simulateData.decision.fallbackUsed).toBe(true)
    expect(simulateData.decision.policyId).toBe(fallbackPolicyId)
    expect(simulateData.decision.recommendedModelId).toBe('runway-gen3')
    expect(String(simulateData.decision.reason || '')).toContain('预算保护回退到策略')
  })
})
