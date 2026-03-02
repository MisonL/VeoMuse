import { useState, memo, useEffect, useActionState, useOptimistic, lazy, Suspense, useMemo, useRef, useCallback, startTransition } from 'react'
import type { CSSProperties } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from './store/editorStore'
import { useToastStore } from './store/toastStore'
import { useAdminMetricsPolling, useAdminMetricsStore } from './store/adminMetricsStore'
import { useJourneyTelemetryStore } from './store/journeyTelemetryStore'
import { LAYOUT_LIMITS, useLayoutStore } from './store/layoutStore'
import { useThemeSync } from './hooks/useThemeSync'
import { buildAuthHeaders, resolveApiBase } from './utils/eden'
import { calcAspectFit, clamp } from './utils/layoutMath'
import ResizeHandle from './components/Common/ResizeHandle'
import ThemeSwitcher from './components/Common/ThemeSwitcher'
import WorkspaceShell from './components/Layout/WorkspaceShell'
import type { CenterPanelMode, PreviewAspect } from './types/layout'
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
const MAIN_PANEL_MIN_WIDTH = 340
const MAIN_PANEL_MIN_HEIGHT = 260
const CENTER_PANEL_FALLBACK_WIDTH = 520
const CENTER_PANEL_EDIT_WIDTH = 500
const CENTER_PANEL_LAB_WIDTH = 720
const CENTER_PANEL_AUDIO_WIDTH = 620
const CENTER_PANEL_FRAME_GUTTER = 10
const CENTER_PANEL_EDIT_MAX_WIDTH = 700
const CENTER_PANEL_AUDIO_MAX_WIDTH = 860
const CENTER_PANEL_LAB_MAX_WIDTH = 940
const HEADER_HEIGHT = 62
const HORIZONTAL_HANDLE_SIZE = 10
const VERTICAL_HANDLE_SIZE = 8
const SHELL_VERTICAL_PADDING = 20
const SHELL_VERTICAL_GAP = 30
const GUIDE_STORAGE_KEY = 'veomuse-onboarding-v1'
const PREVIEW_ASPECT_RATIO_MAP: Record<PreviewAspect, number> = {
  '16:9': 16 / 9,
  '21:9': 21 / 9
}
const CENTER_MODE_WIDTH_BOOST: Record<CenterPanelMode, number> = {
  fit: 0,
  focus: 56
}
type ExportUiStatus = 'idle' | 'pending' | 'done' | 'error'
type ExportProgressStage = 'idle' | 'validating' | 'composing' | 'packaging' | 'done' | 'error'
type ExportActionState = { status: 'idle' | 'done' | 'error'; message?: string }
type ExportQuality = 'standard' | '4k-hdr' | 'spatial-vr'

interface GuideStep {
  title: string
  description: string
  target: string
  actionLabel?: string
  onAction?: () => void
  onEnter?: () => void
}

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
  optimisticExportStatus: ExportUiStatus,
  progressPercent?: number
) => {
  if (isExportPending || optimisticExportStatus === 'pending') {
    if (typeof progressPercent === 'number' && progressPercent > 0) {
      return `导出中 ${Math.round(Math.max(1, Math.min(99, progressPercent)))}%`
    }
    return '导出中...'
  }
  return '导出'
}

const resolveExportStageByProgress = (progress: number): ExportProgressStage => {
  if (progress < 30) return 'validating'
  if (progress < 78) return 'composing'
  return 'packaging'
}

const compactExportMessage = (message: string, limit = 92) => {
  const normalized = message.replace(/\s+/g, ' ').trim()
  if (normalized.length <= limit) return normalized
  return `${normalized.slice(0, limit)}...`
}

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
  const markJourneyStep = useJourneyTelemetryStore(state => state.markStep)
  const reportJourney = useJourneyTelemetryStore(state => state.reportJourney)
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
    useShallow(state => ({
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

  // @ts-ignore
  const { undo, redo, pastStates, futureStates } = useEditorStore.temporal.getState()

  const [activeMode, setActiveMode] = useState('edit')
  const [activeTool, setActiveTool] = useState('select')
  const [activeSidebar, setActiveSidebar] = useState<'assets' | 'director' | 'actors' | 'motion'>('assets')
  const [exportQuality, setExportQuality] = useState<ExportQuality>('standard')
  const [directorPrompt, setDirectorPrompt] = useState('')
  const [directorScenes, setDirectorScenes] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isTimelineReady, setIsTimelineReady] = useState(false)
  const [isDesktopLayout, setIsDesktopLayout] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.innerWidth > DESKTOP_BREAKPOINT
  })
  const [previewFrameSize, setPreviewFrameSize] = useState({ width: 0, height: 0 })
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const [guideStepIndex, setGuideStepIndex] = useState(0)
  const [guideAnchorRect, setGuideAnchorRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const [optimisticScenes, setOptimisticScenes] = useOptimistic<any[], any[]>(directorScenes, (_prev, next) => next)
  const [optimisticExportStatus, setOptimisticExportStatus] = useOptimistic<ExportUiStatus, ExportUiStatus>('idle', (_prev, next) => next)
  const shellRef = useRef<HTMLDivElement | null>(null)
  const mainLayoutRef = useRef<HTMLDivElement | null>(null)
  const leftPanelRef = useRef<HTMLElement | null>(null)
  const rightPanelRef = useRef<HTMLElement | null>(null)
  const previewHostRef = useRef<HTMLDivElement | null>(null)
  const exportProgressTimerRef = useRef<number | null>(null)
  const exportFeedbackResetTimerRef = useRef<number | null>(null)
  const [exportState, runExportAction, isExportPending] = useActionState<ExportActionState, ExportQuality>(async (_state, quality) => {
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
      const payload = await response.json().catch(() => null) as any
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || `HTTP ${response.status}`)
      }
      showToast(`导出成功: ${payload.outputPath}`, 'success')
      return { status: 'done' as const, message: payload.outputPath }
    } catch (e: any) {
      return { status: 'error' as const, message: e.message || '导出失败' }
    }
  }, { status: 'idle' })
  const [exportUiStatus, setExportUiStatus] = useState<ExportUiStatus>('idle')
  const [exportProgress, setExportProgress] = useState(0)
  const [exportStage, setExportStage] = useState<ExportProgressStage>('idle')
  const [lastExportOutput, setLastExportOutput] = useState('')

  const telemetryHistory = useMemo(() => renderLoadHistory.slice(-10), [renderLoadHistory])
  const hasRenderableClips = useMemo(() => (
    tracks.some(track => (
      track.type !== 'text'
      && track.type !== 'mask'
      && track.clips.some(clip => typeof clip.src === 'string' && clip.src.trim().length > 0)
    ))
  ), [tracks])
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
      setExportProgress(prev => {
        if (prev >= 94) return prev
        const delta = prev < 30 ? 7 : prev < 68 ? 4 : 2
        const next = Math.min(94, prev + delta)
        setExportStage(resolveExportStageByProgress(next))
        return next
      })
    }, 260)
  }, [clearExportFeedbackTimers])

  const resetExportFeedback = useCallback((status: ExportUiStatus = 'idle') => {
    clearExportFeedbackTimers()
    setExportUiStatus(status)
    startTransition(() => {
      setOptimisticExportStatus(status)
    })
    setExportProgress(0)
    setExportStage(status === 'error' ? 'error' : status === 'done' ? 'done' : 'idle')
    if (status === 'idle') setLastExportOutput('')
  }, [clearExportFeedbackTimers, setOptimisticExportStatus])

  const applyOptimisticScenes = useCallback((next: any[]) => {
    startTransition(() => {
      setOptimisticScenes(next)
    })
  }, [setOptimisticScenes])

  const applyOptimisticExportStatus = useCallback((status: ExportUiStatus) => {
    startTransition(() => {
      setOptimisticExportStatus(status)
    })
  }, [setOptimisticExportStatus])

  const dispatchExportAction = useCallback((quality: ExportQuality) => {
    startTransition(() => {
      void runExportAction(quality)
    })
  }, [runExportAction])

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

  const ensureTimelineReady = useCallback(() => {
    setIsTimelineReady(prev => {
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
    setActiveMode('color')
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('veomuse:open-channel-panel'))
    }, 0)
  }, [])

  const guideSteps = useMemo<GuideStep[]>(() => ([
    {
      title: '切换工作模式',
      description: '先在这里切换剪辑、实验室和音频大师，主工作区会随模式变化。',
      target: '[data-guide=\"mode-selector\"]',
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
      target: '[data-guide=\"left-resize-handle\"]',
      onEnter: () => setActiveMode('edit')
    },
    {
      title: '时间轴工具区',
      description: '在这里执行撤销、重做、选择、切割、平移等剪辑操作。',
      target: '[data-guide=\"timeline-tools\"]',
      onEnter: () => {
        setActiveMode('edit')
        ensureTimelineReady()
      }
    },
    {
      title: '实验室模式',
      description: '在实验室里做模型对比、策略治理、创意闭环和协作流程。',
      target: '[data-guide=\"lab-toolbar\"]',
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
  ]), [ensureTimelineReady, openImportFromAnywhere])

  const handleDirector = async () => {
    if (!directorPrompt.trim()) return showToast('请输入脚本', 'info')
    markJourneyStep('generation_triggered')
    setIsProcessing(true)
    applyOptimisticScenes([{ title: 'AI 正在分析脚本...', duration: 1 }])

    try {
      const response = await fetch(`${resolveApiBase()}/api/ai/director/analyze`, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ script: directorPrompt })
      })
      const data = await response.json().catch(() => null) as any
      if (!response.ok || !data || data.success === false) {
        throw new Error(data?.error || `HTTP ${response.status}`)
      }

      if (data && 'scenes' in data) {
        setDirectorScenes(data.scenes || [])
        applyOptimisticScenes(data.scenes || [])

        const latestTracks = useEditorStore.getState().tracks
        const primaryTrack = latestTracks.find(track => track.id === 'track-v1')
        if (primaryTrack) {
          let offset = primaryTrack.clips.reduce((max, clip) => Math.max(max, Number(clip.end) || 0), 0)
          const newClips = (data.scenes || []).map((scene: any, i: number) => {
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
                worldId: (data as any).worldId
              }
            }
            offset += duration
            return clip
          })
          const mergedTracks = latestTracks.map(track => (
            track.id === 'track-v1'
              ? { ...track, clips: [...track.clips, ...newClips] }
              : track
          ))
          setTracks(mergedTracks)
          showToast('分镜序列生成并编排成功', 'success')
        }
      }
    } catch (e: any) {
      const fallbackScenes = directorScenes.length > 0 ? directorScenes : [{ title: '手动编排片段', duration: 5 }]
      showRecoverableToast(
        e.message || '导演分析失败',
        () => { void handleDirector() },
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
      void reportJourney(false, { reason: 'export-error' })
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
  }, [applyOptimisticExportStatus, clearExportFeedbackTimers, dispatchExportAction, exportState, exportQuality, reportJourney, resetExportFeedback, showToast, startExportProgressFeedback])

  useEffect(() => () => clearExportFeedbackTimers(), [clearExportFeedbackTimers])

  const exportQualityLabel = useMemo(() => {
    if (exportQuality === '4k-hdr') return '4K HDR'
    if (exportQuality === 'spatial-vr') return '空间视频'
    return '标准导出'
  }, [exportQuality])

  const exportFeedbackTitle = useMemo(() => {
    if (exportStage === 'validating') return '准备素材中'
    if (exportStage === 'composing') return '渲染时间轴中'
    if (exportStage === 'packaging') return '封装输出中'
    if (exportStage === 'done') return '导出完成'
    if (exportStage === 'error') return '导出失败'
    return '等待导出'
  }, [exportStage])

  const exportFeedbackSubtitle = useMemo(() => {
    if (exportUiStatus === 'pending') return `规格：${exportQualityLabel}`
    if (exportUiStatus === 'done') return '输出文件已生成'
    if (exportUiStatus === 'error') return compactExportMessage(exportState.message || '请重试或稍后再试')
    return ''
  }, [exportQualityLabel, exportState.message, exportUiStatus])

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
  }, [guideStepIndex, guideSteps, isGuideOpen, activeMode, activeSidebar, isDesktopLayout, leftPanelPx, rightPanelPx, timelinePx])

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
      const previewRatio = PREVIEW_ASPECT_RATIO_MAP[previewAspect] || PREVIEW_ASPECT_RATIO_MAP['16:9']
      const fit = calcAspectFit(availableWidth, availableHeight, previewRatio)
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
  }, [activeMode, leftPanelPx, previewAspect, rightPanelPx, timelinePx])

  const centerPanelMinWidth = useMemo(() => {
    if (!isDesktopLayout) return MAIN_PANEL_MIN_WIDTH
    const boost = CENTER_MODE_WIDTH_BOOST[centerMode]
    if (activeMode === 'color') return 340 + boost
    if (activeMode === 'audio') return 320 + boost
    return MAIN_PANEL_MIN_WIDTH + boost
  }, [activeMode, centerMode, isDesktopLayout])

  const normalizeDesktopPanelWidths = useCallback(() => {
    if (!isDesktopLayout) return
    const mainWidth = mainLayoutRef.current?.clientWidth || 0
    if (!mainWidth) return

    const availableForSidePanels = mainWidth - (HORIZONTAL_HANDLE_SIZE * 2) - centerPanelMinWidth
    if (availableForSidePanels <= 0) return

    const leftMin = LAYOUT_LIMITS.leftPanelPx.min
    const rightMin = LAYOUT_LIMITS.rightPanelPx.min
    const leftMax = Math.min(LAYOUT_LIMITS.leftPanelPx.max, availableForSidePanels - rightMin)
    const rightMax = Math.min(LAYOUT_LIMITS.rightPanelPx.max, availableForSidePanels - leftMin)
    if (leftMax < leftMin || rightMax < rightMin) return

    const layoutState = useLayoutStore.getState()
    let nextLeft = clamp(layoutState.leftPanelPx, leftMin, leftMax)
    let nextRight = clamp(layoutState.rightPanelPx, rightMin, rightMax)

    const overflow = nextLeft + nextRight - availableForSidePanels
    if (overflow > 0) {
      if (nextLeft >= nextRight) {
        nextLeft = Math.max(leftMin, nextLeft - overflow)
      } else {
        nextRight = Math.max(rightMin, nextRight - overflow)
      }
    }

    const remainingOverflow = nextLeft + nextRight - availableForSidePanels
    if (remainingOverflow > 0) {
      nextRight = Math.max(rightMin, nextRight - remainingOverflow)
    }

    if (nextLeft !== layoutState.leftPanelPx) {
      layoutState.setLeftPanelPx(nextLeft)
    }
    if (nextRight !== layoutState.rightPanelPx) {
      layoutState.setRightPanelPx(nextRight)
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

  const handleLeftPanelResize = useCallback((delta: number) => {
    if (!isDesktopLayout) return

    const mainWidth = mainLayoutRef.current?.clientWidth || 0
    if (!mainWidth) return

    const layoutState = useLayoutStore.getState()
    const currentLeft = leftPanelRef.current?.clientWidth || layoutState.leftPanelPx
    const currentRight = rightPanelRef.current?.clientWidth || layoutState.rightPanelPx
    const maxLeft = Math.min(
      LAYOUT_LIMITS.leftPanelPx.max,
      mainWidth - (HORIZONTAL_HANDLE_SIZE * 2) - Math.max(currentRight, LAYOUT_LIMITS.rightPanelPx.min) - centerPanelMinWidth
    )

    layoutState.setLeftPanelPx(
      clamp(currentLeft + delta, LAYOUT_LIMITS.leftPanelPx.min, Math.max(LAYOUT_LIMITS.leftPanelPx.min, maxLeft))
    )
  }, [centerPanelMinWidth, isDesktopLayout])

  const handleRightPanelResize = useCallback((delta: number) => {
    if (!isDesktopLayout) return

    const mainWidth = mainLayoutRef.current?.clientWidth || 0
    if (!mainWidth) return

    const layoutState = useLayoutStore.getState()
    const currentLeft = leftPanelRef.current?.clientWidth || layoutState.leftPanelPx
    const currentRight = rightPanelRef.current?.clientWidth || layoutState.rightPanelPx
    const maxRight = Math.min(
      LAYOUT_LIMITS.rightPanelPx.max,
      mainWidth - (HORIZONTAL_HANDLE_SIZE * 2) - Math.max(currentLeft, LAYOUT_LIMITS.leftPanelPx.min) - centerPanelMinWidth
    )

    layoutState.setRightPanelPx(
      clamp(currentRight - delta, LAYOUT_LIMITS.rightPanelPx.min, Math.max(LAYOUT_LIMITS.rightPanelPx.min, maxRight))
    )
  }, [centerPanelMinWidth, isDesktopLayout])

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
    if (!isDesktopLayout) return CENTER_PANEL_FALLBACK_WIDTH
    const maxBoost = centerMode === 'focus' ? 96 : 0
    if (activeMode === 'color') {
      return clamp(CENTER_PANEL_LAB_WIDTH + maxBoost, centerPanelMinWidth, CENTER_PANEL_LAB_MAX_WIDTH + maxBoost)
    }
    if (activeMode === 'audio') {
      return clamp(CENTER_PANEL_AUDIO_WIDTH + maxBoost, centerPanelMinWidth, CENTER_PANEL_AUDIO_MAX_WIDTH + maxBoost)
    }
    const editFitWidth = Math.max(
      CENTER_PANEL_EDIT_WIDTH,
      previewFrameSize.width > 0 ? previewFrameSize.width + CENTER_PANEL_FRAME_GUTTER : 0
    )
    return clamp(editFitWidth + maxBoost, centerPanelMinWidth, CENTER_PANEL_EDIT_MAX_WIDTH + maxBoost)
  }, [activeMode, centerMode, centerPanelMinWidth, isDesktopLayout, previewFrameSize.width])

  const shellLayoutVars = useMemo(() => ({
    '--left-panel-w': `${leftPanelPx}px`,
    '--right-panel-w': `${rightPanelPx}px`,
    '--center-panel-min-w': `${centerPanelMinWidth}px`,
    '--center-panel-fit-w': `${Math.round(centerPanelFitWidth)}px`,
    '--left-panel-flex': centerMode === 'focus' ? '1.42fr' : '2.05fr',
    '--right-panel-flex': centerMode === 'focus' ? '1.28fr' : '1.86fr',
    '--timeline-h': `${timelinePx}px`
  } as CSSProperties), [
    centerMode,
    centerPanelFitWidth,
    centerPanelMinWidth,
    leftPanelPx,
    rightPanelPx,
    timelinePx
  ])

  const previewFrameStyle = useMemo(() => {
    if (!previewFrameSize.width || !previewFrameSize.height) return undefined
    return {
      width: `${previewFrameSize.width}px`,
      height: `${previewFrameSize.height}px`
    } as CSSProperties
  }, [previewFrameSize.height, previewFrameSize.width])

  const closeGuide = useCallback((completed: boolean) => {
    setIsGuideOpen(false)
    if (completed && typeof window !== 'undefined') {
      window.localStorage.setItem(GUIDE_STORAGE_KEY, 'done')
    }
  }, [])

  const currentGuideStep = guideSteps[guideStepIndex]

  const goGuidePrev = () => {
    setGuideStepIndex(prev => Math.max(0, prev - 1))
  }

  const goGuideNext = () => {
    if (guideStepIndex >= guideSteps.length - 1) {
      closeGuide(true)
      return
    }
    setGuideStepIndex(prev => Math.min(guideSteps.length - 1, prev + 1))
  }

  const guideHighlightStyle = useMemo<CSSProperties | undefined>(() => {
    if (!guideAnchorRect) return undefined
    return {
      top: `${Math.round(guideAnchorRect.top - 6)}px`,
      left: `${Math.round(guideAnchorRect.left - 6)}px`,
      width: `${Math.round(guideAnchorRect.width + 12)}px`,
      height: `${Math.round(guideAnchorRect.height + 12)}px`
    }
  }, [guideAnchorRect])

  const guideCardStyle = useMemo<CSSProperties | undefined>(() => {
    if (!guideAnchorRect || typeof window === 'undefined') return undefined
    const cardW = 320
    const cardH = 220
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight
    let top = guideAnchorRect.top + guideAnchorRect.height + 14
    if (top + cardH > viewportH - 12) top = Math.max(12, guideAnchorRect.top - cardH - 14)
    let left = guideAnchorRect.left
    if (left + cardW > viewportW - 12) left = viewportW - cardW - 12
    left = Math.max(12, left)
    return {
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`
    }
  }, [guideAnchorRect])

  return (
    <WorkspaceShell shellRef={shellRef} style={shellLayoutVars} layoutMode={centerMode} topBarDensity={topBarDensity}>
      <Suspense fallback={null}>
        <ToastContainer />
      </Suspense>

      <header className="pro-panel os-header" data-testid="area-top-header">
        <div className="brand-zone">
          <div className="brand-logo">V</div>
          <span className="brand-title">VEOMUSE PRO</span>
        </div>
        <div className="mode-selector" data-guide="mode-selector" data-testid="area-mode-selector">
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
              data-testid={`btn-mode-${m}`}
            >
              {m === 'edit' ? '剪辑' : m === 'color' ? '实验室' : '音频大师'}
            </button>
          ))}
        </div>
        <div className="header-actions" data-testid="area-header-actions">
          <div className="header-actions-group header-actions-layout" data-testid="group-header-layout">
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
          <div className="header-actions-group header-actions-quick" data-testid="group-header-quick-actions">
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
            <button id="btn-reset-layout" aria-label="重置布局" className="layout-reset-btn" onClick={resetLayout} data-testid="btn-reset-layout">
              重置布局
            </button>
          </div>
          <div className="header-actions-group header-actions-export" data-testid="group-header-export">
            <select
              id="export-quality"
              name="exportQuality"
              value={exportQuality}
              onChange={(e) => setExportQuality(e.target.value as 'standard' | '4k-hdr' | 'spatial-vr')}
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
                <div className={`export-feedback-pop ${exportUiStatus}`} role="status" aria-live="polite">
                  <div className="export-feedback-top">
                    <span className="export-feedback-title">{exportFeedbackTitle}</span>
                    {exportUiStatus === 'pending' ? (
                      <span className="export-feedback-percent">{Math.round(exportProgress)}%</span>
                    ) : null}
                  </div>
                  <div className="export-feedback-subtitle">{exportFeedbackSubtitle}</div>
                  {exportUiStatus === 'pending' ? (
                    <div className="export-progress-track">
                      <span className="export-progress-fill" style={{ width: `${Math.max(6, Math.min(100, exportProgress))}%` }} />
                    </div>
                  ) : null}
                  {exportUiStatus === 'done' && lastExportOutput ? (
                    <div className="export-feedback-path" title={lastExportOutput}>{lastExportOutput}</div>
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
                <button id="tool-prev" aria-label="跳转到开头" className="transport-btn" onClick={() => setCurrentTime(0)} data-testid="btn-player-prev">⏮</button>
                <button id="tool-play" aria-label={isPlaying ? '暂停播放' : '开始播放'} className="transport-btn play" onClick={togglePlay} data-testid="btn-player-play">{isPlaying ? '⏸' : '▶'}</button>
                <button id="tool-next" aria-label="跳转到下一片段" className="transport-btn" onClick={() => setCurrentTime(getNextClipTime())} data-testid="btn-player-next">⏭</button>
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
                <button type="button" className="audio-master-btn primary" onClick={openImportFromAnywhere}>
                  导入素材开始处理
                </button>
                <button type="button" className="audio-master-btn" onClick={() => setActiveMode('color')}>
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

        <aside className="pro-panel pro-inspector-outer panel-right" ref={rightPanelRef} data-testid="area-right-panel">
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
          hint="拖动调整时间轴高度"
          testId="handle-timeline"
          onDrag={handleTimelineResize}
        />
      ) : null}

      <footer className="pro-panel timeline-container" onMouseEnter={ensureTimelineReady} onFocusCapture={ensureTimelineReady} data-testid="area-timeline">
        <div className="timeline-actions">
          <div className="timeline-tools" data-guide="timeline-tools">
            <span className="timeline-section-title">编辑工具</span>
            <div className="undo-group">
              <button id="tool-undo" aria-label="撤销" className="tool-icon" onClick={() => undo()} disabled={pastStates.length === 0} data-testid="btn-tool-undo">↩</button>
              <button id="tool-redo" aria-label="重做" className="tool-icon" onClick={() => redo()} disabled={futureStates.length === 0} data-testid="btn-tool-redo">↪</button>
            </div>
            <button id="tool-select" aria-label="选择工具" className={`tool-icon ${activeTool === 'select' ? 'active' : ''}`} onClick={() => setActiveTool('select')} data-testid="btn-tool-select">↖</button>
            <button id="tool-cut" aria-label="切割工具" className={`tool-icon ${activeTool === 'cut' ? 'active' : ''}`} onClick={() => setActiveTool('cut')} data-testid="btn-tool-cut">✂</button>
            <button id="tool-hand" aria-label="平移工具" className={`tool-icon ${activeTool === 'hand' ? 'active' : ''}`} onClick={() => setActiveTool('hand')} data-testid="btn-tool-hand">✋</button>
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

      {isGuideOpen && currentGuideStep ? (
        <div className="guide-overlay" role="dialog" aria-modal="true" aria-label="新手引导" data-testid="area-guide-overlay">
          <div className="guide-dim" />
          {guideHighlightStyle ? <div className="guide-highlight" style={guideHighlightStyle} /> : null}
          <section className="guide-card" style={guideCardStyle}>
            <div className="guide-card-head">
              <span className="guide-step">步骤 {guideStepIndex + 1} / {guideSteps.length}</span>
              <button type="button" className="guide-close" onClick={() => closeGuide(true)}>跳过</button>
            </div>
            <h3>{currentGuideStep.title}</h3>
            <p>{currentGuideStep.description}</p>
            <div className="guide-actions">
              {currentGuideStep.actionLabel && currentGuideStep.onAction ? (
                <button type="button" className="guide-action" onClick={currentGuideStep.onAction}>
                  {currentGuideStep.actionLabel}
                </button>
              ) : null}
              <button type="button" className="guide-nav" onClick={goGuidePrev} disabled={guideStepIndex === 0}>上一步</button>
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
