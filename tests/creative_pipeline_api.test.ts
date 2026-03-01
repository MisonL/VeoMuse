import { describe, expect, it } from 'bun:test'
import { app } from '../apps/backend/src/index'
import { createAuthHeaders, createTestSession } from './helpers/auth'

describe('创意闭环 API 回归', () => {
  it('应支持创建 run、查询 run、重生成分镜', async () => {
    const session = await createTestSession('creative-api')
    const createResp = await app.handle(
      new Request('http://localhost/api/ai/creative/run', {
        method: 'POST',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          script: '清晨的海边，主角独自前行。镜头推近，浪花反光。最终定格在人物眼神。',
          style: 'cinematic'
        })
      })
    )
    const createData = await createResp.json() as any
    expect(createResp.status).toBe(200)
    expect(createData.success).toBe(true)
    expect(createData.run?.id).toContain('run_')
    expect(Array.isArray(createData.run?.scenes)).toBe(true)
    expect(createData.run.scenes.length).toBeGreaterThan(0)

    const runId = createData.run.id as string
    const firstSceneId = createData.run.scenes[0].id as string

    const getResp = await app.handle(new Request(`http://localhost/api/ai/creative/run/${runId}`, {
      headers: createAuthHeaders(session.accessToken, { organizationId: session.organizationId })
    }))
    const getData = await getResp.json() as any
    expect(getResp.status).toBe(200)
    expect(getData.success).toBe(true)
    expect(getData.run.id).toBe(runId)

    const regenResp = await app.handle(
      new Request(`http://localhost/api/ai/creative/run/${runId}/regenerate`, {
        method: 'POST',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          sceneId: firstSceneId,
          feedback: '增强逆光层次与情绪张力'
        })
      })
    )
    const regenData = await regenResp.json() as any
    expect(regenResp.status).toBe(200)
    expect(regenData.success).toBe(true)
    const regeneratedScene = regenData.run.scenes.find((scene: any) => scene.id === firstSceneId)
    expect(regeneratedScene.status).toBe('regenerated')
    expect(regeneratedScene.videoPrompt).toContain('创意反馈')
  })

  it('查询不存在的 run 应返回 404', async () => {
    const session = await createTestSession('creative-notfound')
    const response = await app.handle(new Request('http://localhost/api/ai/creative/run/run_not_found', {
      headers: createAuthHeaders(session.accessToken, { organizationId: session.organizationId })
    }))
    const data = await response.json() as any

    expect(response.status).toBe(404)
    expect(data.success).toBe(false)
  })

  it('不同组织不应读取其他组织 run', async () => {
    const owner = await createTestSession('creative-owner')
    const outsider = await createTestSession('creative-outsider')

    const createResp = await app.handle(
      new Request('http://localhost/api/ai/creative/run', {
        method: 'POST',
        headers: createAuthHeaders(owner.accessToken, {
          organizationId: owner.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          script: '组织 A 的专属创意内容',
          style: 'cinematic'
        })
      })
    )
    const createData = await createResp.json() as any
    expect(createResp.status).toBe(200)
    const runId = String(createData.run?.id || '')
    expect(runId.startsWith('run_')).toBe(true)

    const outsiderResp = await app.handle(new Request(`http://localhost/api/ai/creative/run/${runId}`, {
      headers: createAuthHeaders(outsider.accessToken, { organizationId: outsider.organizationId })
    }))
    const outsiderData = await outsiderResp.json() as any
    expect(outsiderResp.status).toBe(404)
    expect(outsiderData.success).toBe(false)
  })
})
