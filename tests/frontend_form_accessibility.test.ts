import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync, readdirSync } from 'fs'
import path from 'path'

const collectSourceFiles = (dir: string): string[] => {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return collectSourceFiles(fullPath)
    return entry.isFile() && fullPath.endsWith('.tsx') ? [fullPath] : []
  })
}

const readAppSourceBundle = () => {
  const sourceRoot = path.resolve(process.cwd(), 'apps/frontend/src')
  const files = [
    path.join(sourceRoot, 'App.tsx'),
    ...collectSourceFiles(path.join(sourceRoot, 'components/App'))
  ].sort()
  return {
    files,
    content: files.map((file) => readFileSync(file, 'utf8')).join('\n')
  }
}

describe('前端表单可访问性回归', () => {
  it('ComparisonLab 关键表单字段应具备 name 属性', () => {
    const content = [
      'apps/frontend/src/components/Editor/ComparisonLab.tsx',
      'apps/frontend/src/components/Editor/comparison-lab/LabToolbar.tsx',
      'apps/frontend/src/components/Editor/comparison-lab/modes/CompareModePanel.tsx',
      'apps/frontend/src/components/Editor/comparison-lab/modes/MarketplaceModePanel.tsx',
      'apps/frontend/src/components/Editor/comparison-lab/modes/CreativeModePanel.tsx',
      'apps/frontend/src/components/Editor/comparison-lab/modes/creative/CreativeInputSection.tsx',
      'apps/frontend/src/components/Editor/comparison-lab/modes/creative/CreativeRunDetailsSection.tsx',
      'apps/frontend/src/components/Editor/comparison-lab/modes/creative/WorkflowSection.tsx',
      'apps/frontend/src/components/Editor/comparison-lab/modes/creative/BatchJobSection.tsx',
      'apps/frontend/src/components/Editor/comparison-lab/modes/creative/AssetReuseSection.tsx',
      'apps/frontend/src/components/Editor/comparison-lab/modes/creative/VideoGenerationWorkbench.tsx',
      'apps/frontend/src/components/Editor/comparison-lab/modes/CollabModePanel.tsx',
      'apps/frontend/src/components/Editor/comparison-lab/modes/collab/WorkspaceSection.tsx',
      'apps/frontend/src/components/Editor/comparison-lab/modes/collab/InviteJoinSection.tsx',
      'apps/frontend/src/components/Editor/comparison-lab/modes/collab/CommentThreadsSection.tsx',
      'apps/frontend/src/components/Editor/comparison-lab/ChannelAccessPanel.tsx'
    ]
      .map((file) => readFileSync(path.resolve(process.cwd(), file), 'utf8'))
      .join('\n')
    expect(content).toContain('name="leftModel"')
    expect(content).toContain('name="selectedPolicyId"')
    expect(content).toContain('name="creativeScript"')
    expect(content).toContain('name="videoGenerationMode"')
    expect(content).toContain('name="videoGenerationPrompt"')
    expect(content).toContain('name="videoGenerationStatusFilter"')
    expect(content).toContain('name="workspaceName"')
    expect(content).toContain('name="syncPlayback"')
  })

  it('Compare/渠道面板关键输入应具备 aria-label 语义', () => {
    const content = [
      'apps/frontend/src/components/Editor/comparison-lab/modes/CompareModePanel.tsx',
      'apps/frontend/src/components/Editor/comparison-lab/ChannelAccessPanel.tsx'
    ]
      .map((file) => readFileSync(path.resolve(process.cwd(), file), 'utf8'))
      .join('\n')
    expect(content).toContain('aria-label="A 通道模型"')
    expect(content).toContain('aria-label="B 通道模型"')
    expect(content).toContain('aria-label="登录邮箱"')
    expect(content).toContain('aria-label="当前组织"')
    expect(content).toContain('aria-label="请求配额"')
  })

  it('TelemetryDashboard 数据库字段应具备 id/name 属性', () => {
    const content = [
      'apps/frontend/src/components/Editor/TelemetryDashboard.tsx',
      'apps/frontend/src/components/Editor/telemetry-dashboard/DbOpsPanel.tsx',
      'apps/frontend/src/components/Editor/telemetry-dashboard/DbRepairHistorySection.tsx'
    ]
      .map((file) => readFileSync(path.resolve(process.cwd(), file), 'utf8'))
      .join('\n')
    expect(content).toContain('id="db-admin-token"')
    expect(content).toContain('name="dbAdminToken"')
    expect(content).toContain('name="dbRepairRange"')
    expect(content).toContain('name="dbRepairStatus"')
    expect(content).toContain('name="dbRepairReason"')
  })

  it('App 关键按钮应具备 aria-label 语义', () => {
    const { files, content } = readAppSourceBundle()
    expect(
      files.some((file) => file.includes(`${path.sep}components${path.sep}App${path.sep}`))
    ).toBe(true)
    expect(content).toContain('id="export-quality"')
    expect(content).toContain('name="exportQuality"')
    expect(content).toContain('aria-label="导出视频"')
    expect(content).toContain('aria-label="跳转到开头"')
    expect(content).toContain('aria-label="跳转到下一片段"')
    expect(content).toContain('aria-label="撤销"')
    expect(content).toContain('aria-label="重做"')
  })

  it('AssetPanel 搜索输入应具备 id/name 属性', () => {
    const content = readFileSync(
      path.resolve(process.cwd(), 'apps/frontend/src/components/Editor/AssetPanel.tsx'),
      'utf8'
    )
    expect(content).toContain('id="asset-search-input"')
    expect(content).toContain('name="assetSearch"')
  })
})
