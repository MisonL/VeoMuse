import { useCallback, useEffect, useRef, useState } from 'react'
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
} from '../../comparison-lab/types'
import type {
  ProjectGovernanceClipBatchUpdateResult,
  ProjectGovernanceComment,
  ProjectGovernanceReview,
  ProjectGovernanceTemplate,
  ProjectGovernanceTemplateApplyResult
} from '../../comparison-lab/types'
import {
  buildGovernanceCommentListArgs,
  mergeUniqueComments,
  normalizeClipBatchOperations,
  parseGovernanceReviewScore,
  parseJsonArray,
  parseJsonObject,
  parseMentions,
  resolveSelectedCommentId
} from '../../telemetryDashboard.logic'

const resolveErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

export const useTelemetryGovernanceController = () => {
  const [governanceProjectId, setGovernanceProjectId] = useState('')
  const [governanceBusy, setGovernanceBusy] = useState(false)
  const [governanceCommentLimit, setGovernanceCommentLimit] = useState('20')
  const [governanceCommentCursor, setGovernanceCommentCursor] = useState('')
  const [governanceCommentHasMore, setGovernanceCommentHasMore] = useState(false)
  const [governanceComments, setGovernanceComments] = useState<ProjectGovernanceComment[]>([])
  const [governanceCommentAnchor, setGovernanceCommentAnchor] = useState('')
  const [governanceCommentContent, setGovernanceCommentContent] = useState('')
  const [governanceCommentMentions, setGovernanceCommentMentions] = useState('')
  const [governanceSelectedCommentId, setGovernanceSelectedCommentId] = useState('')
  const [governanceReviewLimit, setGovernanceReviewLimit] = useState('20')
  const [governanceReviews, setGovernanceReviews] = useState<ProjectGovernanceReview[]>([])
  const [governanceReviewDecision, setGovernanceReviewDecision] =
    useState<ProjectGovernanceReview['decision']>('approved')
  const [governanceReviewSummary, setGovernanceReviewSummary] = useState('')
  const [governanceReviewScore, setGovernanceReviewScore] = useState('')
  const [governanceTemplates, setGovernanceTemplates] = useState<ProjectGovernanceTemplate[]>([])
  const [governanceSelectedTemplateId, setGovernanceSelectedTemplateId] = useState('')
  const [governanceTemplateOptions, setGovernanceTemplateOptions] = useState('{}')
  const [governanceTemplateResult, setGovernanceTemplateResult] =
    useState<ProjectGovernanceTemplateApplyResult | null>(null)
  const [governanceBatchOperations, setGovernanceBatchOperations] = useState(
    '[\n  {"clipId":"clip-a","patch":{"start":0,"end":3}}\n]'
  )
  const [governanceBatchResult, setGovernanceBatchResult] =
    useState<ProjectGovernanceClipBatchUpdateResult | null>(null)
  const [governanceError, setGovernanceError] = useState('')

  const latestGovernanceRequestToken = useRef(0)

  const ensureGovernanceProjectId = useCallback(() => {
    const projectId = governanceProjectId.trim()
    if (!projectId) {
      setGovernanceError('请先输入项目 ID')
      return ''
    }
    return projectId
  }, [governanceProjectId])

  const handleLoadGovernanceComments = useCallback(
    async (append = false) => {
      const projectId = ensureGovernanceProjectId()
      if (!projectId) return
      const args = buildGovernanceCommentListArgs({
        append,
        cursor: governanceCommentCursor,
        limitInput: governanceCommentLimit,
        defaultLimit: 20
      })
      if (args.shouldStop) {
        setGovernanceCommentHasMore(false)
        return
      }
      const requestToken = ++latestGovernanceRequestToken.current
      const isStaleRequest = () =>
        requestToken !== latestGovernanceRequestToken.current ||
        governanceProjectId.trim() !== projectId
      setGovernanceBusy(true)
      setGovernanceError('')
      try {
        const payload = await listProjectGovernanceComments(projectId, {
          limit: args.limit,
          cursor: args.cursor
        })
        if (isStaleRequest()) return
        const rows = payload.comments || []
        const merged = mergeUniqueComments(governanceComments, rows, append)
        setGovernanceComments(merged)
        const nextCursor = payload.page.nextCursor || ''
        setGovernanceCommentCursor(nextCursor)
        setGovernanceCommentHasMore(Boolean(nextCursor) && payload.page.hasMore)
        setGovernanceSelectedCommentId(resolveSelectedCommentId(governanceSelectedCommentId, merged))
      } catch (error: unknown) {
        if (isStaleRequest()) return
        setGovernanceError(resolveErrorMessage(error, '加载项目评论失败'))
      } finally {
        if (!isStaleRequest()) {
          setGovernanceBusy(false)
        }
      }
    },
    [
      ensureGovernanceProjectId,
      governanceCommentCursor,
      governanceCommentLimit,
      governanceComments,
      governanceProjectId,
      governanceSelectedCommentId
    ]
  )

  const handleCreateGovernanceComment = useCallback(async () => {
    const projectId = ensureGovernanceProjectId()
    if (!projectId) return
    if (!governanceCommentContent.trim()) {
      setGovernanceError('请输入评论内容')
      return
    }
    const requestToken = ++latestGovernanceRequestToken.current
    const isStaleRequest = () =>
      requestToken !== latestGovernanceRequestToken.current ||
      governanceProjectId.trim() !== projectId
    setGovernanceBusy(true)
    setGovernanceError('')
    try {
      const comment = await createProjectGovernanceComment(projectId, {
        anchor: governanceCommentAnchor.trim() || undefined,
        content: governanceCommentContent.trim(),
        mentions: parseMentions(governanceCommentMentions)
      })
      if (isStaleRequest()) return
      if (comment) {
        setGovernanceComments((prev) => [comment, ...prev.filter((item) => item.id !== comment.id)])
        setGovernanceSelectedCommentId(comment.id)
      }
      setGovernanceCommentContent('')
      setGovernanceCommentMentions('')
    } catch (error: unknown) {
      if (isStaleRequest()) return
      setGovernanceError(resolveErrorMessage(error, '创建项目评论失败'))
    } finally {
      if (!isStaleRequest()) {
        setGovernanceBusy(false)
      }
    }
  }, [
    ensureGovernanceProjectId,
    governanceCommentAnchor,
    governanceCommentContent,
    governanceCommentMentions,
    governanceProjectId
  ])

  const handleResolveGovernanceComment = useCallback(async () => {
    const projectId = ensureGovernanceProjectId()
    if (!projectId) return
    if (!governanceSelectedCommentId.trim()) {
      setGovernanceError('请先选择评论')
      return
    }
    const requestToken = ++latestGovernanceRequestToken.current
    const isStaleRequest = () =>
      requestToken !== latestGovernanceRequestToken.current ||
      governanceProjectId.trim() !== projectId
    setGovernanceBusy(true)
    setGovernanceError('')
    try {
      const comment = await resolveProjectGovernanceComment(projectId, governanceSelectedCommentId)
      if (isStaleRequest()) return
      if (comment) {
        setGovernanceComments((prev) =>
          prev.map((item) => (item.id === comment.id ? comment : item))
        )
      }
    } catch (error: unknown) {
      if (isStaleRequest()) return
      setGovernanceError(resolveErrorMessage(error, '标记评论失败'))
    } finally {
      if (!isStaleRequest()) {
        setGovernanceBusy(false)
      }
    }
  }, [ensureGovernanceProjectId, governanceProjectId, governanceSelectedCommentId])

  const handleLoadGovernanceReviews = useCallback(async () => {
    const projectId = ensureGovernanceProjectId()
    if (!projectId) return
    const limit = normalizeProjectGovernanceLimit(governanceReviewLimit, 20)
    const requestToken = ++latestGovernanceRequestToken.current
    const isStaleRequest = () =>
      requestToken !== latestGovernanceRequestToken.current ||
      governanceProjectId.trim() !== projectId
    setGovernanceBusy(true)
    setGovernanceError('')
    try {
      const rows = await listProjectGovernanceReviews(projectId, { limit })
      if (isStaleRequest()) return
      setGovernanceReviews(rows)
    } catch (error: unknown) {
      if (isStaleRequest()) return
      setGovernanceError(resolveErrorMessage(error, '加载项目评审失败'))
    } finally {
      if (!isStaleRequest()) {
        setGovernanceBusy(false)
      }
    }
  }, [ensureGovernanceProjectId, governanceProjectId, governanceReviewLimit])

  const handleCreateGovernanceReview = useCallback(async () => {
    const projectId = ensureGovernanceProjectId()
    if (!projectId) return
    if (!governanceReviewSummary.trim()) {
      setGovernanceError('请输入评审摘要')
      return
    }
    const parsedScore = parseGovernanceReviewScore(governanceReviewScore)
    if (parsedScore.error) {
      setGovernanceError(parsedScore.error)
      return
    }
    const requestToken = ++latestGovernanceRequestToken.current
    const isStaleRequest = () =>
      requestToken !== latestGovernanceRequestToken.current ||
      governanceProjectId.trim() !== projectId
    setGovernanceBusy(true)
    setGovernanceError('')
    try {
      const review = await createProjectGovernanceReview(projectId, {
        decision: governanceReviewDecision,
        summary: governanceReviewSummary.trim(),
        score: parsedScore.score
      })
      if (isStaleRequest()) return
      if (review) {
        setGovernanceReviews((prev) => [review, ...prev.filter((item) => item.id !== review.id)])
      }
      setGovernanceReviewSummary('')
      setGovernanceReviewScore('')
    } catch (error: unknown) {
      if (isStaleRequest()) return
      setGovernanceError(resolveErrorMessage(error, '创建项目评审失败'))
    } finally {
      if (!isStaleRequest()) {
        setGovernanceBusy(false)
      }
    }
  }, [
    ensureGovernanceProjectId,
    governanceProjectId,
    governanceReviewDecision,
    governanceReviewScore,
    governanceReviewSummary
  ])

  const handleLoadGovernanceTemplates = useCallback(async () => {
    const projectId = ensureGovernanceProjectId()
    if (!projectId) return
    const requestToken = ++latestGovernanceRequestToken.current
    const isStaleRequest = () =>
      requestToken !== latestGovernanceRequestToken.current ||
      governanceProjectId.trim() !== projectId
    setGovernanceBusy(true)
    setGovernanceError('')
    try {
      const rows = await listProjectGovernanceTemplates(projectId)
      if (isStaleRequest()) return
      setGovernanceTemplates(rows)
      if (
        !governanceSelectedTemplateId ||
        rows.every((item) => item.id !== governanceSelectedTemplateId)
      ) {
        setGovernanceSelectedTemplateId(rows[0]?.id || '')
      }
    } catch (error: unknown) {
      if (isStaleRequest()) return
      setGovernanceError(resolveErrorMessage(error, '加载项目模板失败'))
    } finally {
      if (!isStaleRequest()) {
        setGovernanceBusy(false)
      }
    }
  }, [ensureGovernanceProjectId, governanceProjectId, governanceSelectedTemplateId])

  const handleApplyGovernanceTemplate = useCallback(async () => {
    const projectId = ensureGovernanceProjectId()
    if (!projectId) return
    if (!governanceSelectedTemplateId.trim()) {
      setGovernanceError('请先选择模板')
      return
    }
    let options: Record<string, unknown> = {}
    try {
      options = parseJsonObject(governanceTemplateOptions, '模板应用参数')
    } catch (error: unknown) {
      setGovernanceError(resolveErrorMessage(error, '模板应用参数解析失败'))
      return
    }
    const requestToken = ++latestGovernanceRequestToken.current
    const isStaleRequest = () =>
      requestToken !== latestGovernanceRequestToken.current ||
      governanceProjectId.trim() !== projectId
    setGovernanceBusy(true)
    setGovernanceError('')
    try {
      const result = await applyProjectGovernanceTemplate(projectId, {
        templateId: governanceSelectedTemplateId.trim(),
        options: Object.keys(options).length > 0 ? options : undefined
      })
      if (isStaleRequest()) return
      setGovernanceTemplateResult(result || null)
    } catch (error: unknown) {
      if (isStaleRequest()) return
      setGovernanceError(resolveErrorMessage(error, '应用项目模板失败'))
    } finally {
      if (!isStaleRequest()) {
        setGovernanceBusy(false)
      }
    }
  }, [
    ensureGovernanceProjectId,
    governanceProjectId,
    governanceSelectedTemplateId,
    governanceTemplateOptions
  ])

  const handleGovernanceBatchUpdateClips = useCallback(async () => {
    const projectId = ensureGovernanceProjectId()
    if (!projectId) return
    let rows: unknown[] = []
    try {
      rows = parseJsonArray(governanceBatchOperations, '批量更新 operations')
    } catch (error: unknown) {
      setGovernanceError(resolveErrorMessage(error, '批量更新参数解析失败'))
      return
    }
    const operations = normalizeClipBatchOperations(rows)
    if (operations.length === 0) {
      setGovernanceError('至少提供一条有效操作（clipId + patch）')
      return
    }
    const requestToken = ++latestGovernanceRequestToken.current
    const isStaleRequest = () =>
      requestToken !== latestGovernanceRequestToken.current ||
      governanceProjectId.trim() !== projectId
    setGovernanceBusy(true)
    setGovernanceError('')
    try {
      const result = await batchUpdateProjectGovernanceClips(projectId, operations)
      if (isStaleRequest()) return
      setGovernanceBatchResult(result || null)
    } catch (error: unknown) {
      if (isStaleRequest()) return
      setGovernanceError(resolveErrorMessage(error, '片段批量更新失败'))
    } finally {
      if (!isStaleRequest()) {
        setGovernanceBusy(false)
      }
    }
  }, [ensureGovernanceProjectId, governanceBatchOperations, governanceProjectId])

  useEffect(() => {
    setGovernanceCommentCursor('')
    setGovernanceCommentHasMore(false)
    setGovernanceSelectedCommentId('')
    setGovernanceTemplateResult(null)
    setGovernanceBatchResult(null)
    setGovernanceError('')
  }, [governanceProjectId])

  return {
    governanceProjectId,
    governanceBusy,
    governanceCommentLimit,
    governanceCommentCursor,
    governanceCommentHasMore,
    governanceComments,
    governanceCommentAnchor,
    governanceCommentContent,
    governanceCommentMentions,
    governanceSelectedCommentId,
    governanceReviewLimit,
    governanceReviews,
    governanceReviewDecision,
    governanceReviewSummary,
    governanceReviewScore,
    governanceTemplates,
    governanceSelectedTemplateId,
    governanceTemplateOptions,
    governanceTemplateResult,
    governanceBatchOperations,
    governanceBatchResult,
    governanceError,
    setGovernanceProjectId,
    setGovernanceCommentLimit,
    setGovernanceCommentAnchor,
    setGovernanceCommentContent,
    setGovernanceCommentMentions,
    setGovernanceSelectedCommentId,
    setGovernanceReviewLimit,
    setGovernanceReviewDecision,
    setGovernanceReviewSummary,
    setGovernanceReviewScore,
    setGovernanceSelectedTemplateId,
    setGovernanceTemplateOptions,
    setGovernanceBatchOperations,
    handleLoadGovernanceComments,
    handleCreateGovernanceComment,
    handleResolveGovernanceComment,
    handleLoadGovernanceReviews,
    handleCreateGovernanceReview,
    handleLoadGovernanceTemplates,
    handleApplyGovernanceTemplate,
    handleGovernanceBatchUpdateClips
  }
}
