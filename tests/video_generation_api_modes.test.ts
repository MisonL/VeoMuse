import { describe, expect, it } from 'bun:test'
import { app } from '../apps/backend/src/index'
import { callApi, createAuthHeaders, createTestSession } from './helpers/auth'

const createWorkspaceForSession = async (session: {
  accessToken: string
  organizationId: string
}) => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const created = await callApi('/api/workspaces', {
    method: 'POST',
    headers: createAuthHeaders(session.accessToken, {
      organizationId: session.organizationId,
      contentTypeJson: true
    }),
    body: JSON.stringify({
      name: `video-generation-${stamp}`,
      organizationId: session.organizationId
    })
  })
  expect(created.response.status).toBe(200)
  expect(created.data.success).toBe(true)
  return String(created.data.workspace?.id || '')
}

const addOrganizationMember = async (
  owner: {
    accessToken: string
    organizationId: string
  },
  email: string,
  role: 'owner' | 'admin' | 'member' = 'member'
) => {
  const response = await app.handle(
    new Request(`http://localhost/api/organizations/${owner.organizationId}/members`, {
      method: 'POST',
      headers: createAuthHeaders(owner.accessToken, {
        organizationId: owner.organizationId,
        contentTypeJson: true
      }),
      body: JSON.stringify({
        email,
        role
      })
    })
  )
  expect(response.status).toBe(200)
}

const inviteAndAcceptWorkspaceMember = async (
  owner: {
    accessToken: string
    organizationId: string
  },
  guestAccessToken: string,
  workspaceId: string,
  role: 'viewer' | 'editor' = 'viewer'
) => {
  const inviteResp = await app.handle(
    new Request(`http://localhost/api/workspaces/${workspaceId}/invites`, {
      method: 'POST',
      headers: createAuthHeaders(owner.accessToken, {
        organizationId: owner.organizationId,
        contentTypeJson: true
      }),
      body: JSON.stringify({
        role,
        inviter: 'owner'
      })
    })
  )
  const inviteData = (await inviteResp.json()) as any
  expect(inviteResp.status).toBe(200)
  expect(inviteData.success).toBe(true)
  const code = String(inviteData.invite?.code || '')
  expect(code.length).toBeGreaterThan(0)

  const acceptResp = await app.handle(
    new Request(`http://localhost/api/workspaces/invites/${code}/accept`, {
      method: 'POST',
      headers: createAuthHeaders(guestAccessToken, {
        organizationId: owner.organizationId,
        contentTypeJson: true
      }),
      body: JSON.stringify({})
    })
  )
  const acceptData = (await acceptResp.json()) as any
  expect(acceptResp.status).toBe(200)
  expect(acceptData.success).toBe(true)
}

describe('视频生成任务 API（多模式）', () => {
  it('应支持四种模式创建任务并可查询详情与列表', async () => {
    const session = await createTestSession('video-generations')
    const workspaceId = await createWorkspaceForSession(session)
    const headers = createAuthHeaders(session.accessToken, {
      organizationId: session.organizationId,
      contentTypeJson: true
    })

    const payloads = [
      {
        generationMode: 'text_to_video',
        prompt: '城市夜景延时摄影，镜头平稳推进'
      },
      {
        generationMode: 'image_to_video',
        prompt: '让画面中的云层缓慢流动',
        inputs: {
          image: {
            sourceType: 'url',
            value: 'https://example.com/ref/image-seed.jpg'
          }
        }
      },
      {
        generationMode: 'first_last_frame_transition',
        prompt: '从晨光过渡到夜景',
        workspaceId,
        inputs: {
          firstFrame: {
            sourceType: 'url',
            value: 'https://example.com/ref/frame-start.jpg'
          },
          lastFrame: {
            sourceType: 'objectKey',
            value: `${workspaceId}/project/frame-end.jpg`
          }
        }
      },
      {
        generationMode: 'video_extend',
        prompt: '保持镜头语言并延长 3 秒',
        workspaceId,
        inputs: {
          video: {
            sourceType: 'objectKey',
            value: `${workspaceId}/project/input-video.mp4`
          }
        }
      }
    ]

    const createdJobIds: string[] = []
    for (const payload of payloads) {
      const response = await app.handle(
        new Request('http://localhost/api/video/generations', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            modelId: 'luma-dream',
            ...payload
          })
        })
      )
      const data = (await response.json()) as any
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.job.generationMode).toBe(payload.generationMode)
      expect(typeof data.job.id).toBe('string')
      expect(['submitted', 'failed', 'queued']).toContain(data.job.status)
      expect(['ok', 'degraded', 'not_implemented', 'error']).toContain(data.providerResult?.status)
      createdJobIds.push(String(data.job.id))

      const detail = await app.handle(
        new Request(`http://localhost/api/video/generations/${encodeURIComponent(data.job.id)}`, {
          headers: createAuthHeaders(session.accessToken, {
            organizationId: session.organizationId
          })
        })
      )
      const detailData = (await detail.json()) as any
      expect(detail.status).toBe(200)
      expect(detailData.success).toBe(true)
      expect(detailData.job.id).toBe(data.job.id)
    }

    const list = await app.handle(
      new Request('http://localhost/api/video/generations?limit=2', {
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId
        })
      })
    )
    const listData = (await list.json()) as any
    expect(list.status).toBe(200)
    expect(listData.success).toBe(true)
    expect(Array.isArray(listData.jobs)).toBe(true)
    expect(listData.jobs.length).toBeGreaterThan(0)
    expect(listData.jobs.some((job: any) => createdJobIds.includes(String(job.id)))).toBe(true)
    expect(typeof listData.page?.limit).toBe('number')
    expect(typeof listData.page?.hasMore).toBe('boolean')
  })

  it('video_extend 缺少输入视频时应返回 400', async () => {
    const session = await createTestSession('video-generations-invalid')
    const response = await app.handle(
      new Request('http://localhost/api/video/generations', {
        method: 'POST',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          modelId: 'luma-dream',
          generationMode: 'video_extend',
          prompt: '继续延展画面'
        })
      })
    )
    const data = (await response.json()) as any
    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(String(data.error || '')).toContain('inputs.video')
  })

  it('objectKey 输入应被标准化为可访问 URL 并落库', async () => {
    const session = await createTestSession('video-generations-objectkey')
    const workspaceId = await createWorkspaceForSession(session)
    const response = await app.handle(
      new Request('http://localhost/api/video/generations', {
        method: 'POST',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          modelId: 'luma-dream',
          generationMode: 'image_to_video',
          workspaceId,
          prompt: '让这张图形成短视频',
          inputs: {
            image: {
              sourceType: 'objectKey',
              value: `${workspaceId}/project/reference-image.png`
            }
          }
        })
      })
    )
    const data = (await response.json()) as any
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.job.request.inputs.image.sourceType).toBe('objectKey')
    expect(data.job.request.inputs.image.value).toBe(`${workspaceId}/project/reference-image.png`)
    expect(data.job.request.inputs.image.resolvedUrl).toContain(
      `/uploads/workspace/${workspaceId}/project/reference-image.png`
    )
  })

  it('仅在请求头传 x-workspace-id 时也应正确持久化 workspaceId', async () => {
    const session = await createTestSession('video-generations-header-workspace')
    const workspaceId = await createWorkspaceForSession(session)
    const response = await app.handle(
      new Request('http://localhost/api/video/generations', {
        method: 'POST',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true,
          extra: {
            'x-workspace-id': workspaceId
          }
        }),
        body: JSON.stringify({
          modelId: 'luma-dream',
          generationMode: 'image_to_video',
          prompt: '从图像生成短视频',
          inputs: {
            image: {
              sourceType: 'objectKey',
              value: `${workspaceId}/project/header-only.png`
            }
          }
        })
      })
    )
    const data = (await response.json()) as any
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.job.workspaceId).toBe(workspaceId)
    expect(data.job.request.inputs.image.value).toBe(`${workspaceId}/project/header-only.png`)
  })

  it('列表查询在未指定 workspaceId 时应过滤无权限工作区任务', async () => {
    const owner = await createTestSession('video-generations-owner')
    const viewer = await createTestSession('video-generations-viewer')
    const workspaceA = await createWorkspaceForSession(owner)
    const workspaceB = await createWorkspaceForSession(owner)

    await addOrganizationMember(owner, viewer.email, 'member')
    await inviteAndAcceptWorkspaceMember(owner, viewer.accessToken, workspaceA, 'viewer')

    const createJob = async (workspaceId: string, prompt: string) => {
      const response = await app.handle(
        new Request('http://localhost/api/video/generations', {
          method: 'POST',
          headers: createAuthHeaders(owner.accessToken, {
            organizationId: owner.organizationId,
            contentTypeJson: true
          }),
          body: JSON.stringify({
            modelId: 'luma-dream',
            workspaceId,
            generationMode: 'text_to_video',
            prompt
          })
        })
      )
      const data = (await response.json()) as any
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      return String(data.job.id || '')
    }

    const jobA = await createJob(workspaceA, 'workspace-a-visible')
    const jobB = await createJob(workspaceB, 'workspace-b-hidden')
    expect(jobA.length).toBeGreaterThan(0)
    expect(jobB.length).toBeGreaterThan(0)

    const listResp = await app.handle(
      new Request('http://localhost/api/video/generations?limit=50', {
        headers: createAuthHeaders(viewer.accessToken, {
          organizationId: owner.organizationId
        })
      })
    )
    const listData = (await listResp.json()) as any
    expect(listResp.status).toBe(200)
    expect(listData.success).toBe(true)
    const ids = new Set((listData.jobs || []).map((job: any) => String(job.id)))
    expect(ids.has(jobA)).toBe(true)
    expect(ids.has(jobB)).toBe(false)
  })

  it('旧接口参数错误应返回 400 而非 500', async () => {
    const session = await createTestSession('video-generations-legacy-400')
    const response = await app.handle(
      new Request('http://localhost/api/video/generate', {
        method: 'POST',
        headers: createAuthHeaders(session.accessToken, {
          organizationId: session.organizationId,
          contentTypeJson: true
        }),
        body: JSON.stringify({
          modelId: 'luma-dream',
          text: '   '
        })
      })
    )
    const data = (await response.json()) as any
    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(String(data.error || '')).toContain('text_to_video')
  })
})
