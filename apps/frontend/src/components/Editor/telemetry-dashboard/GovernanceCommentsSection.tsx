import React from 'react'
import type { ProjectGovernanceComment } from '../comparison-lab/types'
import { GovernanceCommentPreviewList } from './GovernancePreviewLists'

export interface GovernanceCommentsSectionProps {
  governanceBusy: boolean
  governanceCommentLimit: string
  governanceCommentCursor: string
  governanceCommentHasMore: boolean
  governanceComments: ProjectGovernanceComment[]
  governanceCommentAnchor: string
  governanceCommentContent: string
  governanceCommentMentions: string
  governanceSelectedCommentId: string
  onGovernanceCommentLimitChange: (value: string) => void
  onLoadGovernanceComments: (append?: boolean) => void
  onGovernanceCommentAnchorChange: (value: string) => void
  onGovernanceCommentContentChange: (value: string) => void
  onGovernanceCommentMentionsChange: (value: string) => void
  onCreateGovernanceComment: () => void
  onGovernanceSelectedCommentIdChange: (value: string) => void
  onResolveGovernanceComment: () => void
}

const GovernanceCommentsSection: React.FC<GovernanceCommentsSectionProps> = ({
  governanceBusy,
  governanceCommentLimit,
  governanceCommentCursor,
  governanceCommentHasMore,
  governanceComments,
  governanceCommentAnchor,
  governanceCommentContent,
  governanceCommentMentions,
  governanceSelectedCommentId,
  onGovernanceCommentLimitChange,
  onLoadGovernanceComments,
  onGovernanceCommentAnchorChange,
  onGovernanceCommentContentChange,
  onGovernanceCommentMentionsChange,
  onCreateGovernanceComment,
  onGovernanceSelectedCommentIdChange,
  onResolveGovernanceComment
}) => {
  return (
    <>
      <div className="governance-action-row">
        <button disabled={governanceBusy} onClick={() => onLoadGovernanceComments(false)}>
          刷新评论
        </button>
        <input
          type="number"
          min={1}
          id="governance-comment-limit"
          name="governanceCommentLimit"
          aria-label="评论 limit"
          value={governanceCommentLimit}
          onChange={(event) => onGovernanceCommentLimitChange(event.target.value)}
          placeholder="评论 limit"
        />
        <button
          disabled={governanceBusy || !governanceCommentHasMore}
          onClick={() => onLoadGovernanceComments(true)}
        >
          评论加载更多
        </button>
      </div>
      <div className="governance-meta-row">
        <span>评论游标：{governanceCommentCursor || '-'}</span>
      </div>
      <div className="governance-input-grid">
        <input
          type="text"
          id="governance-comment-anchor"
          name="governanceCommentAnchor"
          aria-label="评论锚点（可选）"
          value={governanceCommentAnchor}
          onChange={(event) => onGovernanceCommentAnchorChange(event.target.value)}
          placeholder="评论锚点（可选）"
        />
        <input
          type="text"
          id="governance-comment-content"
          name="governanceCommentContent"
          aria-label="评论内容"
          value={governanceCommentContent}
          onChange={(event) => onGovernanceCommentContentChange(event.target.value)}
          placeholder="评论内容"
        />
        <input
          type="text"
          id="governance-comment-mentions"
          name="governanceCommentMentions"
          aria-label="评论提醒"
          value={governanceCommentMentions}
          onChange={(event) => onGovernanceCommentMentionsChange(event.target.value)}
          placeholder="提醒：管理员,编辑者"
        />
        <button disabled={governanceBusy} onClick={onCreateGovernanceComment}>
          新建评论
        </button>
      </div>
      <div className="governance-action-row">
        <select
          id="governance-selected-comment-id"
          name="governanceSelectedCommentId"
          aria-label="选择评论"
          value={governanceSelectedCommentId}
          onChange={(event) => onGovernanceSelectedCommentIdChange(event.target.value)}
        >
          <option value="">选择评论后可 Resolve</option>
          {governanceComments.map((item) => (
            <option key={item.id} value={item.id}>
              {item.id.slice(0, 8)} · {item.status}
            </option>
          ))}
        </select>
        <button
          disabled={governanceBusy || !governanceSelectedCommentId}
          onClick={onResolveGovernanceComment}
        >
          Resolve 评论
        </button>
      </div>
      <GovernanceCommentPreviewList comments={governanceComments} />
    </>
  )
}

export default GovernanceCommentsSection
