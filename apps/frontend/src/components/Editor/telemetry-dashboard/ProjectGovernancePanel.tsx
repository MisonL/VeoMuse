import React from 'react'
import type {
  ProjectGovernanceClipBatchUpdateResult,
  ProjectGovernanceComment,
  ProjectGovernanceReview,
  ProjectGovernanceTemplate,
  ProjectGovernanceTemplateApplyResult
} from '../comparison-lab/types'
import GovernanceCommentsSection from './GovernanceCommentsSection'
import GovernanceReviewsSection from './GovernanceReviewsSection'
import GovernanceTemplateBatchSection from './GovernanceTemplateBatchSection'

export interface ProjectGovernancePanelProps {
  governanceProjectId: string
  governanceBusy: boolean
  governanceCommentLimit: string
  governanceCommentCursor: string
  governanceCommentHasMore: boolean
  governanceComments: ProjectGovernanceComment[]
  governanceCommentAnchor: string
  governanceCommentContent: string
  governanceCommentMentions: string
  governanceSelectedCommentId: string
  governanceReviewLimit: string
  governanceReviews: ProjectGovernanceReview[]
  governanceReviewDecision: ProjectGovernanceReview['decision']
  governanceReviewSummary: string
  governanceReviewScore: string
  governanceTemplates: ProjectGovernanceTemplate[]
  governanceSelectedTemplateId: string
  governanceTemplateOptions: string
  governanceTemplateResult: ProjectGovernanceTemplateApplyResult | null
  governanceBatchOperations: string
  governanceBatchResult: ProjectGovernanceClipBatchUpdateResult | null
  governanceError: string
  onGovernanceProjectIdChange: (value: string) => void
  onGovernanceCommentLimitChange: (value: string) => void
  onLoadGovernanceComments: (append?: boolean) => void
  onGovernanceCommentAnchorChange: (value: string) => void
  onGovernanceCommentContentChange: (value: string) => void
  onGovernanceCommentMentionsChange: (value: string) => void
  onCreateGovernanceComment: () => void
  onGovernanceSelectedCommentIdChange: (value: string) => void
  onResolveGovernanceComment: () => void
  onLoadGovernanceReviews: () => void
  onGovernanceReviewLimitChange: (value: string) => void
  onGovernanceReviewDecisionChange: (value: ProjectGovernanceReview['decision']) => void
  onGovernanceReviewSummaryChange: (value: string) => void
  onGovernanceReviewScoreChange: (value: string) => void
  onCreateGovernanceReview: () => void
  onLoadGovernanceTemplates: () => void
  onGovernanceSelectedTemplateIdChange: (value: string) => void
  onApplyGovernanceTemplate: () => void
  onGovernanceTemplateOptionsChange: (value: string) => void
  onGovernanceBatchOperationsChange: (value: string) => void
  onGovernanceBatchUpdateClips: () => void
}

const ProjectGovernancePanel: React.FC<ProjectGovernancePanelProps> = ({
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
  onGovernanceProjectIdChange,
  onGovernanceCommentLimitChange,
  onLoadGovernanceComments,
  onGovernanceCommentAnchorChange,
  onGovernanceCommentContentChange,
  onGovernanceCommentMentionsChange,
  onCreateGovernanceComment,
  onGovernanceSelectedCommentIdChange,
  onResolveGovernanceComment,
  onLoadGovernanceReviews,
  onGovernanceReviewLimitChange,
  onGovernanceReviewDecisionChange,
  onGovernanceReviewSummaryChange,
  onGovernanceReviewScoreChange,
  onCreateGovernanceReview,
  onLoadGovernanceTemplates,
  onGovernanceSelectedTemplateIdChange,
  onApplyGovernanceTemplate,
  onGovernanceTemplateOptionsChange,
  onGovernanceBatchOperationsChange,
  onGovernanceBatchUpdateClips
}) => {
  return (
    <section className="project-governance-panel" data-testid="project-governance-card">
      <h3 className="telemetry-section-title">项目治理卡片（第二入口）</h3>
      <div className="governance-project-row">
        <input
          type="text"
          id="governance-project-id"
          name="governanceProjectId"
          aria-label="项目 ID（prj_xxx）"
          value={governanceProjectId}
          onChange={(event) => onGovernanceProjectIdChange(event.target.value)}
          placeholder="输入项目 ID（prj_xxx）"
        />
        <span>{governanceBusy ? '处理中...' : '空闲'}</span>
      </div>
      <GovernanceCommentsSection
        governanceBusy={governanceBusy}
        governanceCommentLimit={governanceCommentLimit}
        governanceCommentCursor={governanceCommentCursor}
        governanceCommentHasMore={governanceCommentHasMore}
        governanceComments={governanceComments}
        governanceCommentAnchor={governanceCommentAnchor}
        governanceCommentContent={governanceCommentContent}
        governanceCommentMentions={governanceCommentMentions}
        governanceSelectedCommentId={governanceSelectedCommentId}
        onGovernanceCommentLimitChange={onGovernanceCommentLimitChange}
        onLoadGovernanceComments={onLoadGovernanceComments}
        onGovernanceCommentAnchorChange={onGovernanceCommentAnchorChange}
        onGovernanceCommentContentChange={onGovernanceCommentContentChange}
        onGovernanceCommentMentionsChange={onGovernanceCommentMentionsChange}
        onCreateGovernanceComment={onCreateGovernanceComment}
        onGovernanceSelectedCommentIdChange={onGovernanceSelectedCommentIdChange}
        onResolveGovernanceComment={onResolveGovernanceComment}
      />

      <GovernanceReviewsSection
        governanceBusy={governanceBusy}
        governanceReviewLimit={governanceReviewLimit}
        governanceReviews={governanceReviews}
        governanceReviewDecision={governanceReviewDecision}
        governanceReviewSummary={governanceReviewSummary}
        governanceReviewScore={governanceReviewScore}
        onLoadGovernanceReviews={onLoadGovernanceReviews}
        onGovernanceReviewLimitChange={onGovernanceReviewLimitChange}
        onGovernanceReviewDecisionChange={onGovernanceReviewDecisionChange}
        onGovernanceReviewSummaryChange={onGovernanceReviewSummaryChange}
        onGovernanceReviewScoreChange={onGovernanceReviewScoreChange}
        onCreateGovernanceReview={onCreateGovernanceReview}
      />

      <GovernanceTemplateBatchSection
        governanceBusy={governanceBusy}
        governanceTemplates={governanceTemplates}
        governanceSelectedTemplateId={governanceSelectedTemplateId}
        governanceTemplateOptions={governanceTemplateOptions}
        governanceTemplateResult={governanceTemplateResult}
        governanceBatchOperations={governanceBatchOperations}
        governanceBatchResult={governanceBatchResult}
        onLoadGovernanceTemplates={onLoadGovernanceTemplates}
        onGovernanceSelectedTemplateIdChange={onGovernanceSelectedTemplateIdChange}
        onApplyGovernanceTemplate={onApplyGovernanceTemplate}
        onGovernanceTemplateOptionsChange={onGovernanceTemplateOptionsChange}
        onGovernanceBatchOperationsChange={onGovernanceBatchOperationsChange}
        onGovernanceBatchUpdateClips={onGovernanceBatchUpdateClips}
      />
      {governanceError ? <div className="db-error">{governanceError}</div> : null}
    </section>
  )
}

export default ProjectGovernancePanel
