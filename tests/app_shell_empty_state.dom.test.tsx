import './helpers/dom-test-setup'
import React, { createRef } from 'react'
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render } from '@testing-library/react'
import AppCenterPanel from '../apps/frontend/src/components/App/AppCenterPanel'
import AppTimeline from '../apps/frontend/src/components/App/AppTimeline'

const renderCenterPanel = (props: Partial<React.ComponentProps<typeof AppCenterPanel>> = {}) =>
  render(
    <AppCenterPanel
      activeMode="edit"
      labSurface="stage"
      assetCount={0}
      hasTimelineClips={false}
      previewAspect="16:9"
      previewHostRef={createRef<HTMLDivElement>()}
      isSpatialPreview={false}
      isPlaying={false}
      timecodeDisplay={<span>00:00:00:00</span>}
      previewPlayer={<div>preview</div>}
      comparisonLab={<div>lab</div>}
      labWatchPanel={<div>watch</div>}
      onToggleSpatialPreview={mock(() => {})}
      onSeekToStart={mock(() => {})}
      onTogglePlay={mock(() => {})}
      onSeekToNextClip={mock(() => {})}
      onOpenAssets={mock(() => {})}
      onOpenDirector={mock(() => {})}
      onSwitchToLab={mock(() => {})}
      {...props}
    />
  )

describe('编辑器壳层空态回归', () => {
  afterEach(() => {
    cleanup()
  })

  it('中心工作区在无片段时应渲染唯一主入口 launchpad', () => {
    const view = renderCenterPanel()

    expect(view.getByText('开启创作流')).toBeInTheDocument()
    expect(view.getByRole('button', { name: '导入素材' })).toBeInTheDocument()
    expect(view.getByRole('button', { name: 'AI 导演' })).toBeInTheDocument()
    expect(view.getByRole('button', { name: '视频实验室' })).toBeInTheDocument()
  })

  it('中心空态应呈现 Nebula Flow 的导演画布双入口', () => {
    const view = renderCenterPanel()

    const launchpad = view.getByTestId('director-canvas-launchpad')
    expect(launchpad).toHaveAttribute('data-visual-system', 'nebula-flow')
    expect(view.getByText("Director's Canvas")).toBeInTheDocument()
    expect(view.getByText('唤醒 AI 导演')).toBeInTheDocument()
    expect(view.getByLabelText('AI 创作链路')).toHaveTextContent('PromptShotsTimeline')
    expect(view.getByRole('button', { name: /导入素材/ })).toHaveClass(/is-import/)
    expect(view.getByRole('button', { name: /AI 导演/ })).toHaveClass(/is-ai/)
  })

  it('中心空态引导应挂在预览宿主层级而不是锁在画面框内', () => {
    const view = renderCenterPanel()

    const host = view.getByTestId('area-preview-host')
    const frame = view.getByTestId('area-preview-frame')
    const overlay = view.container.querySelector('.monitor-empty-overlay')

    expect(overlay).not.toBeNull()
    expect(host).toContainElement(overlay as HTMLElement)
    expect(frame).not.toContainElement(overlay as HTMLElement)
  })

  it('中心底部应暴露 Output Dock 且不影响播放与实验室入口', () => {
    const seekToStart = mock(() => {})
    const togglePlay = mock(() => {})
    const seekToNextClip = mock(() => {})
    const switchToLab = mock(() => {})
    const view = renderCenterPanel({
      onSeekToStart: seekToStart,
      onTogglePlay: togglePlay,
      onSeekToNextClip: seekToNextClip,
      onSwitchToLab: switchToLab
    })

    const dock = view.getByTestId('output-dock')
    expect(dock).toHaveAttribute('data-visual-system', 'nebula-flow')
    expect(view.getByLabelText('输出停靠链路')).toHaveTextContent('PreviewLabRender')
    expect(dock).toHaveTextContent('Output Dock')

    fireEvent.click(view.getByTestId('btn-player-prev'))
    fireEvent.click(view.getByTestId('btn-player-play'))
    fireEvent.click(view.getByTestId('btn-player-next'))
    fireEvent.click(view.getByRole('button', { name: '视频实验室' }))
    expect(seekToStart).toHaveBeenCalledTimes(1)
    expect(togglePlay).toHaveBeenCalledTimes(1)
    expect(seekToNextClip).toHaveBeenCalledTimes(1)
    expect(switchToLab).toHaveBeenCalledTimes(1)
  })

  it('底部时间轴在无片段时应渲染待命态说明', () => {
    const openAssets = mock(() => {})
    const openDirector = mock(() => {})
    const onActiveToolChange = mock(() => {})
    const view = render(
      <AppTimeline
        activeMode="edit"
        canUndo={false}
        canRedo={false}
        activeTool="select"
        hasTimelineClips={false}
        currentMetrics={{ gpu: 12, ram: '8GB', cache: '31%' }}
        timelineContent={<div>timeline</div>}
        onActivate={mock(() => {})}
        onUndo={mock(() => {})}
        onRedo={mock(() => {})}
        onActiveToolChange={onActiveToolChange}
        onOpenAssets={openAssets}
        onOpenDirector={openDirector}
      />
    )

    expect(view.getByTestId('area-timeline')).toHaveClass(/is-idle/)
    const bus = view.getByTestId('timeline-bus')
    expect(bus).toHaveAttribute('data-visual-system', 'nebula-flow')
    expect(bus).toHaveTextContent('Timeline Bus')
    expect(view.getByLabelText('时间轴装配链路')).toHaveTextContent('QueueSyncDeliver')
    expect(view.getByText('主节目轨空置')).toBeInTheDocument()
    expect(view.getByText('请从左侧拖入素材，或使用 AI 导演启动编排')).toBeInTheDocument()
    expect(view.container.querySelector('.timeline-empty-hint button')).toBeNull()
    expect(view.container.querySelector('.timeline-empty-cta-rail')).not.toBeNull()
    expect(view.container.querySelector('.timeline-ai-kicker')).toHaveTextContent('Queue')
    expect(view.getByRole('button', { name: 'AI 导演编排' }).getAttribute('data-ai-emphasis')).toBe(
      'true'
    )
    fireEvent.click(view.getByRole('button', { name: '从素材库入轨' }))
    fireEvent.click(view.getByRole('button', { name: 'AI 导演编排' }))
    fireEvent.click(view.getByRole('button', { name: '剪切工具' }))
    expect(openAssets).toHaveBeenCalledTimes(1)
    expect(openDirector).toHaveBeenCalledTimes(1)
    expect(onActiveToolChange).toHaveBeenCalledWith('cut')
  })

  it('底部时间轴应按音频大师模式渲染母带空态说明', () => {
    const view = render(
      <AppTimeline
        activeMode="audio"
        canUndo={false}
        canRedo={false}
        activeTool="select"
        hasTimelineClips={false}
        currentMetrics={{ gpu: 0, ram: '0 / 0', cache: '0%' }}
        timelineContent={<div>timeline</div>}
        onActivate={mock(() => {})}
        onUndo={mock(() => {})}
        onRedo={mock(() => {})}
        onActiveToolChange={mock(() => {})}
      />
    )

    expect(view.getByText('母带轨空置')).toBeInTheDocument()
    expect(view.getByText('导入音频素材后，时间轴会承接节拍、响度与交付检查')).toBeInTheDocument()
    expect(view.queryByText('请从左侧拖入素材，或使用 AI 导演启动编排')).toBeNull()
  })

  it('底部时间轴应按实验室模式渲染比对空态说明', () => {
    const view = render(
      <AppTimeline
        activeMode="color"
        canUndo={false}
        canRedo={false}
        activeTool="select"
        hasTimelineClips={false}
        currentMetrics={{ gpu: 0, ram: '0 / 0', cache: '0%' }}
        timelineContent={<div>timeline</div>}
        onActivate={mock(() => {})}
        onUndo={mock(() => {})}
        onRedo={mock(() => {})}
        onActiveToolChange={mock(() => {})}
      />
    )

    expect(view.getByText('实验轨空置')).toBeInTheDocument()
    expect(view.getByText('完成双通道比对后，时间轴会承接选定片段与实验结论')).toBeInTheDocument()
    expect(view.queryByText('请从左侧拖入素材，或使用 AI 导演启动编排')).toBeNull()
  })

  it('底部时间轴在有片段时应切换到 armed 状态并隐藏空态', () => {
    const view = render(
      <AppTimeline
        activeMode="edit"
        canUndo
        canRedo
        activeTool="cut"
        hasTimelineClips
        currentMetrics={{ gpu: 42, ram: '12GB', cache: '58%' }}
        timelineContent={<div>timeline</div>}
        onActivate={mock(() => {})}
        onUndo={mock(() => {})}
        onRedo={mock(() => {})}
        onActiveToolChange={mock(() => {})}
      />
    )

    expect(view.getByTestId('area-timeline')).toHaveClass(/is-armed/)
    expect(view.queryByText('主节目轨空置')).toBeNull()
  })

  it('音频大师空态应渲染母带舞台与待命链路', () => {
    const view = renderCenterPanel({
      activeMode: 'audio'
    })

    expect(view.getByText('音频母带引擎已就绪')).toBeInTheDocument()
    expect(view.getByRole('button', { name: '导入音频素材' })).toBeInTheDocument()
    expect(view.getByTestId('audio-bus')).toHaveAttribute('data-visual-system', 'nebula-flow')
    expect(view.getByTestId('audio-bus')).toHaveTextContent('Audio Bus')
    expect(view.getByLabelText('音频母带链路')).toHaveTextContent('InputRhythmDelivery')
    expect(view.getByTestId('audio-master-status-tower')).toBeInTheDocument()
    expect(view.getByTestId('audio-master-lanes')).toBeInTheDocument()
    expect(view.getAllByText('母带输入').length).toBeGreaterThan(0)
  })

  it('实验室监控壳层应暴露 Watch Bus 且保留监控面板内容', () => {
    const view = renderCenterPanel({
      activeMode: 'color',
      labSurface: 'watch',
      labWatchPanel: <div data-testid="mock-watch-panel">watch</div>
    })

    expect(view.getByTestId('mock-watch-panel')).toBeInTheDocument()
    expect(view.getByTestId('watch-bus')).toHaveAttribute('data-visual-system', 'nebula-flow')
    expect(view.getByTestId('watch-bus')).toHaveTextContent('Watch Bus')
    expect(view.getByLabelText('实验室监控链路')).toHaveTextContent('ObserveRepairRelease')
  })
})
