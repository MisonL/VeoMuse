import { describe, expect, it } from 'bun:test'
import { app } from '../apps/backend/src/index'
import { createAuthHeaders, createTestSession } from './helpers/auth'

describe('虚拟演员 API 闭环验证', () => {
  it('应支持获取演员列表并创建新演员', async () => {
    const session = await createTestSession('actors-api')
    const listBeforeResp = await app.handle(
      new Request('http://localhost/api/ai/actors', {
        headers: createAuthHeaders(session.accessToken, { organizationId: session.organizationId })
      })
    )
    const listBefore = (await listBeforeResp.json()) as any
    expect(listBeforeResp.status).toBe(200)
    expect(Array.isArray(listBefore.actors)).toBe(true)

    const createResp = await app.handle(
      new Request('http://localhost/api/ai/actors', {
        method: 'POST',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          name: '都市女主角',
          refImage: 'https://example.com/actor.jpg'
        })
      })
    )
    const created = (await createResp.json()) as any
    expect(createResp.status).toBe(200)
    expect(created.success).toBe(true)
    expect(created.actor?.id).toContain('都市女主角')

    const listAfterResp = await app.handle(
      new Request('http://localhost/api/ai/actors', {
        headers: createAuthHeaders(session.accessToken, { organizationId: session.organizationId })
      })
    )
    const listAfter = (await listAfterResp.json()) as any
    expect(listAfter.actors.some((actor: any) => actor.id === created.actor.id)).toBe(true)
  })

  it('视频生成接口应接收演员与口型同步参数', async () => {
    const session = await createTestSession('actors-video')
    process.env.LUMA_API_URL = ''
    process.env.LUMA_API_KEY = ''

    const response = await app.handle(
      new Request('http://localhost/api/video/generate', {
        method: 'POST',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          modelId: 'luma-dream',
          text: '角色在雨夜奔跑',
          actorId: 'hero-man',
          consistencyStrength: 0.8,
          syncLip: true
        })
      })
    )
    const data = (await response.json()) as any
    expect(response.status).toBe(200)
    expect(data.provider).toBe('luma-dream')
    expect(['ok', 'not_implemented', 'error']).toContain(data.status)
  })
})
