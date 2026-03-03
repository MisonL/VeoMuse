import { describe, it, expect, beforeAll } from 'bun:test'
import { app } from '../apps/backend/src/index'
import { createAuthHeaders, createTestSession } from './helpers/auth'

describe('Video Composition API 连通性验证', () => {
  let session: { accessToken: string; organizationId: string }

  beforeAll(() => {
    process.env.NODE_ENV = 'test'
  })

  beforeAll(async () => {
    const created = await createTestSession('compose-api')
    session = {
      accessToken: created.accessToken,
      organizationId: created.organizationId
    }
  })

  it('未登录导出应返回 401', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/video/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timelineData: {
            tracks: [{ id: 'track-1', clips: [{ id: 'c1', start: 0, end: 3, src: 'input1.mp4' }] }]
          }
        })
      })
    )
    const data = (await response.json()) as any
    expect(response.status).toBe(401)
    expect(data.success).toBe(false)
  })

  it('应能正确处理视频合成请求', async () => {
    const mockTimelineData = {
      tracks: [{ id: 'track-1', clips: [{ id: 'c1', start: 0, end: 5, src: 'input1.mp4' }] }]
    }

    const response = await app.handle(
      new Request('http://localhost/api/video/compose', {
        method: 'POST',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({ timelineData: mockTimelineData })
      })
    )

    const data = (await response.json()) as any
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('应支持空间视频导出参数', async () => {
    const mockTimelineData = {
      tracks: [{ id: 'track-1', clips: [{ id: 'c1', start: 0, end: 5, src: 'input1.mp4' }] }],
      exportConfig: { quality: 'spatial-vr' }
    }

    const response = await app.handle(
      new Request('http://localhost/api/video/compose', {
        method: 'POST',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({ timelineData: mockTimelineData })
      })
    )

    const data = (await response.json()) as any
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.outputPath).toContain('.mp4')
  })

  it('空时间轴导出应返回校验错误', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/video/compose', {
        method: 'POST',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({ timelineData: { tracks: [] } })
      })
    )

    const data = (await response.json()) as any
    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.code).toBe('VALIDATION')
  })
})
