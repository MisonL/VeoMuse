import React from 'react'
import type {
  ProjectGovernanceClipBatchUpdateResult,
  ProjectGovernanceComment,
  ProjectGovernanceReview,
  ProjectGovernanceTemplate,
  ProjectGovernanceTemplateApplyResult
} from '../comparison-lab/types'
import { GovernanceCommentPreviewList, GovernanceReviewPreviewList } from './GovernancePreviewLists'

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
          aria-label="评论 mentions"
          value={governanceCommentMentions}
          onChange={(event) => onGovernanceCommentMentionsChange(event.target.value)}
          placeholder="mentions: owner,editor"
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

      <div className="governance-action-row">
        <button disabled={governanceBusy} onClick={onLoadGovernanceTemplates}>
          刷新模板
        </button>
        <select
          id="governance-selected-template-id"
          name="governanceSelectedTemplateId"
          aria-label="选择模板"
          value={governanceSelectedTemplateId}
          onChange={(event) => onGovernanceSelectedTemplateIdChange(event.target.value)}
        >
          <option value="">选择模板</option>
          {governanceTemplates.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <button
          disabled={governanceBusy || !governanceSelectedTemplateId}
          onClick={onApplyGovernanceTemplate}
        >
          应用模板
        </button>
      </div>
      <textarea
        id="governance-template-options"
        name="governanceTemplateOptions"
        aria-label="模板应用参数 JSON"
        value={governanceTemplateOptions}
        onChange={(event) => onGovernanceTemplateOptionsChange(event.target.value)}
        placeholder='模板应用参数 JSON，例如 {"targetTrack":"track-v1"}'
      />
      <div className="governance-meta-row">
        <span>模板回执：{governanceTemplateResult?.traceId || '-'}</span>
        <span>{governanceTemplateResult?.templateName || '-'}</span>
      </div>

      <textarea
        id="governance-batch-operations"
        name="governanceBatchOperations"
        aria-label="片段批量更新 operations JSON 数组"
        value={governanceBatchOperations}
        onChange={(event) => onGovernanceBatchOperationsChange(event.target.value)}
        placeholder="片段批量更新 operations JSON 数组"
      />
      <div className="governance-action-row">
        <button disabled={governanceBusy} onClick={onGovernanceBatchUpdateClips}>
          提交 clips/batch-update
        </button>
        <span>requested {governanceBatchResult?.requested ?? '-'}</span>
        <span>accepted {governanceBatchResult?.accepted ?? '-'}</span>
        <span>updated {governanceBatchResult?.updated ?? '-'}</span>
      </div>
      {governanceError ? <div className="db-error">{governanceError}</div> : null}
    </section>
  )
}

export default ProjectGovernancePanel
