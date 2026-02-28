import { describe, expect, it } from 'bun:test'
import { app } from '../apps/backend/src/index'

describe('模型超市 API 回归', () => {
  it('应返回模型超市列表与运行指标', async () => {
    const response = await app.handle(new Request('http://localhost/api/models/marketplace'))
    const data = await response.json() as any

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(Array.isArray(data.models)).toBe(true)
    expect(data.models.length).toBeGreaterThan(0)

    const veo = data.models.find((item: any) => item.profile?.id === 'veo-3.1')
    expect(Boolean(veo)).toBe(true)
    expect(typeof veo.metrics.successRate).toBe('number')
    expect(typeof veo.metrics.p95LatencyMs).toBe('number')
  })

  it('应支持获取模型画像并在不存在时返回 404', async () => {
    const profileResp = await app.handle(new Request('http://localhost/api/models/veo-3.1/profile'))
    const profileData = await profileResp.json() as any
    expect(profileResp.status).toBe(200)
    expect(profileData.success).toBe(true)
    expect(profileData.profile.id).toBe('veo-3.1')

    const missingResp = await app.handle(new Request('http://localhost/api/models/not-exist-model/profile'))
    const missingData = await missingResp.json() as any
    expect(missingResp.status).toBe(404)
    expect(missingData.success).toBe(false)
  })

  it('应返回策略模拟决策与候选模型', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/models/policy/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: '写实风格都市夜景追车镜头，8秒',
          budgetUsd: 0.9,
          priority: 'quality'
        })
      })
    )
    const data = await response.json() as any

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(typeof data.decision.recommendedModelId).toBe('string')
    expect(typeof data.decision.estimatedCostUsd).toBe('number')
    expect(Array.isArray(data.decision.candidates)).toBe(true)
    expect(data.decision.candidates.length).toBeGreaterThan(0)
  })
})
