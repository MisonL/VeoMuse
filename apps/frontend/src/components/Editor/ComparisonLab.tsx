import React, { useEffect, useMemo, useRef, useState } from 'react'
import type {
  CollabEvent,
  CollabPresence,
  CreativeRun,
  RoutingExecution,
  RoutingPolicy,
  WorkspaceInvite,
  WorkspaceRole
} from '@veomuse/shared'
import { useEditorStore } from '../../store/editorStore'
import { useToastStore } from '../../store/toastStore'
import { api, getErrorMessage, resolveApiBase } from '../../utils/eden'
import './ComparisonLab.css'

type LabMode = 'compare' | 'marketplace' | 'creative' | 'collab'
type PolicyPriority = 'quality' | 'speed' | 'cost'
interface ComparisonLabProps {
  onOpenAssets?: () => void
}

interface CapabilityPayload {
  models?: Record<string, boolean>
  services?: Record<string, boolean | string>
  timestamp?: string
}

const MODEL_CAPABILITY_ROWS: Array<{ id: string; label: string; env: string }> = [
  { id: 'veo-3.1', label: 'Gemini Veo 3.1', env: 'GEMINI_API_KEYS' },
  { id: 'kling-v1', label: 'Kling V1', env: 'KLING_API_URL + KLING_API_KEY' },
  { id: 'sora-preview', label: 'Sora Preview', env: 'SORA_API_URL + SORA_API_KEY' },
  { id: 'luma-dream', label: 'Luma Dream', env: 'LUMA_API_URL + LUMA_API_KEY' },
  { id: 'runway-gen3', label: 'Runway Gen-3', env: 'RUNWAY_API_URL + RUNWAY_API_KEY' },
  { id: 'pika-1.5', label: 'Pika 1.5', env: 'PIKA_API_URL + PIKA_API_KEY' }
]

const SERVICE_CAPABILITY_ROWS: Array<{ id: string; label: string; env: string }> = [
  { id: 'tts', label: 'TTS 配音', env: 'TTS_API_URL + TTS_API_KEY' },
  { id: 'voiceMorph', label: '音色迁移', env: 'VOICE_MORPH_API_URL + VOICE_MORPH_API_KEY' },
  { id: 'spatialRender', label: '空间重构', env: 'SPATIAL_API_URL + SPATIAL_API_KEY' },
  { id: 'vfx', label: 'VFX 特效', env: 'VFX_API_URL + VFX_API_KEY' },
  { id: 'lipSync', label: '口型同步', env: 'LIP_SYNC_API_URL + LIP_SYNC_API_KEY' },
  { id: 'audioAnalysis', label: '音频分析', env: 'AUDIO_ANALYSIS_API_URL + AUDIO_ANALYSIS_API_KEY' },
  { id: 'relighting', label: '重光照', env: 'RELIGHT_API_URL + RELIGHT_API_KEY' },
  { id: 'styleTransfer', label: '风格迁移', env: 'ALCHEMY_API_URL + ALCHEMY_API_KEY' }
]

const POLICY_EXEC_PAGE_SIZE = 12
const defaultWeights = {
  quality: 0.45,
  speed: 0.2,
  cost: 0.15,
  reliability: 0.2
}

const wsBaseFromApi = (base: string) => {
  if (base.startsWith('https://')) return base.replace('https://', 'wss://')
  if (base.startsWith('http://')) return base.replace('http://', 'ws://')
  return base
}

const requestJson = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const headers: Record<string, string> = {}
  const customHeaders = init?.headers
  if (customHeaders && typeof customHeaders === 'object' && !Array.isArray(customHeaders)) {
    Object.assign(headers, customHeaders as Record<string, string>)
  }
  const method = (init?.method || 'GET').toUpperCase()
  const isFormDataBody = typeof FormData !== 'undefined' && init?.body instanceof FormData
  if (method !== 'GET' && method !== 'HEAD' && !isFormDataBody) {
    const hasContentType = Object.keys(headers).some(key => key.toLowerCase() === 'content-type')
    if (!hasContentType) headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${resolveApiBase()}${path}`, {
    ...init,
    headers
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.error || payload?.repair?.error || `HTTP ${response.status}`)
  }
  return payload as T
}

const ComparisonLab: React.FC<ComparisonLabProps> = ({ onOpenAssets }) => {
  const allAssets = useEditorStore(state => state.assets)
  const { showToast } = useToastStore()

  const [labMode, setLabMode] = useState<LabMode>('compare')

  const [syncPlayback, setSyncPlayback] = useState(true)
  const [leftAssetId, setLeftAssetId] = useState<string>('')
  const [rightAssetId, setRightAssetId] = useState<string>('')
  const [leftModel, setLeftModel] = useState('veo-3.1')
  const [rightModel, setRightModel] = useState('kling-v1')
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string }>>([])
  const [marketplace, setMarketplace] = useState<Array<any>>([])

  const [policies, setPolicies] = useState<RoutingPolicy[]>([])
  const [isPolicyLoading, setIsPolicyLoading] = useState(false)
  const [isPolicySimulating, setIsPolicySimulating] = useState(false)
  const [selectedPolicyId, setSelectedPolicyId] = useState('')
  const [policyCreateName, setPolicyCreateName] = useState('默认创作策略')
  const [policyCreatePriority, setPolicyCreatePriority] = useState<PolicyPriority>('quality')
  const [policyCreateBudget, setPolicyCreateBudget] = useState(1.2)
  const [policyAllowedModels, setPolicyAllowedModels] = useState<string[]>([])
  const [policyWeights, setPolicyWeights] = useState(defaultWeights)
  const [policyPrompt, setPolicyPrompt] = useState('')
  const [policyBudget, setPolicyBudget] = useState<number>(0.8)
  const [policyPriority, setPolicyPriority] = useState<PolicyPriority>('quality')
  const [policyDecision, setPolicyDecision] = useState<any>(null)
  const [policyExecutions, setPolicyExecutions] = useState<RoutingExecution[]>([])
  const [policyExecOffset, setPolicyExecOffset] = useState(0)
  const [policyExecHasMore, setPolicyExecHasMore] = useState(false)
  const [policyExecLoading, setPolicyExecLoading] = useState(false)

  const [creativeScript, setCreativeScript] = useState('')
  const [creativeStyle, setCreativeStyle] = useState('cinematic')
  const [creativeRun, setCreativeRun] = useState<CreativeRun | null>(null)
  const [creativeVersions, setCreativeVersions] = useState<CreativeRun[]>([])
  const [creativeRunFeedback, setCreativeRunFeedback] = useState('')
  const [sceneFeedbackMap, setSceneFeedbackMap] = useState<Record<string, string>>({})
  const [commitScore, setCommitScore] = useState<number>(0.9)
  const [isCreativeBusy, setIsCreativeBusy] = useState(false)

  const [workspaceName, setWorkspaceName] = useState('VeoMuse 协作空间')
  const [workspaceOwner, setWorkspaceOwner] = useState('Owner')
  const [workspaceId, setWorkspaceId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [memberName, setMemberName] = useState('Editor A')
  const [collabRole, setCollabRole] = useState<WorkspaceRole>('editor')
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('editor')
  const [inviteCode, setInviteCode] = useState('')
  const [invites, setInvites] = useState<WorkspaceInvite[]>([])
  const [presence, setPresence] = useState<CollabPresence[]>([])
  const [collabEvents, setCollabEvents] = useState<CollabEvent[]>([])
  const [snapshots, setSnapshots] = useState<Array<{ id: string; actorName: string; createdAt: string }>>([])
  const [uploadFileName, setUploadFileName] = useState('demo.mp4')
  const [uploadToken, setUploadToken] = useState<string>('')
  const [isWsConnected, setIsWsConnected] = useState(false)
  const [showChannelPanel, setShowChannelPanel] = useState(false)
  const [isCapabilitiesLoading, setIsCapabilitiesLoading] = useState(false)
  const [capabilities, setCapabilities] = useState<CapabilityPayload | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const heartbeatRef = useRef<number | null>(null)
  const leftVideoRef = useRef<HTMLVideoElement | null>(null)
  const rightVideoRef = useRef<HTMLVideoElement | null>(null)

  const assets = useMemo(
    () => allAssets.filter(asset => asset.type === 'video'),
    [allAssets]
  )

  const selectedPolicy = useMemo(
    () => policies.find(item => item.id === selectedPolicyId) || null,
    [policies, selectedPolicyId]
  )

  const leftAsset = useMemo(() => assets.find(a => a.id === leftAssetId), [assets, leftAssetId])
  const rightAsset = useMemo(() => assets.find(a => a.id === rightAssetId), [assets, rightAssetId])
  const currentActorName = memberName.trim() || workspaceOwner.trim() || 'Owner'
  const ownerActorName = workspaceOwner.trim() || currentActorName

  useEffect(() => {
    const loadModels = async () => {
      const { data, error } = await api.api.models.get()
      if (error) return
      if (Array.isArray(data)) {
        const rows = data as Array<{ id: string; name: string }>
        setAvailableModels(rows)
        setPolicyAllowedModels(rows.map(item => item.id))
        if (rows[0]?.id) setLeftModel(rows[0].id)
        if (rows[1]?.id) setRightModel(rows[1].id)
      }
    }
    void loadModels()
    void refreshMarketplace(false)
    void loadPolicies(false)
  }, [])

  useEffect(() => {
    if (!selectedPolicyId) return
    setPolicyExecutions([])
    setPolicyExecOffset(0)
    setPolicyExecHasMore(false)
    void loadPolicyExecutions(true)
  }, [selectedPolicyId])

  useEffect(() => {
    if (!syncPlayback) return
    const left = leftVideoRef.current
    const right = rightVideoRef.current
    if (!left || !right) return

    const onLeftPlay = () => right.play().catch(() => {})
    const onLeftPause = () => right.pause()
    const onLeftSeek = () => {
      if (Math.abs(right.currentTime - left.currentTime) > 0.08) right.currentTime = left.currentTime
    }
    const onRightPlay = () => left.play().catch(() => {})
    const onRightPause = () => left.pause()
    const onRightSeek = () => {
      if (Math.abs(left.currentTime - right.currentTime) > 0.08) left.currentTime = right.currentTime
    }

    left.addEventListener('play', onLeftPlay)
    left.addEventListener('pause', onLeftPause)
    left.addEventListener('seeked', onLeftSeek)
    right.addEventListener('play', onRightPlay)
    right.addEventListener('pause', onRightPause)
    right.addEventListener('seeked', onRightSeek)

    return () => {
      left.removeEventListener('play', onLeftPlay)
      left.removeEventListener('pause', onLeftPause)
      left.removeEventListener('seeked', onLeftSeek)
      right.removeEventListener('play', onRightPlay)
      right.removeEventListener('pause', onRightPause)
      right.removeEventListener('seeked', onRightSeek)
    }
  }, [syncPlayback, leftAssetId, rightAssetId])

  useEffect(() => {
    if (!leftAssetId && assets[0]) setLeftAssetId(assets[0].id)
    if (!rightAssetId && assets[1]) setRightAssetId(assets[1].id)
  }, [assets, leftAssetId, rightAssetId])

  useEffect(() => {
    return () => {
      if (heartbeatRef.current) window.clearInterval(heartbeatRef.current)
      if (wsRef.current) wsRef.current.close()
    }
  }, [])

  const loadCapabilities = async () => {
    setIsCapabilitiesLoading(true)
    try {
      const payload = await requestJson<CapabilityPayload>('/api/capabilities')
      setCapabilities(payload)
    } catch (error: any) {
      showToast(error.message || '加载渠道接入状态失败', 'error')
    } finally {
      setIsCapabilitiesLoading(false)
    }
  }

  const openChannelPanel = () => {
    setShowChannelPanel(true)
    void loadCapabilities()
  }

  const refreshMarketplace = async (notify: boolean) => {
    const { data, error } = await api.api.models.marketplace.get()
    if (error) return showToast(getErrorMessage(error), 'error')
    if (data?.models) {
      setMarketplace(data.models as any[])
      if (notify) showToast('模型超市数据已刷新', 'success')
    }
  }

  const loadPolicies = async (notify: boolean) => {
    setIsPolicyLoading(true)
    try {
      const payload = await requestJson<{ success: boolean; policies: RoutingPolicy[] }>('/api/models/policies')
      const rows = payload.policies || []
      setPolicies(rows)
      if (!selectedPolicyId && rows[0]?.id) {
        setSelectedPolicyId(rows[0].id)
      }
      if (notify) showToast(`已加载 ${rows.length} 条策略`, 'success')
    } catch (error: any) {
      setPolicies([])
      showToast(error.message || '加载策略失败', 'error')
    } finally {
      setIsPolicyLoading(false)
    }
  }

  const loadPolicyExecutions = async (reset: boolean) => {
    if (!selectedPolicyId) return
    setPolicyExecLoading(true)
    try {
      const offset = reset ? 0 : policyExecOffset
      const payload = await requestJson<{
        success: boolean;
        executions: RoutingExecution[];
        page: { hasMore: boolean; offset: number; total: number };
      }>(`/api/models/policies/${selectedPolicyId}/executions?limit=${POLICY_EXEC_PAGE_SIZE}&offset=${offset}`)
      const rows = payload.executions || []
      setPolicyExecutions(reset ? rows : [...policyExecutions, ...rows])
      setPolicyExecHasMore(Boolean(payload.page?.hasMore))
      setPolicyExecOffset(offset + rows.length)
    } catch (error: any) {
      showToast(error.message || '加载策略执行记录失败', 'error')
    } finally {
      setPolicyExecLoading(false)
    }
  }

  const exportReport = async () => {
    try {
      const modelName = (id: string) => availableModels.find(m => m.id === id)?.name || id
      const report = {
        timestamp: new Date().toISOString(),
        mode: labMode,
        left: { modelId: leftModel, modelName: modelName(leftModel), assetName: leftAsset?.name || null },
        right: { modelId: rightModel, modelName: modelName(rightModel), assetName: rightAsset?.name || null },
        syncPlayback
      }
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `comparison-report-${Date.now()}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      showToast('对比报告已导出', 'success')
    } catch (error: any) {
      showToast(error.message || '导出失败', 'error')
    }
  }

  const requestRecommendation = async (side: 'left' | 'right') => {
    const prompt = side === 'left' ? leftAsset?.name : rightAsset?.name
    if (!prompt) return showToast('请先选择对比素材', 'info')

    const { data, error } = await api.api.models.recommend.post({ prompt })
    if (error) return showToast(getErrorMessage(error), 'error')

    if (data?.recommendedModelId) {
      if (side === 'left') setLeftModel(data.recommendedModelId)
      else setRightModel(data.recommendedModelId)
      showToast(`${side === 'left' ? '左侧' : '右侧'}推荐模型: ${data.recommendedModelId}`, 'success')
    }
  }

  const toggleAllowedModel = (modelId: string) => {
    setPolicyAllowedModels(prev => (
      prev.includes(modelId) ? prev.filter(item => item !== modelId) : [...prev, modelId]
    ))
  }

  const createPolicy = async () => {
    if (!policyCreateName.trim()) {
      showToast('请输入策略名称', 'info')
      return
    }
    if (policyAllowedModels.length === 0) {
      showToast('至少选择一个可用模型', 'warning')
      return
    }

    try {
      const payload = await requestJson<{ success: boolean; policy: RoutingPolicy }>('/api/models/policies', {
        method: 'POST',
        body: JSON.stringify({
          name: policyCreateName.trim(),
          description: '来自实验室策略中心',
          priority: policyCreatePriority,
          maxBudgetUsd: policyCreateBudget,
          enabled: true,
          allowedModels: policyAllowedModels,
          weights: policyWeights
        })
      })
      showToast(`策略已创建：${payload.policy.name}`, 'success')
      await loadPolicies(false)
      setSelectedPolicyId(payload.policy.id)
    } catch (error: any) {
      showToast(error.message || '创建策略失败', 'error')
    }
  }

  const updateSelectedPolicy = async () => {
    if (!selectedPolicy) return
    try {
      const payload = await requestJson<{ success: boolean; policy: RoutingPolicy }>(
        `/api/models/policies/${selectedPolicy.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            enabled: !selectedPolicy.enabled,
            maxBudgetUsd: policyBudget,
            priority: policyPriority
          })
        }
      )
      setPolicies(prev => prev.map(item => item.id === payload.policy.id ? payload.policy : item))
      showToast(`策略状态已更新：${payload.policy.enabled ? '启用' : '停用'}`, 'success')
    } catch (error: any) {
      showToast(error.message || '更新策略失败', 'error')
    }
  }

  const simulatePolicy = async (overridePrompt?: string) => {
    const prompt = (overridePrompt || policyPrompt).trim()
    if (!prompt) {
      showToast('请输入路由提示词', 'info')
      return null
    }
    if (isPolicySimulating) {
      return null
    }
    setIsPolicySimulating(true)
    try {
      const endpoint = selectedPolicyId
        ? `/api/models/policies/${selectedPolicyId}/simulate`
        : '/api/models/policy/simulate'
      const payload = await requestJson<{ success: boolean; decision: any }>(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          budgetUsd: policyBudget,
          priority: policyPriority
        })
      })
      const decision = payload.decision || null
      setPolicyDecision(decision)
      if (decision?.recommendedModelId) {
        setLeftModel(decision.recommendedModelId)
      }
      showToast(`策略推荐模型：${decision?.recommendedModelId || '--'}`, 'success')
      if (selectedPolicyId) {
        await loadPolicyExecutions(true)
      }
      return decision
    } catch (error: any) {
      showToast(error.message || '策略模拟失败', 'error')
      return null
    } finally {
      setIsPolicySimulating(false)
    }
  }

  const resolveRoutingDecisionForCreativeRun = async () => {
    if (!selectedPolicyId) return null
    if (policyDecision && policyDecision.policyId === selectedPolicyId) {
      return policyDecision
    }
    const previewPrompt = creativeScript
      .trim()
      .split(/\n|。|\.|!|！|\?|？/)
      .map(item => item.trim())
      .find(Boolean) || creativeScript.trim()
    return await simulatePolicy(previewPrompt)
  }

  const createCreativeRun = async () => {
    if (!creativeScript.trim()) {
      showToast('请输入创意脚本', 'info')
      return
    }
    if (isCreativeBusy) return
    setIsCreativeBusy(true)
    try {
      const routingDecision = await resolveRoutingDecisionForCreativeRun()
      const payload = await requestJson<{ success: boolean; run: CreativeRun }>('/api/ai/creative/run', {
        method: 'POST',
        body: JSON.stringify({
          script: creativeScript.trim(),
          style: creativeStyle,
          context: {
            source: 'comparison-lab',
            createdBy: 'frontend-user',
            routingPolicyId: selectedPolicyId || null,
            routingDecision: routingDecision || null
          }
        })
      })
      setCreativeRun(payload.run)
      setSceneFeedbackMap({})
      setCreativeRunFeedback('')
      showToast(`创意 run 已创建：${payload.run.id}`, 'success')
      await refreshCreativeVersions(payload.run.id)
    } catch (error: any) {
      showToast(error.message || '创建创意 run 失败', 'error')
    } finally {
      setIsCreativeBusy(false)
    }
  }

  const refreshCreativeVersions = async (runId?: string) => {
    const targetRunId = runId || creativeRun?.id
    if (!targetRunId) return
    try {
      const payload = await requestJson<{ success: boolean; versions: CreativeRun[] }>(
        `/api/ai/creative/run/${targetRunId}/versions`
      )
      setCreativeVersions(payload.versions || [])
    } catch {
      setCreativeVersions([])
    }
  }

  const applyCreativeFeedback = async () => {
    if (!creativeRun?.id) {
      showToast('请先创建创意 run', 'info')
      return
    }
    if (isCreativeBusy) return

    const sceneFeedbacks = Object.entries(sceneFeedbackMap)
      .map(([sceneId, feedback]) => ({ sceneId, feedback: feedback.trim() }))
      .filter(item => item.feedback.length > 0)

    if (!creativeRunFeedback.trim() && sceneFeedbacks.length === 0) {
      showToast('请至少填写一条反馈', 'warning')
      return
    }

    setIsCreativeBusy(true)
    try {
      const payload = await requestJson<{ success: boolean; run: CreativeRun; parentRun: CreativeRun | null }>(
        `/api/ai/creative/run/${creativeRun.id}/feedback`,
        {
          method: 'POST',
          body: JSON.stringify({
            runFeedback: creativeRunFeedback.trim() || undefined,
            sceneFeedbacks
          })
        }
      )
      setCreativeRun(payload.run)
      setSceneFeedbackMap({})
      setCreativeRunFeedback('')
      showToast(`反馈已应用，生成版本 v${payload.run.version || 1}`, 'success')
      await refreshCreativeVersions(payload.run.id)
    } catch (error: any) {
      showToast(error.message || '反馈应用失败', 'error')
    } finally {
      setIsCreativeBusy(false)
    }
  }

  const commitCreativeRun = async () => {
    if (!creativeRun?.id) {
      showToast('请先创建创意 run', 'info')
      return
    }
    if (isCreativeBusy) return
    setIsCreativeBusy(true)
    try {
      const payload = await requestJson<{ success: boolean; run: CreativeRun }>(
        `/api/ai/creative/run/${creativeRun.id}/commit`,
        {
          method: 'POST',
          body: JSON.stringify({
            qualityScore: commitScore,
            notes: {
              source: 'comparison-lab',
              reviewedAt: new Date().toISOString()
            }
          })
        }
      )
      setCreativeRun(payload.run)
      showToast('创意 run 已提交完成', 'success')
      await refreshCreativeVersions(payload.run.id)
    } catch (error: any) {
      showToast(error.message || '提交创意 run 失败', 'error')
    } finally {
      setIsCreativeBusy(false)
    }
  }

  const refreshWorkspaceState = async (nextWorkspaceId?: string, nextProjectId?: string) => {
    const wid = nextWorkspaceId || workspaceId
    const pid = nextProjectId || projectId
    if (!wid) return
    const actorName = currentActorName

    try {
      const [presencePayload, eventsPayload] = await Promise.all([
        requestJson<{ success: boolean; members: CollabPresence[] }>(`/api/workspaces/${wid}/presence`, {
          headers: {
            'x-workspace-actor': actorName
          }
        }),
        requestJson<{ success: boolean; events: CollabEvent[] }>(`/api/workspaces/${wid}/collab/events?limit=50`, {
          headers: {
            'x-workspace-actor': actorName
          }
        })
      ])
      setPresence(presencePayload.members || [])
      setCollabEvents(eventsPayload.events || [])
    } catch (error: any) {
      showToast(error.message || '刷新协作状态失败', 'error')
    }

    if (pid) {
      try {
        const snapshotsPayload = await requestJson<{ success: boolean; snapshots: Array<{ id: string; actorName: string; createdAt: string }> }>(
          `/api/projects/${pid}/snapshots?limit=20`,
          {
            headers: {
              'x-workspace-actor': actorName
            }
          }
        )
        setSnapshots(snapshotsPayload.snapshots || [])
      } catch {
        setSnapshots([])
      }
    }

    try {
      const invitesPayload = await requestJson<{ success: boolean; invites: WorkspaceInvite[] }>(
        `/api/workspaces/${wid}/invites`,
        {
          headers: {
            'x-workspace-actor': ownerActorName
          }
        }
      )
      setInvites(invitesPayload.invites || [])
    } catch {
      setInvites([])
    }
  }

  const createWorkspace = async () => {
    if (!workspaceName.trim()) {
      showToast('请输入工作区名称', 'info')
      return
    }
    try {
      const payload = await requestJson<{
        success: boolean;
        workspace: { id: string };
        defaultProject: { id: string };
        owner?: { name?: string; role?: WorkspaceRole };
      }>('/api/workspaces', {
        method: 'POST',
        body: JSON.stringify({
          name: workspaceName.trim(),
          ownerName: workspaceOwner.trim() || 'Owner'
        })
      })
      setWorkspaceId(payload.workspace.id)
      setProjectId(payload.defaultProject.id)
      if (payload.owner?.name) setMemberName(payload.owner.name)
      setCollabRole(payload.owner?.role || 'owner')
      showToast('协作空间创建成功', 'success')
      await refreshWorkspaceState(payload.workspace.id, payload.defaultProject.id)
    } catch (error: any) {
      showToast(error.message || '创建工作区失败', 'error')
    }
  }

  const createInvite = async () => {
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
          headers: {
            'x-workspace-actor': ownerActorName
          },
          body: JSON.stringify({
            role: inviteRole,
            expiresInHours: 24
          })
        }
      )
      setInviteCode(payload.invite.code)
      setInvites(prev => [payload.invite, ...prev])
      showToast(`邀请已生成：${payload.invite.code}`, 'success')
    } catch (error: any) {
      showToast(error.message || '创建邀请失败', 'error')
    }
  }

  const acceptInvite = async () => {
    if (!inviteCode.trim()) {
      showToast('请输入邀请码', 'info')
      return
    }
    try {
      const payload = await requestJson<{
        success: boolean;
        member: { role: WorkspaceRole } | null;
        workspace: { id: string } | null;
        defaultProject: { id: string } | null;
      }>(`/api/workspaces/invites/${inviteCode.trim()}/accept`, {
        method: 'POST',
        body: JSON.stringify({
          memberName: currentActorName
        })
      })
      if (payload.workspace?.id) setWorkspaceId(payload.workspace.id)
      if (payload.defaultProject?.id) setProjectId(payload.defaultProject.id)
      if (payload.member?.role) setCollabRole(payload.member.role)
      showToast('已接受邀请并加入空间', 'success')
      await refreshWorkspaceState(payload.workspace?.id || undefined, payload.defaultProject?.id || undefined)
    } catch (error: any) {
      showToast(error.message || '接受邀请失败', 'error')
    }
  }

  const createSnapshot = async () => {
    if (!projectId) {
      showToast('当前无项目可快照', 'info')
      return
    }
    try {
      await requestJson<{ success: boolean }>(`/api/projects/${projectId}/snapshots`, {
        method: 'POST',
        headers: {
          'x-workspace-actor': memberName.trim() || 'Editor'
        },
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
    } catch (error: any) {
      showToast(error.message || '创建快照失败', 'error')
    }
  }

  const requestUploadToken = async () => {
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
        success: boolean;
        token: { uploadUrl: string; objectKey: string };
      }>('/api/storage/upload-token', {
        method: 'POST',
        headers: {
          'x-workspace-actor': currentActorName
        },
        body: JSON.stringify({
          workspaceId,
          projectId: projectId || undefined,
          fileName: uploadFileName.trim(),
          contentType: 'video/mp4'
        })
      })
      setUploadToken(payload.token.objectKey)
      showToast('上传令牌已生成', 'success')
    } catch (error: any) {
      showToast(error.message || '生成上传令牌失败', 'error')
    }
  }

  const disconnectWs = () => {
    if (heartbeatRef.current) {
      window.clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setIsWsConnected(false)
  }

  const connectWs = () => {
    if (!workspaceId) {
      showToast('请先创建工作区', 'info')
      return
    }
    disconnectWs()
    const query = new URLSearchParams({
      memberName: memberName.trim() || 'Editor',
      role: collabRole,
      sessionId: `sess-${Math.random().toString(36).slice(2, 10)}`
    })
    const wsUrl = `${wsBaseFromApi(resolveApiBase())}/ws/collab/${workspaceId}?${query.toString()}`
    const socket = new WebSocket(wsUrl)
    wsRef.current = socket

    socket.onopen = () => {
      setIsWsConnected(true)
      showToast('协作实时通道已连接', 'success')
      heartbeatRef.current = window.setInterval(() => {
        socket.send(JSON.stringify({ type: 'presence.heartbeat' }))
      }, 12_000)
    }

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload.type === 'presence.snapshot' || payload.type === 'presence.joined' || payload.type === 'presence.left') {
          if (Array.isArray(payload.members)) setPresence(payload.members as CollabPresence[])
          return
        }
        if (payload.type === 'collab.event') {
          const eventRow = {
            id: `rt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            workspaceId,
            projectId: payload.projectId || null,
            actorName: payload.actorName || 'Unknown',
            sessionId: payload.sessionId || null,
            eventType: payload.eventType || 'project.patch',
            payload: payload.payload || {},
            createdAt: new Date(payload.ts || Date.now()).toISOString()
          } as CollabEvent
          setCollabEvents(prev => [eventRow, ...prev].slice(0, 100))
        }
      } catch {
        // noop
      }
    }

    socket.onclose = () => {
      disconnectWs()
    }

    socket.onerror = () => {
      showToast('协作通道连接异常', 'error')
      disconnectWs()
    }
  }

  const sendCollabEvent = (type: 'timeline.patch' | 'project.patch' | 'cursor.update') => {
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
    wsRef.current.send(JSON.stringify({
      type,
      projectId: projectId || undefined,
      payload: eventPayload
    }))
    const optimisticEvent: CollabEvent = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      workspaceId: workspaceId || 'local',
      projectId: projectId || null,
      actorName,
      sessionId: null,
      eventType: type,
      payload: eventPayload,
      createdAt: new Date(eventPayload.at).toISOString()
    }
    setCollabEvents(prev => [optimisticEvent, ...prev].slice(0, 100))
  }

  const renderCompareMode = () => (
    <div className="lab-split-engine">
      <div className="model-pane">
        <div className="pane-head">
          <div className="pane-overlay">
            <span className="model-name">{availableModels.find(m => m.id === leftModel)?.name || leftModel}</span>
            <div className="metric-chip">A 通道</div>
          </div>
          <div className="pane-controls">
            <select name="leftModel" value={leftModel} onChange={e => setLeftModel(e.target.value)}>
              {availableModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <select name="leftAssetId" value={leftAssetId} onChange={e => setLeftAssetId(e.target.value)}>
              <option value="">选择素材</option>
              {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button onClick={() => requestRecommendation('left')}>推荐</button>
          </div>
        </div>
        <div className="pane-viewport">
          {leftAsset?.src ? (
            <video ref={leftVideoRef} src={leftAsset.src} controls playsInline />
          ) : (
            <div className="empty-pane">
              <span>请选择左侧素材</span>
              {onOpenAssets ? (
                <button type="button" className="empty-pane-cta" onClick={onOpenAssets}>
                  去左侧导入素材
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="lab-axis">
        <div className="axis-line" />
        <div className="axis-handle">VS</div>
      </div>

      <div className="model-pane">
        <div className="pane-head">
          <div className="pane-overlay">
            <span className="model-name">{availableModels.find(m => m.id === rightModel)?.name || rightModel}</span>
            <div className="metric-chip secondary">B 通道</div>
          </div>
          <div className="pane-controls">
            <select name="rightModel" value={rightModel} onChange={e => setRightModel(e.target.value)}>
              {availableModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <select name="rightAssetId" value={rightAssetId} onChange={e => setRightAssetId(e.target.value)}>
              <option value="">选择素材</option>
              {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button onClick={() => requestRecommendation('right')}>推荐</button>
          </div>
        </div>
        <div className="pane-viewport">
          {rightAsset?.src ? (
            <video ref={rightVideoRef} src={rightAsset.src} controls playsInline />
          ) : (
            <div className="empty-pane">
              <span>请选择右侧素材</span>
              {onOpenAssets ? (
                <button type="button" className="empty-pane-cta" onClick={onOpenAssets}>
                  去左侧导入素材
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const renderMarketplaceMode = () => (
    <div className="marketplace-shell">
      <div className="marketplace-policy">
        <h4>策略治理中心</h4>
        <label className="lab-field">
          <span>策略</span>
          <select name="selectedPolicyId" value={selectedPolicyId} onChange={(event) => setSelectedPolicyId(event.target.value)}>
            <option value="">未选择（使用默认策略）</option>
            {policies.map(item => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.priority} · ${item.maxBudgetUsd}
              </option>
            ))}
          </select>
        </label>

        <div className="policy-create-grid">
          <label className="lab-field">
            <span>新策略名称</span>
            <input
              type="text"
              name="policyCreateName"
              value={policyCreateName}
              onChange={(event) => setPolicyCreateName(event.target.value)}
            />
          </label>
          <label className="lab-field">
            <span>优先级</span>
            <select name="policyCreatePriority" value={policyCreatePriority} onChange={(event) => setPolicyCreatePriority(event.target.value as PolicyPriority)}>
              <option value="quality">质量</option>
              <option value="speed">速度</option>
              <option value="cost">成本</option>
            </select>
          </label>
          <label className="lab-field">
            <span>预算上限（USD）</span>
            <input
              type="number"
              name="policyCreateBudget"
              min={0}
              step={0.1}
              value={policyCreateBudget}
              onChange={(event) => setPolicyCreateBudget(Number(event.target.value || 0))}
            />
          </label>
          <div className="policy-weight-grid">
            {(['quality', 'speed', 'cost', 'reliability'] as const).map(key => (
              <label key={key} className="lab-field">
                <span>{key}</span>
                <input
                  type="number"
                  name={`policyWeight-${key}`}
                  min={0}
                  max={1}
                  step={0.05}
                  value={policyWeights[key]}
                  onChange={(event) => {
                    const next = Math.max(0, Math.min(1, Number(event.target.value || 0)))
                    setPolicyWeights(prev => ({ ...prev, [key]: next }))
                  }}
                />
              </label>
            ))}
          </div>
          <div className="policy-model-list">
            {availableModels.map(model => (
              <label key={model.id} className="policy-model-chip">
                <input
                  type="checkbox"
                  name={`policyAllowed-${model.id}`}
                  checked={policyAllowedModels.includes(model.id)}
                  onChange={() => toggleAllowedModel(model.id)}
                />
                <span>{model.name}</span>
              </label>
            ))}
          </div>
          <div className="lab-inline-actions">
            <button disabled={isPolicyLoading} onClick={() => void createPolicy()}>创建策略</button>
            <button disabled={isPolicyLoading} onClick={() => void loadPolicies(true)}>
              {isPolicyLoading ? '刷新中...' : '刷新策略'}
            </button>
            <button disabled={!selectedPolicy || isPolicyLoading} onClick={() => void updateSelectedPolicy()}>
              {selectedPolicy?.enabled ? '停用策略' : '启用策略'}
            </button>
          </div>
        </div>

        <h4>路由模拟</h4>
        <textarea
          name="policyPrompt"
          value={policyPrompt}
          onChange={(e) => setPolicyPrompt(e.target.value)}
          placeholder="输入生成意图，例如：写实风格的都市夜景追车镜头，8秒"
        />
        <div className="policy-controls">
          <label>
            预算 $
            <input name="policyBudget" type="number" min={0} step={0.1} value={policyBudget} onChange={(e) => setPolicyBudget(Number(e.target.value || 0))} />
          </label>
          <label>
            优先级
            <select name="policyPriority" value={policyPriority} onChange={(e) => setPolicyPriority(e.target.value as PolicyPriority)}>
              <option value="quality">质量</option>
              <option value="speed">速度</option>
              <option value="cost">成本</option>
            </select>
          </label>
          <button disabled={isPolicySimulating} onClick={() => void simulatePolicy()}>
            {isPolicySimulating ? '模拟中...' : '模拟路由'}
          </button>
        </div>
        {policyDecision ? (
          <div className="policy-result">
            <div>推荐模型：<b>{policyDecision.recommendedModelId}</b></div>
            <div>预计成本：${policyDecision.estimatedCostUsd}</div>
            <div>预计时延：{policyDecision.estimatedLatencyMs}ms</div>
            <div>原因：{policyDecision.reason}</div>
            {Array.isArray(policyDecision.scoreBreakdown) && policyDecision.scoreBreakdown.length > 0 ? (
              <div className="policy-breakdown">
                {policyDecision.scoreBreakdown.map((item: any) => (
                  <div key={item.modelId}>
                    {item.modelId}: Q{item.quality.toFixed(2)} / S{item.speed.toFixed(2)} / C{item.cost.toFixed(2)} / R{item.reliability.toFixed(2)} {'=>'} <b>{item.finalScore.toFixed(2)}</b>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="market-right-stack">
        <div className="market-grid">
          {marketplace.map((item: any) => (
            <div key={item.profile.id} className="market-card">
              <div className="market-head">
                <strong>{item.profile.name}</strong>
                <span>{item.profile.provider}</span>
              </div>
              <div className="market-tags">
                {item.profile.capabilities.map((tag: string) => <span key={tag}>{tag}</span>)}
              </div>
              <div className="market-metrics">
                <div>成功率：{Math.round((item.metrics.successRate || 0) * 100)}%</div>
                <div>P95：{item.metrics.p95LatencyMs}ms</div>
                <div>均价：${item.profile.costPerSecond}/s</div>
              </div>
            </div>
          ))}
        </div>

        <div className="execution-panel">
          <div className="execution-head">
            <h4>策略执行记录</h4>
            <button disabled={!selectedPolicyId || policyExecLoading} onClick={() => void loadPolicyExecutions(true)}>
              刷新
            </button>
          </div>
          <div className="execution-list">
            {policyExecutions.map(row => (
              <div key={row.id} className="execution-item">
                <div className="execution-title">{row.recommendedModelId} · {row.priority}</div>
                <div className="execution-meta">
                  <span>${row.estimatedCostUsd}</span>
                  <span>{row.estimatedLatencyMs}ms</span>
                  <span>{new Date(row.createdAt).toLocaleString()}</span>
                </div>
                <div className="execution-reason">{row.reason}</div>
              </div>
            ))}
            {policyExecutions.length === 0 ? <div className="api-empty">暂无策略执行记录</div> : null}
          </div>
          {policyExecHasMore ? (
            <button
              className="execution-load-more"
              disabled={policyExecLoading}
              onClick={() => void loadPolicyExecutions(false)}
            >
              {policyExecLoading ? '加载中...' : '加载更多'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )

  const renderCreativeMode = () => (
    <div className="creative-shell">
      <section className="creative-card">
        <h4>创意闭环引擎</h4>
        <label className="lab-field">
          <span>脚本</span>
          <textarea
            name="creativeScript"
            value={creativeScript}
            onChange={(event) => setCreativeScript(event.target.value)}
            placeholder="输入剧情脚本，系统将自动拆解分镜并支持版本闭环反馈"
          />
        </label>
        <div className="lab-inline-fields">
          <label className="lab-field">
            <span>风格</span>
            <select name="creativeStyle" value={creativeStyle} onChange={(event) => setCreativeStyle(event.target.value)}>
              <option value="cinematic">cinematic</option>
              <option value="realistic">realistic</option>
              <option value="anime">anime</option>
              <option value="commercial">commercial</option>
            </select>
          </label>
          <label className="lab-field">
            <span>质量分</span>
            <input
              type="number"
              name="commitScore"
              min={0}
              max={1}
              step={0.05}
              value={commitScore}
              onChange={(event) => setCommitScore(Math.max(0, Math.min(1, Number(event.target.value || 0))))}
            />
          </label>
        </div>
        <div className="lab-inline-actions">
          <button disabled={isCreativeBusy} onClick={() => void createCreativeRun()}>
            {isCreativeBusy ? '处理中...' : '创建 Run'}
          </button>
          <button disabled={!creativeRun?.id || isCreativeBusy} onClick={() => void applyCreativeFeedback()}>应用反馈</button>
          <button disabled={!creativeRun?.id || isCreativeBusy} onClick={() => void commitCreativeRun()}>提交完成</button>
          <button disabled={!creativeRun?.id || isCreativeBusy} onClick={() => void refreshCreativeVersions()}>刷新版本链</button>
        </div>
      </section>

      <section className="creative-card">
        <h4>运行详情</h4>
        {creativeRun ? (
          <>
            <div className="creative-summary">
              <div>ID: {creativeRun.id}</div>
              <div>状态: {creativeRun.status}</div>
              <div>版本: v{creativeRun.version || 1}</div>
              <div>父版本: {creativeRun.parentRunId || '-'}</div>
            </div>
            <label className="lab-field">
              <span>整片反馈</span>
              <textarea
                name="creativeRunFeedback"
                value={creativeRunFeedback}
                onChange={(event) => setCreativeRunFeedback(event.target.value)}
                placeholder="例如：节奏更紧凑，镜头 2 需要更强反差"
              />
            </label>
            <div className="creative-scene-list">
              {creativeRun.scenes.map(scene => (
                <div key={scene.id} className="creative-scene-item">
                  <div className="scene-headline">
                    <strong>{scene.order + 1}. {scene.title}</strong>
                    <span>rev {scene.revision || 1} · {scene.status}</span>
                  </div>
                  <div className="scene-meta-line">
                    <span>{scene.duration}s</span>
                    <span>{scene.lastFeedback || '暂无反馈'}</span>
                  </div>
                  <input
                    type="text"
                    name={`sceneFeedback-${scene.id}`}
                    value={sceneFeedbackMap[scene.id] || ''}
                    onChange={(event) => setSceneFeedbackMap(prev => ({ ...prev, [scene.id]: event.target.value }))}
                    placeholder="该分镜反馈"
                  />
                </div>
              ))}
            </div>
          </>
        ) : <div className="api-empty">尚未创建创意 run</div>}
      </section>

      <section className="creative-card">
        <h4>版本链</h4>
        <div className="creative-version-list">
          {creativeVersions.map(version => (
            <button
              key={version.id}
              className={`creative-version-item ${creativeRun?.id === version.id ? 'active' : ''}`}
              onClick={() => setCreativeRun(version)}
            >
              <span>v{version.version || 1} · {version.status}</span>
              <span>{new Date(version.updatedAt).toLocaleString()}</span>
            </button>
          ))}
          {creativeVersions.length === 0 ? <div className="api-empty">暂无版本链记录</div> : null}
        </div>
      </section>
    </div>
  )

  const renderCollabMode = () => (
    <div className="collab-shell">
      <section className="collab-card">
        <h4>团队空间</h4>
        <div className="lab-inline-fields">
          <label className="lab-field">
            <span>空间名</span>
            <input name="workspaceName" value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} />
          </label>
          <label className="lab-field">
            <span>Owner</span>
            <input name="workspaceOwner" value={workspaceOwner} onChange={(event) => setWorkspaceOwner(event.target.value)} />
          </label>
        </div>
        <div className="lab-inline-actions">
          <button onClick={() => void createWorkspace()}>创建工作区</button>
          <button disabled={!workspaceId} onClick={() => void refreshWorkspaceState()}>刷新状态</button>
        </div>
        <div className="collab-meta">
          <span>workspace: {workspaceId || '-'}</span>
          <span>project: {projectId || '-'}</span>
        </div>
      </section>

      <section className="collab-card">
        <h4>邀请与加入</h4>
        <div className="lab-inline-fields">
          <label className="lab-field">
            <span>邀请角色</span>
            <select name="inviteRole" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as WorkspaceRole)}>
              <option value="editor">editor</option>
              <option value="viewer">viewer</option>
              <option value="owner">owner</option>
            </select>
          </label>
          <label className="lab-field">
            <span>成员名</span>
            <input name="memberName" value={memberName} onChange={(event) => setMemberName(event.target.value)} />
          </label>
          <label className="lab-field">
            <span>协作角色</span>
            <select name="collabRole" value={collabRole} onChange={(event) => setCollabRole(event.target.value as WorkspaceRole)}>
              <option value="editor">editor</option>
              <option value="viewer">viewer</option>
              <option value="owner">owner</option>
            </select>
          </label>
        </div>
        <div className="lab-inline-fields">
          <label className="lab-field">
            <span>邀请码</span>
            <input name="inviteCode" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} />
          </label>
        </div>
        <div className="lab-inline-actions">
          <button disabled={!workspaceId || collabRole !== 'owner'} onClick={() => void createInvite()}>生成邀请</button>
          <button onClick={() => void acceptInvite()}>接受邀请</button>
        </div>
        <div className="collab-list">
          {invites.slice(0, 6).map(item => (
            <div key={item.id} className="collab-list-item">
              <span>{item.code}</span>
              <span>{item.role}</span>
              <span>{item.status}</span>
            </div>
          ))}
          {invites.length === 0 ? <div className="api-empty">暂无邀请记录</div> : null}
        </div>
      </section>

      <section className="collab-card">
        <h4>多人协同通道</h4>
        <div className="lab-inline-actions">
          <button aria-label="连接协作通道" disabled={isWsConnected || !workspaceId} onClick={() => connectWs()}>连接 WS</button>
          <button aria-label="断开协作通道" disabled={!isWsConnected} onClick={() => disconnectWs()}>断开 WS</button>
          <button aria-label="发送时间轴补丁" disabled={!isWsConnected} onClick={() => sendCollabEvent('timeline.patch')}>发送 Timeline Patch</button>
          <button aria-label="发送光标更新" disabled={!isWsConnected} onClick={() => sendCollabEvent('cursor.update')}>发送 Cursor 更新</button>
        </div>
        <div className="collab-meta">
          <span>连接状态：{isWsConnected ? '已连接' : '未连接'}</span>
          <span>在线人数：{presence.length}</span>
        </div>
        <div className="collab-split">
          <div className="collab-column">
            <h5>在线成员</h5>
            <div className="collab-list">
              {presence.map(item => (
                <div key={`${item.workspaceId}-${item.sessionId}`} className="collab-list-item">
                  <span>{item.memberName}</span>
                  <span>{item.role}</span>
                  <span>{item.status}</span>
                </div>
              ))}
              {presence.length === 0 ? <div className="api-empty">暂无在线成员</div> : null}
            </div>
          </div>
          <div className="collab-column">
            <h5>协作事件</h5>
            <div className="collab-list">
              {collabEvents.slice(0, 20).map(item => (
                <div key={item.id} className="collab-list-item">
                  <span>{item.eventType}</span>
                  <span>{item.actorName}</span>
                  <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
                </div>
              ))}
              {collabEvents.length === 0 ? <div className="api-empty">暂无协作事件</div> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="collab-card">
        <h4>云存储与快照</h4>
        <div className="lab-inline-actions">
          <button disabled={!projectId} onClick={() => void createSnapshot()}>创建快照</button>
          <button disabled={!workspaceId} onClick={() => void refreshWorkspaceState()}>刷新列表</button>
        </div>
        <div className="lab-inline-fields">
          <label className="lab-field">
            <span>文件名</span>
            <input name="uploadFileName" value={uploadFileName} onChange={(event) => setUploadFileName(event.target.value)} />
          </label>
          <button className="inline-fill-btn" onClick={() => void requestUploadToken()}>生成上传令牌</button>
        </div>
        <div className="collab-meta">
          <span>令牌对象：{uploadToken || '-'}</span>
        </div>
        <div className="collab-list">
          {snapshots.map(item => (
            <div key={item.id} className="collab-list-item">
              <span>{item.id.slice(0, 12)}</span>
              <span>{item.actorName}</span>
              <span>{new Date(item.createdAt).toLocaleString()}</span>
            </div>
          ))}
          {snapshots.length === 0 ? <div className="api-empty">暂无项目快照</div> : null}
        </div>
      </section>
    </div>
  )

  const renderChannelRows = (
    rows: Array<{ id: string; label: string; env: string }>,
    source: Record<string, boolean | string> | undefined
  ) => rows.map((row) => {
    const raw = source?.[row.id]
    const enabled = raw === true || (typeof raw === 'string' && raw.trim().length > 0)
    return (
      <div key={row.id} className="capability-row">
        <div className="capability-meta">
          <strong>{row.label}</strong>
          <span>{row.env}</span>
        </div>
        <span className={`capability-badge ${enabled ? 'ok' : 'off'}`}>
          {enabled ? '已接入' : '未接入'}
        </span>
      </div>
    )
  })

  return (
    <div className="comparison-lab-pro">
      <div className="lab-toolbar" data-guide="lab-toolbar">
        <div className="lab-status">
          <span className="live-dot">●</span> 实验室在线
        </div>
        <div className="lab-actions">
          {labMode === 'compare' ? (
            <label className="sync-toggle">
              <input name="syncPlayback" type="checkbox" checked={syncPlayback} onChange={e => setSyncPlayback(e.target.checked)} />
              <span>同步预览</span>
            </label>
          ) : null}
          <div className="lab-mode-switch">
            <button className={`lab-mode-btn ${labMode === 'compare' ? 'active' : ''}`} onClick={() => setLabMode('compare')}>对比</button>
            <button className={`lab-mode-btn ${labMode === 'marketplace' ? 'active' : ''}`} onClick={() => setLabMode('marketplace')}>策略治理</button>
            <button className={`lab-mode-btn ${labMode === 'creative' ? 'active' : ''}`} onClick={() => setLabMode('creative')}>创意闭环</button>
            <button className={`lab-mode-btn ${labMode === 'collab' ? 'active' : ''}`} onClick={() => setLabMode('collab')}>协作平台</button>
          </div>
          {labMode === 'compare' ? (
            <button id="btn-export-compare-report" className="lab-btn" onClick={() => void exportReport()}>导出对比报告</button>
          ) : (
            <button className="lab-btn" onClick={() => void refreshMarketplace(true)}>刷新超市</button>
          )}
          <button className="lab-btn" onClick={openChannelPanel}>渠道接入</button>
        </div>
      </div>

      {labMode === 'compare' ? renderCompareMode() : null}
      {labMode === 'marketplace' ? renderMarketplaceMode() : null}
      {labMode === 'creative' ? renderCreativeMode() : null}
      {labMode === 'collab' ? renderCollabMode() : null}

      {showChannelPanel ? (
        <div className="channel-panel-mask" role="dialog" aria-modal="true" aria-label="AI 渠道接入状态">
          <section className="channel-panel">
            <header className="channel-panel-head">
              <div>
                <h3>AI 渠道接入状态</h3>
                <p>配置后请重启 `veomuse-backend` 容器，状态会自动刷新。</p>
              </div>
              <button type="button" className="channel-close-btn" onClick={() => setShowChannelPanel(false)}>关闭</button>
            </header>

            <div className="channel-panel-actions">
              <button type="button" className="channel-refresh-btn" onClick={() => void loadCapabilities()} disabled={isCapabilitiesLoading}>
                {isCapabilitiesLoading ? '刷新中...' : '刷新状态'}
              </button>
              <code className="channel-hint">配置位置：项目根目录 `.env`（Docker 使用 `env_file` 注入）</code>
            </div>

            <div className="channel-grid">
              <section className="channel-card">
                <h4>视频模型渠道</h4>
                <div className="channel-list">
                  {renderChannelRows(MODEL_CAPABILITY_ROWS, capabilities?.models)}
                </div>
              </section>

              <section className="channel-card">
                <h4>媒体服务渠道</h4>
                <div className="channel-list">
                  {renderChannelRows(SERVICE_CAPABILITY_ROWS, capabilities?.services)}
                </div>
              </section>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

export default ComparisonLab
