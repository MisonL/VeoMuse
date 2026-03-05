import { useCallback, useEffect, useState } from 'react'
import {
  applyProjectGovernanceTemplate,
  batchUpdateProjectGovernanceClips,
  createProjectGovernanceComment,
  createProjectGovernanceReview,
  listProjectGovernanceComments,
  listProjectGovernanceReviews,
  listProjectGovernanceTemplates,
  normalizeProjectGovernanceLimit,
  resolveProjectGovernanceComment
} from '../types'
import type {
  LabMode,
  ProjectGovernanceClipBatchUpdateResult,
  ProjectGovernanceComment,
  ProjectGovernanceReview,
  ProjectGovernanceTemplate,
  ProjectGovernanceTemplateApplyResult
} from '../types'

type ToastType = 'success' | 'error' | 'warning' | 'info'

type ParseMentionsInput = (raw: string) => string[]
type ParseJsonObjectInput = (raw: string, fieldName: string) => Record<string, unknown> | null
type ParseJsonArrayInput = (raw: string, fieldName: string) => unknown[] | null

interface UseProjectGovernanceOptions {
  projectId: string
  labMode: LabMode
  showToast: (message: string, type?: ToastType) => void
  parseMentionsInput: ParseMentionsInput
  parseJsonObjectInput: ParseJsonObjectInput
  parseJsonArrayInput: ParseJsonArrayInput
}

const DEFAULT_BATCH_OPERATIONS = '[\n  {"clipId":"clip-a","patch":{"start":0,"end":4}}\n]'

const normalizeBatchOperations = (operationsRaw: unknown[]) => {
  return operationsRaw
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null
      const row = item as Record<string, unknown>
      const clipId = typeof row.clipId === 'string' ? row.clipId.trim() : ''
      const patch =
        row.patch && typeof row.patch === 'object' && !Array.isArray(row.patch)
          ? (row.patch as Record<string, unknown>)
          : null
      if (!clipId || !patch) return null
      return { clipId, patch }
    })
    .filter((item): item is { clipId: string; patch: Record<string, unknown> } => Boolean(item))
}

export const useProjectGovernance = ({
  projectId,
  labMode,
  showToast,
  parseMentionsInput,
  parseJsonObjectInput,
  parseJsonArrayInput
}: UseProjectGovernanceOptions) => {
  const [projectComments, setProjectComments] = useState<ProjectGovernanceComment[]>([])
  const [projectCommentCursor, setProjectCommentCursor] = useState('')
  const [projectCommentLimit, setProjectCommentLimit] = useState('20')
  const [projectCommentHasMore, setProjectCommentHasMore] = useState(false)
  const [projectCommentAnchor, setProjectCommentAnchor] = useState('')
  const [projectCommentContent, setProjectCommentContent] = useState('')
  const [projectCommentMentions, setProjectCommentMentions] = useState('')
  const [projectSelectedCommentId, setProjectSelectedCommentId] = useState('')
  const [projectReviews, setProjectReviews] = useState<ProjectGovernanceReview[]>([])
  const [projectReviewLimit, setProjectReviewLimit] = useState('20')
  const [projectReviewDecision, setProjectReviewDecision] =
    useState<ProjectGovernanceReview['decision']>('approved')
  const [projectReviewSummary, setProjectReviewSummary] = useState('')
  const [projectReviewScore, setProjectReviewScore] = useState('')
  const [projectTemplates, setProjectTemplates] = useState<ProjectGovernanceTemplate[]>([])
  const [projectSelectedTemplateId, setProjectSelectedTemplateId] = useState('')
  const [projectTemplateApplyOptions, setProjectTemplateApplyOptions] = useState('{}')
  const [projectTemplateApplyResult, setProjectTemplateApplyResult] =
    useState<ProjectGovernanceTemplateApplyResult | null>(null)
  const [projectClipBatchOperations, setProjectClipBatchOperations] =
    useState(DEFAULT_BATCH_OPERATIONS)
  const [projectClipBatchResult, setProjectClipBatchResult] =
    useState<ProjectGovernanceClipBatchUpdateResult | null>(null)
  const [isProjectGovernanceBusy, setIsProjectGovernanceBusy] = useState(false)

  const loadProjectComments = useCallback(
    async (append = false) => {
      if (!projectId) {
        setProjectComments([])
        setProjectSelectedCommentId('')
        setProjectCommentCursor('')
        setProjectCommentHasMore(false)
        return
      }
      const limit = normalizeProjectGovernanceLimit(projectCommentLimit, 20)
      const nextCursor = append ? projectCommentCursor.trim() : ''
      if (append && !nextCursor) {
        setProjectCommentHasMore(false)
        return
      }
      if (isProjectGovernanceBusy) return
      setIsProjectGovernanceBusy(true)
      try {
        const payload = await listProjectGovernanceComments(projectId, {
          limit,
          cursor: nextCursor || undefined
        })
        const rows = payload.comments || []
        const merged = append
          ? [
              ...projectComments,
              ...rows.filter((item) => projectComments.every((prev) => prev.id !== item.id))
            ]
          : rows
        setProjectComments(merged)
        const cursor = payload.page.nextCursor || ''
        const hasMore = Boolean(cursor) && payload.page.hasMore
        setProjectCommentCursor(cursor)
        setProjectCommentHasMore(hasMore)
        if (
          !projectSelectedCommentId ||
          merged.every((item) => item.id !== projectSelectedCommentId)
        ) {
          setProjectSelectedCommentId(merged[0]?.id || '')
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : '加载项目评论失败'
        showToast(message || '加载项目评论失败', 'error')
      } finally {
        setIsProjectGovernanceBusy(false)
      }
    },
    [
      projectId,
      projectCommentLimit,
      projectCommentCursor,
      isProjectGovernanceBusy,
      projectComments,
      projectSelectedCommentId,
      showToast
    ]
  )

  const createProjectCommentEntry = useCallback(async () => {
    if (!projectId) {
      showToast('请先创建或加入项目', 'info')
      return
    }
    if (!projectCommentContent.trim()) {
      showToast('请输入评论内容', 'info')
      return
    }
    if (isProjectGovernanceBusy) return
    setIsProjectGovernanceBusy(true)
    try {
      const comment = await createProjectGovernanceComment(projectId, {
        anchor: projectCommentAnchor.trim() || undefined,
        content: projectCommentContent.trim(),
        mentions: parseMentionsInput(projectCommentMentions)
      })
      if (comment) {
        setProjectComments((prev) => [comment, ...prev.filter((item) => item.id !== comment.id)])
        setProjectSelectedCommentId(comment.id)
      }
      setProjectCommentContent('')
      setProjectCommentMentions('')
      showToast('项目评论已创建', 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '创建项目评论失败'
      showToast(message || '创建项目评论失败', 'error')
    } finally {
      setIsProjectGovernanceBusy(false)
    }
  }, [
    projectId,
    projectCommentContent,
    isProjectGovernanceBusy,
    projectCommentAnchor,
    parseMentionsInput,
    projectCommentMentions,
    showToast
  ])

  const resolveProjectCommentEntry = useCallback(async () => {
    if (!projectId || !projectSelectedCommentId.trim()) {
      showToast('请先选择评论', 'info')
      return
    }
    if (isProjectGovernanceBusy) return
    setIsProjectGovernanceBusy(true)
    try {
      const comment = await resolveProjectGovernanceComment(projectId, projectSelectedCommentId)
      if (comment) {
        setProjectComments((prev) => prev.map((item) => (item.id === comment.id ? comment : item)))
      }
      showToast('项目评论已标记为已解决', 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '标记项目评论失败'
      showToast(message || '标记项目评论失败', 'error')
    } finally {
      setIsProjectGovernanceBusy(false)
    }
  }, [projectId, projectSelectedCommentId, isProjectGovernanceBusy, showToast])

  const loadProjectReviews = useCallback(async () => {
    if (!projectId) {
      setProjectReviews([])
      return
    }
    const limit = normalizeProjectGovernanceLimit(projectReviewLimit, 20)
    if (isProjectGovernanceBusy) return
    setIsProjectGovernanceBusy(true)
    try {
      const rows = await listProjectGovernanceReviews(projectId, { limit })
      setProjectReviews(rows)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '加载项目评审失败'
      showToast(message || '加载项目评审失败', 'error')
    } finally {
      setIsProjectGovernanceBusy(false)
    }
  }, [projectId, projectReviewLimit, isProjectGovernanceBusy, showToast])

  const createProjectReviewEntry = useCallback(async () => {
    if (!projectId) {
      showToast('请先创建或加入项目', 'info')
      return
    }
    if (!projectReviewSummary.trim()) {
      showToast('请输入评审摘要', 'info')
      return
    }
    let score: number | undefined
    const scoreRaw = projectReviewScore.trim()
    if (scoreRaw) {
      score = Number.parseFloat(scoreRaw)
      if (!Number.isFinite(score)) {
        showToast('评分必须为数字', 'warning')
        return
      }
    }
    if (isProjectGovernanceBusy) return
    setIsProjectGovernanceBusy(true)
    try {
      const review = await createProjectGovernanceReview(projectId, {
        decision: projectReviewDecision,
        summary: projectReviewSummary.trim(),
        score
      })
      if (review) {
        setProjectReviews((prev) => [review, ...prev.filter((item) => item.id !== review.id)])
      }
      setProjectReviewSummary('')
      setProjectReviewScore('')
      showToast('项目评审已提交', 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '提交项目评审失败'
      showToast(message || '提交项目评审失败', 'error')
    } finally {
      setIsProjectGovernanceBusy(false)
    }
  }, [
    projectId,
    projectReviewSummary,
    projectReviewScore,
    isProjectGovernanceBusy,
    showToast,
    projectReviewDecision
  ])

  const loadProjectTemplates = useCallback(async () => {
    if (!projectId) {
      setProjectTemplates([])
      setProjectSelectedTemplateId('')
      return
    }
    if (isProjectGovernanceBusy) return
    setIsProjectGovernanceBusy(true)
    try {
      const rows = await listProjectGovernanceTemplates(projectId)
      setProjectTemplates(rows)
      if (
        !projectSelectedTemplateId ||
        rows.every((item) => item.id !== projectSelectedTemplateId)
      ) {
        setProjectSelectedTemplateId(rows[0]?.id || '')
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '加载项目模板失败'
      showToast(message || '加载项目模板失败', 'error')
    } finally {
      setIsProjectGovernanceBusy(false)
    }
  }, [projectId, isProjectGovernanceBusy, projectSelectedTemplateId, showToast])

  const applyProjectTemplateEntry = useCallback(async () => {
    if (!projectId) {
      showToast('请先创建或加入项目', 'info')
      return
    }
    if (!projectSelectedTemplateId.trim()) {
      showToast('请先选择模板', 'info')
      return
    }
    const options = parseJsonObjectInput(projectTemplateApplyOptions, '模板应用参数')
    if (!options) return
    if (isProjectGovernanceBusy) return
    setIsProjectGovernanceBusy(true)
    try {
      const result = await applyProjectGovernanceTemplate(projectId, {
        templateId: projectSelectedTemplateId.trim(),
        options: Object.keys(options).length > 0 ? options : undefined
      })
      setProjectTemplateApplyResult(result || null)
      showToast(`模板应用成功：${result?.traceId || '-'}`, 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '应用模板失败'
      showToast(message || '应用模板失败', 'error')
    } finally {
      setIsProjectGovernanceBusy(false)
    }
  }, [
    projectId,
    projectSelectedTemplateId,
    parseJsonObjectInput,
    projectTemplateApplyOptions,
    isProjectGovernanceBusy,
    showToast
  ])

  const batchUpdateProjectClipsEntry = useCallback(async () => {
    if (!projectId) {
      showToast('请先创建或加入项目', 'info')
      return
    }
    const operationsRaw = parseJsonArrayInput(projectClipBatchOperations, '片段批量更新操作')
    if (!operationsRaw) return
    const operations = normalizeBatchOperations(operationsRaw)
    if (operations.length === 0) {
      showToast('至少提供一条有效操作（clipId + patch）', 'warning')
      return
    }
    if (isProjectGovernanceBusy) return
    setIsProjectGovernanceBusy(true)
    try {
      const result = await batchUpdateProjectGovernanceClips(projectId, operations)
      setProjectClipBatchResult(result || null)
      showToast(`片段批量更新完成：accepted ${result?.accepted ?? 0}`, 'success')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '片段批量更新失败'
      showToast(message || '片段批量更新失败', 'error')
    } finally {
      setIsProjectGovernanceBusy(false)
    }
  }, [
    projectId,
    parseJsonArrayInput,
    projectClipBatchOperations,
    isProjectGovernanceBusy,
    showToast
  ])

  useEffect(() => {
    setProjectCommentCursor('')
    setProjectCommentHasMore(false)
    setProjectSelectedCommentId('')
    setProjectTemplateApplyResult(null)
    setProjectClipBatchResult(null)
  }, [projectId])

  useEffect(() => {
    if (labMode !== 'collab' || !projectId) return
    void loadProjectComments(false)
    void loadProjectReviews()
    void loadProjectTemplates()
  }, [labMode, projectId, loadProjectComments, loadProjectReviews, loadProjectTemplates])

  return {
    projectComments,
    projectCommentCursor,
    projectCommentLimit,
    projectCommentHasMore,
    projectCommentAnchor,
    projectCommentContent,
    projectCommentMentions,
    projectSelectedCommentId,
    projectReviews,
    projectReviewLimit,
    projectReviewDecision,
    projectReviewSummary,
    projectReviewScore,
    projectTemplates,
    projectSelectedTemplateId,
    projectTemplateApplyOptions,
    projectTemplateApplyResult,
    projectClipBatchOperations,
    projectClipBatchResult,
    isProjectGovernanceBusy,
    setProjectCommentLimit,
    setProjectCommentAnchor,
    setProjectCommentContent,
    setProjectCommentMentions,
    setProjectSelectedCommentId,
    setProjectReviewLimit,
    setProjectReviewDecision,
    setProjectReviewSummary,
    setProjectReviewScore,
    setProjectSelectedTemplateId,
    setProjectTemplateApplyOptions,
    setProjectClipBatchOperations,
    loadProjectComments,
    createProjectCommentEntry,
    resolveProjectCommentEntry,
    loadProjectReviews,
    createProjectReviewEntry,
    loadProjectTemplates,
    applyProjectTemplateEntry,
    batchUpdateProjectClipsEntry
  }
}
