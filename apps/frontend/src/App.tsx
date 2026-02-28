import { useState, memo, useEffect, useActionState, useOptimistic, lazy, Suspense, useMemo, useRef, useCallback } from 'react'
import type { CSSProperties } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from './store/editorStore'
import { useToastStore } from './store/toastStore'
import { useAdminMetricsPolling, useAdminMetricsStore } from './store/adminMetricsStore'
import { LAYOUT_LIMITS, useLayoutStore } from './store/layoutStore'
import { useThemeSync } from './hooks/useThemeSync'
import { api, getErrorMessage } from './utils/eden'
import { calcAspectFit, clamp } from './utils/layoutMath'
import ResizeHandle from './components/Common/ResizeHandle'
import ThemeSwitcher from './components/Common/ThemeSwitcher'
import './App.css'

const loadVideoEditor = () => import('./components/Editor/VideoEditor')
const loadMultiVideoPlayer = () => import('./components/Editor/MultiVideoPlayer')
const loadPropertyInspector = () => import('./components/Editor/PropertyInspector')
const loadAssetPanel = () => import('./components/Editor/AssetPanel')
const loadComparisonLab = () => import('./components/Editor/ComparisonLab')
const loadToastContainer = () => import('./components/Editor/ToastContainer')

const VideoEditor = lazy(loadVideoEditor)
const MultiVideoPlayer = lazy(loadMultiVideoPlayer)
const PropertyInspector = lazy(loadPropertyInspector)
const AssetPanel = lazy(loadAssetPanel)
const ComparisonLab = lazy(loadComparisonLab)
const ToastContainer = lazy(loadToastContainer)

const fps = 30
const DESKTOP_BREAKPOINT = 980
const MAIN_PANEL_MIN_WIDTH = 360
const MAIN_PANEL_MIN_HEIGHT = 260
const CENTER_PANEL_FALLBACK_WIDTH = 760
const CENTER_PANEL_FRAME_GUTTER = 32
const CENTER_PANEL_MAX_WIDTH = 980
const HEADER_HEIGHT = 62
const HORIZONTAL_HANDLE_SIZE = 10
const VERTICAL_HANDLE_SIZE = 8
const SHELL_VERTICAL_PADDING = 20
const SHELL_VERTICAL_GAP = 30

const formatTimecode = (seconds: number) => {
  const safe = Math.max(0, seconds)
  const hh = Math.floor(safe / 3600)
  const mm = Math.floor((safe % 3600) / 60)
  const ss = Math.floor(safe % 60)
  const ff = Math.floor((safe - Math.floor(safe)) * fps)
  return [hh, mm, ss, ff].map(v => String(v).padStart(2, '0')).join(':')
}

export const getExportButtonLabel = (
  isExportPending: boolean,
  optimisticExportStatus: 'idle' | 'pending' | 'done' | 'error'
) => (isExportPending || optimisticExportStatus === 'pending' ? '导出中...' : '导出')

const TimecodeDisplay = memo(() => {
  const currentTime = useEditorStore(state => state.currentTime)
  return <div className="timecode">{formatTimecode(currentTime)}</div>
})

const LazyFallback = memo(({ label = '加载中...' }: { label?: string }) => (
  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ap-text-dim)', fontSize: '12px', fontWeight: 700 }}>
    {label}
  </div>
))

function App() {
  useThemeSync()
  useAdminMetricsPolling()
  const { showToast } = useToastStore()
  const metrics = useAdminMetricsStore(state => state.metrics)
  const renderLoadHistory = useAdminMetricsStore(state => state.renderLoadHistory)

  const { isPlaying, togglePlay, setCurrentTime, tracks, setTracks } = useEditorStore(
    useShallow(state => ({
      isPlaying: state.isPlaying,
      togglePlay: state.togglePlay,
      setCurrentTime: state.setCurrentTime,
      tracks: state.tracks,
      setTracks: state.setTracks
    }))
  )
  const { isSpatialPreview, setSpatialPreview } = useEditorStore(
    useShallow(state => ({
      isSpatialPreview: state.isSpatialPreview,
      setSpatialPreview: state.setSpatialPreview
    }))
  )
  const { leftPanelPx, rightPanelPx, timelinePx, setTimelinePx, resetLayout } = useLayoutStore(
    useShallow(state => ({
      leftPanelPx: state.leftPanelPx,
      rightPanelPx: state.rightPanelPx,
      timelinePx: state.timelinePx,
      setTimelinePx: state.setTimelinePx,
      resetLayout: state.resetLayout
    }))
  )

  // @ts-ignore
  const { undo, redo, pastStates, futureStates } = useEditorStore.temporal.getState()

  const [activeMode, setActiveMode] = useState('edit')
  const [activeTool, setActiveTool] = useState('select')
  const [activeSidebar, setActiveSidebar] = useState<'assets' | 'director' | 'actors' | 'motion'>('assets')
  const [exportQuality, setExportQuality] = useState<'standard' | '4k-hdr' | 'spatial-vr'>('standard')
  const [directorPrompt, setDirectorPrompt] = useState('')
  const [directorScenes, setDirectorScenes] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isTimelineReady, setIsTimelineReady] = useState(false)
  const [isDesktopLayout, setIsDesktopLayout] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.innerWidth > DESKTOP_BREAKPOINT
  })
  const [previewFrameSize, setPreviewFrameSize] = useState({ width: 0, height: 0 })
  const [optimisticScenes, setOptimisticScenes] = useOptimistic<any[], any[]>(directorScenes, (_prev, next) => next)
  const [optimisticExportStatus, setOptimisticExportStatus] = useOptimistic<'idle' | 'pending' | 'done' | 'error', 'idle' | 'pending' | 'done' | 'error'>('idle', (_prev, next) => next)
  const shellRef = useRef<HTMLDivElement | null>(null)
  const mainLayoutRef = useRef<HTMLDivElement | null>(null)
  const leftPanelRef = useRef<HTMLElement | null>(null)
  const rightPanelRef = useRef<HTMLElement | null>(null)
  const previewHostRef = useRef<HTMLDivElement | null>(null)
  const [exportState, runExportAction, isExportPending] = useActionState(async (_: { status: 'idle' | 'done' | 'error'; message?: string }, quality: 'standard' | '4k-hdr' | 'spatial-vr') => {
    const timelineData = {
      tracks: useEditorStore.getState().tracks,
      exportConfig: { quality }
    }
    try {
      const { data, error } = await api.api.video.compose.post({ timelineData })
      if (error) throw new Error(getErrorMessage(error))
      if (data?.success) {
        showToast(`导出成功: ${data.outputPath}`, 'success')
        return { status: 'done' as const, message: data.outputPath }
      }
      return { status: 'error' as const, message: '导出失败' }
    } catch (e: any) {
      return { status: 'error' as const, message: e.message || '导出失败' }
    }
  }, { status: 'idle' as const })

  const telemetryHistory = useMemo(() => renderLoadHistory.slice(-10), [renderLoadHistory])
  const currentMetrics = useMemo(() => {
    if (!metrics?.system?.memory) return { gpu: 0, ram: '0 / 0', cache: '0%' }
    const gpu = Number.isFinite(metrics.system.renderLoad) ? Math.round(metrics.system.renderLoad) : 0
    const totalMemoryGb = Number(metrics.system.memory.total || 0) / (1024 ** 3)
    const usagePercent = Number(metrics.system.memory.usage || 0) * 100
    return {
      gpu,
      ram: `${totalMemoryGb.toFixed(1)}GB`,
      cache: `${Math.round(usagePercent)}%`
    }
  }, [metrics])

  const showRecoverableToast = (
    message: string,
    onRetry: () => void,
    onFallback: () => void
  ) => {
    showToast(message, 'error', {
      sticky: true,
      actions: [
        { label: '重试', variant: 'primary', onClick: onRetry },
        { label: '降级继续编辑', variant: 'secondary', onClick: onFallback }
      ]
    })
  }

  useEffect(() => {
    // 空闲时预热非首屏模块，降低首次切换等待
    const timer = setTimeout(() => {
      void loadComparisonLab()
      void loadPropertyInspector()
    }, 600)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (isTimelineReady) return

    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }

    const markReady = () => {
      setIsTimelineReady(true)
      void loadVideoEditor()
    }

    if (typeof w.requestIdleCallback === 'function') {
      const idleId = w.requestIdleCallback(markReady, { timeout: 800 })
      return () => {
        if (typeof w.cancelIdleCallback === 'function') w.cancelIdleCallback(idleId)
      }
    }

    timeoutId = setTimeout(markReady, 320)
    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [isTimelineReady])

  const ensureTimelineReady = () => {
    if (isTimelineReady) return
    setIsTimelineReady(true)
    void loadVideoEditor()
  }

  const handleDirector = async () => {
    if (!directorPrompt.trim()) return showToast('请输入脚本', 'info')
    setIsProcessing(true)
    setOptimisticScenes([{ title: 'AI 正在分析脚本...', duration: 1 }])

    try {
      const { data, error } = await api.api.ai.director.analyze.post({ script: directorPrompt })
      if (error) throw new Error(getErrorMessage(error))

      if (data && 'scenes' in data) {
        setDirectorScenes(data.scenes || [])
        setOptimisticScenes(data.scenes || [])

        let offset = 0
        const newTracks = JSON.parse(JSON.stringify(tracks))
        const vTrack = newTracks.find((t: any) => t.id === 'track-v1')
        if (vTrack) {
          data.scenes.forEach((scene: any, i: number) => {
            vTrack.clips.push({
              id: `auto-${Date.now()}-${i}`,
              start: offset,
              end: offset + Number(scene.duration || 5),
              src: '',
              name: scene.title || `场景 ${i + 1}`,
              type: 'video',
              data: {
                fromDirector: true,
                videoPrompt: scene.videoPrompt,
                audioPrompt: scene.audioPrompt,
                worldLink: true,
                worldId: (data as any).worldId
              }
            })
            offset += Number(scene.duration || 5)
          })
          setTracks(newTracks)
          showToast('分镜序列生成并编排成功', 'success')
        }
      }
    } catch (e: any) {
      const fallbackScenes = directorScenes.length > 0 ? directorScenes : [{ title: '手动编排片段', duration: 5 }]
      showRecoverableToast(
        e.message || '导演分析失败',
        () => { void handleDirector() },
        () => {
          setOptimisticScenes(fallbackScenes)
          showToast('已降级为手动编排模式，可继续剪辑', 'warning')
        }
      )
      setOptimisticScenes(fallbackScenes)
    } finally {
      setIsProcessing(false)
    }
  }

  const getNextClipTime = () => {
    const currentTime = useEditorStore.getState().currentTime
    const allClipStarts = tracks
      .flatMap(t => t.clips)
      .map(c => c.start)
      .filter(start => start > currentTime)
      .sort((a, b) => a - b)

    return allClipStarts[0] ?? 0
  }

  const handleExport = () => {
    setOptimisticExportStatus('pending')
    void runExportAction(exportQuality)
  }

  useEffect(() => {
    if (exportState.status === 'done') setOptimisticExportStatus('done')
    if (exportState.status === 'error') {
      setOptimisticExportStatus('error')
      showRecoverableToast(
        exportState.message || '导出失败',
        () => {
          setOptimisticExportStatus('pending')
          void runExportAction(exportQuality)
        },
        () => {
          setOptimisticExportStatus('idle')
          showToast('已降级为手动编辑模式，可继续编辑并稍后导出', 'warning')
        }
      )
    }
  }, [exportState, exportQuality, runExportAction, setOptimisticExportStatus, showToast])

  useEffect(() => {
    const handleResize = () => setIsDesktopLayout(window.innerWidth > DESKTOP_BREAKPOINT)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (activeMode !== 'edit') return
    if (!previewHostRef.current) return

    const host = previewHostRef.current
    let rafId = 0

    const syncPreviewFrame = () => {
      rafId = 0
      const style = window.getComputedStyle(host)
      const horizontalPadding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)
      const verticalPadding = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0)
      const availableWidth = Math.max(0, host.clientWidth - horizontalPadding)
      const availableHeight = Math.max(0, host.clientHeight - verticalPadding)
      const fit = calcAspectFit(availableWidth, availableHeight)
      setPreviewFrameSize(prev => (
        prev.width === fit.width && prev.height === fit.height
          ? prev
          : fit
      ))
    }

    const scheduleSync = () => {
      if (rafId) return
      rafId = window.requestAnimationFrame(syncPreviewFrame)
    }

    const resizeObserver = new ResizeObserver(scheduleSync)
    resizeObserver.observe(host)
    scheduleSync()

    return () => {
      resizeObserver.disconnect()
      if (rafId) window.cancelAnimationFrame(rafId)
    }
  }, [activeMode, leftPanelPx, rightPanelPx, timelinePx])

  const handleLeftPanelResize = useCallback((delta: number) => {
    if (!isDesktopLayout) return

    const mainWidth = mainLayoutRef.current?.clientWidth || 0
    if (!mainWidth) return

    const layoutState = useLayoutStore.getState()
    const currentLeft = leftPanelRef.current?.clientWidth || layoutState.leftPanelPx
    const currentRight = rightPanelRef.current?.clientWidth || layoutState.rightPanelPx
    const maxLeft = Math.min(
      LAYOUT_LIMITS.leftPanelPx.max,
      mainWidth - (HORIZONTAL_HANDLE_SIZE * 2) - currentRight - MAIN_PANEL_MIN_WIDTH
    )

    layoutState.setLeftPanelPx(
      clamp(currentLeft + delta, LAYOUT_LIMITS.leftPanelPx.min, Math.max(LAYOUT_LIMITS.leftPanelPx.min, maxLeft))
    )
  }, [isDesktopLayout])

  const handleRightPanelResize = useCallback((delta: number) => {
    if (!isDesktopLayout) return

    const mainWidth = mainLayoutRef.current?.clientWidth || 0
    if (!mainWidth) return

    const layoutState = useLayoutStore.getState()
    const currentLeft = leftPanelRef.current?.clientWidth || layoutState.leftPanelPx
    const currentRight = rightPanelRef.current?.clientWidth || layoutState.rightPanelPx
    const maxRight = Math.min(
      LAYOUT_LIMITS.rightPanelPx.max,
      mainWidth - (HORIZONTAL_HANDLE_SIZE * 2) - currentLeft - MAIN_PANEL_MIN_WIDTH
    )

    layoutState.setRightPanelPx(
      clamp(currentRight - delta, LAYOUT_LIMITS.rightPanelPx.min, Math.max(LAYOUT_LIMITS.rightPanelPx.min, maxRight))
    )
  }, [isDesktopLayout])

  const handleTimelineResize = useCallback((delta: number) => {
    if (!isDesktopLayout) return

    const shellHeight = shellRef.current?.clientHeight || window.innerHeight
    const maxTimelineByShell = shellHeight
      - HEADER_HEIGHT
      - VERTICAL_HANDLE_SIZE
      - SHELL_VERTICAL_PADDING
      - SHELL_VERTICAL_GAP
      - MAIN_PANEL_MIN_HEIGHT
    const maxTimeline = Math.min(
      LAYOUT_LIMITS.timelinePx.max,
      Math.max(LAYOUT_LIMITS.timelinePx.min, maxTimelineByShell)
    )

    setTimelinePx(clamp(timelinePx - delta, LAYOUT_LIMITS.timelinePx.min, maxTimeline))
  }, [isDesktopLayout, setTimelinePx, timelinePx])

  const centerPanelFitWidth = useMemo(() => {
    if (!isDesktopLayout || previewFrameSize.width <= 0) return CENTER_PANEL_FALLBACK_WIDTH
    return clamp(
      previewFrameSize.width + CENTER_PANEL_FRAME_GUTTER,
      MAIN_PANEL_MIN_WIDTH,
      CENTER_PANEL_MAX_WIDTH
    )
  }, [isDesktopLayout, previewFrameSize.width])

  const shellLayoutVars = useMemo(() => ({
    '--left-panel-w': `${leftPanelPx}px`,
    '--right-panel-w': `${rightPanelPx}px`,
    '--center-panel-min-w': `${MAIN_PANEL_MIN_WIDTH}px`,
    '--center-panel-fit-w': `${Math.round(centerPanelFitWidth)}px`,
    '--timeline-h': `${timelinePx}px`
  } as CSSProperties), [centerPanelFitWidth, leftPanelPx, rightPanelPx, timelinePx])

  const previewFrameStyle = useMemo(() => {
    if (!previewFrameSize.width || !previewFrameSize.height) return undefined
    return {
      width: `${previewFrameSize.width}px`,
      height: `${previewFrameSize.height}px`
    } as CSSProperties
  }, [previewFrameSize.height, previewFrameSize.width])

  return (
    <div className="pro-master-shell" ref={shellRef} style={shellLayoutVars}>
      <Suspense fallback={null}>
        <ToastContainer />
      </Suspense>

      <header className="pro-panel os-header">
        <div className="brand-zone">
          <div className="brand-logo">V</div>
          <span className="brand-title">VEOMUSE PRO</span>
        </div>
        <div className="mode-selector">
          {['edit', 'color', 'audio'].map(m => (
            <button
              key={m}
              className={`mode-tab ${activeMode === m ? 'active' : ''}`}
              onMouseEnter={() => {
                if (m === 'color') void loadComparisonLab()
                if (m === 'edit') {
                  void loadVideoEditor()
                  void loadMultiVideoPlayer()
                }
              }}
              onClick={() => setActiveMode(m)}
            >
              {m === 'edit' ? '剪辑' : m === 'color' ? '实验室' : '音频大师'}
            </button>
          ))}
        </div>
        <div className="header-actions">
          <ThemeSwitcher />
          <button id="btn-reset-layout" aria-label="重置布局" className="layout-reset-btn" onClick={resetLayout}>
            重置布局
          </button>
          <select
            id="export-quality"
            name="exportQuality"
            value={exportQuality}
            onChange={(e) => setExportQuality(e.target.value as 'standard' | '4k-hdr' | 'spatial-vr')}
            className="header-select"
          >
            <option value="standard">标准导出</option>
            <option value="4k-hdr">4K HDR</option>
            <option value="spatial-vr">空间视频</option>
          </select>
          <button id="btn-export" aria-label="导出视频" className="export-btn" onClick={handleExport} disabled={isProcessing || isExportPending}>
            {getExportButtonLabel(isExportPending, optimisticExportStatus)}
          </button>
        </div>
      </header>

      <div className="os-main main-layout" ref={mainLayoutRef}>
        <aside className="pro-panel panel-left" ref={leftPanelRef}>
          <div className="panel-title-bar">
            <div className="sidebar-tabs">
              <button className={`sidebar-tab ${activeSidebar === 'assets' ? 'active' : ''}`} onClick={() => setActiveSidebar('assets')}>媒体资源</button>
              <button className={`sidebar-tab ${activeSidebar === 'director' ? 'active' : ''}`} onClick={() => setActiveSidebar('director')}>AI 导演</button>
              <button className={`sidebar-tab ${activeSidebar === 'actors' ? 'active' : ''}`} onClick={() => setActiveSidebar('actors')}>演员库</button>
              <button className={`sidebar-tab ${activeSidebar === 'motion' ? 'active' : ''}`} onClick={() => setActiveSidebar('motion')}>动捕实验室</button>
            </div>
          </div>
          <div className="sidebar-content">
            <Suspense fallback={<LazyFallback label="资源面板加载中..." />}>
              <AssetPanel
                mode={activeSidebar}
                directorPrompt={directorPrompt}
                onDirectorPromptChange={setDirectorPrompt}
                onRunDirector={handleDirector}
                directorScenes={optimisticScenes}
                isAiWorking={isProcessing}
              />
            </Suspense>
          </div>
        </aside>

        {isDesktopLayout ? (
          <ResizeHandle
            axis="x"
            className="main-resize-handle"
            ariaLabel="调整左侧功能区宽度"
            onDrag={handleLeftPanelResize}
          />
        ) : null}

        <section className="pro-panel monitor-core panel-center">
          {activeMode === 'edit' ? (
            <div className="monitor-content">
              <div className="preview-host" ref={previewHostRef}>
                <div className="preview-frame" style={previewFrameStyle}>
                  <div className="monitor-overlay">
                    <div className="monitor-overlay-left">
                      <div className="live-badge">● 实时</div>
                      <TimecodeDisplay />
                    </div>
                    <div className="preview-meta">
                      <button
                        onClick={() => setSpatialPreview(!isSpatialPreview)}
                        className={`preview-mode-toggle ${isSpatialPreview ? 'active' : ''}`}
                      >
                        {isSpatialPreview ? '3D 模式' : '2D 模式'}
                      </button>
                      <div className="preview-quality">4K | HDR</div>
                    </div>
                  </div>

                  <Suspense fallback={<LazyFallback label="预览器加载中..." />}>
                    <MultiVideoPlayer />
                  </Suspense>
                </div>
              </div>

              <div className="transport-controls">
                <button id="tool-prev" aria-label="跳转到开头" className="transport-btn" onClick={() => setCurrentTime(0)}>⏮</button>
                <button id="tool-play" aria-label={isPlaying ? '暂停播放' : '开始播放'} className="transport-btn play" onClick={togglePlay}>{isPlaying ? '⏸' : '▶'}</button>
                <button id="tool-next" aria-label="跳转到下一片段" className="transport-btn" onClick={() => setCurrentTime(getNextClipTime())}>⏭</button>
              </div>
            </div>
          ) : activeMode === 'color' ? (
            <Suspense fallback={<LazyFallback label="实验室加载中..." />}>
              <ComparisonLab />
            </Suspense>
          ) : (
            <div className="audio-master-state">
              <div className="audio-master-icon">🎚️</div>
              <div className="audio-master-title">AUDIO MASTER 引擎已就绪</div>
            </div>
          )}
        </section>

        {isDesktopLayout ? (
          <ResizeHandle
            axis="x"
            className="main-resize-handle"
            ariaLabel="调整右侧功能区宽度"
            onDrag={handleRightPanelResize}
          />
        ) : null}

        <aside className="pro-panel pro-inspector-outer panel-right" ref={rightPanelRef}>
          <div className="panel-title-bar"><span className="inspector-title">属性检查器</span></div>
          <div className="inspector-scroll">
            <Suspense fallback={<LazyFallback label="属性面板加载中..." />}>
              <PropertyInspector />
            </Suspense>
          </div>
        </aside>
      </div>

      {isDesktopLayout ? (
        <ResizeHandle
          axis="y"
          className="timeline-resize-handle"
          ariaLabel="调整时间轴高度"
          onDrag={handleTimelineResize}
        />
      ) : null}

      <footer className="pro-panel timeline-container" onMouseEnter={ensureTimelineReady} onFocusCapture={ensureTimelineReady}>
        <div className="timeline-actions">
          <div className="timeline-tools">
            <span className="timeline-section-title">编辑工具</span>
            <div className="undo-group">
              <button id="tool-undo" aria-label="撤销" className="tool-icon" onClick={() => undo()} disabled={pastStates.length === 0}>↩</button>
              <button id="tool-redo" aria-label="重做" className="tool-icon" onClick={() => redo()} disabled={futureStates.length === 0}>↪</button>
            </div>
            <button id="tool-select" aria-label="选择工具" className={`tool-icon ${activeTool === 'select' ? 'active' : ''}`} onClick={() => setActiveTool('select')}>↖</button>
            <button id="tool-cut" aria-label="切割工具" className={`tool-icon ${activeTool === 'cut' ? 'active' : ''}`} onClick={() => setActiveTool('cut')}>✂</button>
            <button id="tool-hand" aria-label="平移工具" className={`tool-icon ${activeTool === 'hand' ? 'active' : ''}`} onClick={() => setActiveTool('hand')}>✋</button>
          </div>

          <div className="system-telemetry">
            <span className="timeline-section-title telemetry-label">系统状态</span>
            <div className="telemetry-item">
              <span>GPU LOAD: <b className="telemetry-value success">{currentMetrics.gpu}%</b></span>
              <div className="telemetry-sparkline">
                {telemetryHistory.map((v, i) => <div key={i} className="spark-bar" style={{ height: `${Math.max(2, Math.min(100, v))}%` }} />)}
              </div>
            </div>
            <div className="telemetry-item telemetry-divider">
              RAM: <span className="telemetry-value success">{currentMetrics.ram}</span>
            </div>
            <div className="telemetry-item telemetry-divider">
              CACHE: <span className="telemetry-value accent">{currentMetrics.cache}</span>
            </div>
          </div>
        </div>
        <div className="timeline-body">
          {isTimelineReady ? (
            <Suspense fallback={<LazyFallback label="时间轴加载中..." />}>
              <VideoEditor activeTool={activeTool as any} />
            </Suspense>
          ) : (
            <LazyFallback label="时间轴预热中..." />
          )}
        </div>
      </footer>
    </div>
  )
}

export default memo(App)
