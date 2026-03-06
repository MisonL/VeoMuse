import React from 'react'
import type {
  ProjectGovernanceClipBatchUpdateResult,
  ProjectGovernanceTemplate,
  ProjectGovernanceTemplateApplyResult
} from '../comparison-lab/types'

export interface GovernanceTemplateBatchSectionProps {
  governanceBusy: boolean
  governanceTemplates: ProjectGovernanceTemplate[]
  governanceSelectedTemplateId: string
  governanceTemplateOptions: string
  governanceTemplateResult: ProjectGovernanceTemplateApplyResult | null
  governanceBatchOperations: string
  governanceBatchResult: ProjectGovernanceClipBatchUpdateResult | null
  onLoadGovernanceTemplates: () => void
  onGovernanceSelectedTemplateIdChange: (value: string) => void
  onApplyGovernanceTemplate: () => void
  onGovernanceTemplateOptionsChange: (value: string) => void
  onGovernanceBatchOperationsChange: (value: string) => void
  onGovernanceBatchUpdateClips: () => void
}

const GovernanceTemplateBatchSection: React.FC<GovernanceTemplateBatchSectionProps> = ({
  governanceBusy,
  governanceTemplates,
  governanceSelectedTemplateId,
  governanceTemplateOptions,
  governanceTemplateResult,
  governanceBatchOperations,
  governanceBatchResult,
  onLoadGovernanceTemplates,
  onGovernanceSelectedTemplateIdChange,
  onApplyGovernanceTemplate,
  onGovernanceTemplateOptionsChange,
  onGovernanceBatchOperationsChange,
  onGovernanceBatchUpdateClips
}) => {
  return (
    <>
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
    </>
  )
}

export default GovernanceTemplateBatchSection
