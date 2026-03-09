import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import AssetPanel from '../apps/frontend/src/components/Editor/AssetPanel'
import CreativeModePanel from '../apps/frontend/src/components/Editor/comparison-lab/modes/CreativeModePanel'
import PropertyInspector from '../apps/frontend/src/components/Editor/PropertyInspector'
import TelemetryDashboard from '../apps/frontend/src/components/Editor/TelemetryDashboard'
import { createCreativeModePanelProps } from './helpers/creativeModePanelProps'

describe('编辑器聚合面板 SSR 覆盖补强', () => {
  it('AssetPanel 多模式应渲染关键区块（默认 store）', () => {
    const assetsHtml = renderToString(createElement(AssetPanel, { mode: 'assets' }))
    expect(assetsHtml).toContain('暂无素材')
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
    const html = renderToString(createElement(PropertyInspector, { shellMode: 'edit' }))
    expect(html).toContain('等待片段进入工位')
    expect(html).toContain('时间轴选中片段后，可在这里查看参数')
    expect(html).toContain('系统监控')
    expect(html).toContain('切到系统监控')
  })

  it('TelemetryDashboard 默认应渲染治理与数据库区块', () => {
    const html = renderToString(createElement(TelemetryDashboard))
    expect(html).toContain('播放 FPS 稳定性')
    expect(html).toContain('暂无 SLO 数据')
    expect(html).toContain('project-governance-card')
    expect(html).toContain('数据库自愈中心')
    expect(html).toContain('总控链路')
  })

  it('CreativeModePanel 默认应渲染创意、工作流与资产复用区块', () => {
    const html = renderToString(
      createElement(
        CreativeModePanel,
        createCreativeModePanelProps({
          creativeRun: {
            id: 'run_ssr_1',
            status: 'draft',
            version: 1,
            parentRunId: null,
            updatedAt: '2026-03-06T08:00:00.000Z',
            scenes: []
          } as any
        })
      )
    )
    expect(html).toContain('创意闭环引擎')
    expect(html).toContain('area-creative-hero-stage')
    expect(html).toContain('统一视频生成工作台')
    expect(html).toContain('v4 Workflow')
    expect(html).toContain('资产复用')
    expect(html).toContain('Gemini 快速自检')
  })
})
