import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import path from 'path'

const read = (relativePath: string) =>
  readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

const comparisonLabFiles = [
  'apps/frontend/src/components/Editor/ComparisonLab.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/hooks/useProjectGovernance.ts',
  'apps/frontend/src/components/Editor/comparison-lab/hooks/useV4CommentThreads.ts',
  'apps/frontend/src/components/Editor/comparison-lab/hooks/useV4CreativeOps.ts',
  'apps/frontend/src/components/Editor/comparison-lab/hooks/useV4OpsManager.ts',
  'apps/frontend/src/components/Editor/comparison-lab/hooks/useCreativeModeController.ts',
  'apps/frontend/src/components/Editor/comparison-lab/hooks/useCollabModeController.ts',
  'apps/frontend/src/components/Editor/comparison-lab/hooks/useVideoGenerationManager.ts',
  'apps/frontend/src/components/Editor/comparison-lab/modes/creative/CreativeInputSection.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/creative/CreativeRunDetailsSection.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/creative/CreativeVersionChainSection.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/CreativeModePanel.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/creative/CreativeModeContainer.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/creative/WorkflowSection.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/creative/BatchJobSection.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/creative/AssetReuseSection.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/creative/VideoGenerationWorkbench.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/CollabModePanel.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/collab/CollabModeContainer.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/collab/WorkspaceSection.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/collab/InviteJoinSection.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/collab/RealtimeChannelSection.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/collab/CommentThreadsSection.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/collab/ProjectGovernanceSection.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/collab/OpsToolsSection.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/collab/PermissionMergeSection.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/collab/StorageSnapshotsSection.tsx'
]
const governanceSharedFile = 'apps/frontend/src/components/Editor/comparison-lab/types.ts'
const telemetryDashboardFiles = [
  'apps/frontend/src/components/Editor/TelemetryDashboard.tsx',
  'apps/frontend/src/components/Editor/telemetry-dashboard/hooks/useTelemetryDashboardPolling.ts',
  'apps/frontend/src/components/Editor/telemetry-dashboard/hooks/useTelemetryDbOpsController.ts',
  'apps/frontend/src/components/Editor/telemetry-dashboard/hooks/useTelemetryGovernanceController.ts',
  'apps/frontend/src/components/Editor/telemetry-dashboard/hooks/useTelemetryProviderHealthController.ts',
  'apps/frontend/src/components/Editor/telemetry-dashboard/hooks/useTelemetrySloController.ts',
  'apps/frontend/src/components/Editor/telemetry-dashboard/SloSection.tsx',
  'apps/frontend/src/components/Editor/telemetry-dashboard/ProjectGovernancePanel.tsx',
  'apps/frontend/src/components/Editor/telemetry-dashboard/GovernanceCommentsSection.tsx',
  'apps/frontend/src/components/Editor/telemetry-dashboard/GovernanceReviewsSection.tsx',
  'apps/frontend/src/components/Editor/telemetry-dashboard/GovernanceTemplateBatchSection.tsx',
  'apps/frontend/src/components/Editor/telemetry-dashboard/DbOpsPanel.tsx',
  'apps/frontend/src/components/Editor/telemetry-dashboard/DbRepairHistorySection.tsx'
]

const readJoined = (files: string[]) => files.map(read).join('\n')

describe('V4 实验室前端闭环对齐', () => {
  it('源码中应包含告警 ACK、评论分页 mentions、Workflow runs 与复用历史调用线索', () => {
    const repoSources = readJoined([
      ...comparisonLabFiles,
      governanceSharedFile,
      ...telemetryDashboardFiles,
      'scripts/api_contract_guard.ts'
    ])
    const comparisonLabSources = readJoined(comparisonLabFiles)
    const governanceSharedSource = read(governanceSharedFile)
    const telemetrySource = readJoined(telemetryDashboardFiles)

    expect(repoSources).toContain('/admin/reliability/alerts')
    expect(comparisonLabSources).toContain(
      '/admin/reliability/alerts/${encodeURIComponent(normalizedAlertId)}/ack'
    )
    expect(repoSources).toContain('/admin/reliability/error-budget')
    expect(repoSources).toContain('/assets/reuse-history')
    expect(comparisonLabSources).toContain('/api/video/generations')
    expect(comparisonLabSources).toContain(
      '/api/video/generations/${encodeURIComponent(targetJobId)}'
    )
    expect(comparisonLabSources).toContain(
      '/api/video/generations/${encodeURIComponent(normalizedJobId)}/sync'
    )
    expect(comparisonLabSources).toContain(
      '/api/video/generations/${encodeURIComponent(normalizedJobId)}/retry'
    )
    expect(comparisonLabSources).toContain(
      '/api/video/generations/${encodeURIComponent(normalizedJobId)}/cancel'
    )
    expect(comparisonLabSources).toMatch(/\/admin\/reliability\/(alerts|error-budget|drills)/)
    expect(comparisonLabSources).toMatch(
      /\/admin\/reliability\/error-budget[\s\S]{0,300}method:\s*'PUT'/
    )
    expect(comparisonLabSources).toContain('/assets/${encodeURIComponent(assetId)}/reuse')
    expect(comparisonLabSources).toContain(
      '/creative/prompt-workflows/${encodeURIComponent(v4SelectedWorkflowId)}/runs'
    )
    expect(comparisonLabSources).toContain(
      '/projects/${projectId}/comment-threads?${query.toString()}'
    )
    expect(comparisonLabSources).toContain("query.set('cursor', nextCursor)")
    expect(comparisonLabSources).toContain('mentions: mentions.length > 0 ? mentions : undefined')
    expect(comparisonLabSources).toContain('sourceProjectId')
    expect(comparisonLabSources).toContain('targetProjectId')
    expect(comparisonLabSources).toContain('offset')
    expect(governanceSharedSource).toContain('/comments')
    expect(governanceSharedSource).toContain('/reviews')
    expect(governanceSharedSource).toContain('/templates')
    expect(governanceSharedSource).toContain('/templates/apply')
    expect(governanceSharedSource).toContain('/clips/batch-update')
    expect(telemetrySource).toContain('listProjectGovernanceComments')
    expect(comparisonLabSources).toContain('listProjectGovernanceComments')
  })

  it('ComparisonLab 运维区域应存在 admin token 相关输入/状态文案', () => {
    const collabPanel = readJoined([
      'apps/frontend/src/components/Editor/comparison-lab/modes/CollabModePanel.tsx',
      'apps/frontend/src/components/Editor/comparison-lab/modes/collab/OpsToolsSection.tsx'
    ])
    const telemetryDashboard = readJoined(telemetryDashboardFiles)

    expect(collabPanel).toContain('运维工具')
    expect(telemetryDashboard).toContain('输入管理员令牌（x-admin-token）')
    expect(telemetryDashboard).toContain('暂无 SLO 数据，请先保存管理员令牌')
    expect(collabPanel).toContain('placeholder="用于 x-admin-token 请求头，可持久化"')
  })

  it('面板中应包含告警列表、评论分页、回滚参数化与批处理条目展示入口文案', () => {
    const comparisonLabSources = readJoined([...comparisonLabFiles, ...telemetryDashboardFiles])

    expect(comparisonLabSources).toMatch(/告警列表|ACK|错误预算|回滚演练|更新错误预算策略/)
    expect(comparisonLabSources).toMatch(/复用历史|Asset Reuse|目标项目|来源项目|偏移量/)
    expect(comparisonLabSources).toMatch(/加载更多|Workflow Runs|Batch Job Items|mentions/)
    expect(comparisonLabSources).toMatch(/统一视频生成工作台|Gemini 快速自检/)
    expect(comparisonLabSources).toMatch(/同步|重试|取消|刷新详情/)
    expect(comparisonLabSources).toContain('v4RollbackPlan')
    expect(comparisonLabSources).toContain('v4RollbackResult')
    expect(comparisonLabSources).toContain('项目治理闭环')
    expect(comparisonLabSources).toContain('项目治理卡片（第二入口）')
    expect(comparisonLabSources).toContain('onBatchUpdateProjectClips')
    expect(comparisonLabSources).toContain('handleGovernanceBatchUpdateClips')
    expect(comparisonLabSources).toContain('useCollabModeController')
    expect(comparisonLabSources).toContain('CollabModeContainer')
  })
})
