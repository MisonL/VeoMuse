import { useCallback, useEffect, useState } from 'react'
import { getAdminToken, setAdminToken } from '../../../../utils/eden'
import { requestV4 } from '../api'
import type {
  V4ErrorBudget,
  V4PermissionGrant,
  V4ReliabilityAlert,
  V4ReliabilityAlertLevel,
  V4RollbackDrillResult,
  V4TimelineMergeResult,
  WorkspaceRole
} from '../types'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface UseV4OpsManagerOptions {
  workspaceId: string
  projectId: string
  currentActorName: string
  parseJsonObjectInput: (raw: string, fieldName: string) => Record<string, unknown> | null
  showToast: (message: string, type?: ToastType) => void
}

export const useV4OpsManager = ({
  workspaceId,
  projectId,
  currentActorName,
  parseJsonObjectInput,
  showToast
}: UseV4OpsManagerOptions) => {
  const [v4Permissions, setV4Permissions] = useState<V4PermissionGrant[]>([])
  const [v4PermissionSubjectId, setV4PermissionSubjectId] = useState('')
  const [v4PermissionRole, setV4PermissionRole] = useState<WorkspaceRole>('viewer')
  const [v4TimelineMergeResult, setV4TimelineMergeResult] = useState<V4TimelineMergeResult | null>(
    null
  )
  const [v4ErrorBudget, setV4ErrorBudget] = useState<V4ErrorBudget | null>(null)
  const [v4ReliabilityAlerts, setV4ReliabilityAlerts] = useState<V4ReliabilityAlert[]>([])
  const [v4ReliabilityAlertLevel, setV4ReliabilityAlertLevel] = useState<
    'all' | V4ReliabilityAlertLevel
  >('all')
  const [v4ReliabilityAlertStatus, setV4ReliabilityAlertStatus] = useState<
    'all' | V4ReliabilityAlert['status']
  >('all')
  const [v4ReliabilityAlertLimit, setV4ReliabilityAlertLimit] = useState('20')
  const [v4ErrorBudgetScope, setV4ErrorBudgetScope] = useState('global')
  const [v4ErrorBudgetTargetSlo, setV4ErrorBudgetTargetSlo] = useState('0.99')
  const [v4ErrorBudgetWindowDays, setV4ErrorBudgetWindowDays] = useState('30')
  const [v4ErrorBudgetWarningThresholdRatio, setV4ErrorBudgetWarningThresholdRatio] =
    useState('0.7')
  const [v4ErrorBudgetAlertThresholdRatio, setV4ErrorBudgetAlertThresholdRatio] = useState('0.9')
  const [v4ErrorBudgetFreezeDeployOnBreach, setV4ErrorBudgetFreezeDeployOnBreach] = useState(false)
  const [v4RollbackPolicyId, setV4RollbackPolicyId] = useState('')
  const [v4RollbackEnvironment, setV4RollbackEnvironment] = useState('staging')
  const [v4RollbackTriggerType, setV4RollbackTriggerType] = useState('manual')
  const [v4RollbackSummary, setV4RollbackSummary] = useState('Triggered from comparison-lab')
  const [v4RollbackPlan, setV4RollbackPlan] = useState('{"steps":[]}')
  const [v4RollbackResult, setV4RollbackResult] = useState('{}')
  const [v4RollbackDrillId, setV4RollbackDrillId] = useState('')
  const [v4RollbackDrillResult, setV4RollbackDrillResult] = useState<V4RollbackDrillResult | null>(
    null
  )
  const [v4AdminToken, setV4AdminTokenState] = useState(() => getAdminToken())
  const [isV4CollabBusy, setIsV4CollabBusy] = useState(false)
  const [isV4OpsBusy, setIsV4OpsBusy] = useState(false)

  useEffect(() => {
    setAdminToken(v4AdminToken)
  }, [v4AdminToken])

  const buildV4AdminHeaders = useCallback(
    (customHeaders?: Record<string, string>) => {
      const headers: Record<string, string> = {
        ...(customHeaders || {})
      }
      const token = v4AdminToken.trim()
      if (token) headers['x-admin-token'] = token
      return headers
    },
    [v4AdminToken]
  )

  const refreshV4Permissions = useCallback(async () => {
    if (!workspaceId) {
      setV4Permissions([])
      return
    }
    if (isV4CollabBusy) return
    setIsV4CollabBusy(true)
    try {
      const payload = await requestV4<{ success: boolean; permissions: V4PermissionGrant[] }>(
        `/workspaces/${workspaceId}/permissions`
      )
      setV4Permissions(payload.permissions || [])
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '加载权限失败'
      showToast(message || '加载权限失败', 'error')
    } finally {
      setIsV4CollabBusy(false)
    }
  }, [isV4CollabBusy, showToast, workspaceId])

  const updateV4Permission = useCallback(async () => {
    if (!workspaceId) {
      showToast('请先创建或加入工作区', 'info')
      return
    }
    const rawPermissionInput = v4PermissionSubjectId.trim()
    if (!rawPermissionInput) {
      showToast('请输入权限键（如 timeline.merge）', 'info')
      return
    }
    let permissionKey = rawPermissionInput
    let allowed = true
    if (rawPermissionInput.includes('=')) {
      const [left, ...rightParts] = rawPermissionInput.split('=')
      permissionKey = left.trim()
      const normalizedValue = rightParts.join('=').trim().toLowerCase()
      if (['true', '1', 'yes', 'on', 'allow', 'allowed'].includes(normalizedValue)) {
        allowed = true
      } else if (['false', '0', 'no', 'off', 'deny', 'denied'].includes(normalizedValue)) {
        allowed = false
      } else {
        showToast('权限值仅支持 true/false，例如 timeline.merge=true', 'warning')
        return
      }
    }
    if (!permissionKey) {
      showToast('请输入有效权限键（如 timeline.merge）', 'info')
      return
    }
    if (isV4CollabBusy) return
    setIsV4CollabBusy(true)
    try {
      const currentRolePermission = v4Permissions.find((item) => item.role === v4PermissionRole)
      const mergedPermissions = {
        ...(currentRolePermission?.permissions || {}),
        [permissionKey]: allowed
      }
      const payload = await requestV4<{ success: boolean; permission?: V4PermissionGrant }>(
        `/workspaces/${workspaceId}/permissions/${v4PermissionRole}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            permissions: mergedPermissions,
            updatedBy: currentActorName || undefined
          })
        }
      )
      const nextPermission = payload.permission
      if (nextPermission) {
        setV4Permissions((prev) => [
          nextPermission,
          ...prev.filter((item) => item.role !== nextPermission.role)
        ])
      } else {
        await refreshV4Permissions()
      }
      showToast(`权限已更新：${permissionKey}=${allowed}`, 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '更新权限失败'
      showToast(message || '更新权限失败', 'error')
    } finally {
      setIsV4CollabBusy(false)
    }
  }, [
    currentActorName,
    isV4CollabBusy,
    refreshV4Permissions,
    showToast,
    v4PermissionRole,
    v4PermissionSubjectId,
    v4Permissions,
    workspaceId
  ])

  const mergeV4Timeline = useCallback(async () => {
    if (!projectId) {
      showToast('请先创建或加入项目', 'info')
      return
    }
    if (isV4CollabBusy) return
    setIsV4CollabBusy(true)
    try {
      const payload = await requestV4<{ success: boolean; merge: V4TimelineMergeResult }>(
        `/projects/${projectId}/timeline/merge`,
        {
          method: 'POST',
          body: JSON.stringify({
            result: {
              source: 'comparison-lab',
              actorName: currentActorName
            }
          })
        }
      )
      setV4TimelineMergeResult(payload.merge || null)
      showToast(`Timeline Merge 已触发：${payload.merge?.status || '-'}`, 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Timeline Merge 调用失败'
      showToast(message || 'Timeline Merge 调用失败', 'error')
    } finally {
      setIsV4CollabBusy(false)
    }
  }, [currentActorName, isV4CollabBusy, projectId, showToast])

  const loadV4ReliabilityAlerts = useCallback(async () => {
    const limitRaw = v4ReliabilityAlertLimit.trim() || '20'
    const limit = Number.parseInt(limitRaw, 10)
    if (!Number.isFinite(limit) || limit <= 0) {
      showToast('告警查询 limit 必须是大于 0 的整数', 'warning')
      return
    }
    if (isV4OpsBusy) return
    setIsV4OpsBusy(true)
    try {
      const query = new URLSearchParams({
        limit: String(Math.min(limit, 200))
      })
      if (v4ReliabilityAlertLevel !== 'all') query.set('level', v4ReliabilityAlertLevel)
      if (v4ReliabilityAlertStatus !== 'all') query.set('status', v4ReliabilityAlertStatus)
      const payload = await requestV4<{ success: boolean; alerts: V4ReliabilityAlert[] }>(
        `/admin/reliability/alerts?${query.toString()}`,
        {
          headers: buildV4AdminHeaders()
        }
      )
      const alerts = payload.alerts || []
      setV4ReliabilityAlerts(alerts)
      showToast(`可靠性告警已加载 ${alerts.length} 条`, 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '加载可靠性告警失败'
      showToast(message || '加载可靠性告警失败', 'error')
    } finally {
      setIsV4OpsBusy(false)
    }
  }, [
    buildV4AdminHeaders,
    isV4OpsBusy,
    showToast,
    v4ReliabilityAlertLevel,
    v4ReliabilityAlertLimit,
    v4ReliabilityAlertStatus
  ])

  const acknowledgeV4ReliabilityAlert = useCallback(
    async (alertId: string) => {
      const normalizedAlertId = alertId.trim()
      if (!normalizedAlertId) return
      if (isV4OpsBusy) return
      setIsV4OpsBusy(true)
      try {
        const payload = await requestV4<{
          success: boolean
          alert?: V4ReliabilityAlert
        }>(`/admin/reliability/alerts/${encodeURIComponent(normalizedAlertId)}/ack`, {
          method: 'POST',
          headers: buildV4AdminHeaders(),
          body: JSON.stringify({
            acknowledgedBy: currentActorName || undefined
          })
        })
        const acknowledgedAt = payload.alert?.acknowledgedAt || new Date().toISOString()
        setV4ReliabilityAlerts((prev) =>
          prev.map((item) => {
            if (item.id !== normalizedAlertId) return item
            return (
              payload.alert || {
                ...item,
                status: 'acknowledged',
                acknowledgedAt
              }
            )
          })
        )
        showToast('告警已 ACK', 'success')
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'ACK 告警失败'
        showToast(message || 'ACK 告警失败', 'error')
      } finally {
        setIsV4OpsBusy(false)
      }
    },
    [buildV4AdminHeaders, currentActorName, isV4OpsBusy, showToast]
  )

  const loadV4ErrorBudget = useCallback(async () => {
    if (isV4OpsBusy) return
    setIsV4OpsBusy(true)
    try {
      const payload = await requestV4<{
        success: boolean
        policy: V4ErrorBudget['policy']
        evaluation: V4ErrorBudget['evaluation']
      }>('/admin/reliability/error-budget', {
        headers: buildV4AdminHeaders()
      })
      setV4ErrorBudget(
        payload.policy && payload.evaluation
          ? {
              policy: payload.policy,
              evaluation: payload.evaluation
            }
          : null
      )
      if (payload.policy) {
        setV4ErrorBudgetScope(payload.policy.scope || 'global')
        setV4ErrorBudgetTargetSlo(String(payload.policy.targetSlo))
        setV4ErrorBudgetWindowDays(String(payload.policy.windowDays))
        setV4ErrorBudgetWarningThresholdRatio(String(payload.policy.warningThresholdRatio))
        setV4ErrorBudgetAlertThresholdRatio(String(payload.policy.alertThresholdRatio))
        setV4ErrorBudgetFreezeDeployOnBreach(Boolean(payload.policy.freezeDeployOnBreach))
      }
      showToast('错误预算读取成功', 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '读取错误预算失败'
      showToast(message || '读取错误预算失败', 'error')
    } finally {
      setIsV4OpsBusy(false)
    }
  }, [buildV4AdminHeaders, isV4OpsBusy, showToast])

  const updateV4ErrorBudget = useCallback(async () => {
    const targetSlo = Number.parseFloat(v4ErrorBudgetTargetSlo.trim() || '0.99')
    if (!Number.isFinite(targetSlo) || targetSlo < 0.5 || targetSlo > 0.99999) {
      showToast('targetSlo 必须在 0.5 ~ 0.99999 之间', 'warning')
      return
    }
    const windowDays = Number.parseInt(v4ErrorBudgetWindowDays.trim() || '30', 10)
    if (!Number.isFinite(windowDays) || windowDays < 1 || windowDays > 3650) {
      showToast('windowDays 必须是 1 ~ 3650 的整数', 'warning')
      return
    }
    const warningThresholdRatio = Number.parseFloat(
      v4ErrorBudgetWarningThresholdRatio.trim() || '0.7'
    )
    if (
      !Number.isFinite(warningThresholdRatio) ||
      warningThresholdRatio < 0 ||
      warningThresholdRatio > 1
    ) {
      showToast('warningThresholdRatio 必须在 0 ~ 1 之间', 'warning')
      return
    }
    const alertThresholdRatio = Number.parseFloat(v4ErrorBudgetAlertThresholdRatio.trim() || '0.9')
    if (
      !Number.isFinite(alertThresholdRatio) ||
      alertThresholdRatio < 0 ||
      alertThresholdRatio > 1
    ) {
      showToast('alertThresholdRatio 必须在 0 ~ 1 之间', 'warning')
      return
    }
    if (warningThresholdRatio > alertThresholdRatio) {
      showToast('warningThresholdRatio 不能大于 alertThresholdRatio', 'warning')
      return
    }
    if (isV4OpsBusy) return
    setIsV4OpsBusy(true)
    try {
      const payload = await requestV4<{
        success: boolean
        policy: V4ErrorBudget['policy']
        evaluation: V4ErrorBudget['evaluation']
      }>('/admin/reliability/error-budget', {
        method: 'PUT',
        headers: buildV4AdminHeaders(),
        body: JSON.stringify({
          policyId: v4ErrorBudget?.policy.id || undefined,
          scope: v4ErrorBudgetScope.trim() || undefined,
          targetSlo,
          windowDays,
          warningThresholdRatio,
          alertThresholdRatio,
          freezeDeployOnBreach: v4ErrorBudgetFreezeDeployOnBreach,
          updatedBy: currentActorName || 'comparison-lab'
        })
      })
      if (payload.policy && payload.evaluation) {
        setV4ErrorBudget({
          policy: payload.policy,
          evaluation: payload.evaluation
        })
      }
      showToast('错误预算策略已更新', 'success')
    } catch (error: unknown) {
      const normalized = error instanceof Error ? error : new Error(String(error))
      showToast(normalized.message || '更新错误预算策略失败', 'error')
    } finally {
      setIsV4OpsBusy(false)
    }
  }, [
    buildV4AdminHeaders,
    currentActorName,
    isV4OpsBusy,
    showToast,
    v4ErrorBudget,
    v4ErrorBudgetAlertThresholdRatio,
    v4ErrorBudgetFreezeDeployOnBreach,
    v4ErrorBudgetScope,
    v4ErrorBudgetTargetSlo,
    v4ErrorBudgetWarningThresholdRatio,
    v4ErrorBudgetWindowDays
  ])

  const triggerV4RollbackDrill = useCallback(async () => {
    const plan = parseJsonObjectInput(v4RollbackPlan, '回滚演练 plan')
    if (!plan) return
    const result = parseJsonObjectInput(v4RollbackResult, '回滚演练 result')
    if (!result) return
    if (isV4OpsBusy) return
    setIsV4OpsBusy(true)
    try {
      const payload = await requestV4<{ success: boolean; drill: V4RollbackDrillResult }>(
        '/admin/reliability/drills/rollback',
        {
          method: 'POST',
          headers: buildV4AdminHeaders(),
          body: JSON.stringify({
            policyId: v4RollbackPolicyId.trim() || undefined,
            environment: v4RollbackEnvironment.trim() || undefined,
            initiatedBy: currentActorName || 'comparison-lab',
            triggerType: v4RollbackTriggerType.trim() || undefined,
            summary: v4RollbackSummary.trim() || undefined,
            plan,
            result
          })
        }
      )
      setV4RollbackDrillResult(payload.drill || null)
      if (payload.drill) {
        if (payload.drill.id) setV4RollbackDrillId(payload.drill.id)
        setV4RollbackPolicyId(payload.drill.policyId || '')
        setV4RollbackEnvironment(payload.drill.environment || '')
        setV4RollbackTriggerType(payload.drill.triggerType || '')
        setV4RollbackSummary(payload.drill.summary || '')
        setV4RollbackPlan(JSON.stringify(payload.drill.plan || {}, null, 2))
        setV4RollbackResult(JSON.stringify(payload.drill.result || {}, null, 2))
      }
      showToast(`回滚演练已触发：${payload.drill?.id || '-'}`, 'success')
    } catch (error: unknown) {
      const normalized = error instanceof Error ? error : new Error(String(error))
      showToast(normalized.message || '触发回滚演练失败', 'error')
    } finally {
      setIsV4OpsBusy(false)
    }
  }, [
    buildV4AdminHeaders,
    currentActorName,
    isV4OpsBusy,
    parseJsonObjectInput,
    showToast,
    v4RollbackEnvironment,
    v4RollbackPlan,
    v4RollbackPolicyId,
    v4RollbackResult,
    v4RollbackSummary,
    v4RollbackTriggerType
  ])

  const queryV4RollbackDrill = useCallback(async () => {
    const targetDrillId = v4RollbackDrillId.trim() || v4RollbackDrillResult?.id || ''
    if (!targetDrillId) {
      showToast('请填写演练 ID 或先触发一次演练', 'info')
      return
    }
    if (isV4OpsBusy) return
    setIsV4OpsBusy(true)
    try {
      const payload = await requestV4<{ success: boolean; drill: V4RollbackDrillResult }>(
        `/admin/reliability/drills/${encodeURIComponent(targetDrillId)}`,
        {
          headers: buildV4AdminHeaders()
        }
      )
      setV4RollbackDrillResult(payload.drill || null)
      if (payload.drill) {
        if (payload.drill.id) setV4RollbackDrillId(payload.drill.id)
        setV4RollbackPolicyId(payload.drill.policyId || '')
        setV4RollbackEnvironment(payload.drill.environment || '')
        setV4RollbackTriggerType(payload.drill.triggerType || '')
        setV4RollbackSummary(payload.drill.summary || '')
        setV4RollbackPlan(JSON.stringify(payload.drill.plan || {}, null, 2))
        setV4RollbackResult(JSON.stringify(payload.drill.result || {}, null, 2))
      }
      showToast(`演练状态：${payload.drill?.status || '-'}`, 'success')
    } catch (error: unknown) {
      const normalized = error instanceof Error ? error : new Error(String(error))
      showToast(normalized.message || '查询回滚演练失败', 'error')
    } finally {
      setIsV4OpsBusy(false)
    }
  }, [buildV4AdminHeaders, isV4OpsBusy, showToast, v4RollbackDrillId, v4RollbackDrillResult?.id])

  return {
    v4Permissions,
    v4PermissionSubjectId,
    v4PermissionRole,
    v4TimelineMergeResult,
    v4ErrorBudget,
    v4ReliabilityAlerts,
    v4ReliabilityAlertLevel,
    v4ReliabilityAlertStatus,
    v4ReliabilityAlertLimit,
    v4ErrorBudgetScope,
    v4ErrorBudgetTargetSlo,
    v4ErrorBudgetWindowDays,
    v4ErrorBudgetWarningThresholdRatio,
    v4ErrorBudgetAlertThresholdRatio,
    v4ErrorBudgetFreezeDeployOnBreach,
    v4RollbackPolicyId,
    v4RollbackEnvironment,
    v4RollbackTriggerType,
    v4RollbackSummary,
    v4RollbackPlan,
    v4RollbackResult,
    v4RollbackDrillId,
    v4RollbackDrillResult,
    v4AdminToken,
    isV4CollabBusy,
    isV4OpsBusy,
    setV4Permissions,
    setV4PermissionSubjectId,
    setV4PermissionRole,
    setV4AdminToken: setV4AdminTokenState,
    setIsV4CollabBusy,
    setV4ReliabilityAlertLevel,
    setV4ReliabilityAlertStatus,
    setV4ReliabilityAlertLimit,
    setV4ErrorBudgetScope,
    setV4ErrorBudgetTargetSlo,
    setV4ErrorBudgetWindowDays,
    setV4ErrorBudgetWarningThresholdRatio,
    setV4ErrorBudgetAlertThresholdRatio,
    setV4ErrorBudgetFreezeDeployOnBreach,
    setV4RollbackPolicyId,
    setV4RollbackEnvironment,
    setV4RollbackTriggerType,
    setV4RollbackSummary,
    setV4RollbackPlan,
    setV4RollbackResult,
    setV4RollbackDrillId,
    refreshV4Permissions,
    updateV4Permission,
    mergeV4Timeline,
    loadV4ReliabilityAlerts,
    acknowledgeV4ReliabilityAlert,
    loadV4ErrorBudget,
    updateV4ErrorBudget,
    triggerV4RollbackDrill,
    queryV4RollbackDrill
  }
}
