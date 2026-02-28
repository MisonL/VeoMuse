import { describe, expect, it } from 'bun:test'
import { app } from '../apps/backend/src/index'

describe('创意闭环 API 回归', () => {
  it('应支持创建 run、查询 run、重生成分镜', async () => {
    const createResp = await app.handle(
      new Request('http://localhost/api/ai/creative/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

    const getResp = await app.handle(new Request(`http://localhost/api/ai/creative/run/${runId}`))
    const getData = await getResp.json() as any
    expect(getResp.status).toBe(200)
    expect(getData.success).toBe(true)
    expect(getData.run.id).toBe(runId)

    const regenResp = await app.handle(
      new Request(`http://localhost/api/ai/creative/run/${runId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    const response = await app.handle(new Request('http://localhost/api/ai/creative/run/run_not_found'))
    const data = await response.json() as any

    expect(response.status).toBe(404)
    expect(data.success).toBe(false)
  })
})
