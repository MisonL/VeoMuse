import React from 'react'
import {
  formatCursor,
  formatLocalTime,
  formatMentions,
  formatShortId,
  isLoadMoreDisabled,
  takePreviewItems
} from '../collabModePanel.logic'
import type { V4CommentThread } from '../../types'

const resolveThreadTone = (status: V4CommentThread['status']) => {
  if (status === 'resolved') return 'success'
  return 'warning'
}

export interface CommentThreadsSectionProps {
  projectId: string
  commentThreads: V4CommentThread[]
  commentThreadCursor: string
  commentThreadLimit: string
  commentThreadHasMore: boolean
  commentAnchor: string
  commentContent: string
  commentMentions: string
  selectedThreadId: string
  commentReplyContent: string
  commentReplyMentions: string
  isV4Busy: boolean
  onRefreshCommentThreads: () => void
  onLoadMoreCommentThreads: () => void
  onCommentThreadLimitChange: (value: string) => void
  onCommentAnchorChange: (value: string) => void
  onCommentContentChange: (value: string) => void
  onCommentMentionsChange: (value: string) => void
  onSelectedThreadIdChange: (value: string) => void
  onCommentReplyContentChange: (value: string) => void
  onCommentReplyMentionsChange: (value: string) => void
  onCreateCommentThread: () => void
  onReplyCommentThread: () => void
  onResolveCommentThread: () => void
}

const CommentThreadsSection: React.FC<CommentThreadsSectionProps> = ({
  projectId,
  commentThreads,
  commentThreadCursor,
  commentThreadLimit,
  commentThreadHasMore,
  commentAnchor,
  commentContent,
  commentMentions,
  selectedThreadId,
  commentReplyContent,
  commentReplyMentions,
  isV4Busy,
  onRefreshCommentThreads,
  onLoadMoreCommentThreads,
  onCommentThreadLimitChange,
  onCommentAnchorChange,
  onCommentContentChange,
  onCommentMentionsChange,
  onSelectedThreadIdChange,
  onCommentReplyContentChange,
  onCommentReplyMentionsChange,
  onCreateCommentThread,
  onReplyCommentThread,
  onResolveCommentThread
}) => {
  const selectedThread = commentThreads.find((item) => item.id === selectedThreadId) || null
  const selectedThreadTone = selectedThread ? resolveThreadTone(selectedThread.status) : 'neutral'

  return (
    <section className="collab-card comment-threads-desk" data-testid="area-comment-threads-desk">
      <div className="comment-threads-desk-head">
        <div className="collab-section-copy">
          <span className="collab-section-kicker">review desk</span>
          <h4>v4 评论线程</h4>
        </div>
        <div className="collab-meta">
          <span>下一页游标：{formatCursor(commentThreadCursor)}</span>
        </div>
      </div>
      <div className="comment-threads-desk-layout">
        <div className="comment-threads-compose">
          <div className="lab-inline-actions">
            <button disabled={!projectId || isV4Busy} onClick={onRefreshCommentThreads}>
              {isV4Busy ? '处理中...' : '刷新线程'}
            </button>
            <label className="lab-field">
              <span>limit</span>
              <input
                type="number"
                min={1}
                name="v4CommentThreadLimit"
                value={commentThreadLimit}
                onChange={(event) => onCommentThreadLimitChange(event.target.value)}
                placeholder="20"
              />
            </label>
            <button
              disabled={isLoadMoreDisabled(projectId, commentThreadHasMore, isV4Busy)}
              onClick={onLoadMoreCommentThreads}
            >
              加载更多
            </button>
          </div>
          <div className="lab-inline-fields">
            <label className="lab-field">
              <span>锚点</span>
              <input
                name="v4CommentAnchor"
                value={commentAnchor}
                onChange={(event) => onCommentAnchorChange(event.target.value)}
                placeholder="timeline:12.4s"
              />
            </label>
            <label className="lab-field">
              <span>线程内容</span>
              <input
                name="v4CommentContent"
                value={commentContent}
                onChange={(event) => onCommentContentChange(event.target.value)}
                placeholder="输入评论线程内容"
              />
            </label>
            <label className="lab-field">
              <span>mentions</span>
              <input
                name="v4CommentMentions"
                value={commentMentions}
                onChange={(event) => onCommentMentionsChange(event.target.value)}
                placeholder="alice,bob"
              />
            </label>
            <button
              className="inline-fill-btn"
              disabled={!projectId || isV4Busy}
              onClick={onCreateCommentThread}
            >
              创建线程
            </button>
          </div>
          <div className="lab-inline-fields">
            <label className="lab-field">
              <span>线程</span>
              <select
                name="v4SelectedThreadId"
                value={selectedThreadId}
                onChange={(event) => onSelectedThreadIdChange(event.target.value)}
              >
                <option value="">选择线程</option>
                {commentThreads.map((item) => (
                  <option key={item.id} value={item.id}>
                    {formatShortId(item.id, 8)} · {item.status}
                  </option>
                ))}
              </select>
            </label>
            <label className="lab-field">
              <span>回复</span>
              <input
                name="v4CommentReplyContent"
                value={commentReplyContent}
                onChange={(event) => onCommentReplyContentChange(event.target.value)}
                placeholder="输入回复内容"
              />
            </label>
            <label className="lab-field">
              <span>回复 mentions</span>
              <input
                name="v4CommentReplyMentions"
                value={commentReplyMentions}
                onChange={(event) => onCommentReplyMentionsChange(event.target.value)}
                placeholder="alice,bob"
              />
            </label>
          </div>
          <div className="lab-inline-actions">
            <button disabled={!selectedThreadId || isV4Busy} onClick={onReplyCommentThread}>
              回复线程
            </button>
            <button disabled={!selectedThreadId || isV4Busy} onClick={onResolveCommentThread}>
              标记 Resolve
            </button>
          </div>
        </div>
        <div className="comment-threads-review-column">
          <div className={`comment-thread-spotlight comment-thread-spotlight--${selectedThreadTone}`}>
            <div className="comment-thread-spotlight-head">
              <span className="comment-thread-spotlight-kicker">当前焦点</span>
              <span className={`lab-status-badge lab-status-badge--${selectedThreadTone}`}>
                {selectedThread ? selectedThread.status : '未选择'}
              </span>
            </div>
            <strong>{selectedThread ? selectedThread.content : '尚未选中评论线程'}</strong>
            <div className="comment-thread-spotlight-meta">
              <span>锚点：{selectedThread?.anchor || '-'}</span>
              <span>{selectedThread ? formatMentions(selectedThread.mentions) : '暂无 mentions'}</span>
            </div>
            <span>
              {selectedThread
                ? `${selectedThread.status} · 最近更新 ${formatLocalTime(selectedThread.updatedAt)}`
                : '选择线程后可直接回复或 Resolve。'}
            </span>
          </div>
          <div className="collab-list">
            {takePreviewItems(commentThreads, 12).map((item) => (
              <div
                key={item.id}
                className={`collab-list-item collab-list-item--rich comment-thread-list-item comment-thread-list-item--${resolveThreadTone(
                  item.status
                )} ${selectedThreadId === item.id ? 'is-selected' : ''}`}
              >
                <div className="collab-list-item-head">
                  <strong>{item.content}</strong>
                  <span className={`lab-status-badge lab-status-badge--${resolveThreadTone(item.status)}`}>
                    {item.status}
                  </span>
                </div>
                <div className="collab-list-meta">
                  <span>锚点：{item.anchor || '-'}</span>
                  <span>{formatMentions(item.mentions)}</span>
                </div>
                <div className="collab-list-meta">
                  <span>更新：{formatLocalTime(item.updatedAt)}</span>
                  <span>创建：{formatLocalTime(item.createdAt)}</span>
                </div>
              </div>
            ))}
            {commentThreads.length === 0 ? <div className="api-empty">暂无评论线程</div> : null}
          </div>
        </div>
      </div>
    </section>
  )
}

export default CommentThreadsSection
