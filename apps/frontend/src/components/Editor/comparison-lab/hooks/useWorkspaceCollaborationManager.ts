import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  JourneyErrorKind,
  JourneyFailedStage,
  JourneyStep
} from '../../../../store/journeyTelemetryStore'
import { getAccessToken, resolveApiBase } from '../../../../utils/eden'
import { classifyRequestError } from '../../../../utils/requestError'
import { requestJson, requestJsonWithRetry, wsBaseFromApi } from '../api'
import { buildIdempotencyKey } from '../helpers'
import type {
  AuthProfile,
  CollabEvent,
  CollabPresence,
  LabMode,
  WorkspaceInvite,
  WorkspaceRole
} from '../types'

type ShowToast = (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void

interface UseWorkspaceCollaborationManagerOptions {
  authProfile: AuthProfile | null
  workspaceName: string
  workspaceOwner: string
  workspaceId: string
  setWorkspaceId: (value: string) => void
  projectId: string
  setProjectId: (value: string) => void
  memberName: string
  setMemberName: (value: string) => void
  collabRole: WorkspaceRole
  setCollabRole: (value: WorkspaceRole) => void
  inviteRole: WorkspaceRole
  inviteCode: string
  setInviteCode: (value: string) => void
  uploadFileName: string
  effectiveOrganizationId: string
  selectOrganization: (organizationId: string) => void
  labMode: LabMode
  openChannelPanel: () => void
  showToast: ShowToast
  markJourneyStep: (
    step: JourneyStep,
    payload?: { organizationId?: string; workspaceId?: string }
  ) => void
  reportJourney: (
    success: boolean,
    payload?: {
      reason?: string
      durationMs?: number
      failedStage?: JourneyFailedStage
      errorKind?: JourneyErrorKind
      httpStatus?: number
    }
  ) => Promise<boolean>
}

export const useWorkspaceCollaborationManager = ({
  authProfile,
  workspaceName,
  workspaceOwner,
  workspaceId,
  setWorkspaceId,
  projectId,
  setProjectId,
  memberName,
  setMemberName,
  collabRole,
  setCollabRole,
  inviteRole,
  inviteCode,
  setInviteCode,
  uploadFileName,
  effectiveOrganizationId,
  selectOrganization,
  labMode,
  openChannelPanel,
  showToast,
  markJourneyStep,
  reportJourney
}: UseWorkspaceCollaborationManagerOptions) => {
  const [invites, setInvites] = useState<WorkspaceInvite[]>([])
  const [presence, setPresence] = useState<CollabPresence[]>([])
  const [collabEvents, setCollabEvents] = useState<CollabEvent[]>([])
  const [snapshots, setSnapshots] = useState<
    Array<{ id: string; actorName: string; createdAt: string }>
  >([])
  const [uploadToken, setUploadToken] = useState('')
  const [isWorkspaceCreating, setIsWorkspaceCreating] = useState(false)
  const [isWsConnected, setIsWsConnected] = useState(false)
  const [isWsConnecting, setIsWsConnecting] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const heartbeatRef = useRef<number | null>(null)
  const wsMessageParseWarningShownRef = useRef(false)
  const workspaceCreateIdempotencyKeyRef = useRef('')

  const currentActorName = memberName.trim() || workspaceOwner.trim() || 'Owner'

  const refreshWorkspaceState = useCallback(
    async (nextWorkspaceId?: string, nextProjectId?: string) => {
      const targetWorkspaceId = nextWorkspaceId || workspaceId
      const targetProjectId = nextProjectId || projectId
      if (!targetWorkspaceId) return

      try {
        const [presencePayload, eventsPayload] = await Promise.all([
          requestJson<{ success: boolean; members: CollabPresence[] }>(
            `/api/workspaces/${targetWorkspaceId}/presence`
          ),
          requestJson<{ success: boolean; events: CollabEvent[] }>(
            `/api/workspaces/${targetWorkspaceId}/collab/events?limit=50`
          )
        ])
        setPresence(presencePayload.members || [])
        setCollabEvents(eventsPayload.events || [])
      } catch (error: unknown) {
        const normalizedError = error instanceof Error ? error : new Error(String(error))
        showToast(normalizedError.message || '刷新协作状态失败', 'error')
      }

      if (targetProjectId) {
        try {
          const snapshotsPayload = await requestJson<{
            success: boolean
            snapshots: Array<{ id: string; actorName: string; createdAt: string }>
          }>(`/api/projects/${targetProjectId}/snapshots?limit=20`)
          setSnapshots(snapshotsPayload.snapshots || [])
        } catch {
          setSnapshots([])
        }
      }

      try {
        const invitesPayload = await requestJson<{ success: boolean; invites: WorkspaceInvite[] }>(
          `/api/workspaces/${targetWorkspaceId}/invites`
        )
        setInvites(invitesPayload.invites || [])
      } catch {
        setInvites([])
      }
    },
    [projectId, showToast, workspaceId]
  )

  const createWorkspace = useCallback(async () => {
    if (isWorkspaceCreating) {
      return
    }
    if (!authProfile) {
      showToast('请先登录后再创建工作区', 'info')
      openChannelPanel()
      return
    }
    if (!workspaceName.trim()) {
      showToast('请输入工作区名称', 'info')
      return
    }
    if (!workspaceCreateIdempotencyKeyRef.current) {
      workspaceCreateIdempotencyKeyRef.current = buildIdempotencyKey('workspace:create')
    }
    const idempotencyKey = workspaceCreateIdempotencyKeyRef.current
    setIsWorkspaceCreating(true)
    try {
      const payload = await requestJsonWithRetry<{
        success: boolean
        workspace: { id: string; organizationId?: string }
        defaultProject: { id: string }
        owner?: { name?: string; role?: WorkspaceRole }
      }>(
        '/api/workspaces',
        {
          method: 'POST',
          body: JSON.stringify({
            name: workspaceName.trim(),
            ownerName: workspaceOwner.trim() || 'Owner',
            organizationId: effectiveOrganizationId || undefined,
            idempotencyKey
          })
        },
        {
          idempotent: true
        }
      )
      setWorkspaceId(payload.workspace.id)
      if (payload.workspace.organizationId) {
        selectOrganization(payload.workspace.organizationId)
      }
      setProjectId(payload.defaultProject.id)
      const ownerName = payload.owner?.name || workspaceOwner.trim() || 'Owner'
      setMemberName(ownerName)
      setCollabRole(payload.owner?.role || 'owner')
      markJourneyStep('workspace_ready', {
        organizationId: payload.workspace.organizationId || effectiveOrganizationId,
        workspaceId: payload.workspace.id
      })
      showToast('协作空间创建成功', 'success')
      await refreshWorkspaceState(payload.workspace.id, payload.defaultProject.id)
    } catch (error: unknown) {
      const normalizedError = error instanceof Error ? error : new Error(String(error))
      const { errorKind, httpStatus } = classifyRequestError(normalizedError)
      void reportJourney(false, {
        reason: 'workspace-create-failed',
        failedStage: 'workspace',
        errorKind,
        httpStatus
      })
      showToast(normalizedError.message || '创建协作空间失败', 'error')
    } finally {
      setIsWorkspaceCreating(false)
      workspaceCreateIdempotencyKeyRef.current = ''
    }
  }, [
    authProfile,
    effectiveOrganizationId,
    isWorkspaceCreating,
    markJourneyStep,
    openChannelPanel,
    refreshWorkspaceState,
    reportJourney,
    selectOrganization,
    setCollabRole,
    setMemberName,
    setProjectId,
    setWorkspaceId,
    showToast,
    workspaceName,
    workspaceOwner
  ])

  const createInvite = useCallback(async () => {
    if (!workspaceId) {
      showToast('请先创建工作区', 'info')
      return
    }
    if (collabRole !== 'owner') {
      showToast('仅 owner 可生成邀请', 'warning')
      return
    }
    try {
      const payload = await requestJson<{ success: boolean; invite: WorkspaceInvite }>(
        `/api/workspaces/${workspaceId}/invites`,
        {
          method: 'POST',
          body: JSON.stringify({
            role: inviteRole,
            expiresInHours: 24
          })
        }
      )
      setInviteCode(payload.invite.code)
      setInvites((prev) => [payload.invite, ...prev])
      showToast(`邀请已生成：${payload.invite.code}`, 'success')
    } catch (error: unknown) {
      const normalizedError = error instanceof Error ? error : new Error(String(error))
      showToast(normalizedError.message || '创建邀请失败', 'error')
    }
  }, [collabRole, inviteRole, setInviteCode, showToast, workspaceId])

  const acceptInvite = useCallback(async () => {
    if (!inviteCode.trim()) {
      showToast('请输入邀请码', 'info')
      return
    }
    const idempotencyKey = buildIdempotencyKey('workspace:invite-accept')
    try {
      const payload = await requestJsonWithRetry<{
        success: boolean
        member: { role: WorkspaceRole } | null
        workspace: { id: string; organizationId?: string } | null
        defaultProject: { id: string } | null
      }>(
        `/api/workspaces/invites/${inviteCode.trim()}/accept`,
        {
          method: 'POST',
          body: JSON.stringify({
            memberName: currentActorName,
            idempotencyKey
          })
        },
        {
          idempotent: true
        }
      )
      if (payload.workspace?.id) setWorkspaceId(payload.workspace.id)
      if (payload.workspace?.organizationId) {
        selectOrganization(payload.workspace.organizationId)
      }
      if (payload.defaultProject?.id) setProjectId(payload.defaultProject.id)
      if (payload.member?.role) setCollabRole(payload.member.role)
      markJourneyStep('workspace_ready', {
        organizationId: payload.workspace?.organizationId || effectiveOrganizationId,
        workspaceId: payload.workspace?.id || ''
      })
      showToast('已接受邀请并加入空间', 'success')
      await refreshWorkspaceState(
        payload.workspace?.id || undefined,
        payload.defaultProject?.id || undefined
      )
    } catch (error: unknown) {
      const normalizedError = error instanceof Error ? error : new Error(String(error))
      const { errorKind, httpStatus } = classifyRequestError(normalizedError)
      void reportJourney(false, {
        reason: 'workspace-accept-invite-failed',
        failedStage: 'workspace',
        errorKind,
        httpStatus
      })
      showToast(normalizedError.message || '接受邀请失败', 'error')
    }
  }, [
    currentActorName,
    effectiveOrganizationId,
    inviteCode,
    markJourneyStep,
    refreshWorkspaceState,
    reportJourney,
    selectOrganization,
    setCollabRole,
    setProjectId,
    setWorkspaceId,
    showToast
  ])

  const createSnapshot = useCallback(async () => {
    if (!projectId) {
      showToast('当前无项目可快照', 'info')
      return
    }
    try {
      await requestJson<{ success: boolean }>(`/api/projects/${projectId}/snapshots`, {
        method: 'POST',
        body: JSON.stringify({
          content: {
            source: 'comparison-lab',
            timestamp: Date.now(),
            mode: labMode
          }
        })
      })
      showToast('项目快照已创建', 'success')
      await refreshWorkspaceState()
    } catch (error: unknown) {
      const normalizedError = error instanceof Error ? error : new Error(String(error))
      showToast(normalizedError.message || '创建快照失败', 'error')
    }
  }, [labMode, projectId, refreshWorkspaceState, showToast])

  const requestUploadToken = useCallback(async () => {
    if (!workspaceId) {
      showToast('请先创建或加入工作区', 'info')
      return
    }
    if (!uploadFileName.trim()) {
      showToast('请输入文件名', 'info')
      return
    }
    try {
      const payload = await requestJson<{
        success: boolean
        token: { uploadUrl: string; objectKey: string }
      }>('/api/storage/upload-token', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId,
          projectId: projectId || undefined,
          fileName: uploadFileName.trim(),
          contentType: 'video/mp4'
        })
      })
      setUploadToken(payload.token.objectKey)
      showToast('上传令牌已生成', 'success')
    } catch (error: unknown) {
      const normalizedError = error instanceof Error ? error : new Error(String(error))
      showToast(normalizedError.message || '生成上传令牌失败', 'error')
    }
  }, [projectId, showToast, uploadFileName, workspaceId])

  const disconnectWs = useCallback(() => {
    if (heartbeatRef.current) {
      window.clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setIsWsConnecting(false)
    setIsWsConnected(false)
  }, [])

  const connectWs = useCallback(() => {
    if (isWsConnecting || isWsConnected) {
      return
    }
    if (!workspaceId) {
      showToast('请先创建工作区', 'info')
      return
    }
    disconnectWs()
    const accessToken = getAccessToken().trim()
    if (!accessToken) {
      showToast('请先登录后再连接协作通道', 'info')
      return
    }
    setIsWsConnecting(true)
    const query = new URLSearchParams({
      memberName: memberName.trim() || 'Editor',
      role: collabRole,
      sessionId: `sess-${Math.random().toString(36).slice(2, 10)}`
    })
    const wsUrl = `${wsBaseFromApi(resolveApiBase())}/ws/collab/${workspaceId}?${query.toString()}`
    const socket = new WebSocket(wsUrl, ['veomuse-collab.v1', `veomuse-auth.${accessToken}`])
    wsRef.current = socket

    socket.onopen = () => {
      setIsWsConnecting(false)
      setIsWsConnected(true)
      showToast('协作实时通道已连接', 'success')
      heartbeatRef.current = window.setInterval(() => {
        socket.send(JSON.stringify({ type: 'presence.heartbeat' }))
      }, 12_000)
    }

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (
          payload.type === 'presence.snapshot' ||
          payload.type === 'presence.joined' ||
          payload.type === 'presence.left'
        ) {
          if (Array.isArray(payload.members)) setPresence(payload.members as CollabPresence[])
          return
        }
        if (payload.type === 'collab.event') {
          const eventRow: CollabEvent = {
            id: `rt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            organizationId: effectiveOrganizationId || 'local',
            workspaceId,
            projectId: payload.projectId || null,
            actorName: payload.actorName || 'Unknown',
            sessionId: payload.sessionId || null,
            eventType: payload.eventType || 'project.patch',
            payload: payload.payload || {},
            createdAt: new Date(payload.ts || Date.now()).toISOString()
          }
          setCollabEvents((prev) => [eventRow, ...prev].slice(0, 100))
        }
      } catch (error: unknown) {
        const normalizedError = error instanceof Error ? error : new Error(String(error))
        void reportJourney(false, {
          reason: `collab-ws-message-parse-failed:${normalizedError.message || 'parse-failed'}`,
          failedStage: 'workspace',
          errorKind: 'unknown'
        })
        if (!wsMessageParseWarningShownRef.current) {
          wsMessageParseWarningShownRef.current = true
          showToast('收到一条异常协作事件，已自动忽略并上报诊断', 'warning')
        }
      }
    }

    socket.onclose = () => {
      disconnectWs()
    }

    socket.onerror = () => {
      showToast('协作通道连接异常', 'error')
      disconnectWs()
    }
  }, [
    collabRole,
    disconnectWs,
    effectiveOrganizationId,
    isWsConnected,
    isWsConnecting,
    memberName,
    reportJourney,
    showToast,
    workspaceId
  ])

  const sendCollabEvent = useCallback(
    (type: 'timeline.patch' | 'project.patch' | 'cursor.update') => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        showToast('请先连接协作通道', 'info')
        return
      }
      const actorName = memberName.trim() || 'Editor'
      const eventPayload = {
        at: Date.now(),
        from: actorName,
        detail: type === 'cursor.update' ? 'cursor-x=0.42' : 'timeline patched'
      }
      wsRef.current.send(
        JSON.stringify({
          type,
          projectId: projectId || undefined,
          payload: eventPayload
        })
      )
      const optimisticEvent: CollabEvent = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        organizationId: effectiveOrganizationId || 'local',
        workspaceId: workspaceId || 'local',
        projectId: projectId || null,
        actorName,
        sessionId: null,
        eventType: type,
        payload: eventPayload,
        createdAt: new Date(eventPayload.at).toISOString()
      }
      setCollabEvents((prev) => [optimisticEvent, ...prev].slice(0, 100))
    },
    [effectiveOrganizationId, memberName, projectId, showToast, workspaceId]
  )

  useEffect(() => () => disconnectWs(), [disconnectWs])

  return {
    invites,
    presence,
    collabEvents,
    snapshots,
    uploadToken,
    isWorkspaceCreating,
    isWsConnected,
    isWsConnecting,
    refreshWorkspaceState,
    createWorkspace,
    createInvite,
    acceptInvite,
    createSnapshot,
    requestUploadToken,
    connectWs,
    disconnectWs,
    sendCollabEvent
  }
}
