import {
  useState,
  memo,
  useEffect,
  useActionState,
  useOptimistic,
  lazy,
  Suspense,
  useMemo,
  useRef,
  useCallback,
  startTransition
} from 'react'
import type { CSSProperties } from 'react'
import type { StoreApi } from 'zustand'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { TemporalState } from 'zundo'
import { useEditorStore } from './store/editorStore'
import { useToastStore } from './store/toastStore'
import { useAdminMetricsPolling, useAdminMetricsStore } from './store/adminMetricsStore'
import { useJourneyTelemetryStore } from './store/journeyTelemetryStore'
import { useLayoutStore } from './store/layoutStore'
import { useThemeSync } from './hooks/useThemeSync'
import { buildAuthHeaders, resolveApiBase } from './utils/eden'
import { classifyRequestError } from './utils/requestError'
import { calcAspectFit } from './utils/layoutMath'
import { requestJsonWithRetry } from './components/Editor/comparison-lab/api'
import ResizeHandle from './components/Common/ResizeHandle'
import ThemeSwitcher from './components/Common/ThemeSwitcher'
import WorkspaceShell from './components/Layout/WorkspaceShell'
// type imports are handled via appHelpers below or are not needed here if unused
import {
  formatTimecode,
  getExportButtonLabel,
  resolveExportStageByProgress,
  hasRenderableClipsFromTracks,
  deriveCurrentMetrics,
  getNextClipTimeFromTracks,
  resolveExportQualityLabel,
  resolveExportFeedbackTitle,
  resolveExportFeedbackSubtitle,
  computeCenterPanelMinWidth,
  computeCenterPanelFitWidth,
  buildShellLayoutVars,
  normalizeDesktopPanelWidthsPure,
  computeLeftPanelWidthAfterDrag,
  computeRightPanelWidthAfterDrag,
  computeTimelineHeightAfterDrag,
  buildPreviewFrameStyle,
  buildGuideHighlightStyle,
  buildGuideCardStyle,
  GUIDE_STORAGE_KEY,
  IS_TEST_ENV,
  PREVIEW_ASPECT_RATIO_MAP,
  DESKTOP_BREAKPOINT
} from './utils/appHelpers'
import type {
  ExportUiStatus,
  ExportProgressStage,
  ExportActionState,
  ExportQuality,
  GuideStep,
  DirectorScene,
  PreviewAspect
} from './utils/appHelpers'
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

const TimecodeDisplay = memo(() => {
  const currentTime = useEditorStore((state) => state.currentTime)
  return <div className="timecode">{formatTimecode(currentTime)}</div>
})

const LazyFallback = memo(({ label = '加载中...' }: { label?: string }) => (
  <div
    style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--ap-text-dim)',
      fontSize: '12px',
      fontWeight: 700
    }}
  >
    {label}
  </div>
))

type EditorStateSnapshot = ReturnType<typeof useEditorStore.getState>
type EditorTemporalStore = StoreApi<TemporalState<EditorStateSnapshot>>
type EditorStoreWithTemporal = typeof useEditorStore & { temporal?: EditorTemporalStore }

const resolveEditorTemporalStore = (): EditorTemporalStore => {
  const store = useEditorStore as EditorStoreWithTemporal
  if (store.temporal) return store.temporal
  throw new Error('editor temporal store is unavailable')
}

const editorTemporalStore = resolveEditorTemporalStore()

function App() {
  useThemeSync()
  useAdminMetricsPolling()
  const { showToast } = useToastStore()
  const markJourneyStep = useJourneyTelemetryStore((state) => state.markStep)
  const reportJourney = useJourneyTelemetryStore((state) => state.reportJourney)
  const metrics = useAdminMetricsStore((state) => state.metrics)
  const renderLoadHistory = useAdminMetricsStore((state) => state.renderLoadHistory)

  const { isPlaying, togglePlay, setCurrentTime, tracks, setTracks } = useEditorStore(
    useShallow((state) => ({
      isPlaying: state.isPlaying,
      togglePlay: state.togglePlay,
      setCurrentTime: state.setCurrentTime,
      tracks: state.tracks,
      setTracks: state.setTracks
    }))
  )
  const { isSpatialPreview, setSpatialPreview } = useEditorStore(
    useShallow((state) => ({
      isSpatialPreview: state.isSpatialPreview,
      setSpatialPreview: state.setSpatialPreview
    }))
  )
  const {
    leftPanelPx,
    rightPanelPx,
    timelinePx,
    centerMode,
    topBarDensity,
    previewAspect,
    setCenterMode,
    setTopBarDensity,
    setPreviewAspect,
    setTimelinePx,
    resetLayout
  } = useLayoutStore(
    useShallow((state) => ({
      leftPanelPx: state.leftPanelPx,
      rightPanelPx: state.rightPanelPx,
      timelinePx: state.timelinePx,
      centerMode: state.centerMode,
      topBarDensity: state.topBarDensity,
      previewAspect: state.previewAspect,
      setCenterMode: state.setCenterMode,
      setTopBarDensity: state.setTopBarDensity,
      setPreviewAspect: state.setPreviewAspect,
      setTimelinePx: state.setTimelinePx,
      resetLayout: state.resetLayout
    }))
  )

  const { undo, redo, pastStates, futureStates } = useStore(
    editorTemporalStore,
    useShallow((state) => ({
      undo: state.undo,
      redo: state.redo,
      pastStates: state.pastStates,
      futureStates: state.futureStates
    }))
  )

  const [activeMode, setActiveMode] = useState('edit')
  const [activeTool, setActiveTool] = useState('select')
  const [activeSidebar, setActiveSidebar] = useState<'assets' | 'director' | 'actors' | 'motion'>(
    'assets'
  )
  const [exportQuality, setExportQuality] = useState<ExportQuality>('standard')
  const [directorPrompt, setDirectorPrompt] = useState('')
  const [directorScenes, setDirectorScenes] = useState<DirectorScene[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isTimelineReady, setIsTimelineReady] = useState(false)
  const [isDesktopLayout, setIsDesktopLayout] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.innerWidth > DESKTOP_BREAKPOINT
  })
  const [previewFrameSize, setPreviewFrameSize] = useState({ width: 0, height: 0 })
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const [guideStepIndex, setGuideStepIndex] = useState(0)
  const [guideAnchorRect, setGuideAnchorRect] = useState<{
    top: number
    left: number
    width: number
    height: number
  } | null>(null)
  const [optimisticScenes, setOptimisticScenes] = useOptimistic<DirectorScene[], DirectorScene[]>(
    directorScenes,
    (_prev, next) => next
  )
  const [optimisticExportStatus, setOptimisticExportStatus] = useOptimistic<
    ExportUiStatus,
    ExportUiStatus
  >('idle', (_prev, next) => next)
  const shellRef = useRef<HTMLDivElement | null>(null)
  const mainLayoutRef = useRef<HTMLDivElement | null>(null)
  const leftPanelRef = useRef<HTMLElement | null>(null)
  const rightPanelRef = useRef<HTMLElement | null>(null)
  const previewHostRef = useRef<HTMLDivElement | null>(null)
  const exportProgressTimerRef = useRef<number | null>(null)
  const exportFeedbackResetTimerRef = useRef<number | null>(null)
  const [exportState, runExportAction, isExportPending] = useActionState<
    ExportActionState,
    ExportQuality
  >(
    async (_state, quality) => {
      const timelineData = {
        tracks: useEditorStore.getState().tracks,
        exportConfig: { quality }
      }
      try {
        const response = await fetch(`${resolveApiBase()}/api/video/compose`, {
          method: 'POST',
          headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ timelineData })
        })
        const payload = (await response.json().catch(() => null)) as {
          success?: boolean
          outputPath?: string
          error?: string
          code?: string
        } | null
        if (!response.ok || !payload?.success) {
          const error = new Error(payload?.error || `HTTP ${response.status}`) as Error & {
            status?: number
            code?: string
          }
          error.status = response.status
          if (typeof payload?.code === 'string') error.code = payload.code
          throw error
        }
        showToast(`导出成功: ${payload.outputPath}`, 'success')
        return { status: 'done' as const, message: payload.outputPath }
      } catch (e: unknown) {
        const error = e instanceof Error ? e : new Error(String(e))
        const { errorKind, httpStatus } = classifyRequestError(error)
        return {
          status: 'error' as const,
          message: error.message || '导出失败',
          errorKind,
          httpStatus
        }
      }
    },
    { status: 'idle' }
  )
  const [exportUiStatus, setExportUiStatus] = useState<ExportUiStatus>('idle')
  const [exportProgress, setExportProgress] = useState(0)
  const [exportStage, setExportStage] = useState<ExportProgressStage>('idle')
  const [lastExportOutput, setLastExportOutput] = useState('')

  const telemetryHistory = useMemo(() => renderLoadHistory.slice(-10), [renderLoadHistory])
  const hasRenderableClips = useMemo(() => hasRenderableClipsFromTracks(tracks), [tracks])
  const currentMetrics = useMemo(() => deriveCurrentMetrics(metrics ?? undefined), [metrics])

  const showRecoverableToast = useCallback(
    (message: string, onRetry: () => void, onFallback: () => void) => {
      showToast(message, 'error', {
        sticky: true,
        actions: [
          { label: '重试', variant: 'primary', onClick: onRetry },
          { label: '降级继续编辑', variant: 'secondary', onClick: onFallback }
        ]
      })
    },
    [showToast]
  )

  const clearExportFeedbackTimers = useCallback(() => {
    if (typeof window === 'undefined') return
    if (exportProgressTimerRef.current) {
      window.clearInterval(exportProgressTimerRef.current)
      exportProgressTimerRef.current = null
    }
    if (exportFeedbackResetTimerRef.current) {
      window.clearTimeout(exportFeedbackResetTimerRef.current)
      exportFeedbackResetTimerRef.current = null
    }
  }, [])

  const startExportProgressFeedback = useCallback(() => {
    if (typeof window === 'undefined') return
    clearExportFeedbackTimers()
    setExportProgress(8)
    setExportStage('validating')
    exportProgressTimerRef.current = window.setInterval(() => {
      setExportProgress((prev) => {
        if (prev >= 94) return prev
        const delta = prev < 30 ? 7 : prev < 68 ? 4 : 2
        const next = Math.min(94, prev + delta)
        setExportStage(resolveExportStageByProgress(next))
        return next
      })
    }, 260)
  }, [clearExportFeedbackTimers])

  const resetExportFeedback = useCallback(
    (status: ExportUiStatus = 'idle') => {
      clearExportFeedbackTimers()
      setExportUiStatus(status)
      startTransition(() => {
        setOptimisticExportStatus(status)
      })
      setExportProgress(0)
      setExportStage(status === 'error' ? 'error' : status === 'done' ? 'done' : 'idle')
      if (status === 'idle') setLastExportOutput('')
    },
    [clearExportFeedbackTimers, setOptimisticExportStatus]
  )

  const applyOptimisticScenes = useCallback(
    (next: DirectorScene[]) => {
      startTransition(() => {
        setOptimisticScenes(next)
      })
    },
    [setOptimisticScenes]
  )

  const applyOptimisticExportStatus = useCallback(
    (status: ExportUiStatus) => {
      startTransition(() => {
        setOptimisticExportStatus(status)
      })
    },
    [setOptimisticExportStatus]
  )

  const dispatchExportAction = useCallback(
    (quality: ExportQuality) => {
      startTransition(() => {
        void runExportAction(quality)
      })
    },
    [runExportAction]
  )

  useEffect(() => {
    if (IS_TEST_ENV) return
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

  const ensureTimelineReady = useCallback(() => {
    setIsTimelineReady((prev) => {
      if (prev) return prev
      void loadVideoEditor()
      return true
    })
  }, [])

  const focusImportAction = useCallback(() => {
    setTimeout(() => {
      const importBtn = document.getElementById('btn-import') as HTMLButtonElement | null
      if (importBtn) importBtn.focus()
    }, 40)
  }, [])

  const openImportFromAnywhere = useCallback(() => {
    setActiveMode('edit')
    setActiveSidebar('assets')
    focusImportAction()
  }, [focusImportAction])

  const openDirectorFromAnywhere = useCallback(() => {
    setActiveMode('edit')
    setActiveSidebar('director')
  }, [])

  const openChannelAccess = useCallback(() => {
    if (!IS_TEST_ENV) {
      setActiveMode('color')
    }
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('veomuse:open-channel-panel'))
    }, 0)
  }, [])

  const guideSteps = useMemo<GuideStep[]>(
    () => [
      {
        title: '切换工作模式',
        description: '先在这里切换剪辑、实验室和音频大师，主工作区会随模式变化。',
        target: '[data-guide="mode-selector"]',
        onEnter: () => setActiveMode('edit')
      },
      {
        title: '先导入素材',
        description: '点击导入按钮选择本地视频或音频，素材会进入左侧资源区。',
        target: '#btn-import',
        actionLabel: '聚焦导入按钮',
        onAction: () => openImportFromAnywhere(),
        onEnter: () => {
          setActiveMode('edit')
          setActiveSidebar('assets')
        }
      },
      {
        title: '拖动调整布局',
        description: '拖动这个手柄可调整左侧宽度；右侧和时间轴也有同类手柄。',
        target: '[data-guide="left-resize-handle"]',
        onEnter: () => setActiveMode('edit')
      },
      {
        title: '时间轴工具区',
        description: '在这里执行撤销、重做、选择、切割、平移等剪辑操作。',
        target: '[data-guide="timeline-tools"]',
        onEnter: () => {
          setActiveMode('edit')
          ensureTimelineReady()
        }
      },
      {
        title: '实验室模式',
        description: '在实验室里做模型对比、策略治理、创意闭环和协作流程。',
        target: '[data-guide="lab-toolbar"]',
        actionLabel: '切到实验室',
        onAction: () => setActiveMode('color'),
        onEnter: () => {
          setActiveMode('color')
          void loadComparisonLab()
        }
      },
      {
        title: '最终导出',
        description: '确认时间轴后，在右上角选择导出规格并执行导出。',
        target: '#btn-export'
      }
    ],
    [ensureTimelineReady, openImportFromAnywhere]
  )

  const handleDirector = async () => {
    if (!directorPrompt.trim()) return showToast('请输入脚本', 'info')
    markJourneyStep('generation_triggered')
    setIsProcessing(true)
    applyOptimisticScenes([{ title: 'AI 正在分析脚本...', duration: 1 }])

    try {
      const data = await requestJsonWithRetry<{
        scenes?: DirectorScene[]
        worldId?: string
      }>(
        '/api/ai/director/analyze',
        {
          method: 'POST',
          body: JSON.stringify({ script: directorPrompt })
        },
        {
          idempotent: true
        }
      )

      if (data && 'scenes' in data) {
        setDirectorScenes(data.scenes || [])
        applyOptimisticScenes(data.scenes || [])

        const latestTracks = useEditorStore.getState().tracks
        const primaryTrack = latestTracks.find((track) => track.id === 'track-v1')
        if (primaryTrack) {
          let offset = primaryTrack.clips.reduce(
            (max, clip) => Math.max(max, Number(clip.end) || 0),
            0
          )
          const newClips = (data.scenes || []).map((scene: DirectorScene, i: number) => {
            const duration = Number(scene.duration || 5)
            const clip = {
              id: `auto-${Date.now()}-${i}`,
              start: offset,
              end: offset + duration,
              src: '',
              name: scene.title || `场景 ${i + 1}`,
              type: 'video' as const,
              data: {
                fromDirector: true,
                videoPrompt: scene.videoPrompt,
                audioPrompt: scene.audioPrompt,
                worldLink: true,
                worldId: data.worldId
              }
            }
            offset += duration
            return clip
          })
          const mergedTracks = latestTracks.map((track) =>
            track.id === 'track-v1' ? { ...track, clips: [...track.clips, ...newClips] } : track
          )
          setTracks(mergedTracks)
          showToast('分镜序列生成并编排成功', 'success')
        }
      }
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e))
      const { errorKind, httpStatus } = classifyRequestError(error)
      void reportJourney(false, {
        reason: 'generation-error',
        failedStage: 'generate',
        errorKind,
        httpStatus
      })
      const fallbackScenes =
        directorScenes.length > 0 ? directorScenes : [{ title: '手动编排片段', duration: 5 }]
      showRecoverableToast(
        error.message || '导演分析失败',
        () => {
          void handleDirector()
        },
        () => {
          applyOptimisticScenes(fallbackScenes)
          showToast('已降级为手动编排模式，可继续剪辑', 'warning')
        }
      )
      applyOptimisticScenes(fallbackScenes)
    } finally {
      setIsProcessing(false)
    }
  }

  const getNextClipTime = () =>
    getNextClipTimeFromTracks(useEditorStore.getState().currentTime, tracks)

  const handleExport = () => {
    markJourneyStep('export_triggered')
    if (!hasRenderableClips) {
      resetExportFeedback('idle')
      showToast('请先导入并放置至少一个可渲染片段后再导出', 'info')
      return
    }
    setLastExportOutput('')
    setExportUiStatus('pending')
    applyOptimisticExportStatus('pending')
    startExportProgressFeedback()
    dispatchExportAction(exportQuality)
  }

  useEffect(() => {
    if (exportState.status === 'done') {
      clearExportFeedbackTimers()
      setExportUiStatus('done')
      applyOptimisticExportStatus('done')
      setExportProgress(100)
      setExportStage('done')
      setLastExportOutput(exportState.message || '')
      void reportJourney(true)
      if (typeof window !== 'undefined') {
        exportFeedbackResetTimerRef.current = window.setTimeout(() => {
          resetExportFeedback('idle')
        }, 4200)
      }
    }
    if (exportState.status === 'error') {
      clearExportFeedbackTimers()
      setExportUiStatus('error')
      applyOptimisticExportStatus('error')
      setExportStage('error')
      const fallbackError = classifyRequestError({ message: exportState.message || '' })
      void reportJourney(false, {
        reason: 'export-error',
        failedStage: 'export',
        errorKind: exportState.errorKind || fallbackError.errorKind,
        httpStatus: exportState.httpStatus || fallbackError.httpStatus
      })
      showRecoverableToast(
        exportState.message || '导出失败',
        () => {
          setExportUiStatus('pending')
          applyOptimisticExportStatus('pending')
          setLastExportOutput('')
          startExportProgressFeedback()
          dispatchExportAction(exportQuality)
        },
        () => {
          resetExportFeedback('idle')
          showToast('已降级为手动编辑模式，可继续编辑并稍后导出', 'warning')
        }
      )
    }
  }, [
    applyOptimisticExportStatus,
    clearExportFeedbackTimers,
    dispatchExportAction,
    exportState,
    exportQuality,
    reportJourney,
    showRecoverableToast,
    resetExportFeedback,
    showToast,
    startExportProgressFeedback
  ])

  useEffect(() => () => clearExportFeedbackTimers(), [clearExportFeedbackTimers])

  const exportQualityLabel = useMemo(
    () => resolveExportQualityLabel(exportQuality),
    [exportQuality]
  )

  const exportFeedbackTitle = useMemo(() => resolveExportFeedbackTitle(exportStage), [exportStage])

  const exportFeedbackSubtitle = useMemo(
    () => resolveExportFeedbackSubtitle(exportUiStatus, exportQualityLabel, exportState.message),
    [exportQualityLabel, exportState.message, exportUiStatus]
  )

  useEffect(() => {
    const handleResize = () => setIsDesktopLayout(window.innerWidth > DESKTOP_BREAKPOINT)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const hasOnboarded = window.localStorage.getItem(GUIDE_STORAGE_KEY) === 'done'
    if (!hasOnboarded) {
      setGuideStepIndex(0)
      setIsGuideOpen(true)
    }
  }, [])

  useEffect(() => {
    if (!isGuideOpen) return
    const step = guideSteps[guideStepIndex]
    step?.onEnter?.()
  }, [guideStepIndex, guideSteps, isGuideOpen])

  useEffect(() => {
    if (!isGuideOpen) {
      setGuideAnchorRect(null)
      return
    }

    const updateAnchorRect = () => {
      const step = guideSteps[guideStepIndex]
      if (!step) {
        setGuideAnchorRect(null)
        return
      }
      const el = document.querySelector(step.target) as HTMLElement | null
      if (!el) {
        setGuideAnchorRect(null)
        return
      }
      const rect = el.getBoundingClientRect()
      setGuideAnchorRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      })
    }

    const timerId = window.setTimeout(updateAnchorRect, 80)
    updateAnchorRect()
    window.addEventListener('resize', updateAnchorRect)
    window.addEventListener('scroll', updateAnchorRect, true)

    return () => {
      window.clearTimeout(timerId)
      window.removeEventListener('resize', updateAnchorRect)
      window.removeEventListener('scroll', updateAnchorRect, true)
    }
  }, [
    guideStepIndex,
    guideSteps,
    isGuideOpen,
    activeMode,
    activeSidebar,
    isDesktopLayout,
    leftPanelPx,
    rightPanelPx,
    timelinePx
  ])

  useEffect(() => {
    if (activeMode !== 'edit') return
    if (!previewHostRef.current) return

    const host = previewHostRef.current
    let rafId = 0

    const syncPreviewFrame = () => {
      rafId = 0
      const style = window.getComputedStyle(host)
      const horizontalPadding =
        (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)
      const verticalPadding =
        (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0)
      const availableWidth = Math.max(0, host.clientWidth - horizontalPadding)
      const availableHeight = Math.max(0, host.clientHeight - verticalPadding)
      const previewRatio =
        PREVIEW_ASPECT_RATIO_MAP[previewAspect] || PREVIEW_ASPECT_RATIO_MAP['16:9']
      const fit = calcAspectFit(availableWidth, availableHeight, previewRatio)
      setPreviewFrameSize((prev) =>
        prev.width === fit.width && prev.height === fit.height ? prev : fit
      )
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
  }, [activeMode, leftPanelPx, previewAspect, rightPanelPx, timelinePx])

  const centerPanelMinWidth = useMemo(
    () => computeCenterPanelMinWidth(isDesktopLayout, centerMode, activeMode),
    [activeMode, centerMode, isDesktopLayout]
  )

  const normalizeDesktopPanelWidths = useCallback(() => {
    if (!isDesktopLayout) return
    const mainWidth = mainLayoutRef.current?.clientWidth || 0
    if (!mainWidth) return

    const layoutState = useLayoutStore.getState()
    const normalized = normalizeDesktopPanelWidthsPure({
      mainWidth,
      centerPanelMinWidth,
      leftPanelPx: layoutState.leftPanelPx,
      rightPanelPx: layoutState.rightPanelPx
    })
    if (!normalized) return

    if (normalized.leftPanelPx !== layoutState.leftPanelPx) {
      layoutState.setLeftPanelPx(normalized.leftPanelPx)
    }
    if (normalized.rightPanelPx !== layoutState.rightPanelPx) {
      layoutState.setRightPanelPx(normalized.rightPanelPx)
    }
  }, [centerPanelMinWidth, isDesktopLayout])

  useEffect(() => {
    if (!isDesktopLayout || !mainLayoutRef.current) return

    normalizeDesktopPanelWidths()
    const resizeObserver = new ResizeObserver(() => {
      normalizeDesktopPanelWidths()
    })
    resizeObserver.observe(mainLayoutRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [isDesktopLayout, normalizeDesktopPanelWidths])

  const handleLeftPanelResize = useCallback(
    (delta: number) => {
      if (!isDesktopLayout) return

      const mainWidth = mainLayoutRef.current?.clientWidth || 0
      if (!mainWidth) return

      const layoutState = useLayoutStore.getState()
      const currentLeft = leftPanelRef.current?.clientWidth || layoutState.leftPanelPx
      const currentRight = rightPanelRef.current?.clientWidth || layoutState.rightPanelPx
      layoutState.setLeftPanelPx(
        computeLeftPanelWidthAfterDrag({
          delta,
          mainWidth,
          currentLeft,
          currentRight,
          centerPanelMinWidth
        })
      )
    },
    [centerPanelMinWidth, isDesktopLayout]
  )

  const handleRightPanelResize = useCallback(
    (delta: number) => {
      if (!isDesktopLayout) return

      const mainWidth = mainLayoutRef.current?.clientWidth || 0
      if (!mainWidth) return

      const layoutState = useLayoutStore.getState()
      const currentLeft = leftPanelRef.current?.clientWidth || layoutState.leftPanelPx
      const currentRight = rightPanelRef.current?.clientWidth || layoutState.rightPanelPx
      layoutState.setRightPanelPx(
        computeRightPanelWidthAfterDrag({
          delta,
          mainWidth,
          currentLeft,
          currentRight,
          centerPanelMinWidth
        })
      )
    },
    [centerPanelMinWidth, isDesktopLayout]
  )

  const handleTimelineResize = useCallback(
    (delta: number) => {
      if (!isDesktopLayout) return

      const shellHeight = shellRef.current?.clientHeight || window.innerHeight
      setTimelinePx(
        computeTimelineHeightAfterDrag({
          delta,
          shellHeight,
          timelinePx
        })
      )
    },
    [isDesktopLayout, setTimelinePx, timelinePx]
  )

  const centerPanelFitWidth = useMemo(
    () =>
      computeCenterPanelFitWidth({
        activeMode,
        centerMode,
        centerPanelMinWidth,
        isDesktopLayout,
        previewFrameWidth: previewFrameSize.width
      }),
    [activeMode, centerMode, centerPanelMinWidth, isDesktopLayout, previewFrameSize.width]
  )

  const shellLayoutVars = useMemo(
    () =>
      buildShellLayoutVars({
        centerMode,
        centerPanelFitWidth,
        centerPanelMinWidth,
        leftPanelPx,
        rightPanelPx,
        timelinePx
      }),
    [centerMode, centerPanelFitWidth, centerPanelMinWidth, leftPanelPx, rightPanelPx, timelinePx]
  )

  const previewFrameStyle = useMemo(
    () => buildPreviewFrameStyle(previewFrameSize),
    [previewFrameSize]
  )

  const closeGuide = useCallback((completed: boolean) => {
    setIsGuideOpen(false)
    if (completed && typeof window !== 'undefined') {
      window.localStorage.setItem(GUIDE_STORAGE_KEY, 'done')
    }
  }, [])

  const currentGuideStep = guideSteps[guideStepIndex]

  const goGuidePrev = () => {
    setGuideStepIndex((prev) => Math.max(0, prev - 1))
  }

  const goGuideNext = () => {
    if (guideStepIndex >= guideSteps.length - 1) {
      closeGuide(true)
      return
    }
    setGuideStepIndex((prev) => Math.min(guideSteps.length - 1, prev + 1))
  }

  const guideHighlightStyle = useMemo<CSSProperties | undefined>(
    () => buildGuideHighlightStyle(guideAnchorRect),
    [guideAnchorRect]
  )

  const guideCardStyle = useMemo<CSSProperties | undefined>(() => {
    if (typeof window === 'undefined') return undefined
    return buildGuideCardStyle(guideAnchorRect, {
      width: window.innerWidth,
      height: window.innerHeight
    })
  }, [guideAnchorRect])

  return (
    <WorkspaceShell
      shellRef={shellRef}
      style={shellLayoutVars}
      layoutMode={centerMode}
      topBarDensity={topBarDensity}
    >
      <Suspense fallback={null}>
        <ToastContainer />
      </Suspense>

      <header className="pro-panel os-header" data-testid="area-top-header">
        <div className="brand-zone">
          <div className="brand-logo">V</div>
          <span className="brand-title">VEOMUSE PRO</span>
        </div>
        <div className="mode-selector" data-guide="mode-selector" data-testid="area-mode-selector">
          {['edit', 'color', 'audio'].map((m) => (
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
              data-testid={`btn-mode-${m}`}
            >
              {m === 'edit' ? '剪辑' : m === 'color' ? '实验室' : '音频大师'}
            </button>
          ))}
        </div>
        <div className="header-actions" data-testid="area-header-actions">
          <div
            className="header-actions-group header-actions-layout"
            data-testid="group-header-layout"
          >
            <div className="header-segment" data-testid="group-center-mode">
              <button
                type="button"
                className={`header-segment-btn ${centerMode === 'fit' ? 'active' : ''}`}
                onClick={() => setCenterMode('fit')}
                data-testid="btn-center-mode-fit"
              >
                均衡
              </button>
              <button
                type="button"
                className={`header-segment-btn ${centerMode === 'focus' ? 'active' : ''}`}
                onClick={() => setCenterMode('focus')}
                data-testid="btn-center-mode-focus"
              >
                聚焦
              </button>
            </div>
            <div className="header-segment" data-testid="group-topbar-density">
              <button
                type="button"
                className={`header-segment-btn ${topBarDensity === 'comfortable' ? 'active' : ''}`}
                onClick={() => setTopBarDensity('comfortable')}
                data-testid="btn-density-comfortable"
              >
                舒展
              </button>
              <button
                type="button"
                className={`header-segment-btn ${topBarDensity === 'compact' ? 'active' : ''}`}
                onClick={() => setTopBarDensity('compact')}
                data-testid="btn-density-compact"
              >
                紧凑
              </button>
            </div>
          </div>
          <div
            className="header-actions-group header-actions-quick"
            data-testid="group-header-quick-actions"
          >
            <button
              id="btn-open-channel-access"
              aria-label="打开 AI 渠道接入"
              className="channel-entry-btn"
              onClick={openChannelAccess}
              data-testid="btn-open-channel-access"
            >
              AI接入
            </button>
            <button
              id="btn-open-guide"
              aria-label="打开使用引导"
              className="guide-toggle-btn"
              onClick={() => {
                setGuideStepIndex(0)
                setIsGuideOpen(true)
              }}
              data-testid="btn-open-guide"
            >
              使用引导
            </button>
            <ThemeSwitcher />
            <button
              id="btn-reset-layout"
              aria-label="重置布局"
              className="layout-reset-btn"
              onClick={resetLayout}
              data-testid="btn-reset-layout"
            >
              重置布局
            </button>
          </div>
          <div
            className="header-actions-group header-actions-export"
            data-testid="group-header-export"
          >
            <select
              id="export-quality"
              name="exportQuality"
              aria-label="导出规格"
              value={exportQuality}
              onChange={(e) =>
                setExportQuality(e.target.value as 'standard' | '4k-hdr' | 'spatial-vr')
              }
              className="header-select"
              data-testid="select-export-quality"
            >
              <option value="standard">标准导出</option>
              <option value="4k-hdr">4K HDR</option>
              <option value="spatial-vr">空间视频</option>
            </select>
            <select
              id="preview-aspect"
              name="previewAspect"
              aria-label="预览宽高比"
              value={previewAspect}
              onChange={(e) => setPreviewAspect(e.target.value as PreviewAspect)}
              className="header-select preview-aspect-select"
              data-testid="select-preview-aspect"
            >
              <option value="16:9">预览 16:9</option>
              <option value="21:9">预览 21:9</option>
            </select>
            <div className="export-action-wrap">
              <button
                id="btn-export"
                aria-label="导出视频"
                className={`export-btn ${exportUiStatus === 'pending' ? 'is-pending' : ''} ${exportUiStatus === 'done' ? 'is-done' : ''} ${exportUiStatus === 'error' ? 'is-error' : ''}`}
                onClick={handleExport}
                disabled={isProcessing || isExportPending}
                data-testid="btn-export"
              >
                {getExportButtonLabel(isExportPending, optimisticExportStatus, exportProgress)}
              </button>
              {exportUiStatus !== 'idle' ? (
                <div
                  className={`export-feedback-pop ${exportUiStatus}`}
                  role="status"
                  aria-live="polite"
                >
                  <div className="export-feedback-top">
                    <span className="export-feedback-title">{exportFeedbackTitle}</span>
                    {exportUiStatus === 'pending' ? (
                      <span className="export-feedback-percent">{Math.round(exportProgress)}%</span>
                    ) : null}
                  </div>
                  <div className="export-feedback-subtitle">{exportFeedbackSubtitle}</div>
                  {exportUiStatus === 'pending' ? (
                    <div className="export-progress-track">
                      <span
                        className="export-progress-fill"
                        style={{ width: `${Math.max(6, Math.min(100, exportProgress))}%` }}
                      />
                    </div>
                  ) : null}
                  {exportUiStatus === 'done' && lastExportOutput ? (
                    <div className="export-feedback-path" title={lastExportOutput}>
                      {lastExportOutput}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className="os-main main-layout" ref={mainLayoutRef} data-testid="area-main-layout">
        <aside className="pro-panel panel-left" ref={leftPanelRef} data-testid="area-left-panel">
          <div className="panel-title-bar">
            <div className="sidebar-tabs">
              <button
                className={`sidebar-tab ${activeSidebar === 'assets' ? 'active' : ''}`}
                onClick={() => setActiveSidebar('assets')}
              >
                媒体资源
              </button>
              <button
                className={`sidebar-tab ${activeSidebar === 'director' ? 'active' : ''}`}
                onClick={() => setActiveSidebar('director')}
              >
                AI 导演
              </button>
              <button
                className={`sidebar-tab ${activeSidebar === 'actors' ? 'active' : ''}`}
                onClick={() => setActiveSidebar('actors')}
              >
                演员库
              </button>
              <button
                className={`sidebar-tab ${activeSidebar === 'motion' ? 'active' : ''}`}
                onClick={() => setActiveSidebar('motion')}
              >
                动捕实验室
              </button>
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
            hint="拖动调整左侧功能区宽度"
            guideKey="left-resize-handle"
            testId="handle-left-panel"
            onDrag={handleLeftPanelResize}
          />
        ) : null}

        <section className="pro-panel monitor-core panel-center" data-testid="area-center-panel">
          {activeMode === 'edit' ? (
            <div className="monitor-content">
              <div className="preview-host" ref={previewHostRef} data-testid="area-preview-host">
                <div
                  className="preview-frame"
                  style={previewFrameStyle}
                  data-testid="area-preview-frame"
                  data-aspect-ratio={previewAspect}
                >
                  <div className="monitor-overlay">
                    <div className="monitor-overlay-left">
                      <div className="live-badge">● 实时</div>
                      <TimecodeDisplay />
                    </div>
                    <div className="preview-meta">
                      <button
                        onClick={() => setSpatialPreview(!isSpatialPreview)}
                        className={`preview-mode-toggle ${isSpatialPreview ? 'active' : ''}`}
                        data-testid="btn-preview-mode-toggle"
                      >
                        {isSpatialPreview ? '3D 模式' : '2D 模式'}
                      </button>
                      <div className="preview-quality">4K | HDR</div>
                    </div>
                  </div>

                  <Suspense fallback={<LazyFallback label="预览器加载中..." />}>
                    <MultiVideoPlayer
                      onOpenAssets={openImportFromAnywhere}
                      onOpenDirector={openDirectorFromAnywhere}
                    />
                  </Suspense>
                </div>
              </div>

              <div className="transport-controls">
                <button
                  id="tool-prev"
                  aria-label="跳转到开头"
                  className="transport-btn"
                  onClick={() => setCurrentTime(0)}
                  data-testid="btn-player-prev"
                >
                  ⏮
                </button>
                <button
                  id="tool-play"
                  aria-label={isPlaying ? '暂停播放' : '开始播放'}
                  className="transport-btn play"
                  onClick={togglePlay}
                  data-testid="btn-player-play"
                >
                  {isPlaying ? '⏸' : '▶'}
                </button>
                <button
                  id="tool-next"
                  aria-label="跳转到下一片段"
                  className="transport-btn"
                  onClick={() => setCurrentTime(getNextClipTime())}
                  data-testid="btn-player-next"
                >
                  ⏭
                </button>
              </div>
            </div>
          ) : activeMode === 'color' ? (
            <Suspense fallback={<LazyFallback label="实验室加载中..." />}>
              <ComparisonLab onOpenAssets={openImportFromAnywhere} />
            </Suspense>
          ) : (
            <div className="audio-master-state">
              <div className="audio-master-icon">🎚️</div>
              <div className="audio-master-title">AUDIO MASTER 引擎已就绪</div>
              <div className="audio-master-actions">
                <button
                  type="button"
                  className="audio-master-btn primary"
                  onClick={openImportFromAnywhere}
                >
                  导入素材开始处理
                </button>
                <button
                  type="button"
                  className="audio-master-btn"
                  onClick={() => setActiveMode('color')}
                >
                  切换到实验室对比
                </button>
              </div>
            </div>
          )}
        </section>

        {isDesktopLayout ? (
          <ResizeHandle
            axis="x"
            className="main-resize-handle"
            ariaLabel="调整右侧功能区宽度"
            hint="拖动调整右侧功能区宽度"
            testId="handle-right-panel"
            onDrag={handleRightPanelResize}
          />
        ) : null}

        <aside
          className="pro-panel pro-inspector-outer panel-right"
          ref={rightPanelRef}
          data-testid="area-right-panel"
        >
          <div className="panel-title-bar">
            <span className="inspector-title">属性检查器</span>
          </div>
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
          hint="拖动调整时间轴高度"
          testId="handle-timeline"
          onDrag={handleTimelineResize}
        />
      ) : null}

      <footer
        className="pro-panel timeline-container"
        onMouseEnter={ensureTimelineReady}
        onFocusCapture={ensureTimelineReady}
        data-testid="area-timeline"
      >
        <div className="timeline-actions">
          <div className="timeline-tools" data-guide="timeline-tools">
            <span className="timeline-section-title">编辑工具</span>
            <div className="undo-group">
              <button
                id="tool-undo"
                aria-label="撤销"
                className="tool-icon"
                onClick={() => undo()}
                disabled={pastStates.length === 0}
                data-testid="btn-tool-undo"
              >
                ↩
              </button>
              <button
                id="tool-redo"
                aria-label="重做"
                className="tool-icon"
                onClick={() => redo()}
                disabled={futureStates.length === 0}
                data-testid="btn-tool-redo"
              >
                ↪
              </button>
            </div>
            <button
              id="tool-select"
              aria-label="选择工具"
              className={`tool-icon ${activeTool === 'select' ? 'active' : ''}`}
              onClick={() => setActiveTool('select')}
              data-testid="btn-tool-select"
            >
              ↖
            </button>
            <button
              id="tool-cut"
              aria-label="切割工具"
              className={`tool-icon ${activeTool === 'cut' ? 'active' : ''}`}
              onClick={() => setActiveTool('cut')}
              data-testid="btn-tool-cut"
            >
              ✂
            </button>
            <button
              id="tool-hand"
              aria-label="平移工具"
              className={`tool-icon ${activeTool === 'hand' ? 'active' : ''}`}
              onClick={() => setActiveTool('hand')}
              data-testid="btn-tool-hand"
            >
              ✋
            </button>
          </div>

          <div className="system-telemetry">
            <span className="timeline-section-title telemetry-label">系统状态</span>
            <div className="telemetry-item">
              <span>
                GPU LOAD: <b className="telemetry-value success">{currentMetrics.gpu}%</b>
              </span>
              <div className="telemetry-sparkline">
                {telemetryHistory.map((v, i) => (
                  <div
                    key={i}
                    className="spark-bar"
                    style={{ height: `${Math.max(2, Math.min(100, v))}%` }}
                  />
                ))}
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
              <VideoEditor activeTool={activeTool as 'select' | 'hand' | 'cut'} />
            </Suspense>
          ) : (
            <LazyFallback label="时间轴预热中..." />
          )}
        </div>
      </footer>

      {isGuideOpen && currentGuideStep ? (
        <div
          className="guide-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="新手引导"
          data-testid="area-guide-overlay"
        >
          <div className="guide-dim" />
          {guideHighlightStyle ? (
            <div className="guide-highlight" style={guideHighlightStyle} />
          ) : null}
          <section className="guide-card" style={guideCardStyle}>
            <div className="guide-card-head">
              <span className="guide-step">
                步骤 {guideStepIndex + 1} / {guideSteps.length}
              </span>
              <button type="button" className="guide-close" onClick={() => closeGuide(true)}>
                跳过
              </button>
            </div>
            <h3>{currentGuideStep.title}</h3>
            <p>{currentGuideStep.description}</p>
            <div className="guide-actions">
              {currentGuideStep.actionLabel && currentGuideStep.onAction ? (
                <button type="button" className="guide-action" onClick={currentGuideStep.onAction}>
                  {currentGuideStep.actionLabel}
                </button>
              ) : null}
              <button
                type="button"
                className="guide-nav"
                onClick={goGuidePrev}
                disabled={guideStepIndex === 0}
              >
                上一步
              </button>
              <button type="button" className="guide-nav primary" onClick={goGuideNext}>
                {guideStepIndex === guideSteps.length - 1 ? '完成引导' : '下一步'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </WorkspaceShell>
  )
}

export default memo(App)
