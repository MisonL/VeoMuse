import React from 'react'
import GovernanceCommentsSection, {
  type GovernanceCommentsSectionProps
} from './GovernanceCommentsSection'
import GovernanceReviewsSection, {
  type GovernanceReviewsSectionProps
} from './GovernanceReviewsSection'
import GovernanceTemplateBatchSection, {
  type GovernanceTemplateBatchSectionProps
} from './GovernanceTemplateBatchSection'

export interface ProjectGovernancePanelHeaderProps {
  governanceProjectId: string
  governanceBusy: boolean
  governanceError: string
  onGovernanceProjectIdChange: (value: string) => void
}

export interface ProjectGovernancePanelProps {
  headerProps: ProjectGovernancePanelHeaderProps
  commentsSectionProps: GovernanceCommentsSectionProps
  reviewsSectionProps: GovernanceReviewsSectionProps
  templateBatchSectionProps: GovernanceTemplateBatchSectionProps
}

const ProjectGovernancePanel: React.FC<ProjectGovernancePanelProps> = ({
  headerProps,
  commentsSectionProps,
  reviewsSectionProps,
  templateBatchSectionProps
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
          value={headerProps.governanceProjectId}
          onChange={(event) => headerProps.onGovernanceProjectIdChange(event.target.value)}
          placeholder="输入项目 ID（prj_xxx）"
        />
        <span>{headerProps.governanceBusy ? '处理中...' : '空闲'}</span>
      </div>
      <GovernanceCommentsSection {...commentsSectionProps} />

      <GovernanceReviewsSection {...reviewsSectionProps} />

      <GovernanceTemplateBatchSection {...templateBatchSectionProps} />
      {headerProps.governanceError ? (
        <div className="db-error">{headerProps.governanceError}</div>
      ) : null}
    </section>
  )
}

export default ProjectGovernancePanel
