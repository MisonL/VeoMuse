import './helpers/dom-test-setup'
import React, { createRef } from 'react'
import { describe, expect, it, mock } from 'bun:test'
import { render } from '@testing-library/react'
import AppCenterPanel from '../apps/frontend/src/components/App/AppCenterPanel'
import AppTimeline from '../apps/frontend/src/components/App/AppTimeline'

describe('编辑器壳层空态回归', () => {
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

    expect(view.getByText('中心工作区负责给出第一步，时间轴负责承接编排。')).toBeInTheDocument()
    expect(view.getByText('空轨待命')).toBeInTheDocument()
    expect(view.getByText('节目待命 / Waiting For First Clip')).toBeInTheDocument()
    expect(view.getByText('主操作区')).toBeInTheDocument()
    expect(
      view.getByText('先把第一批片段送入这里，后续的剪切、编排和导出前整理都会在这里完成。')
    ).toBeInTheDocument()
  })
})
