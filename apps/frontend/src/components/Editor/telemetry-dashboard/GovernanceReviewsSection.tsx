import React from 'react'
import type { ProjectGovernanceReview } from '../comparison-lab/types'
import { GovernanceReviewPreviewList } from './GovernancePreviewLists'

export interface GovernanceReviewsSectionProps {
  governanceBusy: boolean
  governanceReviewLimit: string
  governanceReviews: ProjectGovernanceReview[]
  governanceReviewDecision: ProjectGovernanceReview['decision']
  governanceReviewSummary: string
  governanceReviewScore: string
  onLoadGovernanceReviews: () => void
  onGovernanceReviewLimitChange: (value: string) => void
  onGovernanceReviewDecisionChange: (value: ProjectGovernanceReview['decision']) => void
  onGovernanceReviewSummaryChange: (value: string) => void
  onGovernanceReviewScoreChange: (value: string) => void
  onCreateGovernanceReview: () => void
}

const GovernanceReviewsSection: React.FC<GovernanceReviewsSectionProps> = ({
  governanceBusy,
  governanceReviewLimit,
  governanceReviews,
  governanceReviewDecision,
  governanceReviewSummary,
  governanceReviewScore,
  onLoadGovernanceReviews,
  onGovernanceReviewLimitChange,
  onGovernanceReviewDecisionChange,
  onGovernanceReviewSummaryChange,
  onGovernanceReviewScoreChange,
  onCreateGovernanceReview
}) => {
  return (
    <>
      <div className="governance-action-row">
        <button disabled={governanceBusy} onClick={onLoadGovernanceReviews}>
          刷新评审
        </button>
        <input
          type="number"
          min={1}
          id="governance-review-limit"
          name="governanceReviewLimit"
          aria-label="评审 limit"
          value={governanceReviewLimit}
          onChange={(event) => onGovernanceReviewLimitChange(event.target.value)}
          placeholder="评审 limit"
        />
        <select
          id="governance-review-decision"
          name="governanceReviewDecision"
          aria-label="评审决策"
          value={governanceReviewDecision}
          onChange={(event) =>
            onGovernanceReviewDecisionChange(
              event.target.value as ProjectGovernanceReview['decision']
            )
          }
        >
          <option value="approved">approved</option>
          <option value="changes_requested">changes_requested</option>
        </select>
        <input
          type="text"
          id="governance-review-summary"
          name="governanceReviewSummary"
          aria-label="评审摘要"
          value={governanceReviewSummary}
          onChange={(event) => onGovernanceReviewSummaryChange(event.target.value)}
          placeholder="评审摘要"
        />
        <input
          type="text"
          id="governance-review-score"
          name="governanceReviewScore"
          aria-label="评审评分（可选）"
          value={governanceReviewScore}
          onChange={(event) => onGovernanceReviewScoreChange(event.target.value)}
          placeholder="评分（可选）"
        />
        <button disabled={governanceBusy} onClick={onCreateGovernanceReview}>
          新建评审
        </button>
      </div>
      <GovernanceReviewPreviewList reviews={governanceReviews} />
    </>
  )
}

export default GovernanceReviewsSection
