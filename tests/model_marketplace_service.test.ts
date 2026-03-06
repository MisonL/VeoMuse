import { afterEach, describe, expect, it, spyOn } from 'bun:test'
import { getLocalDb } from '../apps/backend/src/services/LocalDatabaseService'
import { ModelMarketplaceService } from '../apps/backend/src/services/ModelMarketplaceService'

const countRows = (table: 'routing_executions' | 'policy_alert_events', args: [string, string]) => {
  const row = getLocalDb()
    .prepare(
      `
        SELECT COUNT(1) AS total
        FROM ${table}
        WHERE organization_id = ? AND policy_id = ?
      `
    )
    .get(...args) as { total?: number } | null

  return Number(row?.total || 0)
}

describe('ModelMarketplaceService dry-run 语义', () => {
  let metricsSpy: ReturnType<typeof spyOn> | null = null

  afterEach(() => {
    metricsSpy?.mockRestore()
    metricsSpy = null
  })

  it('simulateDecision 不应写执行记录/告警，也不应刷新聚合指标；executeDecision 应写入', () => {
    const organizationId = `org_marketplace_service_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const policy = ModelMarketplaceService.createPolicy(organizationId, {
      name: '服务层 dry-run 语义',
      priority: 'quality',
      maxBudgetUsd: 1,
      allowedModels: ['luma-dream'],
      weights: {
        quality: 0.55,
        speed: 0.15,
        cost: 0.1,
        reliability: 0.2
      }
    })

    metricsSpy = spyOn(ModelMarketplaceService, 'collectAndPersistMetrics')

    const executionArgs: [string, string] = [organizationId, policy.id]
    expect(countRows('routing_executions', executionArgs)).toBe(0)
    expect(countRows('policy_alert_events', executionArgs)).toBe(0)

    const simulateDecision = ModelMarketplaceService.simulateDecision(
      {
        prompt: '电影级夜景镜头，8秒',
        budgetUsd: 0.642,
        priority: 'quality'
      },
      policy.id,
      organizationId
    )
    expect(simulateDecision.budgetGuard?.status).toBe('warning')
    expect(metricsSpy.mock.calls.length).toBe(0)
    expect(countRows('routing_executions', executionArgs)).toBe(0)
    expect(countRows('policy_alert_events', executionArgs)).toBe(0)

    const executeDecision = ModelMarketplaceService.executeDecision(
      {
        prompt: '电影级夜景镜头，8秒',
        budgetUsd: 0.642,
        priority: 'quality'
      },
      policy.id,
      organizationId
    )
    expect(executeDecision.budgetGuard?.status).toBe('warning')
    expect(metricsSpy.mock.calls.length).toBeGreaterThan(0)
    expect(countRows('routing_executions', executionArgs)).toBe(1)
    expect(countRows('policy_alert_events', executionArgs)).toBe(1)
  })
})
