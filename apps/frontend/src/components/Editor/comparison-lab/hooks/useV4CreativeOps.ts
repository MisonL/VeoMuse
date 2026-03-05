import { useCallback, useState } from 'react'
import { requestV4 } from '../api'
import type {
  V4AssetReuseRecord,
  V4AssetReuseResult,
  V4BatchJob,
  V4Workflow,
  V4WorkflowRun
} from '../types'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface UseV4CreativeOpsOptions {
  projectId: string
  currentActorName: string
  parseJsonObjectInput: (raw: string, fieldName: string) => Record<string, unknown> | null
  showToast: (message: string, type?: ToastType) => void
}

export const useV4CreativeOps = ({
  projectId,
  currentActorName,
  parseJsonObjectInput,
  showToast
}: UseV4CreativeOpsOptions) => {
  const [v4Workflows, setV4Workflows] = useState<V4Workflow[]>([])
  const [v4SelectedWorkflowId, setV4SelectedWorkflowId] = useState('')
  const [v4WorkflowName, setV4WorkflowName] = useState('默认 Workflow')
  const [v4WorkflowDescription, setV4WorkflowDescription] = useState('')
  const [v4WorkflowRunPayload, setV4WorkflowRunPayload] = useState('{}')
  const [v4WorkflowRunResult, setV4WorkflowRunResult] = useState<V4WorkflowRun | null>(null)
  const [v4WorkflowRuns, setV4WorkflowRuns] = useState<V4WorkflowRun[]>([])
  const [v4WorkflowRunsCursor, setV4WorkflowRunsCursor] = useState('')
  const [v4WorkflowRunsLimit, setV4WorkflowRunsLimit] = useState('20')
  const [v4WorkflowRunsHasMore, setV4WorkflowRunsHasMore] = useState(false)
  const [v4BatchJobType, setV4BatchJobType] = useState('render.batch')
  const [v4BatchJobPayload, setV4BatchJobPayload] = useState('{"items":[]}')
  const [v4BatchJobId, setV4BatchJobId] = useState('')
  const [v4BatchJobStatus, setV4BatchJobStatus] = useState<V4BatchJob | null>(null)
  const [v4AssetReuseSourceId, setV4AssetReuseSourceId] = useState('')
  const [v4AssetReuseTargetId, setV4AssetReuseTargetId] = useState('')
  const [v4AssetReuseNote, setV4AssetReuseNote] = useState('')
  const [v4AssetReuseResult, setV4AssetReuseResult] = useState<V4AssetReuseResult | null>(null)
  const [v4AssetReuseHistoryAssetId, setV4AssetReuseHistoryAssetId] = useState('')
  const [v4AssetReuseHistorySourceProjectId, setV4AssetReuseHistorySourceProjectId] = useState('')
  const [v4AssetReuseHistoryTargetProjectId, setV4AssetReuseHistoryTargetProjectId] = useState('')
  const [v4AssetReuseHistoryLimit, setV4AssetReuseHistoryLimit] = useState('20')
  const [v4AssetReuseHistoryOffset, setV4AssetReuseHistoryOffset] = useState('0')
  const [v4AssetReuseHistoryRecords, setV4AssetReuseHistoryRecords] = useState<
    V4AssetReuseRecord[]
  >([])
  const [isV4CreativeBusy, setIsV4CreativeBusy] = useState(false)

  const refreshV4Workflows = useCallback(async () => {
    setIsV4CreativeBusy(true)
    try {
      const payload = await requestV4<{ success: boolean; workflows: V4Workflow[] }>(
        '/creative/prompt-workflows'
      )
      const rows = payload.workflows || []
      setV4Workflows(rows)
      if (!v4SelectedWorkflowId || rows.every((item) => item.id !== v4SelectedWorkflowId)) {
        setV4SelectedWorkflowId(rows[0]?.id || '')
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '加载 workflow 失败'
      showToast(message || '加载 workflow 失败', 'error')
    } finally {
      setIsV4CreativeBusy(false)
    }
  }, [showToast, v4SelectedWorkflowId])

  const createV4Workflow = useCallback(async () => {
    if (!v4WorkflowName.trim()) {
      showToast('请输入 workflow 名称', 'info')
      return
    }
    if (isV4CreativeBusy) return
    setIsV4CreativeBusy(true)
    try {
      const payload = await requestV4<{ success: boolean; workflow: V4Workflow }>(
        '/creative/prompt-workflows',
        {
          method: 'POST',
          body: JSON.stringify({
            name: v4WorkflowName.trim(),
            description: v4WorkflowDescription.trim() || undefined
          })
        },
        {
          retry: {
            idempotent: true,
            maxRetries: 1
          }
        }
      )
      if (payload.workflow) {
        setV4Workflows((prev) => [
          payload.workflow,
          ...prev.filter((item) => item.id !== payload.workflow.id)
        ])
        setV4SelectedWorkflowId(payload.workflow.id)
      }
      showToast('v4 Workflow 创建成功', 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '创建 workflow 失败'
      showToast(message || '创建 workflow 失败', 'error')
    } finally {
      setIsV4CreativeBusy(false)
    }
  }, [isV4CreativeBusy, showToast, v4WorkflowDescription, v4WorkflowName])

  const runV4Workflow = useCallback(async () => {
    if (!v4SelectedWorkflowId) {
      showToast('请先选择 workflow', 'info')
      return
    }
    const input = parseJsonObjectInput(v4WorkflowRunPayload, 'Workflow Run Payload')
    if (!input) return
    if (isV4CreativeBusy) return
    setIsV4CreativeBusy(true)
    try {
      const payload = await requestV4<{ success: boolean; run: V4WorkflowRun }>(
        `/creative/prompt-workflows/${encodeURIComponent(v4SelectedWorkflowId)}/run`,
        {
          method: 'POST',
          body: JSON.stringify({
            triggerType: 'manual',
            input
          })
        }
      )
      setV4WorkflowRunResult(payload.run || null)
      if (payload.run) {
        setV4WorkflowRuns((prev) => [
          payload.run,
          ...prev.filter((item) => item.id !== payload.run.id)
        ])
      }
      showToast(`Workflow 已触发：${payload.run?.id || '-'}`, 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '运行 workflow 失败'
      showToast(message || '运行 workflow 失败', 'error')
    } finally {
      setIsV4CreativeBusy(false)
    }
  }, [
    isV4CreativeBusy,
    parseJsonObjectInput,
    showToast,
    v4SelectedWorkflowId,
    v4WorkflowRunPayload
  ])

  const queryV4WorkflowRuns = useCallback(
    async (append = false) => {
      if (!v4SelectedWorkflowId) {
        showToast('请先选择 workflow', 'info')
        return
      }
      const limitRaw = v4WorkflowRunsLimit.trim() || '20'
      const limit = Number.parseInt(limitRaw, 10)
      if (!Number.isFinite(limit) || limit <= 0) {
        showToast('Workflow runs limit 必须是大于 0 的整数', 'warning')
        return
      }
      const nextCursor = append ? v4WorkflowRunsCursor.trim() : ''
      if (append && !nextCursor) {
        setV4WorkflowRunsHasMore(false)
        return
      }
      if (isV4CreativeBusy) return
      setIsV4CreativeBusy(true)
      try {
        const query = new URLSearchParams({
          limit: String(Math.min(limit, 200))
        })
        if (nextCursor) query.set('cursor', nextCursor)
        const payload = await requestV4<{
          success: boolean
          runs: V4WorkflowRun[]
          page?: {
            cursor?: string | null
            nextCursor?: string | null
            limit?: number
            hasMore?: boolean
          }
        }>(
          `/creative/prompt-workflows/${encodeURIComponent(v4SelectedWorkflowId)}/runs?${query.toString()}`
        )
        const rows = payload.runs || []
        setV4WorkflowRuns((prev) => {
          if (!append) return rows
          return [
            ...prev,
            ...rows.filter((item) => prev.every((prevItem) => prevItem.id !== item.id))
          ]
        })
        const inferredCursor = rows.length > 0 ? rows[rows.length - 1]?.createdAt || '' : ''
        const cursorFromPage =
          typeof payload.page?.nextCursor === 'string'
            ? payload.page.nextCursor
            : typeof payload.page?.cursor === 'string'
              ? payload.page.cursor
              : inferredCursor
        const hasMore =
          typeof payload.page?.hasMore === 'boolean'
            ? payload.page.hasMore
            : rows.length >= Math.min(limit, 200)
        setV4WorkflowRunsCursor(cursorFromPage || '')
        setV4WorkflowRunsHasMore(Boolean(cursorFromPage) && hasMore)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : '加载 Workflow runs 失败'
        showToast(message || '加载 Workflow runs 失败', 'error')
      } finally {
        setIsV4CreativeBusy(false)
      }
    },
    [isV4CreativeBusy, showToast, v4SelectedWorkflowId, v4WorkflowRunsCursor, v4WorkflowRunsLimit]
  )

  const createV4BatchJob = useCallback(async () => {
    if (!v4BatchJobType.trim()) {
      showToast('请输入 batch job 类型', 'info')
      return
    }
    const input = parseJsonObjectInput(v4BatchJobPayload, 'Batch Job Payload')
    if (!input) return
    if (isV4CreativeBusy) return
    setIsV4CreativeBusy(true)
    try {
      const workflowRunId =
        typeof input.workflowRunId === 'string' && input.workflowRunId.trim()
          ? input.workflowRunId.trim()
          : undefined
      const createdBy =
        typeof input.createdBy === 'string' && input.createdBy.trim()
          ? input.createdBy.trim()
          : undefined
      const items = Array.isArray(input.items)
        ? input.items
            .map((item, index) => {
              if (!item || typeof item !== 'object' || Array.isArray(item)) return null
              const row = item as Record<string, unknown>
              const itemInput =
                row.input && typeof row.input === 'object' && !Array.isArray(row.input)
                  ? (row.input as Record<string, unknown>)
                  : undefined
              const itemKeyRaw = typeof row.itemKey === 'string' ? row.itemKey.trim() : ''
              return {
                itemKey: itemKeyRaw || `item-${index + 1}`,
                input: itemInput
              }
            })
            .filter(
              (item): item is { itemKey: string; input: Record<string, unknown> | undefined } =>
                Boolean(item)
            )
        : undefined
      const explicitPayload =
        input.payload && typeof input.payload === 'object' && !Array.isArray(input.payload)
          ? (input.payload as Record<string, unknown>)
          : null
      const fallbackPayload = Object.entries(input).reduce<Record<string, unknown>>(
        (acc, [key, value]) => {
          if (
            key === 'workflowRunId' ||
            key === 'items' ||
            key === 'createdBy' ||
            key === 'payload'
          ) {
            return acc
          }
          acc[key] = value
          return acc
        },
        {}
      )
      const payloadInput = explicitPayload || fallbackPayload
      const payloadRecord = Object.keys(payloadInput).length > 0 ? payloadInput : undefined

      const payload = await requestV4<{ success: boolean; job: V4BatchJob }>(
        '/creative/batch-jobs',
        {
          method: 'POST',
          body: JSON.stringify({
            workflowRunId,
            jobType: v4BatchJobType.trim(),
            payload: payloadRecord,
            items,
            createdBy
          })
        }
      )
      setV4BatchJobStatus(payload.job || null)
      setV4BatchJobId(payload.job?.id || '')
      showToast(`Batch Job 已创建：${payload.job?.id || '-'}`, 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '创建 batch job 失败'
      showToast(message || '创建 batch job 失败', 'error')
    } finally {
      setIsV4CreativeBusy(false)
    }
  }, [isV4CreativeBusy, parseJsonObjectInput, showToast, v4BatchJobPayload, v4BatchJobType])

  const queryV4BatchJob = useCallback(async () => {
    const jobId = v4BatchJobId.trim()
    if (!jobId) {
      showToast('请填写 Batch Job ID', 'info')
      return
    }
    if (isV4CreativeBusy) return
    setIsV4CreativeBusy(true)
    try {
      const payload = await requestV4<{ success: boolean; job: V4BatchJob }>(
        `/creative/batch-jobs/${encodeURIComponent(jobId)}`
      )
      setV4BatchJobStatus(payload.job || null)
      showToast(`Batch Job 状态：${payload.job?.status || '-'}`, 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '查询 batch job 失败'
      showToast(message || '查询 batch job 失败', 'error')
    } finally {
      setIsV4CreativeBusy(false)
    }
  }, [isV4CreativeBusy, showToast, v4BatchJobId])

  const callV4AssetReuse = useCallback(async () => {
    if (!v4AssetReuseSourceId.trim() || !v4AssetReuseTargetId.trim()) {
      showToast('请填写来源 Asset 与目标 ID', 'info')
      return
    }
    if (isV4CreativeBusy) return
    setIsV4CreativeBusy(true)
    try {
      const assetId = v4AssetReuseSourceId.trim()
      const payload = await requestV4<{ success: boolean; record: V4AssetReuseResult }>(
        `/assets/${encodeURIComponent(assetId)}/reuse`,
        {
          method: 'POST',
          body: JSON.stringify({
            sourceProjectId: projectId || undefined,
            targetProjectId: v4AssetReuseTargetId.trim() || undefined,
            reusedBy: currentActorName || undefined,
            context: {
              note: v4AssetReuseNote.trim() || undefined,
              source: 'comparison-lab'
            }
          })
        }
      )
      setV4AssetReuseResult(payload.record || null)
      if (
        payload.record &&
        (!v4AssetReuseHistoryAssetId.trim() ||
          v4AssetReuseHistoryAssetId.trim() === payload.record.assetId)
      ) {
        setV4AssetReuseHistoryRecords((prev) => [
          payload.record,
          ...prev.filter((item) => item.id !== payload.record.id)
        ])
      }
      showToast(`Asset Reuse 记录已创建：${payload.record?.id || '-'}`, 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Asset Reuse 调用失败'
      showToast(message || 'Asset Reuse 调用失败', 'error')
    } finally {
      setIsV4CreativeBusy(false)
    }
  }, [
    currentActorName,
    isV4CreativeBusy,
    projectId,
    showToast,
    v4AssetReuseHistoryAssetId,
    v4AssetReuseNote,
    v4AssetReuseSourceId,
    v4AssetReuseTargetId
  ])

  const queryV4AssetReuseHistory = useCallback(async () => {
    const limitRaw = v4AssetReuseHistoryLimit.trim() || '20'
    const limit = Number.parseInt(limitRaw, 10)
    if (!Number.isFinite(limit) || limit <= 0) {
      showToast('资产复用历史 limit 必须是大于 0 的整数', 'warning')
      return
    }
    const offsetRaw = v4AssetReuseHistoryOffset.trim() || '0'
    const offset = Number.parseInt(offsetRaw, 10)
    if (!Number.isFinite(offset) || offset < 0) {
      showToast('资产复用历史 offset 必须是大于等于 0 的整数', 'warning')
      return
    }
    if (isV4CreativeBusy) return
    setIsV4CreativeBusy(true)
    try {
      const query = new URLSearchParams({
        limit: String(Math.min(limit, 200)),
        offset: String(offset)
      })
      const assetId = v4AssetReuseHistoryAssetId.trim()
      if (assetId) query.set('assetId', assetId)
      const sourceProjectId = v4AssetReuseHistorySourceProjectId.trim()
      if (sourceProjectId) query.set('sourceProjectId', sourceProjectId)
      const targetProjectId = v4AssetReuseHistoryTargetProjectId.trim()
      if (targetProjectId) query.set('targetProjectId', targetProjectId)
      const payload = await requestV4<{ success: boolean; records: V4AssetReuseRecord[] }>(
        `/assets/reuse-history?${query.toString()}`
      )
      const records = payload.records || []
      setV4AssetReuseHistoryRecords(records)
      showToast(`资产复用历史已加载 ${records.length} 条`, 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '查询资产复用历史失败'
      showToast(message || '查询资产复用历史失败', 'error')
    } finally {
      setIsV4CreativeBusy(false)
    }
  }, [
    isV4CreativeBusy,
    showToast,
    v4AssetReuseHistoryAssetId,
    v4AssetReuseHistoryLimit,
    v4AssetReuseHistoryOffset,
    v4AssetReuseHistorySourceProjectId,
    v4AssetReuseHistoryTargetProjectId
  ])

  return {
    v4Workflows,
    v4SelectedWorkflowId,
    v4WorkflowName,
    v4WorkflowDescription,
    v4WorkflowRunPayload,
    v4WorkflowRunResult,
    v4WorkflowRuns,
    v4WorkflowRunsLimit,
    v4WorkflowRunsHasMore,
    v4BatchJobType,
    v4BatchJobPayload,
    v4BatchJobId,
    v4BatchJobStatus,
    v4AssetReuseSourceId,
    v4AssetReuseTargetId,
    v4AssetReuseNote,
    v4AssetReuseResult,
    v4AssetReuseHistoryAssetId,
    v4AssetReuseHistorySourceProjectId,
    v4AssetReuseHistoryTargetProjectId,
    v4AssetReuseHistoryLimit,
    v4AssetReuseHistoryOffset,
    v4AssetReuseHistoryRecords,
    isV4CreativeBusy,
    setV4SelectedWorkflowId,
    setV4WorkflowName,
    setV4WorkflowDescription,
    setV4WorkflowRunPayload,
    setV4WorkflowRuns,
    setV4WorkflowRunsCursor,
    setV4WorkflowRunsHasMore,
    setV4WorkflowRunsLimit,
    setV4BatchJobType,
    setV4BatchJobPayload,
    setV4BatchJobId,
    setV4AssetReuseSourceId,
    setV4AssetReuseTargetId,
    setV4AssetReuseNote,
    setV4AssetReuseHistoryAssetId,
    setV4AssetReuseHistorySourceProjectId,
    setV4AssetReuseHistoryTargetProjectId,
    setV4AssetReuseHistoryLimit,
    setV4AssetReuseHistoryOffset,
    refreshV4Workflows,
    createV4Workflow,
    runV4Workflow,
    queryV4WorkflowRuns,
    createV4BatchJob,
    queryV4BatchJob,
    callV4AssetReuse,
    queryV4AssetReuseHistory
  }
}
