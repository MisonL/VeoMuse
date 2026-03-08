import './helpers/dom-test-setup'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { clearAuthSession, setAccessToken } from '../apps/frontend/src/utils/eden'
import { useWorkspaceCollaborationManager } from '../apps/frontend/src/components/Editor/comparison-lab/hooks/useWorkspaceCollaborationManager'

type WorkspaceManagerController = ReturnType<typeof useWorkspaceCollaborationManager>

let latestController: WorkspaceManagerController | null = null

class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  static instances: MockWebSocket[] = []

  readyState = MockWebSocket.CONNECTING
  sent: string[] = []
  closed = false
  onopen: (() => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor(
    public url: string,
    public protocols?: string | string[]
  ) {
    MockWebSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.closed = true
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.()
  }

  emitOpen() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.()
  }

  emitClose() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.()
  }
}

const buildAccessToken = () => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + 3600,
      sub: 'workspace-test'
    })
  )
  return `${header}.${payload}.signature`
}

function WorkspaceManagerHarness(props: {
  workspaceId: string
  projectId: string
  memberName?: string
  collabRole?: 'owner' | 'editor' | 'viewer'
}) {
  latestController = useWorkspaceCollaborationManager({
    authProfile: null,
    workspaceName: '协作空间',
    workspaceOwner: 'Owner A',
    workspaceId: props.workspaceId,
    setWorkspaceId: () => {},
    projectId: props.projectId,
    setProjectId: () => {},
    memberName: props.memberName || 'Editor A',
    setMemberName: () => {},
    collabRole: props.collabRole || 'editor',
    setCollabRole: () => {},
    inviteRole: 'editor',
    inviteCode: '',
    setInviteCode: () => {},
    uploadFileName: 'demo.mp4',
    effectiveOrganizationId: 'org_test_1',
    selectOrganization: () => {},
    labMode: 'collab',
    openChannelPanel: () => {},
    showToast: () => {},
    markJourneyStep: () => {},
    reportJourney: async () => true
  })
  return null
}

describe('useWorkspaceCollaborationManager 逻辑回归', () => {
  const originalFetch = globalThis.fetch
  const originalWebSocket = globalThis.WebSocket

  beforeEach(() => {
    cleanup()
    latestController = null
    clearAuthSession()
    setAccessToken(buildAccessToken())
    MockWebSocket.instances = []
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket
  })

  afterEach(() => {
    cleanup()
    clearAuthSession()
    globalThis.fetch = originalFetch
    globalThis.WebSocket = originalWebSocket
  })

  it('workspace 变化后应重绑实时通道，并忽略旧 socket 的晚到 onclose', async () => {
    const view = render(<WorkspaceManagerHarness workspaceId="ws_a" projectId="project_a" />)

    await act(async () => {
      await latestController?.connectWs()
    })
    expect(MockWebSocket.instances).toHaveLength(1)
    expect(MockWebSocket.instances[0]?.url).toContain('/ws/collab/ws_a?')

    await act(async () => {
      MockWebSocket.instances[0]?.emitOpen()
    })
    await waitFor(() => {
      expect(latestController?.isWsConnected).toBe(true)
    })

    view.rerender(<WorkspaceManagerHarness workspaceId="ws_b" projectId="project_b" />)

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(2)
    })
    expect(MockWebSocket.instances[0]?.closed).toBe(true)
    expect(MockWebSocket.instances[1]?.url).toContain('/ws/collab/ws_b?')

    await act(async () => {
      MockWebSocket.instances[1]?.emitOpen()
      MockWebSocket.instances[0]?.emitClose()
    })

    await waitFor(() => {
      expect(latestController?.isWsConnected).toBe(true)
    })

    await act(async () => {
      latestController?.sendCollabEvent('project.patch')
    })

    expect(MockWebSocket.instances[1]?.sent.some((item) => item.includes('project.patch'))).toBe(
      true
    )
  })

  it('refreshWorkspaceState 在显式清空 projectId 时不应继续读取旧项目快照', async () => {
    const fetchMock = mock((input: string | URL) => {
      const url = String(input)
      if (url.includes('/api/workspaces/ws_a/presence')) {
        return Promise.resolve(new Response(JSON.stringify({ success: true, members: [] })))
      }
      if (url.includes('/api/workspaces/ws_a/collab/events')) {
        return Promise.resolve(new Response(JSON.stringify({ success: true, events: [] })))
      }
      if (url.includes('/api/workspaces/ws_a/invites')) {
        return Promise.resolve(new Response(JSON.stringify({ success: true, invites: [] })))
      }
      if (url.includes('/api/workspaces/ws_b/presence')) {
        return Promise.resolve(new Response(JSON.stringify({ success: true, members: [] })))
      }
      if (url.includes('/api/workspaces/ws_b/collab/events')) {
        return Promise.resolve(new Response(JSON.stringify({ success: true, events: [] })))
      }
      if (url.includes('/api/workspaces/ws_b/invites')) {
        return Promise.resolve(new Response(JSON.stringify({ success: true, invites: [] })))
      }
      if (url.includes('/api/projects/project_old/snapshots')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              snapshots: [{ id: 'snap_1', actorName: 'Alice', createdAt: new Date().toISOString() }]
            })
          )
        )
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    globalThis.fetch = fetchMock as typeof fetch

    render(<WorkspaceManagerHarness workspaceId="ws_a" projectId="project_old" />)

    await act(async () => {
      await latestController?.refreshWorkspaceState()
    })
    await waitFor(() => {
      expect(latestController?.snapshots).toHaveLength(1)
    })

    const snapshotCallsBefore = fetchMock.mock.calls.filter((args) =>
      String(args[0]).includes('/api/projects/project_old/snapshots')
    ).length

    await act(async () => {
      await latestController?.refreshWorkspaceState('ws_b', null)
    })

    await waitFor(() => {
      expect(latestController?.snapshots).toHaveLength(0)
    })

    const snapshotCallsAfter = fetchMock.mock.calls.filter((args) =>
      String(args[0]).includes('/api/projects/project_old/snapshots')
    ).length
    expect(snapshotCallsAfter).toBe(snapshotCallsBefore)
  })

  it('acceptInvite 重复触发时应只提交一次请求', async () => {
    const setWorkspaceId = mock(() => {})
    const setProjectId = mock(() => {})
    const setCollabRole = mock(() => {})
    const selectOrganization = mock(() => {})
    let controller: WorkspaceManagerController | null = null

    const fetchMock = mock((input: string | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/api/workspaces/invites/INVITE-1/accept')) {
        return new Promise<Response>((resolve) => {
          setTimeout(() => {
            resolve(
              new Response(
                JSON.stringify({
                  success: true,
                  member: { role: 'editor' },
                  workspace: { id: 'ws_joined', organizationId: 'org_test_2' },
                  defaultProject: { id: 'project_joined' }
                })
              )
            )
          }, 20)
        })
      }
      if (url.includes('/api/workspaces/ws_joined/presence')) {
        return Promise.resolve(new Response(JSON.stringify({ success: true, members: [] })))
      }
      if (url.includes('/api/workspaces/ws_joined/collab/events')) {
        return Promise.resolve(new Response(JSON.stringify({ success: true, events: [] })))
      }
      if (url.includes('/api/workspaces/ws_joined/invites')) {
        return Promise.resolve(new Response(JSON.stringify({ success: true, invites: [] })))
      }
      if (url.includes('/api/projects/project_joined/snapshots')) {
        return Promise.resolve(new Response(JSON.stringify({ success: true, snapshots: [] })))
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    globalThis.fetch = fetchMock as typeof fetch

    const Harness = () => {
      controller = useWorkspaceCollaborationManager({
        authProfile: null,
        workspaceName: '协作空间',
        workspaceOwner: 'Owner A',
        workspaceId: '',
        setWorkspaceId,
        projectId: '',
        setProjectId,
        memberName: 'Editor A',
        setMemberName: () => {},
        collabRole: 'editor',
        setCollabRole,
        inviteRole: 'editor',
        inviteCode: 'INVITE-1',
        setInviteCode: () => {},
        uploadFileName: 'demo.mp4',
        effectiveOrganizationId: 'org_test_1',
        selectOrganization,
        labMode: 'collab',
        openChannelPanel: () => {},
        showToast: () => {},
        markJourneyStep: () => {},
        reportJourney: async () => true
      })
      return null
    }

    render(<Harness />)

    await act(async () => {
      controller?.acceptInvite()
      controller?.acceptInvite()
    })

    await waitFor(() => {
      const acceptCalls = fetchMock.mock.calls.filter(([url]) =>
        String(url).includes('/api/workspaces/invites/INVITE-1/accept')
      )
      expect(acceptCalls.length).toBe(1)
    })
    await waitFor(() => {
      expect(setWorkspaceId).toHaveBeenCalledWith('ws_joined')
      expect(setProjectId).toHaveBeenCalledWith('project_joined')
      expect(setCollabRole).toHaveBeenCalledWith('editor')
      expect(selectOrganization).toHaveBeenCalledWith('org_test_2')
    })
  })

  it('uploadToken 在 workspace 或文件上下文变化后应立即失效', async () => {
    const fetchMock = mock((input: string | URL) => {
      const url = String(input)
      if (url.includes('/api/storage/upload-token')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              token: { uploadUrl: '/upload/demo', objectKey: 'object-key-1' }
            })
          )
        )
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    globalThis.fetch = fetchMock as typeof fetch

    const view = render(<WorkspaceManagerHarness workspaceId="ws_a" projectId="project_a" />)

    await act(async () => {
      await latestController?.requestUploadToken()
    })
    await waitFor(() => {
      expect(latestController?.uploadToken).toBe('object-key-1')
    })

    view.rerender(<WorkspaceManagerHarness workspaceId="ws_b" projectId="project_a" />)
    await waitFor(() => {
      expect(latestController?.uploadToken).toBe('')
    })
  })

  it('并发 refreshWorkspaceState 时旧响应不应覆盖新状态', async () => {
    let resolveOldPresence: ((response: Response) => void) | null = null
    const fetchMock = mock((input: string | URL) => {
      const url = String(input)
      if (url.includes('/api/workspaces/ws_old/presence')) {
        return new Promise<Response>((resolve) => {
          resolveOldPresence = resolve
        })
      }
      if (url.includes('/api/workspaces/ws_old/collab/events')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              events: [
                {
                  id: 'evt_old',
                  workspaceId: 'ws_old',
                  projectId: null,
                  actorName: 'Old',
                  eventType: 'project.patch',
                  payload: {},
                  createdAt: new Date().toISOString()
                }
              ]
            })
          )
        )
      }
      if (url.includes('/api/workspaces/ws_old/invites')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ success: true, invites: [{ id: 'invite_old', code: 'OLD' }] })
          )
        )
      }
      if (url.includes('/api/workspaces/ws_new/presence')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              members: [
                {
                  workspaceId: 'ws_new',
                  sessionId: 'sess_new',
                  memberId: 'mem_new',
                  memberName: 'New User',
                  role: 'owner',
                  status: 'online',
                  lastSeenAt: new Date().toISOString()
                }
              ]
            })
          )
        )
      }
      if (url.includes('/api/workspaces/ws_new/collab/events')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              events: [
                {
                  id: 'evt_new',
                  workspaceId: 'ws_new',
                  projectId: null,
                  actorName: 'New',
                  eventType: 'project.patch',
                  payload: {},
                  createdAt: new Date().toISOString()
                }
              ]
            })
          )
        )
      }
      if (url.includes('/api/workspaces/ws_new/invites')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ success: true, invites: [{ id: 'invite_new', code: 'NEW' }] })
          )
        )
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    globalThis.fetch = fetchMock as typeof fetch

    render(<WorkspaceManagerHarness workspaceId="ws_old" projectId="" />)

    const oldRefresh = latestController?.refreshWorkspaceState('ws_old', '')
    const newRefresh = latestController?.refreshWorkspaceState('ws_new', '')

    await waitFor(() => {
      expect(latestController?.presence[0]?.workspaceId).toBe('ws_new')
      expect(latestController?.collabEvents[0]?.workspaceId).toBe('ws_new')
      expect(latestController?.invites[0]?.id).toBe('invite_new')
    })

    await act(async () => {
      resolveOldPresence?.(
        new Response(
          JSON.stringify({
            success: true,
            members: [
              {
                workspaceId: 'ws_old',
                sessionId: 'sess_old',
                memberId: 'mem_old',
                memberName: 'Old User',
                role: 'viewer',
                status: 'online',
                lastSeenAt: new Date().toISOString()
              }
            ]
          })
        )
      )
      await oldRefresh
      await newRefresh
    })

    expect(latestController?.presence[0]?.workspaceId).toBe('ws_new')
    expect(latestController?.collabEvents[0]?.workspaceId).toBe('ws_new')
    expect(latestController?.invites[0]?.id).toBe('invite_new')
  })
})
