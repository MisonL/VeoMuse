interface SessionPayload {
  accessToken: string
  refreshToken: string
  user: {
    id: string
    email: string
  }
}

interface RegisterResponse {
  success: boolean
  session: SessionPayload
  organizations: Array<{ id: string; name: string }>
}

interface WorkspaceResponse {
  success: boolean
  workspace: { id: string; organizationId?: string }
  defaultProject: { id: string }
}

interface StepResult {
  name: string
  ok: boolean
  durationMs: number
  detail?: string
}

const parseIntSafe = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const apiBase = (process.env.API_BASE_URL || 'http://127.0.0.1:18081').trim().replace(/\/+$/, '')
const mockBindHost = (process.env.MOCK_PROVIDER_BIND_HOST || '127.0.0.1').trim()
const mockPort = parseIntSafe(process.env.MOCK_PROVIDER_PORT, 39091)
const mockProviderBaseUrl = (
  process.env.MOCK_PROVIDER_BASE_URL ||
  `http://host.docker.internal:${mockPort}`
).trim().replace(/\/+$/, '')
const mockApiKey = 'mock-key'

const jsonResponse = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'Content-Type': 'application/json' }
})

const startMockProvider = () => Bun.serve({
  hostname: mockBindHost,
  port: mockPort,
  reusePort: true,
  fetch(req) {
    const url = new URL(req.url)
    const path = url.pathname

    if (path.endsWith('/veo-3.1-generate-001:predictLongRunning')) {
      return jsonResponse({
        name: `gemini-op-${Date.now()}`
      })
    }

    if (path.endsWith('/generate')) {
      return jsonResponse({
        operationName: `gen-op-${Date.now()}`,
        message: 'mock-generate-ok'
      })
    }

    if (path.endsWith('/v1/chat/completions')) {
      return jsonResponse({
        id: `openai-compatible-${Date.now()}`,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'openai-compatible-mock-ok'
            }
          }
        ]
      })
    }

    if (path.endsWith('/synthesize')) {
      return jsonResponse({
        audioBase64: Buffer.from('mock-audio').toString('base64')
      })
    }

    if (path.endsWith('/morph')) {
      return jsonResponse({
        morphedAudioUrl: 'https://mock.local/audio/morphed.mp3'
      })
    }

    if (path.endsWith('/reconstruct')) {
      return jsonResponse({
        nerfDataUrl: 'https://mock.local/nerf/data',
        meshUrl: 'https://mock.local/mesh/output.glb',
        totalVoxels: 2048
      })
    }

    if (path.endsWith('/analyze')) {
      return jsonResponse({
        bpm: 128,
        beats: [0.12, 0.58, 1.04, 1.51]
      })
    }

    if (path.endsWith('/sync')) {
      return jsonResponse({
        syncedVideoUrl: 'https://mock.local/video/synced.mp4',
        operationId: `sync-${Date.now()}`
      })
    }

    if (path.endsWith('/style-transfer')) {
      return jsonResponse({
        operationId: `style-${Date.now()}`,
        message: 'mock-style-ok'
      })
    }

    if (path.endsWith('/apply')) {
      return jsonResponse({
        operationId: `apply-${Date.now()}`
      })
    }

    return jsonResponse({
      success: false,
      error: `Unknown mock path: ${path}`
    }, 404)
  }
})

const requestJson = async <T>(
  path: string,
  init?: RequestInit,
  headers?: Record<string, string>
): Promise<T> => {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      ...(headers || {})
    }
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(`${path} -> HTTP ${response.status}: ${(payload as any)?.error || 'unknown'}`)
  }
  return payload as T
}

const timed = async (name: string, fn: () => Promise<void>, steps: StepResult[]) => {
  const started = performance.now()
  try {
    await fn()
    steps.push({
      name,
      ok: true,
      durationMs: Number((performance.now() - started).toFixed(2))
    })
  } catch (error: any) {
    steps.push({
      name,
      ok: false,
      durationMs: Number((performance.now() - started).toFixed(2)),
      detail: error?.message || String(error)
    })
  }
}

const run = async () => {
  const steps: StepResult[] = []
  const server = startMockProvider()
  const stamp = Date.now()
  const email = `e2e-${stamp}@example.com`
  const password = 'Passw0rd!'
  let orgId = ''
  let workspaceId = ''
  let projectId = ''
  let authHeaders: Record<string, string> = {}

  try {
    await timed('注册并创建组织', async () => {
      const data = await requestJson<RegisterResponse>('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          organizationName: `E2E-Org-${stamp}`
        })
      })
      if (!data.success || !data.session?.accessToken || !data.organizations?.[0]?.id) {
        throw new Error('register payload invalid')
      }
      orgId = data.organizations[0].id
      authHeaders = {
        Authorization: `Bearer ${data.session.accessToken}`,
        'x-organization-id': orgId,
        'Content-Type': 'application/json'
      }
    }, steps)

    await timed('创建工作区', async () => {
      const data = await requestJson<WorkspaceResponse>('/api/workspaces', {
        method: 'POST',
        body: JSON.stringify({
          name: `E2E-Workspace-${stamp}`,
          ownerName: `Owner-${stamp}`,
          organizationId: orgId
        })
      }, authHeaders)
      if (!data.success || !data.workspace?.id || !data.defaultProject?.id) {
        throw new Error('workspace payload invalid')
      }
      workspaceId = data.workspace.id
      projectId = data.defaultProject.id
    }, steps)

    const providers = [
      'veo-3.1',
      'kling-v1',
      'sora-preview',
      'luma-dream',
      'runway-gen3',
      'pika-1.5',
      'openai-compatible',
      'tts',
      'voiceMorph',
      'spatialRender',
      'vfx',
      'lipSync',
      'audioAnalysis',
      'relighting',
      'styleTransfer'
    ]

    for (const providerId of providers) {
      await timed(`配置渠道:${providerId}`, async () => {
        const data = await requestJson<{ success: boolean }>(`/api/organizations/${orgId}/channels/${providerId}`, {
          method: 'PUT',
          body: JSON.stringify({
            baseUrl: mockProviderBaseUrl,
            apiKey: mockApiKey,
            enabled: true,
            extra: providerId === 'openai-compatible'
              ? {
                model: 'mock-openai-compatible-model',
                path: '/v1/chat/completions',
                temperature: 0.6
              }
              : undefined
          })
        }, authHeaders)
        if (!data.success) {
          throw new Error(`upsert failed for ${providerId}`)
        }
      }, steps)
    }

    const modelCases = ['veo-3.1', 'kling-v1', 'sora-preview', 'luma-dream', 'runway-gen3', 'pika-1.5', 'openai-compatible']
    for (const modelId of modelCases) {
      await timed(`视频生成:${modelId}`, async () => {
        const data = await requestJson<any>('/api/video/generate', {
          method: 'POST',
          body: JSON.stringify({
            modelId,
            text: `mock generate ${modelId}`,
            workspaceId
          })
        }, authHeaders)
        if (data.status !== 'ok' || !data.success) {
          throw new Error(`unexpected generate status=${data.status}`)
        }
      }, steps)
    }

    const aiCases: Array<{ name: string; path: string; body: Record<string, unknown>; expected: (data: any) => boolean }> = [
      {
        name: 'AI-TTS',
        path: '/api/ai/tts',
        body: { text: '你好，VeoMuse', workspaceId },
        expected: (data) => data.status === 'ok' && Boolean(data.audioUrl)
      },
      {
        name: 'AI-VoiceMorph',
        path: '/api/ai/voice-morph',
        body: { audioUrl: 'https://mock.local/a.mp3', targetVoiceId: 'voice-1', workspaceId },
        expected: (data) => data.status === 'ok' && Boolean(data.morphedAudioUrl)
      },
      {
        name: 'AI-AudioAnalysis',
        path: '/api/ai/analyze-audio',
        body: { audioUrl: 'https://mock.local/a.mp3', workspaceId },
        expected: (data) => data.status === 'ok' && Number(data.bpm) > 0
      },
      {
        name: 'AI-Spatial',
        path: '/api/ai/spatial/render',
        body: { clipId: projectId, quality: 'high', workspaceId },
        expected: (data) => data.status === 'ok' && Boolean(data.meshUrl)
      },
      {
        name: 'AI-VFX',
        path: '/api/ai/vfx/apply',
        body: { clipId: projectId, vfxType: 'glow', intensity: 0.8, workspaceId },
        expected: (data) => data.status === 'ok' && Boolean(data.operationId)
      },
      {
        name: 'AI-LipSync',
        path: '/api/ai/sync-lip',
        body: { videoUrl: 'https://mock.local/v.mp4', audioUrl: 'https://mock.local/a.mp3', workspaceId },
        expected: (data) => data.status === 'ok' && Boolean(data.syncedVideoUrl)
      },
      {
        name: 'AI-Relighting',
        path: '/api/ai/relighting/apply',
        body: { clipId: projectId, style: 'cinematic', workspaceId },
        expected: (data) => data.status === 'ok' && Boolean(data.operationId)
      },
      {
        name: 'AI-StyleTransfer',
        path: '/api/ai/alchemy/style-transfer',
        body: { clipId: projectId, style: 'film', workspaceId },
        expected: (data) => data.status === 'ok' && Boolean(data.operationId)
      }
    ]

    for (const item of aiCases) {
      await timed(item.name, async () => {
        const data = await requestJson<any>(item.path, {
          method: 'POST',
          body: JSON.stringify(item.body)
        }, authHeaders)
        if (!item.expected(data)) {
          throw new Error(`unexpected payload for ${item.name}`)
        }
      }, steps)
    }
  } finally {
    server.stop(true)
  }

  const failed = steps.filter((step) => !step.ok)
  const summary = {
    timestamp: new Date().toISOString(),
    apiBase,
    mockProviderBaseUrl,
    mockBindHost: `${mockBindHost}:${mockPort}`,
    total: steps.length,
    passed: steps.length - failed.length,
    failed: failed.length,
    steps
  }

  console.log('--- PROVIDER CHAIN E2E SUMMARY ---')
  console.log(JSON.stringify(summary, null, 2))

  if (failed.length > 0) {
    process.exit(2)
  }
}

run().catch((error) => {
  console.error('[provider-chain-e2e] failed:', error?.message || error)
  process.exit(1)
})
