import './helpers/dom-test-setup'
import React, { createRef } from 'react'
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, render } from '@testing-library/react'
import AppCenterPanel from '../apps/frontend/src/components/App/AppCenterPanel'
import AppTimeline from '../apps/frontend/src/components/App/AppTimeline'

describe('编辑器壳层空态回归', () => {
  afterEach(() => {
    cleanup()
  })

  it('中心工作区在无片段时应渲染唯一主入口 launchpad', () => {
    const view = render(
      <AppCenterPanel
        activeMode="edit"
        assetCount={0}
        hasTimelineClips={false}
        previewAspect="16:9"
        previewHostRef={createRef<HTMLDivElement>()}
        isSpatialPreview={false}
        isPlaying={false}
        timecodeDisplay={<span>00:00:00:00</span>}
        previewPlayer={<div>preview</div>}
        comparisonLab={<div>lab</div>}
        onToggleSpatialPreview={mock(() => {})}
        onSeekToStart={mock(() => {})}
        onTogglePlay={mock(() => {})}
        onSeekToNextClip={mock(() => {})}
        onOpenAssets={mock(() => {})}
        onOpenDirector={mock(() => {})}
        onSwitchToLab={mock(() => {})}
      />
    )

    expect(view.getByText('先把首批素材送上导播台')).toBeInTheDocument()
    expect(view.getByRole('button', { name: '导入素材' })).toBeInTheDocument()
    expect(view.getByRole('button', { name: '打开 AI 导演' })).toBeInTheDocument()
    expect(view.getByRole('button', { name: '切到实验室' })).toBeInTheDocument()
  })

  it('底部时间轴在无片段时应渲染待命态说明', () => {
    const view = render(
      <AppTimeline
        activeMode="edit"
        assetCount={0}
        canUndo={false}
        canRedo={false}
        activeTool="select"
        hasTimelineClips={false}
        currentMetrics={{ gpu: 12, ram: '8GB', cache: '31%' }}
        telemetryHistory={[8, 12, 16]}
        timelineContent={<div>timeline</div>}
        onActivate={mock(() => {})}
        onUndo={mock(() => {})}
        onRedo={mock(() => {})}
        onActiveToolChange={mock(() => {})}
      />
    )

    expect(view.getByTestId('area-timeline')).toHaveClass(/is-idle/)
    expect(view.container.querySelector('.timeline-priority-band')).toHaveClass('is-idle')
    expect(view.container.querySelector('.system-telemetry')).toHaveClass('is-idle')
    expect(view.getByText('中心工位给出第一步，时间轴接管编排。')).toBeInTheDocument()
    expect(view.getByText('空轨待命')).toBeInTheDocument()
    expect(view.getByText('节目待命 / 等待首个片段')).toBeInTheDocument()
    expect(view.getByText('主操作区')).toBeInTheDocument()
    expect(
      view.getByText('先让首批片段入轨。剪切、编排与导出前整理都在这里完成。')
    ).toBeInTheDocument()
  })

  it('底部时间轴在有片段时应切换到 armed 状态并隐藏空态', () => {
    const view = render(
      <AppTimeline
        activeMode="edit"
        assetCount={4}
        canUndo
        canRedo
        activeTool="cut"
        hasTimelineClips
        currentMetrics={{ gpu: 42, ram: '12GB', cache: '58%' }}
        telemetryHistory={[18, 32, 44, 38]}
        timelineContent={<div>timeline</div>}
        onActivate={mock(() => {})}
        onUndo={mock(() => {})}
        onRedo={mock(() => {})}
        onActiveToolChange={mock(() => {})}
      />
    )

    expect(view.getByTestId('area-timeline')).toHaveClass(/is-armed/)
    expect(view.container.querySelector('.timeline-priority-band')).toHaveClass('is-armed')
    expect(view.container.querySelector('.system-telemetry')).toHaveClass('is-armed')
    expect(view.getByText('节目编排 / 主剪版')).toBeInTheDocument()
    expect(view.getByText('播出总线稳定 / 节目轨热更新中')).toBeInTheDocument()
    expect(view.queryByText('空轨待命')).toBeNull()
  })

  it('音频大师空态应渲染母带舞台与待命链路', () => {
    const view = render(
      <AppCenterPanel
        activeMode="audio"
        assetCount={0}
        hasTimelineClips={false}
        previewAspect="16:9"
        previewHostRef={createRef<HTMLDivElement>()}
        isSpatialPreview={false}
        isPlaying={false}
        timecodeDisplay={<span>00:00:00:00</span>}
        previewPlayer={<div>preview</div>}
        comparisonLab={<div>lab</div>}
        onToggleSpatialPreview={mock(() => {})}
        onSeekToStart={mock(() => {})}
        onTogglePlay={mock(() => {})}
        onSeekToNextClip={mock(() => {})}
        onOpenAssets={mock(() => {})}
        onOpenDirector={mock(() => {})}
        onSwitchToLab={mock(() => {})}
      />
    )

    expect(view.getByText('音频母带引擎已就绪')).toBeInTheDocument()
    expect(view.getByText('旁白链路待命')).toBeInTheDocument()
    expect(view.getByText('音乐节奏待命')).toBeInTheDocument()
    expect(view.getByText('交付校验待命')).toBeInTheDocument()
    expect(view.getByRole('button', { name: '导入素材开始处理' })).toBeInTheDocument()
    expect(view.getByRole('button', { name: '切换到实验室对比' })).toBeInTheDocument()
  })
})
