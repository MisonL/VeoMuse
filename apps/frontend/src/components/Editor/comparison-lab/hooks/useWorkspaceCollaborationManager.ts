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
  const inviteAcceptInFlightRef = useRef(false)
  const inviteAcceptIdempotencyKeyRef = useRef('')
  const wsBindingKeyRef = useRef('')
  const refreshWorkspaceStateSeqRef = useRef(0)
  const uploadTokenRequestSeqRef = useRef(0)

  const currentActorName = memberName.trim() || workspaceOwner.trim() || '空间管理员'
  const normalizeError = useCallback((error: unknown, fallbackMessage: string) => {
    if (error instanceof Error) {
      return error.message ? error : new Error(fallbackMessage)
    }
    const message = String(error || '').trim()
    return new Error(message || fallbackMessage)
  }, [])
  const showRequestError = useCallback(
    (error: unknown, fallbackMessage: string) => {
      showToast(normalizeError(error, fallbackMessage).message, 'error')
    },
    [normalizeError, showToast]
  )
  const reportWorkspaceFailure = useCallback(
    (error: unknown, reason: string) => {
      const normalizedError = normalizeError(error, reason)
      const { errorKind, httpStatus } = classifyRequestError(normalizedError)
      void reportJourney(false, {
        reason,
        failedStage: 'workspace',
        errorKind,
        httpStatus
      })
      return normalizedError
    },
    [normalizeError, reportJourney]
  )
  const applyWorkspaceRealtimeState = useCallback(
    (payload: { presence?: CollabPresence[] | null; events?: CollabEvent[] | null }) => {
      setPresence(payload.presence || [])
      setCollabEvents(payload.events || [])
    },
    []
  )
  const applyWorkspaceSnapshots = useCallback(
    (rows: Array<{ id: string; actorName: string; createdAt: string }> | null | undefined) => {
      setSnapshots(rows || [])
    },
    []
  )
  const resetWorkspaceViewState = useCallback(
    (options?: { clearUploadToken?: boolean }) => {
      applyWorkspaceRealtimeState({ presence: [], events: [] })
      setInvites([])
      applyWorkspaceSnapshots([])
      if (options?.clearUploadToken) setUploadToken('')
    },
    [applyWorkspaceRealtimeState, applyWorkspaceSnapshots]
  )
  const applyWorkspaceJoinState = useCallback(
    (payload: {
      workspace?: { id: string; organizationId?: string } | null
      defaultProject?: { id: string } | null
      member?: { role: WorkspaceRole } | null
      owner?: { name?: string; role?: WorkspaceRole } | null
    }) => {
      setUploadToken('')
      if (payload.workspace?.id) setWorkspaceId(payload.workspace.id)
      if (payload.workspace?.organizationId) {
        selectOrganization(payload.workspace.organizationId)
      }
      if (payload.defaultProject?.id) setProjectId(payload.defaultProject.id)
      const nextActorName = payload.owner?.name || workspaceOwner.trim() || currentActorName
      if (payload.owner) {
        setMemberName(nextActorName)
        setCollabRole(payload.owner.role || 'owner')
      } else if (payload.member?.role) {
        setCollabRole(payload.member.role)
      }
    },
    [
      currentActorName,
      selectOrganization,
      setCollabRole,
      setMemberName,
      setProjectId,
      setWorkspaceId,
      setUploadToken,
      workspaceOwner
    ]
  )
  const appendInvite = useCallback(
    (invite: WorkspaceInvite) => {
      setInviteCode(invite.code)
      setInvites((prev) => [invite, ...prev.filter((item) => item.id !== invite.id)])
    },
    [setInviteCode]
  )
  const clearHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      window.clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
  }, [])
  const disconnectWs = useCallback(() => {
    clearHeartbeat()
    const activeSocket = wsRef.current
    wsRef.current = null
    wsBindingKeyRef.current = ''
    if (
      activeSocket &&
      (activeSocket.readyState === WebSocket.OPEN ||
        activeSocket.readyState === WebSocket.CONNECTING)
    ) {
      activeSocket.close()
    }
    setIsWsConnecting(false)
    setIsWsConnected(false)
  }, [clearHeartbeat])
  const buildWsBindingKey = useCallback(
    (nextWorkspaceId = workspaceId, nextMemberName = memberName, nextRole = collabRole) =>
      `${nextWorkspaceId.trim()}::${nextMemberName.trim() || 'Editor'}::${nextRole}`,
    [collabRole, memberName, workspaceId]
  )
  const buildUploadTokenContextKey = useCallback(
    (
      nextWorkspaceId = workspaceId,
      nextProjectId = projectId,
      nextUploadFileName = uploadFileName
    ) => `${nextWorkspaceId.trim()}::${nextProjectId.trim()}::${nextUploadFileName.trim()}`,
    [projectId, uploadFileName, workspaceId]
  )

  const refreshWorkspaceState = useCallback(
    async (nextWorkspaceId?: string | null, nextProjectId?: string | null) => {
      const requestSeq = refreshWorkspaceStateSeqRef.current + 1
      refreshWorkspaceStateSeqRef.current = requestSeq
      const targetWorkspaceId = nextWorkspaceId === undefined ? workspaceId : nextWorkspaceId || ''
      const targetProjectId = nextProjectId === undefined ? projectId : nextProjectId || ''
      if (!targetWorkspaceId) {
        resetWorkspaceViewState({ clearUploadToken: true })
        return
      }

      try {
        const [presencePayload, eventsPayload] = await Promise.all([
          requestJson<{ success: boolean; members: CollabPresence[] }>(
            `/api/workspaces/${targetWorkspaceId}/presence`
          ),
          requestJson<{ success: boolean; events: CollabEvent[] }>(
            `/api/workspaces/${targetWorkspaceId}/collab/events?limit=50`
          )
        ])
        if (requestSeq !== refreshWorkspaceStateSeqRef.current) return
        applyWorkspaceRealtimeState({
          presence: presencePayload.members,
          events: eventsPayload.events
        })
      } catch (error: unknown) {
        if (requestSeq !== refreshWorkspaceStateSeqRef.current) return
        showRequestError(error, '刷新协作状态失败')
      }

      if (targetProjectId) {
        try {
          const snapshotsPayload = await requestJson<{
            success: boolean
            snapshots: Array<{ id: string; actorName: string; createdAt: string }>
          }>(`/api/projects/${targetProjectId}/snapshots?limit=20`)
          if (requestSeq !== refreshWorkspaceStateSeqRef.current) return
          applyWorkspaceSnapshots(snapshotsPayload.snapshots)
        } catch {
          if (requestSeq !== refreshWorkspaceStateSeqRef.current) return
          applyWorkspaceSnapshots([])
        }
      } else {
        if (requestSeq !== refreshWorkspaceStateSeqRef.current) return
        applyWorkspaceSnapshots([])
      }

      try {
        const invitesPayload = await requestJson<{ success: boolean; invites: WorkspaceInvite[] }>(
          `/api/workspaces/${targetWorkspaceId}/invites`
        )
        if (requestSeq !== refreshWorkspaceStateSeqRef.current) return
        setInvites(invitesPayload.invites || [])
      } catch {
        if (requestSeq !== refreshWorkspaceStateSeqRef.current) return
        setInvites([])
      }
    },
    [
      applyWorkspaceRealtimeState,
      applyWorkspaceSnapshots,
      projectId,
      resetWorkspaceViewState,
      showRequestError,
      workspaceId
    ]
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
            ownerName: workspaceOwner.trim() || '空间管理员',
            organizationId: effectiveOrganizationId || undefined,
            idempotencyKey
          })
        },
        {
          idempotent: true
        }
      )
      applyWorkspaceJoinState(payload)
      markJourneyStep('workspace_ready', {
        organizationId: payload.workspace.organizationId || effectiveOrganizationId,
        workspaceId: payload.workspace.id
      })
      showToast('协作空间创建成功', 'success')
      await refreshWorkspaceState(payload.workspace.id, payload.defaultProject.id)
    } catch (error: unknown) {
      showToast(reportWorkspaceFailure(error, 'workspace-create-failed').message, 'error')
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
    applyWorkspaceJoinState,
    refreshWorkspaceState,
    reportWorkspaceFailure,
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
      showToast('仅空间管理员可生成邀请', 'warning')
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
      appendInvite(payload.invite)
      showToast(`邀请已生成：${payload.invite.code}`, 'success')
    } catch (error: unknown) {
      showRequestError(error, '创建邀请失败')
    }
  }, [appendInvite, collabRole, inviteRole, showRequestError, showToast, workspaceId])

  const acceptInvite = useCallback(async () => {
    if (!inviteCode.trim()) {
      showToast('请输入邀请码', 'info')
      return
    }
    if (inviteAcceptInFlightRef.current) return
    if (!inviteAcceptIdempotencyKeyRef.current) {
      inviteAcceptIdempotencyKeyRef.current = buildIdempotencyKey('workspace:invite-accept')
    }
    const idempotencyKey = inviteAcceptIdempotencyKeyRef.current
    inviteAcceptInFlightRef.current = true
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
      applyWorkspaceJoinState(payload)
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
      showToast(reportWorkspaceFailure(error, 'workspace-accept-invite-failed').message, 'error')
    } finally {
      inviteAcceptInFlightRef.current = false
      inviteAcceptIdempotencyKeyRef.current = ''
    }
  }, [
    currentActorName,
    effectiveOrganizationId,
    inviteCode,
    markJourneyStep,
    applyWorkspaceJoinState,
    refreshWorkspaceState,
    reportWorkspaceFailure,
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
      showRequestError(error, '创建快照失败')
    }
  }, [labMode, projectId, refreshWorkspaceState, showRequestError, showToast])

  const requestUploadToken = useCallback(async () => {
    if (!workspaceId) {
      showToast('请先创建或加入工作区', 'info')
      return
    }
    if (!uploadFileName.trim()) {
      showToast('请输入文件名', 'info')
      return
    }
    const requestSeq = uploadTokenRequestSeqRef.current + 1
    uploadTokenRequestSeqRef.current = requestSeq
    const uploadTokenContextKey = buildUploadTokenContextKey()
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
      if (
        requestSeq !== uploadTokenRequestSeqRef.current ||
        uploadTokenContextKey !== buildUploadTokenContextKey()
      ) {
        return
      }
      setUploadToken(payload.token.objectKey)
      showToast('上传令牌已生成', 'success')
    } catch (error: unknown) {
      if (requestSeq !== uploadTokenRequestSeqRef.current) return
      showRequestError(error, '生成上传令牌失败')
    }
  }, [
    buildUploadTokenContextKey,
    projectId,
    showRequestError,
    showToast,
    uploadFileName,
    workspaceId
  ])

  const connectWs = useCallback(
    (options?: { force?: boolean }) => {
      if (!options?.force && (isWsConnecting || isWsConnected)) {
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
      const bindingKey = buildWsBindingKey()
      wsBindingKeyRef.current = bindingKey
      const query = new URLSearchParams({
        memberName: memberName.trim() || 'Editor',
        role: collabRole,
        sessionId: `sess-${Math.random().toString(36).slice(2, 10)}`
      })
      const wsUrl = `${wsBaseFromApi(resolveApiBase())}/ws/collab/${workspaceId}?${query.toString()}`
      const socket = new WebSocket(wsUrl, ['veomuse-collab.v1', `veomuse-auth.${accessToken}`])
      wsRef.current = socket

      socket.onopen = () => {
        if (wsRef.current !== socket) return
        setIsWsConnecting(false)
        setIsWsConnected(true)
        showToast('协作实时通道已连接', 'success')
        clearHeartbeat()
        heartbeatRef.current = window.setInterval(() => {
          socket.send(JSON.stringify({ type: 'presence.heartbeat' }))
        }, 12_000)
      }

      socket.onmessage = (event) => {
        if (wsRef.current !== socket) return
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
          const normalizedError = normalizeError(error, 'parse-failed')
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
        if (wsRef.current !== socket) return
        clearHeartbeat()
        wsRef.current = null
        wsBindingKeyRef.current = ''
        setIsWsConnecting(false)
        setIsWsConnected(false)
      }

      socket.onerror = () => {
        if (wsRef.current !== socket) return
        showToast('协作通道连接异常', 'error')
        socket.close()
      }
    },
    [
      buildWsBindingKey,
      clearHeartbeat,
      collabRole,
      disconnectWs,
      effectiveOrganizationId,
      isWsConnected,
      isWsConnecting,
      memberName,
      normalizeError,
      reportJourney,
      showToast,
      workspaceId
    ]
  )

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

  useEffect(() => {
    if (!wsRef.current) return
    const nextBindingKey = buildWsBindingKey()
    if (wsBindingKeyRef.current === nextBindingKey) return
    disconnectWs()
    if (workspaceId && getAccessToken().trim()) {
      window.setTimeout(() => {
        connectWs({ force: true })
      }, 0)
    }
  }, [buildWsBindingKey, connectWs, disconnectWs, workspaceId])

  useEffect(() => {
    uploadTokenRequestSeqRef.current += 1
    setUploadToken('')
  }, [projectId, uploadFileName, workspaceId])

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
