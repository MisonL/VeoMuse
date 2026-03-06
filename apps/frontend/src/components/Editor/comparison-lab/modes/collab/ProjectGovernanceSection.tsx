import React from 'react'
import {
  formatCursor,
  formatLocalTime,
  formatMentions,
  formatShortId,
  getBusyStatusText,
  isLoadMoreDisabled,
  isProjectActionDisabled,
  takePreviewItems
} from '../collabModePanel.logic'
import type {
  ProjectGovernanceClipBatchUpdateResult,
  ProjectGovernanceComment,
  ProjectGovernanceReview,
  ProjectGovernanceTemplate,
  ProjectGovernanceTemplateApplyResult
} from '../../types'

export interface ProjectGovernanceSectionProps {
  projectId: string
  isProjectGovernanceBusy: boolean
  projectComments: ProjectGovernanceComment[]
  projectCommentCursor: string
  projectCommentLimit: string
  projectCommentHasMore: boolean
  projectCommentAnchor: string
  projectCommentContent: string
  projectCommentMentions: string
  projectSelectedCommentId: string
  projectReviews: ProjectGovernanceReview[]
  projectReviewLimit: string
  projectReviewDecision: ProjectGovernanceReview['decision']
  projectReviewSummary: string
  projectReviewScore: string
  projectTemplates: ProjectGovernanceTemplate[]
  projectSelectedTemplateId: string
  projectTemplateApplyOptions: string
  projectTemplateApplyResult: ProjectGovernanceTemplateApplyResult | null
  projectClipBatchOperations: string
  projectClipBatchResult: ProjectGovernanceClipBatchUpdateResult | null
  onRefreshProjectComments: () => void
  onLoadMoreProjectComments: () => void
  onProjectCommentLimitChange: (value: string) => void
  onProjectCommentAnchorChange: (value: string) => void
  onProjectCommentContentChange: (value: string) => void
  onProjectCommentMentionsChange: (value: string) => void
  onProjectSelectedCommentIdChange: (value: string) => void
  onCreateProjectComment: () => void
  onResolveProjectComment: () => void
  onRefreshProjectReviews: () => void
  onProjectReviewLimitChange: (value: string) => void
  onProjectReviewDecisionChange: (value: ProjectGovernanceReview['decision']) => void
  onProjectReviewSummaryChange: (value: string) => void
  onProjectReviewScoreChange: (value: string) => void
  onCreateProjectReview: () => void
  onRefreshProjectTemplates: () => void
  onProjectSelectedTemplateIdChange: (value: string) => void
  onProjectTemplateApplyOptionsChange: (value: string) => void
  onApplyProjectTemplate: () => void
  onProjectClipBatchOperationsChange: (value: string) => void
  onBatchUpdateProjectClips: () => void
}

const ProjectGovernanceSection: React.FC<ProjectGovernanceSectionProps> = ({
  projectId,
  isProjectGovernanceBusy,
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
  onRefreshProjectComments,
  onLoadMoreProjectComments,
  onProjectCommentLimitChange,
  onProjectCommentAnchorChange,
  onProjectCommentContentChange,
  onProjectCommentMentionsChange,
  onProjectSelectedCommentIdChange,
  onCreateProjectComment,
  onResolveProjectComment,
  onRefreshProjectReviews,
  onProjectReviewLimitChange,
  onProjectReviewDecisionChange,
  onProjectReviewSummaryChange,
  onProjectReviewScoreChange,
  onCreateProjectReview,
  onRefreshProjectTemplates,
  onProjectSelectedTemplateIdChange,
  onProjectTemplateApplyOptionsChange,
  onApplyProjectTemplate,
  onProjectClipBatchOperationsChange,
  onBatchUpdateProjectClips
}) => {
  return (
    <section className="collab-card" data-testid="area-project-governance-card">
      <h4>项目治理闭环</h4>
      <div className="collab-meta">
        <span>项目 ID：{projectId || '-'}</span>
        <span>状态：{getBusyStatusText(isProjectGovernanceBusy)}</span>
      </div>

      <div className="lab-inline-actions">
        <button
          disabled={isProjectActionDisabled(projectId, isProjectGovernanceBusy)}
          onClick={onRefreshProjectComments}
        >
          刷新评论
        </button>
        <label className="lab-field">
          <span>评论 limit</span>
          <input
            type="number"
            min={1}
            name="projectCommentLimit"
            value={projectCommentLimit}
            onChange={(event) => onProjectCommentLimitChange(event.target.value)}
            placeholder="20"
          />
        </label>
        <button
          disabled={isLoadMoreDisabled(projectId, projectCommentHasMore, isProjectGovernanceBusy)}
          onClick={onLoadMoreProjectComments}
        >
          加载更多评论
        </button>
      </div>
      <div className="collab-meta">
        <span>评论下一页游标：{formatCursor(projectCommentCursor)}</span>
      </div>
      <div className="lab-inline-fields">
        <label className="lab-field">
          <span>评论锚点</span>
          <input
            name="projectCommentAnchor"
            value={projectCommentAnchor}
            onChange={(event) => onProjectCommentAnchorChange(event.target.value)}
            placeholder="timeline:track-v1:clip-1"
          />
        </label>
        <label className="lab-field">
          <span>评论内容</span>
          <input
            name="projectCommentContent"
            value={projectCommentContent}
            onChange={(event) => onProjectCommentContentChange(event.target.value)}
            placeholder="输入项目评论内容"
          />
        </label>
        <label className="lab-field">
          <span>评论 mentions</span>
          <input
            name="projectCommentMentions"
            value={projectCommentMentions}
            onChange={(event) => onProjectCommentMentionsChange(event.target.value)}
            placeholder="owner,editor"
          />
        </label>
        <button
          className="inline-fill-btn"
          disabled={isProjectActionDisabled(projectId, isProjectGovernanceBusy)}
          onClick={onCreateProjectComment}
        >
          新建评论
        </button>
      </div>
      <div className="lab-inline-fields">
        <label className="lab-field">
          <span>待 Resolve 评论</span>
          <select
            name="projectSelectedCommentId"
            value={projectSelectedCommentId}
            onChange={(event) => onProjectSelectedCommentIdChange(event.target.value)}
          >
            <option value="">选择评论</option>
            {projectComments.map((item) => (
              <option key={item.id} value={item.id}>
                {formatShortId(item.id, 8)} · {item.status}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={!projectSelectedCommentId || isProjectGovernanceBusy}
          onClick={onResolveProjectComment}
        >
          标记评论已解决
        </button>
      </div>
      <div className="collab-list">
        {takePreviewItems(projectComments, 12).map((item) => (
          <div key={item.id} className="collab-list-item">
            <span>{item.content}</span>
            <span>{item.status}</span>
            <span>{formatMentions(item.mentions)}</span>
            <span>{formatLocalTime(item.updatedAt)}</span>
          </div>
        ))}
        {projectComments.length === 0 ? <div className="api-empty">暂无项目评论</div> : null}
      </div>

      <div className="lab-inline-actions">
        <button
          disabled={isProjectActionDisabled(projectId, isProjectGovernanceBusy)}
          onClick={onRefreshProjectReviews}
        >
          刷新评审
        </button>
        <label className="lab-field">
          <span>评审 limit</span>
          <input
            type="number"
            min={1}
            name="projectReviewLimit"
            value={projectReviewLimit}
            onChange={(event) => onProjectReviewLimitChange(event.target.value)}
            placeholder="20"
          />
        </label>
      </div>
      <div className="lab-inline-fields">
        <label className="lab-field">
          <span>评审决策</span>
          <select
            name="projectReviewDecision"
            value={projectReviewDecision}
            onChange={(event) =>
              onProjectReviewDecisionChange(
                event.target.value as ProjectGovernanceReview['decision']
              )
            }
          >
            <option value="approved">approved</option>
            <option value="changes_requested">changes_requested</option>
          </select>
        </label>
        <label className="lab-field">
          <span>评审摘要</span>
          <input
            name="projectReviewSummary"
            value={projectReviewSummary}
            onChange={(event) => onProjectReviewSummaryChange(event.target.value)}
            placeholder="输入评审结论"
          />
        </label>
        <label className="lab-field">
          <span>评分（可选）</span>
          <input
            name="projectReviewScore"
            value={projectReviewScore}
            onChange={(event) => onProjectReviewScoreChange(event.target.value)}
            placeholder="8.5"
          />
        </label>
        <button
          className="inline-fill-btn"
          disabled={isProjectActionDisabled(projectId, isProjectGovernanceBusy)}
          onClick={onCreateProjectReview}
        >
          新建评审
        </button>
      </div>
      <div className="collab-list">
        {takePreviewItems(projectReviews, 12).map((item) => (
          <div key={item.id} className="collab-list-item">
            <span>{item.decision}</span>
            <span>{item.summary}</span>
            <span>{item.score ?? '-'}</span>
            <span>{formatLocalTime(item.createdAt)}</span>
          </div>
        ))}
        {projectReviews.length === 0 ? <div className="api-empty">暂无项目评审</div> : null}
      </div>

      <div className="lab-inline-actions">
        <button
          disabled={isProjectActionDisabled(projectId, isProjectGovernanceBusy)}
          onClick={onRefreshProjectTemplates}
        >
          刷新模板
        </button>
        <label className="lab-field">
          <span>模板</span>
          <select
            name="projectSelectedTemplateId"
            value={projectSelectedTemplateId}
            onChange={(event) => onProjectSelectedTemplateIdChange(event.target.value)}
          >
            <option value="">选择模板</option>
            {projectTemplates.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={!projectSelectedTemplateId || isProjectGovernanceBusy}
          onClick={onApplyProjectTemplate}
        >
          应用模板
        </button>
      </div>
      <label className="lab-field">
        <span>模板应用参数（JSON）</span>
        <textarea
          name="projectTemplateApplyOptions"
          value={projectTemplateApplyOptions}
          onChange={(event) => onProjectTemplateApplyOptionsChange(event.target.value)}
          placeholder='{"targetTrack":"track-v1","blendMode":"replace"}'
        />
      </label>
      <div className="collab-meta">
        <span>模板回执 Trace：{projectTemplateApplyResult?.traceId || '-'}</span>
        <span>模板名称：{projectTemplateApplyResult?.templateName || '-'}</span>
      </div>
      <div className="collab-list">
        {takePreviewItems(projectTemplates, 10).map((item) => (
          <div key={item.id} className="collab-list-item">
            <span>{item.name}</span>
            <span>{item.description}</span>
            <span>{item.createdBy}</span>
            <span>{formatLocalTime(item.updatedAt)}</span>
          </div>
        ))}
        {projectTemplates.length === 0 ? <div className="api-empty">暂无项目模板</div> : null}
      </div>

      <label className="lab-field">
        <span>片段批量更新 operations（JSON 数组）</span>
        <textarea
          name="projectClipBatchOperations"
          value={projectClipBatchOperations}
          onChange={(event) => onProjectClipBatchOperationsChange(event.target.value)}
          placeholder='[{"clipId":"clip-a","patch":{"start":0,"end":3}}]'
        />
      </label>
      <div className="lab-inline-actions">
        <button
          disabled={isProjectActionDisabled(projectId, isProjectGovernanceBusy)}
          onClick={onBatchUpdateProjectClips}
        >
          提交片段批量更新
        </button>
      </div>
      <div className="collab-meta">
        <span>requested：{projectClipBatchResult?.requested ?? '-'}</span>
        <span>accepted：{projectClipBatchResult?.accepted ?? '-'}</span>
        <span>skipped：{projectClipBatchResult?.skipped ?? '-'}</span>
        <span>rejected：{projectClipBatchResult?.rejected ?? '-'}</span>
        <span>updated：{projectClipBatchResult?.updated ?? '-'}</span>
      </div>
    </section>
  )
}

export default ProjectGovernanceSection
