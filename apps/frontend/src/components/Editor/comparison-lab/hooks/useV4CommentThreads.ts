import { useCallback, useEffect, useState } from 'react'
import { requestV4 } from '../api'
import type { V4CommentThread } from '../types'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface UseV4CommentThreadsOptions {
  projectId: string
  isV4CollabBusy: boolean
  setIsV4CollabBusy: (value: boolean) => void
  parseMentionsInput: (raw: string) => string[]
  showToast: (message: string, type?: ToastType) => void
}

export const useV4CommentThreads = ({
  projectId,
  isV4CollabBusy,
  setIsV4CollabBusy,
  parseMentionsInput,
  showToast
}: UseV4CommentThreadsOptions) => {
  const [v4CommentThreads, setV4CommentThreads] = useState<V4CommentThread[]>([])
  const [v4CommentThreadCursor, setV4CommentThreadCursor] = useState('')
  const [v4CommentThreadLimit, setV4CommentThreadLimit] = useState('20')
  const [v4CommentThreadHasMore, setV4CommentThreadHasMore] = useState(false)
  const [v4CommentAnchor, setV4CommentAnchor] = useState('')
  const [v4CommentContent, setV4CommentContent] = useState('')
  const [v4CommentMentions, setV4CommentMentions] = useState('')
  const [v4SelectedThreadId, setV4SelectedThreadId] = useState('')
  const [v4CommentReplyContent, setV4CommentReplyContent] = useState('')
  const [v4CommentReplyMentions, setV4CommentReplyMentions] = useState('')

  const showV4CommentThreadError = useCallback(
    (error: unknown, fallbackMessage: string) => {
      const message = error instanceof Error ? error.message : fallbackMessage
      showToast(message || fallbackMessage, 'error')
    },
    [showToast]
  )
  const resetV4CommentThreadState = useCallback(() => {
    setV4CommentThreads([])
    setV4SelectedThreadId('')
    setV4CommentThreadCursor('')
    setV4CommentThreadHasMore(false)
  }, [])
  const runV4CommentThreadTask = useCallback(
    async <T>(task: () => Promise<T>, fallbackMessage: string) => {
      if (isV4CollabBusy) return null
      setIsV4CollabBusy(true)
      try {
        return await task()
      } catch (error: unknown) {
        showV4CommentThreadError(error, fallbackMessage)
        return null
      } finally {
        setIsV4CollabBusy(false)
      }
    },
    [isV4CollabBusy, setIsV4CollabBusy, showV4CommentThreadError]
  )
  const applyV4CommentThreadPage = useCallback(
    (
      rows: V4CommentThread[],
      append: boolean,
      limit: number,
      page?: {
        cursor?: string | null
        nextCursor?: string | null
        limit?: number
        hasMore?: boolean
      }
    ) => {
      setV4CommentThreads((prev) => {
        const merged = append
          ? [...prev, ...rows.filter((item) => prev.every((prevItem) => prevItem.id !== item.id))]
          : rows
        setV4SelectedThreadId((current) =>
          current && merged.some((item) => item.id === current) ? current : merged[0]?.id || ''
        )
        return merged
      })

      const inferredCursor = rows.length > 0 ? rows[rows.length - 1]?.createdAt || '' : ''
      const cursorFromPage =
        typeof page?.nextCursor === 'string'
          ? page.nextCursor
          : typeof page?.cursor === 'string'
            ? page.cursor
            : inferredCursor
      const hasMore =
        typeof page?.hasMore === 'boolean' ? page.hasMore : rows.length >= Math.min(limit, 100)
      setV4CommentThreadCursor(cursorFromPage || '')
      setV4CommentThreadHasMore(Boolean(cursorFromPage) && hasMore)
    },
    []
  )

  const loadV4CommentThreads = useCallback(
    async (append = false) => {
      if (!projectId) {
        resetV4CommentThreadState()
        return
      }
      const limitRaw = v4CommentThreadLimit.trim() || '20'
      const limit = Number.parseInt(limitRaw, 10)
      if (!Number.isFinite(limit) || limit <= 0) {
        showToast('评论线程 limit 必须是大于 0 的整数', 'warning')
        return
      }
      const nextCursor = append ? v4CommentThreadCursor.trim() : ''
      if (append && !nextCursor) {
        setV4CommentThreadHasMore(false)
        return
      }
      const query = new URLSearchParams({
        limit: String(Math.min(limit, 100))
      })
      if (nextCursor) query.set('cursor', nextCursor)
      const payload = await runV4CommentThreadTask(
        () =>
          requestV4<{
            success: boolean
            threads: V4CommentThread[]
            page?: {
              cursor?: string | null
              nextCursor?: string | null
              limit?: number
              hasMore?: boolean
            }
          }>(`/projects/${projectId}/comment-threads?${query.toString()}`),
        '加载评论线程失败'
      )
      if (!payload) return
      applyV4CommentThreadPage(payload.threads || [], append, limit, payload.page)
    },
    [
      applyV4CommentThreadPage,
      projectId,
      resetV4CommentThreadState,
      runV4CommentThreadTask,
      v4CommentThreadLimit,
      v4CommentThreadCursor,
      showToast
    ]
  )

  const refreshV4CommentThreads = useCallback(async () => {
    await loadV4CommentThreads(false)
  }, [loadV4CommentThreads])

  const loadMoreV4CommentThreads = useCallback(async () => {
    await loadV4CommentThreads(true)
  }, [loadV4CommentThreads])

  const createV4CommentThread = useCallback(async () => {
    if (!projectId) {
      showToast('请先创建或加入项目', 'info')
      return
    }
    if (!v4CommentContent.trim()) {
      showToast('请输入评论内容', 'info')
      return
    }
    const mentions = parseMentionsInput(v4CommentMentions)
    const payload = await runV4CommentThreadTask(
      () =>
        requestV4<{ success: boolean; thread: V4CommentThread }>(
          `/projects/${projectId}/comment-threads`,
          {
            method: 'POST',
            body: JSON.stringify({
              anchor: v4CommentAnchor.trim() || undefined,
              content: v4CommentContent.trim(),
              mentions: mentions.length > 0 ? mentions : undefined
            })
          }
        ),
      '创建评论线程失败'
    )
    if (!payload) return
    if (payload.thread) {
      setV4CommentThreads((prev) => [
        payload.thread,
        ...prev.filter((item) => item.id !== payload.thread.id)
      ])
      setV4SelectedThreadId(payload.thread.id)
    }
    setV4CommentContent('')
    setV4CommentMentions('')
    showToast('评论线程已创建', 'success')
  }, [
    projectId,
    v4CommentContent,
    parseMentionsInput,
    v4CommentMentions,
    v4CommentAnchor,
    runV4CommentThreadTask,
    showToast
  ])

  const replyV4CommentThread = useCallback(async () => {
    if (!projectId || !v4SelectedThreadId) {
      showToast('请先选择线程', 'info')
      return
    }
    if (!v4CommentReplyContent.trim()) {
      showToast('请输入回复内容', 'info')
      return
    }
    const mentions = parseMentionsInput(v4CommentReplyMentions)
    const payload = await runV4CommentThreadTask(
      () =>
        requestV4<{
          success: boolean
          thread?: V4CommentThread
        }>(`/projects/${projectId}/comment-threads/${v4SelectedThreadId}/replies`, {
          method: 'POST',
          body: JSON.stringify({
            content: v4CommentReplyContent.trim(),
            mentions: mentions.length > 0 ? mentions : undefined
          })
        }),
      '回复线程失败'
    )
    if (!payload) return
    if (payload.thread) {
      setV4CommentThreads((prev) =>
        prev.map((item) => (item.id === payload.thread?.id ? payload.thread : item))
      )
    } else {
      await refreshV4CommentThreads()
    }
    setV4CommentReplyContent('')
    setV4CommentReplyMentions('')
    showToast('线程回复成功', 'success')
  }, [
    projectId,
    v4SelectedThreadId,
    v4CommentReplyContent,
    parseMentionsInput,
    v4CommentReplyMentions,
    refreshV4CommentThreads,
    runV4CommentThreadTask,
    showToast
  ])

  const resolveV4CommentThread = useCallback(async () => {
    if (!projectId || !v4SelectedThreadId) {
      showToast('请先选择线程', 'info')
      return
    }
    const payload = await runV4CommentThreadTask(
      () =>
        requestV4<{ success: boolean; thread: V4CommentThread }>(
          `/projects/${projectId}/comment-threads/${v4SelectedThreadId}/resolve`,
          {
            method: 'POST'
          }
        ),
      'Resolve 线程失败'
    )
    if (!payload) return
    if (payload.thread) {
      setV4CommentThreads((prev) =>
        prev.map((item) => (item.id === payload.thread.id ? payload.thread : item))
      )
    }
    showToast('线程已标记为 Resolve', 'success')
  }, [projectId, runV4CommentThreadTask, showToast, v4SelectedThreadId])

  useEffect(() => {
    setV4CommentThreadCursor('')
    setV4CommentThreadHasMore(false)
  }, [projectId])

  return {
    v4CommentThreads,
    v4CommentThreadCursor,
    v4CommentThreadLimit,
    v4CommentThreadHasMore,
    v4CommentAnchor,
    v4CommentContent,
    v4CommentMentions,
    v4SelectedThreadId,
    v4CommentReplyContent,
    v4CommentReplyMentions,
    setV4CommentThreadLimit,
    setV4CommentAnchor,
    setV4CommentContent,
    setV4CommentMentions,
    setV4SelectedThreadId,
    setV4CommentReplyContent,
    setV4CommentReplyMentions,
    refreshV4CommentThreads,
    loadMoreV4CommentThreads,
    createV4CommentThread,
    replyV4CommentThread,
    resolveV4CommentThread
  }
}
