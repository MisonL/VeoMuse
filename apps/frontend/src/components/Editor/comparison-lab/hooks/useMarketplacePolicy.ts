import { useCallback, useMemo, useRef, useState } from 'react'
import { getAccessToken } from '../../../../utils/eden'
import { DEFAULT_POLICY_WEIGHTS, POLICY_EXEC_PAGE_SIZE } from '../constants'
import { requestJson } from '../api'
import type {
  MarketplaceModel,
  PolicyPriority,
  RoutingDecision,
  RoutingExecution,
  RoutingPolicy
} from '../types'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface UseMarketplacePolicyOptions {
  showToast: (message: string, type: ToastType) => void
  onRecommendModel?: (modelId: string) => void
}

const resolveErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) return error.message
  const fromObject = (error as { message?: unknown } | null | undefined)?.message
  if (typeof fromObject === 'string' && fromObject.trim()) return fromObject
  return fallback
}

export const useMarketplacePolicy = ({
  showToast,
  onRecommendModel
}: UseMarketplacePolicyOptions) => {
  const [marketplace, setMarketplace] = useState<MarketplaceModel[]>([])
  const [isMarketplaceLoading, setIsMarketplaceLoading] = useState(false)
  const [marketplaceError, setMarketplaceError] = useState('')

  const [policies, setPolicies] = useState<RoutingPolicy[]>([])
  const [isPolicyLoading, setIsPolicyLoading] = useState(false)
  const [isPolicyCreating, setIsPolicyCreating] = useState(false)
  const [isPolicyUpdating, setIsPolicyUpdating] = useState(false)
  const [isPolicySimulating, setIsPolicySimulating] = useState(false)
  const [selectedPolicyId, setSelectedPolicyId] = useState('')
  const [policyCreateName, setPolicyCreateName] = useState('默认创作策略')
  const [policyCreatePriority, setPolicyCreatePriority] = useState<PolicyPriority>('quality')
  const [policyCreateBudget, setPolicyCreateBudget] = useState(1.2)
  const [policyAllowedModels, setPolicyAllowedModels] = useState<string[]>([])
  const [policyWeights, setPolicyWeights] = useState(DEFAULT_POLICY_WEIGHTS)
  const [policyPrompt, setPolicyPrompt] = useState('')
  const [policyBudget, setPolicyBudget] = useState<number>(0.8)
  const [policyPriority, setPolicyPriority] = useState<PolicyPriority>('quality')
  const [policyDecision, setPolicyDecision] = useState<RoutingDecision | null>(null)
  const [policyExecutions, setPolicyExecutions] = useState<RoutingExecution[]>([])
  const [policyExecOffset, setPolicyExecOffset] = useState(0)
  const [policyExecHasMore, setPolicyExecHasMore] = useState(false)
  const [policyExecLoading, setPolicyExecLoading] = useState(false)

  const policyExecRequestSeqRef = useRef(0)
  const policySimulateSeqRef = useRef(0)

  const selectedPolicy = useMemo(
    () => policies.find((item) => item.id === selectedPolicyId) || null,
    [policies, selectedPolicyId]
  )

  const refreshMarketplace = useCallback(
    async (notify: boolean) => {
      setIsMarketplaceLoading(true)
      setMarketplaceError('')
      try {
        const payload = await requestJson<{ success: boolean; models: MarketplaceModel[] }>(
          '/api/models/marketplace'
        )
        setMarketplace(Array.isArray(payload.models) ? payload.models : [])
        if (notify) showToast('模型超市数据已刷新', 'success')
      } catch (error: unknown) {
        const message = resolveErrorMessage(error, '加载模型超市失败')
        setMarketplace([])
        setMarketplaceError(message)
        showToast(message, 'error')
      } finally {
        setIsMarketplaceLoading(false)
      }
    },
    [showToast]
  )

  const loadPolicies = useCallback(
    async (notify: boolean) => {
      if (!getAccessToken().trim()) {
        setPolicies([])
        setSelectedPolicyId('')
        return
      }
      setIsPolicyLoading(true)
      try {
        const payload = await requestJson<{ success: boolean; policies: RoutingPolicy[] }>(
          '/api/models/policies'
        )
        const rows = payload.policies || []
        setPolicies(rows)
        if (!selectedPolicyId && rows[0]?.id) {
          setSelectedPolicyId(rows[0].id)
        }
        if (notify) showToast(`已加载 ${rows.length} 条策略`, 'success')
      } catch (error: unknown) {
        setPolicies([])
        showToast(resolveErrorMessage(error, '加载策略失败'), 'error')
      } finally {
        setIsPolicyLoading(false)
      }
    },
    [selectedPolicyId, showToast]
  )

  const loadPolicyExecutions = useCallback(
    async (reset: boolean, policyIdOverride?: string) => {
      const policyId = policyIdOverride || selectedPolicyId
      if (!policyId) return
      const requestSeq = ++policyExecRequestSeqRef.current
      setPolicyExecLoading(true)
      try {
        const offset = reset ? 0 : policyExecOffset
        const payload = await requestJson<{
          success: boolean
          executions: RoutingExecution[]
          page: { hasMore: boolean; offset: number; total: number }
        }>(
          `/api/models/policies/${policyId}/executions?limit=${POLICY_EXEC_PAGE_SIZE}&offset=${offset}`
        )
        if (requestSeq !== policyExecRequestSeqRef.current) return
        const rows = payload.executions || []
        setPolicyExecutions((prev) => (reset ? rows : [...prev, ...rows]))
        setPolicyExecHasMore(Boolean(payload.page?.hasMore))
        setPolicyExecOffset(offset + rows.length)
      } catch (error: unknown) {
        if (requestSeq === policyExecRequestSeqRef.current) {
          showToast(resolveErrorMessage(error, '加载策略执行记录失败'), 'error')
        }
      } finally {
        if (requestSeq === policyExecRequestSeqRef.current) {
          setPolicyExecLoading(false)
        }
      }
    },
    [policyExecOffset, selectedPolicyId, showToast]
  )

  const toggleAllowedModel = useCallback((modelId: string) => {
    setPolicyAllowedModels((prev) =>
      prev.includes(modelId) ? prev.filter((item) => item !== modelId) : [...prev, modelId]
    )
  }, [])

  const createPolicy = useCallback(async () => {
    if (isPolicyCreating) return
    if (!policyCreateName.trim()) {
      showToast('请输入策略名称', 'info')
      return
    }
    if (policyAllowedModels.length === 0) {
      showToast('至少选择一个可用模型', 'warning')
      return
    }
    setIsPolicyCreating(true)
    try {
      const payload = await requestJson<{ success: boolean; policy: RoutingPolicy }>(
        '/api/models/policies',
        {
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
        }
      )
      showToast(`策略已创建：${payload.policy.name}`, 'success')
      await loadPolicies(false)
      setSelectedPolicyId(payload.policy.id)
    } catch (error: unknown) {
      showToast(resolveErrorMessage(error, '创建策略失败'), 'error')
    } finally {
      setIsPolicyCreating(false)
    }
  }, [
    isPolicyCreating,
    loadPolicies,
    policyAllowedModels,
    policyCreateBudget,
    policyCreateName,
    policyCreatePriority,
    policyWeights,
    showToast
  ])

  const updateSelectedPolicy = useCallback(async () => {
    if (!selectedPolicy || isPolicyUpdating) return
    setIsPolicyUpdating(true)
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
      setPolicies((prev) =>
        prev.map((item) => (item.id === payload.policy.id ? payload.policy : item))
      )
      showToast(`策略状态已更新：${payload.policy.enabled ? '启用' : '停用'}`, 'success')
    } catch (error: unknown) {
      showToast(resolveErrorMessage(error, '更新策略失败'), 'error')
    } finally {
      setIsPolicyUpdating(false)
    }
  }, [isPolicyUpdating, policyBudget, policyPriority, selectedPolicy, showToast])

  const simulatePolicy = useCallback(
    async (overridePrompt?: string) => {
      const prompt = (overridePrompt || policyPrompt).trim()
      if (!prompt) {
        showToast('请输入路由提示词', 'info')
        return null
      }
      if (isPolicySimulating) return null

      const policyIdAtRequest = selectedPolicyId
      const requestSeq = ++policySimulateSeqRef.current
      setIsPolicySimulating(true)
      try {
        const endpoint = policyIdAtRequest
          ? `/api/models/policies/${policyIdAtRequest}/simulate`
          : '/api/models/policy/simulate'
        const payload = await requestJson<{ success: boolean; decision: RoutingDecision }>(
          endpoint,
          {
            method: 'POST',
            body: JSON.stringify({
              prompt,
              budgetUsd: policyBudget,
              priority: policyPriority
            })
          }
        )
        if (requestSeq !== policySimulateSeqRef.current) return null
        const decision = payload.decision || null
        setPolicyDecision(decision)
        if (decision?.recommendedModelId) {
          onRecommendModel?.(decision.recommendedModelId)
        }
        showToast(`策略推荐模型：${decision?.recommendedModelId || '--'}`, 'success')
        if (policyIdAtRequest) {
          await loadPolicyExecutions(true, policyIdAtRequest)
        }
        return decision
      } catch (error: unknown) {
        if (requestSeq === policySimulateSeqRef.current) {
          showToast(resolveErrorMessage(error, '策略模拟失败'), 'error')
        }
        return null
      } finally {
        if (requestSeq === policySimulateSeqRef.current) {
          setIsPolicySimulating(false)
        }
      }
    },
    [
      isPolicySimulating,
      loadPolicyExecutions,
      onRecommendModel,
      policyBudget,
      policyPriority,
      policyPrompt,
      selectedPolicyId,
      showToast
    ]
  )

  return {
    marketplace,
    isMarketplaceLoading,
    marketplaceError,
    policies,
    selectedPolicy,
    selectedPolicyId,
    setSelectedPolicyId,
    isPolicyLoading,
    isPolicyCreating,
    isPolicyUpdating,
    isPolicySimulating,
    policyCreateName,
    setPolicyCreateName,
    policyCreatePriority,
    setPolicyCreatePriority,
    policyCreateBudget,
    setPolicyCreateBudget,
    policyAllowedModels,
    setPolicyAllowedModels,
    policyWeights,
    policyPrompt,
    setPolicyPrompt,
    policyBudget,
    setPolicyBudget,
    policyPriority,
    setPolicyPriority,
    policyDecision,
    policyExecutions,
    policyExecHasMore,
    policyExecLoading,
    setPolicyWeights,
    toggleAllowedModel,
    refreshMarketplace,
    loadPolicies,
    loadPolicyExecutions,
    createPolicy,
    updateSelectedPolicy,
    simulatePolicy
  }
}
