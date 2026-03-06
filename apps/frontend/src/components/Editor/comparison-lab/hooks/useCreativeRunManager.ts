import { useCallback, useState } from 'react'
import type { RoutingDecision } from '@veomuse/shared'
import { requestJson } from '../api'
import type { CreativeRun } from '../types'

type ShowToast = (
  message: string,
  type?: 'info' | 'success' | 'error' | 'warning'
) => void

interface UseCreativeRunManagerParams {
  selectedPolicyId: string
  policyDecision: RoutingDecision | null
  simulatePolicy: (overridePrompt?: string) => Promise<RoutingDecision | null>
  showToast: ShowToast
}

export const useCreativeRunManager = ({
  selectedPolicyId,
  policyDecision,
  simulatePolicy,
  showToast
}: UseCreativeRunManagerParams) => {
  const [creativeScript, setCreativeScript] = useState('')
  const [creativeStyle, setCreativeStyle] = useState('cinematic')
  const [creativeRun, setCreativeRun] = useState<CreativeRun | null>(null)
  const [creativeVersions, setCreativeVersions] = useState<CreativeRun[]>([])
  const [creativeRunFeedback, setCreativeRunFeedback] = useState('')
  const [sceneFeedbackMap, setSceneFeedbackMap] = useState<Record<string, string>>({})
  const [commitScore, setCommitScore] = useState<number>(0.9)
  const [isCreativeBusy, setIsCreativeBusy] = useState(false)

  const refreshCreativeVersions = useCallback(
    async (runId?: string) => {
      const targetRunId = runId || creativeRun?.id
      if (!targetRunId) return
      try {
        const payload = await requestJson<{ success: boolean; versions: CreativeRun[] }>(
          `/api/ai/creative/run/${targetRunId}/versions`
        )
        setCreativeVersions(payload.versions || [])
      } catch (error: unknown) {
        const normalized = error instanceof Error ? error : new Error(String(error))
        console.warn(`[creative-run] refresh versions failed: ${normalized.message}`)
        setCreativeVersions([])
      }
    },
    [creativeRun?.id]
  )

  const resolveRoutingDecisionForCreativeRun = useCallback(async () => {
    if (!selectedPolicyId) return null
    if (policyDecision && policyDecision.policyId === selectedPolicyId) {
      return policyDecision
    }
    const previewPrompt =
      creativeScript
        .trim()
        .split(/\n|。|\.|!|！|\?|？/)
        .map((item) => item.trim())
        .find(Boolean) || creativeScript.trim()
    return await simulatePolicy(previewPrompt)
  }, [creativeScript, policyDecision, selectedPolicyId, simulatePolicy])

  const createCreativeRun = useCallback(async () => {
    if (!creativeScript.trim()) {
      showToast('请输入创意脚本', 'info')
      return
    }
    if (isCreativeBusy) return

    setIsCreativeBusy(true)
    try {
      const routingDecision = await resolveRoutingDecisionForCreativeRun()
      const payload = await requestJson<{ success: boolean; run: CreativeRun }>(
        '/api/ai/creative/run',
        {
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
        }
      )
      setCreativeRun(payload.run)
      setSceneFeedbackMap({})
      setCreativeRunFeedback('')
      showToast(`创意 run 已创建：${payload.run.id}`, 'success')
      await refreshCreativeVersions(payload.run.id)
    } catch (error: unknown) {
      const normalized = error instanceof Error ? error : new Error(String(error))
      showToast(normalized.message || '创建创意 run 失败', 'error')
    } finally {
      setIsCreativeBusy(false)
    }
  }, [
    creativeScript,
    creativeStyle,
    isCreativeBusy,
    refreshCreativeVersions,
    resolveRoutingDecisionForCreativeRun,
    selectedPolicyId,
    showToast
  ])

  const applyCreativeFeedback = useCallback(async () => {
    if (!creativeRun?.id) {
      showToast('请先创建创意 run', 'info')
      return
    }
    if (isCreativeBusy) return

    const sceneFeedbacks = Object.entries(sceneFeedbackMap)
      .map(([sceneId, feedback]) => ({ sceneId, feedback: feedback.trim() }))
      .filter((item) => item.feedback.length > 0)

    if (!creativeRunFeedback.trim() && sceneFeedbacks.length === 0) {
      showToast('请至少填写一条反馈', 'warning')
      return
    }

    setIsCreativeBusy(true)
    try {
      const payload = await requestJson<{
        success: boolean
        run: CreativeRun
        parentRun: CreativeRun | null
      }>(`/api/ai/creative/run/${creativeRun.id}/feedback`, {
        method: 'POST',
        body: JSON.stringify({
          runFeedback: creativeRunFeedback.trim() || undefined,
          sceneFeedbacks
        })
      })
      setCreativeRun(payload.run)
      setSceneFeedbackMap({})
      setCreativeRunFeedback('')
      showToast(`反馈已应用，生成版本 v${payload.run.version || 1}`, 'success')
      await refreshCreativeVersions(payload.run.id)
    } catch (error: unknown) {
      const normalized = error instanceof Error ? error : new Error(String(error))
      showToast(normalized.message || '操作失败', 'error')
    } finally {
      setIsCreativeBusy(false)
    }
  }, [
    creativeRun?.id,
    creativeRunFeedback,
    isCreativeBusy,
    refreshCreativeVersions,
    sceneFeedbackMap,
    showToast
  ])

  const commitCreativeRun = useCallback(async () => {
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
    } catch (error: unknown) {
      const normalized = error instanceof Error ? error : new Error(String(error))
      showToast(normalized.message || '提交创意 run 失败', 'error')
    } finally {
      setIsCreativeBusy(false)
    }
  }, [commitScore, creativeRun?.id, isCreativeBusy, refreshCreativeVersions, showToast])

  const updateSceneFeedback = useCallback((sceneId: string, value: string) => {
    setSceneFeedbackMap((prev) => ({ ...prev, [sceneId]: value }))
  }, [])

  return {
    creativeScript,
    creativeStyle,
    creativeRun,
    creativeVersions,
    creativeRunFeedback,
    sceneFeedbackMap,
    commitScore,
    isCreativeBusy,
    setCreativeScript,
    setCreativeStyle,
    setCreativeRun,
    setCreativeRunFeedback,
    setCommitScore,
    refreshCreativeVersions,
    createCreativeRun,
    applyCreativeFeedback,
    commitCreativeRun,
    updateSceneFeedback
  }
}
