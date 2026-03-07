import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import path from 'path'

const labCssPath = path.resolve(
  process.cwd(),
  'apps/frontend/src/components/Editor/ComparisonLab.css'
)
const labSourceFiles = [
  'apps/frontend/src/components/Editor/ComparisonLab.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/types.ts',
  'apps/frontend/src/components/Editor/comparison-lab/constants.ts',
  'apps/frontend/src/components/Editor/comparison-lab/LabToolbar.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/ChannelAccessPanel.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/hooks/useCompareModeManager.ts',
  'apps/frontend/src/components/Editor/comparison-lab/hooks/useComparisonLabController.ts',
  'apps/frontend/src/components/Editor/comparison-lab/hooks/useCreativeModeController.ts',
  'apps/frontend/src/components/Editor/comparison-lab/hooks/useCreativeRunManager.ts',
  'apps/frontend/src/components/Editor/comparison-lab/hooks/useMarketplacePolicy.ts',
  'apps/frontend/src/components/Editor/comparison-lab/hooks/useCollabModeController.ts',
  'apps/frontend/src/components/Editor/comparison-lab/hooks/useProjectGovernance.ts',
  'apps/frontend/src/components/Editor/comparison-lab/hooks/useV4CommentThreads.ts',
  'apps/frontend/src/components/Editor/comparison-lab/hooks/useV4CreativeOps.ts',
  'apps/frontend/src/components/Editor/comparison-lab/hooks/useWorkspaceCollaborationManager.ts',
  'apps/frontend/src/components/Editor/comparison-lab/modes/CompareModePanel.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/MarketplaceModePanel.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/CreativeModePanel.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/creative/CreativeModeContainer.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/creative/CreativeInputSection.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/creative/CreativeRunDetailsSection.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/creative/CreativeVersionChainSection.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/creative/WorkflowSection.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/creative/BatchJobSection.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/creative/AssetReuseSection.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/creative/VideoGenerationWorkbench.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/CollabModePanel.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/collab/CollabModeContainer.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/collab/CollabAdvancedSections.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/collab/WorkspaceSection.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/collab/InviteJoinSection.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/collab/RealtimeChannelSection.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/collab/CommentThreadsSection.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/collab/ProjectGovernanceSection.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/collab/OpsToolsSection.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/collab/PermissionMergeSection.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/collab/StorageSnapshotsSection.tsx',
  'apps/frontend/src/components/Editor/comparison-lab/modes/collab/useCollabAdvancedSections.ts'
]

const readLabSources = () =>
  labSourceFiles.map((file) => readFileSync(path.resolve(process.cwd(), file), 'utf8')).join('\n')

describe('P2 实验室前端对齐验证', () => {
  it('应包含 P2 三大模式入口', () => {
    const content = readLabSources()
    expect(content).toContain('策略治理')
    expect(content).toContain('创意闭环')
    expect(content).toContain('协作平台')
    expect(content).toContain(`type LabMode = 'compare' | 'marketplace' | 'creative' | 'collab'`)
    expect(content).toContain('role="tablist"')
    expect(content).toContain('role="tab"')
    expect(content).toContain('aria-selected={stage.mode === labMode}')
  })

  it('应接入模型策略治理接口与执行记录分页', () => {
    const content = readLabSources()
    expect(content).toContain('/api/models/policies')
    expect(content).toContain('/executions?limit=')
    expect(content).toContain('scoreBreakdown')
    expect(content).toContain('POLICY_EXEC_PAGE_SIZE')
  })

  it('应接入创意闭环版本链与提交接口', () => {
    const content = readLabSources()
    expect(content).toContain('/api/ai/creative/run')
    expect(content).toContain('/feedback')
    expect(content).toContain('/versions')
    expect(content).toContain('/commit')
    expect(content).toContain('routingDecision')
    expect(content).toContain('routingPolicyId')
    expect(content).toContain('useCreativeModeController')
    expect(content).toContain('CreativeModeContainer')
  })

  it('应接入协作平台 REST + WebSocket 闭环', () => {
    const content = readLabSources()
    expect(content).toContain('/api/workspaces')
    expect(content).toContain('/api/storage/upload-token')
    expect(content).toContain('/ws/collab/')
    expect(content).toContain('presence.heartbeat')
    expect(content).toContain('timeline.patch')
    expect(content).toContain('const optimisticEvent: CollabEvent')
    expect(content).toMatch(
      /setCollabEvents\(\s*\(?prev\)?\s*=>\s*\[optimisticEvent,\s*\.\.\.prev\]\.slice\(0,\s*100\)\s*\)/
    )
    expect(content).toContain('setWorkspaceId(payload.workspace.id)')
    expect(content).toContain('setProjectId(payload.defaultProject.id)')
    expect(content).toContain('useCollabModeController')
    expect(content).toContain('CollabModeContainer')
  })

  it('协作与策略动作应具备加载态/防重入保护', () => {
    const content = readLabSources()
    expect(content).toContain('isPolicyLoading')
    expect(content).toContain('isPolicySimulating')
    expect(content).toContain('isCreativeBusy')
    expect(content).toContain("collabRole !== 'owner'")
  })

  it('样式层应具备创意与协作布局容器', () => {
    const css = readFileSync(labCssPath, 'utf8')
    expect(css).toContain('.creative-shell')
    expect(css).toContain('.collab-shell')
    expect(css).toContain('.market-right-stack')
  })
})
