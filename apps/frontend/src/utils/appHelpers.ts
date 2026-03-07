import type { CSSProperties } from 'react'
import type { JourneyErrorKind } from '../store/journeyTelemetryStore'
import type { CenterPanelMode, PreviewAspect } from '../types/layout'
export type { PreviewAspect, CenterPanelMode }
import { LAYOUT_LIMITS } from '../store/layoutStore'
import { clamp } from './layoutMath'

export const fps = 30
export const DESKTOP_BREAKPOINT = 980
export const MAIN_PANEL_MIN_WIDTH = 340
export const MAIN_PANEL_MIN_HEIGHT = 260
export const CENTER_PANEL_FALLBACK_WIDTH = 520
export const CENTER_PANEL_EDIT_WIDTH = 500
export const CENTER_PANEL_LAB_WIDTH = 720
export const CENTER_PANEL_AUDIO_WIDTH = 620
export const CENTER_PANEL_FRAME_GUTTER = 10
export const CENTER_PANEL_EDIT_MAX_WIDTH = 700
export const CENTER_PANEL_AUDIO_MAX_WIDTH = 860
export const CENTER_PANEL_LAB_MAX_WIDTH = 940
export const CENTER_PANEL_FIT_EDIT_MIN_WIDTH = 360
export const CENTER_PANEL_FIT_AUDIO_MIN_WIDTH = 348
export const CENTER_PANEL_FIT_LAB_MIN_WIDTH = 378
export const HEADER_HEIGHT = 62
export const HORIZONTAL_HANDLE_SIZE = 10
export const VERTICAL_HANDLE_SIZE = 8
export const SHELL_VERTICAL_PADDING = 20
export const SHELL_VERTICAL_GAP = 30
export const GUIDE_STORAGE_KEY = 'veomuse-onboarding-v1'

const getRuntimeEnv = (): Record<string, string | undefined> => {
  const processEnv =
    typeof process !== 'undefined'
      ? (process.env as Record<string, string | undefined>)
      : ({} as Record<string, string | undefined>)
  const bunEnv = (globalThis as { Bun?: { env?: Record<string, string | undefined> } }).Bun?.env
  if (bunEnv && typeof bunEnv === 'object') {
    return {
      ...processEnv,
      ...bunEnv
    }
  }
  return processEnv
}

const runtimeEnv = getRuntimeEnv()
const isHappyDomRuntime =
  typeof navigator !== 'undefined' && /HappyDOM/i.test(String(navigator.userAgent || ''))
export const IS_TEST_ENV =
  isHappyDomRuntime || runtimeEnv.NODE_ENV === 'test' || runtimeEnv.VEOMUSE_TEST_RUNTIME === '1'

export const PREVIEW_ASPECT_RATIO_MAP: Record<PreviewAspect, number> = {
  '16:9': 16 / 9,
  '21:9': 21 / 9
}

export const CENTER_MODE_WIDTH_BOOST: Record<CenterPanelMode, number> = {
  fit: 0,
  focus: 56
}

export type ExportUiStatus = 'idle' | 'pending' | 'done' | 'error'
export type ExportProgressStage =
  | 'idle'
  | 'validating'
  | 'composing'
  | 'packaging'
  | 'done'
  | 'error'

export type ExportActionState = {
  status: 'idle' | 'done' | 'error'
  message?: string
  httpStatus?: number
  errorKind?: JourneyErrorKind
}
export type ExportQuality = 'standard' | '4k-hdr' | 'spatial-vr'

export interface GuideStep {
  title: string
  description: string
  target: string
  actionLabel?: string
  onAction?: () => void
  onEnter?: () => void
}

export const formatTimecode = (seconds: number) => {
  const safe = Math.max(0, seconds)
  const hh = Math.floor(safe / 3600)
  const mm = Math.floor((safe % 3600) / 60)
  const ss = Math.floor(safe % 60)
  const ff = Math.floor((safe - Math.floor(safe)) * fps)
  return [hh, mm, ss, ff].map((v) => String(v).padStart(2, '0')).join(':')
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

export const resolveExportStageByProgress = (progress: number): ExportProgressStage => {
  if (progress < 30) return 'validating'
  if (progress < 78) return 'composing'
  return 'packaging'
}

export const compactExportMessage = (message: string, limit = 92) => {
  const normalized = message.replace(/\s+/g, ' ').trim()
  if (normalized.length <= limit) return normalized
  return `${normalized.slice(0, limit)}...`
}

export type DirectorScene = {
  title?: string
  duration?: number
  videoPrompt?: string
  audioPrompt?: string
}

export type TrackLike = {
  id?: string
  type?: string
  clips: Array<{
    id?: string
    src?: unknown
    start: number
    end?: number
    name?: string
    type?: 'video' | 'audio' | 'text' | 'mask'
    data?: Record<string, unknown>
  }>
}

export type MetricsLike = {
  system?: {
    renderLoad?: number
    memory?: {
      total?: number
      usage?: number
    }
  }
}

export const hasRenderableClipsFromTracks = (tracks: TrackLike[]) =>
  tracks.some(
    (track) =>
      track.type !== 'text' &&
      track.type !== 'mask' &&
      track.clips.some((clip) => typeof clip.src === 'string' && clip.src.trim().length > 0)
  )

export const deriveCurrentMetrics = (metrics?: MetricsLike) => {
  if (!metrics?.system?.memory) return { gpu: 0, ram: '0 / 0', cache: '0%' }
  const gpu = Number.isFinite(metrics.system.renderLoad)
    ? Math.round(metrics.system.renderLoad ?? 0)
    : 0
  const totalMemoryGb = Number(metrics.system.memory.total || 0) / 1024 ** 3
  const usagePercent = Number(metrics.system.memory.usage || 0) * 100
  return {
    gpu,
    ram: `${totalMemoryGb.toFixed(1)}GB`,
    cache: `${Math.round(usagePercent)}%`
  }
}

export const getNextClipTimeFromTracks = (currentTime: number, tracks: TrackLike[]) => {
  const allClipStarts = tracks
    .flatMap((track) => track.clips)
    .map((clip) => Number(clip.start) || 0)
    .filter((start) => start > currentTime)
    .sort((a, b) => a - b)
  return allClipStarts[0] ?? 0
}

export const resolveExportQualityLabel = (exportQuality: ExportQuality) => {
  if (exportQuality === '4k-hdr') return '4K HDR'
  if (exportQuality === 'spatial-vr') return '空间视频'
  return '标准导出'
}

export const resolveExportFeedbackTitle = (exportStage: ExportProgressStage) => {
  if (exportStage === 'validating') return '准备素材中'
  if (exportStage === 'composing') return '渲染时间轴中'
  if (exportStage === 'packaging') return '封装输出中'
  if (exportStage === 'done') return '导出完成'
  if (exportStage === 'error') return '导出失败'
  return '等待导出'
}

export const resolveExportFeedbackSubtitle = (
  exportUiStatus: ExportUiStatus,
  exportQualityLabel: string,
  exportStateMessage?: string
) => {
  if (exportUiStatus === 'pending') return `规格：${exportQualityLabel}`
  if (exportUiStatus === 'done') return '输出文件已生成'
  if (exportUiStatus === 'error')
    return compactExportMessage(exportStateMessage || '请重试或稍后再试')
  return ''
}

export const computeCenterPanelMinWidth = (
  isDesktopLayout: boolean,
  centerMode: CenterPanelMode,
  activeMode: string
) => {
  if (!isDesktopLayout) return MAIN_PANEL_MIN_WIDTH
  if (centerMode === 'fit') {
    if (activeMode === 'color') return Math.max(CENTER_PANEL_FIT_LAB_MIN_WIDTH, 420)
    if (activeMode === 'audio') return CENTER_PANEL_FIT_AUDIO_MIN_WIDTH
    return CENTER_PANEL_FIT_EDIT_MIN_WIDTH
  }
  const boost = CENTER_MODE_WIDTH_BOOST[centerMode]
  if (activeMode === 'color') return Math.max(CENTER_PANEL_FIT_LAB_MIN_WIDTH, 420 + boost)
  if (activeMode === 'audio') return 320 + boost
  return MAIN_PANEL_MIN_WIDTH + boost
}

export const computeCenterPanelFitWidth = (params: {
  activeMode: string
  centerMode: CenterPanelMode
  centerPanelMinWidth: number
  isDesktopLayout: boolean
  previewFrameWidth: number
}) => {
  if (!params.isDesktopLayout) return CENTER_PANEL_FALLBACK_WIDTH
  const maxBoost = params.centerMode === 'focus' ? 96 : 0
  if (params.activeMode === 'color') {
    return clamp(
      CENTER_PANEL_LAB_WIDTH + 96 + maxBoost,
      params.centerPanelMinWidth,
      CENTER_PANEL_LAB_MAX_WIDTH + maxBoost
    )
  }
  if (params.activeMode === 'audio') {
    return clamp(
      CENTER_PANEL_AUDIO_WIDTH + maxBoost,
      params.centerPanelMinWidth,
      CENTER_PANEL_AUDIO_MAX_WIDTH + maxBoost
    )
  }
  const editFitWidth = Math.max(
    CENTER_PANEL_EDIT_WIDTH,
    params.previewFrameWidth > 0 ? params.previewFrameWidth + CENTER_PANEL_FRAME_GUTTER : 0
  )
  return clamp(
    editFitWidth + maxBoost,
    params.centerPanelMinWidth,
    CENTER_PANEL_EDIT_MAX_WIDTH + maxBoost
  )
}

export const buildShellLayoutVars = (params: {
  activeMode: string
  centerMode: CenterPanelMode
  centerPanelFitWidth: number
  centerPanelMinWidth: number
  leftPanelPx: number
  rightPanelPx: number
  timelinePx: number
}) =>
  ({
    '--left-panel-w': `${params.activeMode === 'color' ? Math.min(params.leftPanelPx, 344) : params.leftPanelPx}px`,
    '--right-panel-w': `${params.activeMode === 'color' ? Math.min(params.rightPanelPx, 304) : params.rightPanelPx}px`,
    '--center-panel-min-w': `${params.centerPanelMinWidth}px`,
    '--center-panel-fit-w': `${Math.round(
      params.activeMode === 'color'
        ? Math.max(params.centerPanelFitWidth, 816)
        : params.centerPanelFitWidth
    )}px`,
    '--left-panel-flex':
      params.activeMode === 'color'
        ? params.centerMode === 'focus'
          ? '1.08fr'
          : '1.18fr'
        : params.centerMode === 'focus'
          ? '1.36fr'
          : '1.68fr',
    '--right-panel-flex':
      params.activeMode === 'color'
        ? params.centerMode === 'focus'
          ? '0.94fr'
          : '1.06fr'
        : params.centerMode === 'focus'
          ? '1.24fr'
          : '1.58fr',
    '--timeline-h': `${params.timelinePx}px`
  }) as CSSProperties

export type LayoutLimitsLike = typeof LAYOUT_LIMITS

export const normalizeDesktopPanelWidthsPure = (params: {
  mainWidth: number
  centerPanelMinWidth: number
  leftPanelPx: number
  rightPanelPx: number
  limits?: LayoutLimitsLike
}) => {
  const limits = params.limits || LAYOUT_LIMITS
  const availableForSidePanels =
    params.mainWidth - HORIZONTAL_HANDLE_SIZE * 2 - params.centerPanelMinWidth
  if (availableForSidePanels <= 0) return null

  const leftMin = limits.leftPanelPx.min
  const rightMin = limits.rightPanelPx.min
  const leftMax = Math.min(limits.leftPanelPx.max, availableForSidePanels - rightMin)
  const rightMax = Math.min(limits.rightPanelPx.max, availableForSidePanels - leftMin)
  if (leftMax < leftMin || rightMax < rightMin) return null

  let nextLeft = clamp(params.leftPanelPx, leftMin, leftMax)
  let nextRight = clamp(params.rightPanelPx, rightMin, rightMax)

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

  return {
    leftPanelPx: nextLeft,
    rightPanelPx: nextRight
  }
}

export const computeLeftPanelWidthAfterDrag = (params: {
  delta: number
  mainWidth: number
  currentLeft: number
  currentRight: number
  centerPanelMinWidth: number
  limits?: LayoutLimitsLike
}) => {
  if (!params.mainWidth) return params.currentLeft
  const limits = params.limits || LAYOUT_LIMITS
  const maxLeft = Math.min(
    limits.leftPanelPx.max,
    params.mainWidth -
      HORIZONTAL_HANDLE_SIZE * 2 -
      Math.max(params.currentRight, limits.rightPanelPx.min) -
      params.centerPanelMinWidth
  )
  return clamp(
    params.currentLeft + params.delta,
    limits.leftPanelPx.min,
    Math.max(limits.leftPanelPx.min, maxLeft)
  )
}

export const computeRightPanelWidthAfterDrag = (params: {
  delta: number
  mainWidth: number
  currentLeft: number
  currentRight: number
  centerPanelMinWidth: number
  limits?: LayoutLimitsLike
}) => {
  if (!params.mainWidth) return params.currentRight
  const limits = params.limits || LAYOUT_LIMITS
  const maxRight = Math.min(
    limits.rightPanelPx.max,
    params.mainWidth -
      HORIZONTAL_HANDLE_SIZE * 2 -
      Math.max(params.currentLeft, limits.leftPanelPx.min) -
      params.centerPanelMinWidth
  )
  return clamp(
    params.currentRight - params.delta,
    limits.rightPanelPx.min,
    Math.max(limits.rightPanelPx.min, maxRight)
  )
}

export const computeTimelineHeightAfterDrag = (params: {
  delta: number
  shellHeight: number
  timelinePx: number
  limits?: LayoutLimitsLike
}) => {
  const limits = params.limits || LAYOUT_LIMITS
  const maxTimelineByShell =
    params.shellHeight -
    HEADER_HEIGHT -
    VERTICAL_HANDLE_SIZE -
    SHELL_VERTICAL_PADDING -
    SHELL_VERTICAL_GAP -
    MAIN_PANEL_MIN_HEIGHT
  const maxTimeline = Math.min(
    limits.timelinePx.max,
    Math.max(limits.timelinePx.min, maxTimelineByShell)
  )
  return clamp(params.timelinePx - params.delta, limits.timelinePx.min, maxTimeline)
}

export type GuideAnchorRect = {
  top: number
  left: number
  width: number
  height: number
}

export const buildPreviewFrameStyle = (previewFrameSize: { width: number; height: number }) => {
  if (!previewFrameSize.width || !previewFrameSize.height) return undefined
  return {
    width: `${previewFrameSize.width}px`,
    height: `${previewFrameSize.height}px`
  } as CSSProperties
}

export const buildGuideHighlightStyle = (guideAnchorRect: GuideAnchorRect | null | undefined) => {
  if (!guideAnchorRect) return undefined
  return {
    top: `${Math.round(guideAnchorRect.top - 6)}px`,
    left: `${Math.round(guideAnchorRect.left - 6)}px`,
    width: `${Math.round(guideAnchorRect.width + 12)}px`,
    height: `${Math.round(guideAnchorRect.height + 12)}px`
  } as CSSProperties
}

export const buildGuideCardStyle = (
  guideAnchorRect: GuideAnchorRect | null | undefined,
  viewport: { width: number; height: number }
) => {
  if (!guideAnchorRect) return undefined
  const cardW = 320
  const cardH = 220
  let top = guideAnchorRect.top + guideAnchorRect.height + 14
  if (top + cardH > viewport.height - 12) top = Math.max(12, guideAnchorRect.top - cardH - 14)
  let left = guideAnchorRect.left
  if (left + cardW > viewport.width - 12) left = viewport.width - cardW - 12
  left = Math.max(12, left)
  return {
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`
  } as CSSProperties
}
