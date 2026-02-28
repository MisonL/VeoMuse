import { describe, expect, it } from 'bun:test'
import { app } from '../apps/backend/src/index'

describe('创意闭环版本化 API', () => {
  it('应支持反馈生成新版本、版本列表与提交完成', async () => {
    const createResp = await app.handle(
      new Request('http://localhost/api/ai/creative/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: '夜雨城市街头，主角奔跑。镜头切到高空俯拍。最后定格在霓虹灯反光。',
          style: 'cinematic',
          context: {
            audience: '社媒短视频',
            targetDurationSec: 12
          }
        })
      })
    )
    const createData = await createResp.json() as any
    expect(createResp.status).toBe(200)
    expect(createData.success).toBe(true)
    expect(createData.run.version).toBe(1)

    const sourceRunId = createData.run.id as string
    const sourceSceneId = createData.run.scenes[0].id as string

    const feedbackResp = await app.handle(
      new Request(`http://localhost/api/ai/creative/run/${sourceRunId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runFeedback: '整体节奏更紧凑，增加反差光影',
          sceneFeedbacks: [
            {
              sceneId: sourceSceneId,
              feedback: '镜头推进更快，强调角色表情'
            }
          ]
        })
      })
    )
    const feedbackData = await feedbackResp.json() as any
    expect(feedbackResp.status).toBe(200)
    expect(feedbackData.success).toBe(true)
    expect(feedbackData.previousRunId).toBe(sourceRunId)
    expect(feedbackData.run.parentRunId).toBe(sourceRunId)
    expect(feedbackData.run.version).toBeGreaterThan(1)

    const latestRunId = feedbackData.run.id as string
    const changedScene = feedbackData.run.scenes.find((scene: any) => scene.lastFeedback)
    expect(Boolean(changedScene)).toBe(true)
    expect(changedScene.revision).toBeGreaterThan(1)

    const feedbackResp2 = await app.handle(
      new Request(`http://localhost/api/ai/creative/run/${latestRunId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runFeedback: '第二轮反馈：提升过场连贯性'
        })
      })
    )
    const feedbackData2 = await feedbackResp2.json() as any
    expect(feedbackResp2.status).toBe(200)
    expect(feedbackData2.success).toBe(true)
    expect(feedbackData2.run.parentRunId).toBe(latestRunId)
    expect(feedbackData2.run.version).toBeGreaterThan(feedbackData.run.version)
    const newestRunId = feedbackData2.run.id as string

    const versionsResp = await app.handle(
      new Request(`http://localhost/api/ai/creative/run/${sourceRunId}/versions`)
    )
    const versionsData = await versionsResp.json() as any
    expect(versionsResp.status).toBe(200)
    expect(versionsData.success).toBe(true)
    expect(Array.isArray(versionsData.versions)).toBe(true)
    expect(versionsData.versions.length).toBeGreaterThanOrEqual(3)
    expect(versionsData.versions[0].id).toBe(sourceRunId)
    expect(versionsData.versions[versionsData.versions.length - 1].id).toBe(newestRunId)

    const versionsFromMiddleResp = await app.handle(
      new Request(`http://localhost/api/ai/creative/run/${latestRunId}/versions`)
    )
    const versionsFromMiddleData = await versionsFromMiddleResp.json() as any
    expect(versionsFromMiddleResp.status).toBe(200)
    expect(versionsFromMiddleData.versions.length).toBe(versionsData.versions.length)

    const commitResp = await app.handle(
      new Request(`http://localhost/api/ai/creative/run/${newestRunId}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qualityScore: 0.91,
          notes: {
            reviewer: 'QA',
            decision: 'approved'
          }
        })
      })
    )
    const commitData = await commitResp.json() as any
    expect(commitResp.status).toBe(200)
    expect(commitData.success).toBe(true)
    expect(commitData.run.status).toBe('completed')
    expect(commitData.run.qualityScore).toBe(0.91)
    expect(commitData.run.notes?.decision).toBe('approved')
  })
})
