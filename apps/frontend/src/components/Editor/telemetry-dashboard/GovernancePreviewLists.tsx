import React from 'react'
import type { ProjectGovernanceComment, ProjectGovernanceReview } from '../comparison-lab/types'

interface GovernanceCommentPreviewListProps {
  comments: ProjectGovernanceComment[]
}

interface GovernanceReviewPreviewListProps {
  reviews: ProjectGovernanceReview[]
}

export const GovernanceCommentPreviewList: React.FC<GovernanceCommentPreviewListProps> = ({
  comments
}) => (
  <div className="governance-list">
    {comments.slice(0, 8).map((item) => (
      <div key={item.id} className="governance-item">
        <span>{item.content}</span>
        <span>{item.status}</span>
        <span>{item.mentions.length > 0 ? `@${item.mentions.join(',')}` : '-'}</span>
      </div>
    ))}
    {comments.length === 0 ? <div className="api-empty">暂无项目评论</div> : null}
  </div>
)

export const GovernanceReviewPreviewList: React.FC<GovernanceReviewPreviewListProps> = ({
  reviews
}) => (
  <div className="governance-list">
    {reviews.slice(0, 8).map((item) => (
      <div key={item.id} className="governance-item">
        <span>{item.decision}</span>
        <span>{item.summary}</span>
        <span>{item.score ?? '-'}</span>
      </div>
    ))}
    {reviews.length === 0 ? <div className="api-empty">暂无项目评审</div> : null}
  </div>
)
