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

const FALLBACK_TEXT = '-'

const resolveGovernanceTone = (status: string) => {
  if (status === 'resolved' || status === 'approved') return 'success'
  if (status === 'changes_requested') return 'warning'
  return 'accent'
}

const resolveCommentActor = (comment: ProjectGovernanceComment) => {
  return (
    (comment as ProjectGovernanceComment & { createdBy?: string }).actorName ||
    (comment as ProjectGovernanceComment & { createdBy?: string }).createdBy ||
    FALLBACK_TEXT
  )
}

const resolveReviewActor = (review: ProjectGovernanceReview) => {
  return (
    (review as ProjectGovernanceReview & { createdBy?: string }).actorName ||
    (review as ProjectGovernanceReview & { createdBy?: string }).createdBy ||
    FALLBACK_TEXT
  )
}

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
  const openProjectComments = projectComments.filter((item) => item.status === 'open')
  const resolvedProjectComments = projectComments.length - openProjectComments.length
  const approvedReviews = projectReviews.filter((item) => item.decision === 'approved').length
  const changesRequestedReviews = projectReviews.filter(
    (item) => item.decision === 'changes_requested'
  ).length
  const latestProjectComment = projectComments[0] || null
  const latestTemplate = projectTemplates[0] || null
  const batchRequested = projectClipBatchResult?.requested ?? 0
  const batchAccepted = projectClipBatchResult?.accepted ?? 0
  const batchRejected = projectClipBatchResult?.rejected ?? 0
  const pendingGovernanceCount = openProjectComments.length + changesRequestedReviews
  const commentTone =
    openProjectComments.length > 0 ? 'warning' : projectComments.length > 0 ? 'success' : 'neutral'
  const reviewTone =
    changesRequestedReviews > 0 ? 'warning' : approvedReviews > 0 ? 'success' : 'neutral'
  const templateTone = projectTemplates.length > 0 ? 'accent' : 'neutral'
  const batchTone = batchRejected > 0 ? 'critical' : batchAccepted > 0 ? 'success' : 'neutral'
  const governanceWatchTone =
    pendingGovernanceCount > 0 ? (changesRequestedReviews > 0 ? 'warning' : 'accent') : 'success'

  return (
    <section className="collab-card" data-testid="area-project-governance-card">
      <h4>项目治理闭环</h4>
      <div className="collab-meta">
        <span>项目 ID：{projectId || '-'}</span>
        <span>状态：{getBusyStatusText(isProjectGovernanceBusy)}</span>
      </div>
      <div
        className="lab-metric-grid collab-governance-summary-grid"
        data-testid="project-governance-watchboard"
      >
        <div className={`lab-metric-card lab-metric-card--${commentTone}`}>
          <span>开放评论</span>
          <strong>{openProjectComments.length}</strong>
          <small>已解决 {resolvedProjectComments} 条</small>
        </div>
        <div className={`lab-metric-card lab-metric-card--${reviewTone}`}>
          <span>评审压力</span>
          <strong>{changesRequestedReviews}</strong>
          <small>已批准 {approvedReviews} 条</small>
        </div>
        <div className={`lab-metric-card lab-metric-card--${templateTone}`}>
          <span>模板库存</span>
          <strong>{projectTemplates.length}</strong>
          <small>最新模板：{latestTemplate?.name || FALLBACK_TEXT}</small>
        </div>
        <div className={`lab-metric-card lab-metric-card--${batchTone}`}>
          <span>批量更新</span>
          <strong>{batchAccepted}</strong>
          <small>
            请求 {batchRequested} · 拒绝 {batchRejected}
          </small>
        </div>
      </div>
      <div className={`collab-watch-spotlight collab-watch-spotlight--${governanceWatchTone}`}>
        <div className="collab-watch-spotlight-copy">
          <span className="collab-advanced-group-kicker">governance watch</span>
          <strong>{pendingGovernanceCount} 个待处理事项</strong>
          <span>
            {latestProjectComment
              ? `最新评论锚点 ${latestProjectComment.anchor || '未设置'}，最近更新时间 ${formatLocalTime(
                  latestProjectComment.updatedAt
                )}。`
              : '评论、评审、模板与批量更新会在这里收束为项目治理节奏。'}
          </span>
        </div>
        <div className="collab-watch-inline collab-watch-inline--readout">
          <div>
            <b>待 Resolve</b>
            <span>{projectSelectedCommentId || FALLBACK_TEXT}</span>
          </div>
          <div>
            <b>模板回执</b>
            <span>{projectTemplateApplyResult?.templateName || FALLBACK_TEXT}</span>
          </div>
          <div>
            <b>批量回执</b>
            <span>
              {projectClipBatchResult ? `${batchAccepted}/${batchRequested}` : FALLBACK_TEXT}
            </span>
          </div>
        </div>
      </div>
      <div className="collab-workflow-cluster collab-workflow-cluster--comments">
        <div className="collab-workflow-cluster-head">
          <span className="collab-section-kicker">comment desk</span>
          <strong>评论处理</strong>
          <span>先处理锚点反馈与待 Resolve 项，再决定是否进入评审。</span>
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
            <div key={item.id} className="collab-list-item collab-list-item--rich">
              <div className="collab-list-item-head">
                <strong>{item.content}</strong>
                <span
                  className={`lab-status-badge lab-status-badge--${resolveGovernanceTone(item.status)}`}
                >
                  {item.status}
                </span>
              </div>
              <div className="collab-list-meta">
                <span>锚点：{item.anchor || FALLBACK_TEXT}</span>
                <span>{formatMentions(item.mentions)}</span>
                <span>处理人：{item.resolvedBy || resolveCommentActor(item)}</span>
              </div>
              <div className="collab-list-meta">
                <span>更新：{formatLocalTime(item.updatedAt)}</span>
                <span>创建：{formatLocalTime(item.createdAt)}</span>
              </div>
            </div>
          ))}
          {projectComments.length === 0 ? <div className="api-empty">暂无项目评论</div> : null}
        </div>
      </div>

      <div className="collab-workflow-cluster collab-workflow-cluster--reviews">
        <div className="collab-workflow-cluster-head">
          <span className="collab-section-kicker">review lane</span>
          <strong>评审决策</strong>
          <span>把评论处理结果沉淀成批准或变更请求，形成下一步动作。</span>
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
            <div key={item.id} className="collab-list-item collab-list-item--rich">
              <div className="collab-list-item-head">
                <strong>{item.summary}</strong>
                <span
                  className={`lab-status-badge lab-status-badge--${resolveGovernanceTone(item.decision)}`}
                >
                  {item.decision}
                </span>
              </div>
              <div className="collab-list-meta">
                <span>评分：{item.score ?? FALLBACK_TEXT}</span>
                <span>评审人：{resolveReviewActor(item)}</span>
                <span>时间：{formatLocalTime(item.createdAt)}</span>
              </div>
            </div>
          ))}
          {projectReviews.length === 0 ? <div className="api-empty">暂无项目评审</div> : null}
        </div>
      </div>

      <div className="collab-workflow-cluster collab-workflow-cluster--templates">
        <div className="collab-workflow-cluster-head">
          <span className="collab-section-kicker">template rail</span>
          <strong>模板下发</strong>
          <span>把治理结果转成可复用模板，压缩后续项目对齐成本。</span>
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
            <div key={item.id} className="collab-list-item collab-list-item--rich">
              <div className="collab-list-item-head">
                <strong>{item.name}</strong>
                <span className="lab-status-badge lab-status-badge--neutral">template</span>
              </div>
              <div className="collab-list-item-copy">{item.description || FALLBACK_TEXT}</div>
              <div className="collab-list-meta">
                <span>创建人：{item.createdBy || FALLBACK_TEXT}</span>
                <span>更新时间：{formatLocalTime(item.updatedAt)}</span>
              </div>
            </div>
          ))}
          {projectTemplates.length === 0 ? <div className="api-empty">暂无项目模板</div> : null}
        </div>
      </div>

      <div className="collab-workflow-cluster collab-workflow-cluster--batch">
        <div className="collab-workflow-cluster-head">
          <span className="collab-section-kicker">batch patch</span>
          <strong>片段批量更新</strong>
          <span>批量回写片段修订，适合在治理闭环末尾统一落地。</span>
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
      </div>
    </section>
  )
}

export default ProjectGovernanceSection
