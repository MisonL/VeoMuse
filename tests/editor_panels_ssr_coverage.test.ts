import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import AssetPanel from '../apps/frontend/src/components/Editor/AssetPanel'
import PropertyInspector from '../apps/frontend/src/components/Editor/PropertyInspector'
import TelemetryDashboard from '../apps/frontend/src/components/Editor/TelemetryDashboard'

describe('编辑器聚合面板 SSR 覆盖补强', () => {
  it('AssetPanel 多模式应渲染关键区块（默认 store）', () => {
    const assetsHtml = renderToString(createElement(AssetPanel, { mode: 'assets' }))
    expect(assetsHtml).toContain('暂无媒体素材')
    expect(assetsHtml).toContain('asset-search-input')

    const directorHtml = renderToString(
      createElement(AssetPanel, {
        mode: 'director',
        directorPrompt: '测试脚本',
        directorScenes: [{ title: '场景 A', duration: 5 }],
        isAiWorking: false
      })
    )
    expect(directorHtml).toContain('脚本分析反馈')
    expect(directorHtml).toContain('场景 A')

    const actorsHtml = renderToString(createElement(AssetPanel, { mode: 'actors' }))
    expect(actorsHtml).toContain('演员库管理')
    expect(actorsHtml).toContain('暂无演员')

    const motionHtml = renderToString(createElement(AssetPanel, { mode: 'motion' }))
    expect(motionHtml).toContain('动作捕捉实验室')
    expect(motionHtml).toContain('待启动')
    expect(motionHtml).toContain('0<!-- --> points')
  })

  it('PropertyInspector 默认应渲染空态', () => {
    const html = renderToString(createElement(PropertyInspector))
    expect(html).toContain('未选中片段')
    expect(html).toContain('点击时间轴片段开始炼金')
  })

  it('TelemetryDashboard 默认应渲染治理与数据库区块', () => {
    const html = renderToString(createElement(TelemetryDashboard))
    expect(html).toContain('播放 FPS 稳定性')
    expect(html).toContain('暂无 SLO 数据')
    expect(html).toContain('project-governance-card')
    expect(html).toContain('数据库自愈中心')
  })
})
