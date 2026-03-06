import './helpers/dom-test-setup'
import React from 'react'
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render } from '@testing-library/react'
import ProjectGovernancePanel from '../apps/frontend/src/components/Editor/telemetry-dashboard/ProjectGovernancePanel'

const noop = () => {}

const createProps = (overrides: Record<string, unknown> = {}) =>
  ({
    governanceProjectId: 'project_telemetry_1',
    governanceBusy: false,
    governanceCommentLimit: '20',
    governanceCommentCursor: '',
    governanceCommentHasMore: false,
    governanceComments: [],
    governanceCommentAnchor: '',
    governanceCommentContent: '',
    governanceCommentMentions: '',
    governanceSelectedCommentId: '',
    governanceReviewLimit: '20',
    governanceReviews: [],
    governanceReviewDecision: 'approved',
    governanceReviewSummary: '',
    governanceReviewScore: '',
    governanceTemplates: [],
    governanceSelectedTemplateId: '',
    governanceTemplateOptions: '{}',
    governanceTemplateResult: null,
    governanceBatchOperations: '[]',
    governanceBatchResult: null,
    governanceError: '',
    onGovernanceProjectIdChange: noop,
    onGovernanceCommentLimitChange: noop,
    onLoadGovernanceComments: noop,
    onGovernanceCommentAnchorChange: noop,
    onGovernanceCommentContentChange: noop,
    onGovernanceCommentMentionsChange: noop,
    onCreateGovernanceComment: noop,
    onGovernanceSelectedCommentIdChange: noop,
    onResolveGovernanceComment: noop,
    onLoadGovernanceReviews: noop,
    onGovernanceReviewLimitChange: noop,
    onGovernanceReviewDecisionChange: noop,
    onGovernanceReviewSummaryChange: noop,
    onGovernanceReviewScoreChange: noop,
    onCreateGovernanceReview: noop,
    onLoadGovernanceTemplates: noop,
    onGovernanceSelectedTemplateIdChange: noop,
    onApplyGovernanceTemplate: noop,
    onGovernanceTemplateOptionsChange: noop,
    onGovernanceBatchOperationsChange: noop,
    onGovernanceBatchUpdateClips: noop,
    ...overrides
  }) as any

describe('ProjectGovernancePanel DOM 回归', () => {
  afterEach(() => {
    cleanup()
  })

  it('空态应渲染治理主区块与默认提示', () => {
    const view = render(<ProjectGovernancePanel {...createProps()} />)

    expect(view.getByText('项目治理卡片（第二入口）')).toBeInTheDocument()
    expect(view.getByText('评论游标：-')).toBeInTheDocument()
    expect(view.getByText('暂无项目评论')).toBeInTheDocument()
    expect(view.getByText('暂无项目评审')).toBeInTheDocument()
    expect(view.getByText('模板回执：-')).toBeInTheDocument()
    expect(view.getByText('提交 clips/batch-update')).toBeInTheDocument()
  })

  it('非空态应触发评论/评审/模板批量更新动作', () => {
    const onLoadGovernanceComments = mock((_append?: boolean) => {})
    const onCreateGovernanceComment = mock(() => {})
    const onResolveGovernanceComment = mock(() => {})
    const onLoadGovernanceReviews = mock(() => {})
    const onCreateGovernanceReview = mock(() => {})
    const onLoadGovernanceTemplates = mock(() => {})
    const onApplyGovernanceTemplate = mock(() => {})
    const onGovernanceBatchUpdateClips = mock(() => {})

    const view = render(
      <ProjectGovernancePanel
        {...createProps({
          governanceCommentHasMore: true,
          governanceComments: [
            {
              id: 'cmt_1',
              content: '评论 A',
              status: 'open',
              mentions: ['owner']
            }
          ],
          governanceSelectedCommentId: 'cmt_1',
          governanceReviews: [
            {
              id: 'rev_1',
              decision: 'approved',
              summary: '通过',
              score: 9
            }
          ],
          governanceTemplates: [{ id: 'tpl_1', name: '模板 A' }],
          governanceSelectedTemplateId: 'tpl_1',
          governanceTemplateResult: { traceId: 'trace_1', templateName: '模板 A' },
          governanceBatchResult: { requested: 2, accepted: 2, updated: 2 },
          onLoadGovernanceComments,
          onCreateGovernanceComment,
          onResolveGovernanceComment,
          onLoadGovernanceReviews,
          onCreateGovernanceReview,
          onLoadGovernanceTemplates,
          onApplyGovernanceTemplate,
          onGovernanceBatchUpdateClips
        })}
      />
    )

    fireEvent.click(view.getByRole('button', { name: '刷新评论' }))
    fireEvent.click(view.getByRole('button', { name: '评论加载更多' }))
    fireEvent.click(view.getByRole('button', { name: '新建评论' }))
    fireEvent.click(view.getByRole('button', { name: 'Resolve 评论' }))
    fireEvent.click(view.getByRole('button', { name: '刷新评审' }))
    fireEvent.click(view.getByRole('button', { name: '新建评审' }))
    fireEvent.click(view.getByRole('button', { name: '刷新模板' }))
    fireEvent.click(view.getByRole('button', { name: '应用模板' }))
    fireEvent.click(view.getByRole('button', { name: '提交 clips/batch-update' }))

    expect(onLoadGovernanceComments).toHaveBeenCalledTimes(2)
    expect(onLoadGovernanceComments.mock.calls[0]?.[0]).toBe(false)
    expect(onLoadGovernanceComments.mock.calls[1]?.[0]).toBe(true)
    expect(onCreateGovernanceComment).toHaveBeenCalledTimes(1)
    expect(onResolveGovernanceComment).toHaveBeenCalledTimes(1)
    expect(onLoadGovernanceReviews).toHaveBeenCalledTimes(1)
    expect(onCreateGovernanceReview).toHaveBeenCalledTimes(1)
    expect(onLoadGovernanceTemplates).toHaveBeenCalledTimes(1)
    expect(onApplyGovernanceTemplate).toHaveBeenCalledTimes(1)
    expect(onGovernanceBatchUpdateClips).toHaveBeenCalledTimes(1)
    expect(view.getByText('评论 A')).toBeInTheDocument()
    expect(view.getByText('通过')).toBeInTheDocument()
    expect(view.getByRole('option', { name: '模板 A' })).toBeInTheDocument()
    expect(view.getByText('requested 2')).toBeInTheDocument()
  })
})
