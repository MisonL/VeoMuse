import React, { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useActorsStore } from '../../store/actorsStore'
import { buildAuthHeaders, getAccessToken, resolveApiBase } from '../../utils/eden'
import { useEditorStore } from '../../store/editorStore'
import type { Clip } from '../../store/editorStore'
import { useToastStore } from '../../store/toastStore'
import { buildTranslatedClipClone } from '../../utils/clipOperations'
import {
  buildAlchemyRequest,
  extractInspectorErrorMessage,
  resolveAlchemyOutcome,
  resolveSelectedClipContext,
  resolveTranslationResult,
  resolveTranslationSourceText,
  type AlchemyActionType
} from './propertyInspector.logic'
import TelemetryDashboard from './TelemetryDashboard'
import './PropertyInspector.css'

const resolveErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

const formatTimelineValue = (value: number | string | undefined) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '--:--'

  const totalTenths = Math.max(0, Math.round(numeric * 10))
  const minutes = Math.floor(totalTenths / 600)
  const seconds = Math.floor(totalTenths / 10) % 60
  const tenths = totalTenths % 10

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`
}

const formatDurationValue = (value: number) => {
  if (!Number.isFinite(value)) return '--'
  return `${value.toFixed(value >= 10 ? 0 : 1)}s`
}

const resolveClipTypeLabel = (type: string | undefined) => {
  switch (type) {
    case 'video':
      return '视频'
    case 'audio':
      return '音频'
    case 'text':
      return '文本'
    default:
      return type || '待命'
  }
}

const resolveClipStationSummary = (clip: Clip, trackName: string | null) => {
  const trackLabel = trackName || '未绑定轨道'

  switch (clip.type) {
    case 'video':
      return `当前镜头已挂入 ${trackLabel}，可直接调度风格、特效、一致性与空间渲染总线。`
    case 'text':
      return `当前文稿已挂入 ${trackLabel}，可在这里完成配音、翻译克隆与交付前校验。`
    case 'audio':
      return `当前音频已挂入 ${trackLabel}，适合继续做翻译克隆、节奏分析与母带辅助。`
    default:
      return `当前片段已挂入 ${trackLabel}，值守台已切到可编辑状态。`
  }
}

const resolveClipFocusLabel = (clip: Clip | null) => {
  if (!clip) return '等待片段接管'
  if (clip.type === 'video') return '视觉炼金与一致性'
  if (clip.type === 'text') return '文稿配音与翻译'
  if (clip.type === 'audio') return '翻译克隆与节奏分析'
  return '当前片段参数值守'
}

const STYLE_PRESET_OPTIONS = ['cinematic', 'van_gogh', 'cyberpunk'] as const
const STYLE_MODEL_OPTIONS = ['luma-dream', 'kling-v1', 'veo-3.1'] as const
const VFX_TYPE_OPTIONS = ['magic-particles', 'cyber-glitch', 'neon-bloom'] as const
const TARGET_LANG_OPTIONS = ['English', 'Japanese'] as const

const pickOption = <T extends readonly string[]>(
  value: unknown,
  options: T,
  fallback: T[number]
) =>
  typeof value === 'string' && options.includes(value as T[number])
    ? (value as T[number])
    : fallback

const pickNumeric = (value: unknown, fallback: number, min: number, max: number) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(max, Math.max(min, numeric))
}

type ShellMode = 'edit' | 'color' | 'audio'

interface InspectorReadoutItem {
  label: string
  value: string
  note: string
  tone?: 'accent' | 'signal' | 'live' | 'hot' | 'muted'
}

interface InspectorStepItem {
  index: string
  title: string
  detail: string
}

interface PropertyInspectorProps {
  shellMode?: ShellMode
  labSurface?: 'stage' | 'watch'
  onOpenWatchStage?: () => void
  onReturnToLabStage?: () => void
}

const INSPECTOR_MODE_META: Record<
  ShellMode,
  {
    idleTitle: string
    idleSubtitle: string
    idleAction: string
    labTitle: string
    labSubtitle: string
    labStatus: string
  }
> = {
  edit: {
    idleTitle: '等待片段进入工位',
    idleSubtitle: '属性、炼金与空间渲染动作都绑定到当前片段，不再丢失上下文。',
    idleAction: '时间轴选中片段后，可在这里查看参数、触发炼金，并切换到系统监控值守。',
    labTitle: '系统监控摘要在线',
    labSubtitle: '运行态、告警与治理记录会在当前侧栏持续值守显示。',
    labStatus: '系统监控摘要'
  },
  color: {
    idleTitle: '实验上下文待接管',
    idleSubtitle: '实验策略、比对判断与协作动作将围绕当前实验阶段集中显示。',
    idleAction: '上方实验室选中当前阶段后，可在这里查看上下文、切换监控并承接后续动作。',
    labTitle: '实验室系统监控',
    labSubtitle: 'Provider 健康、治理信号与实验告警会围绕当前实验阶段持续更新。',
    labStatus: '实验监控摘要'
  },
  audio: {
    idleTitle: '母带工位待命',
    idleSubtitle: '旁白、音乐、响度与导出前校验会在这里绑定到当前母带会话。',
    idleAction: '导入素材并进入母带流程后，可在这里查看当前输入、调参并切换到系统监控。',
    labTitle: '母带系统监控',
    labSubtitle: '输入健康、总线状态与交付前检查会围绕当前母带会话持续显示。',
    labStatus: '母带监控摘要'
  }
}

const PropertyInspector: React.FC<PropertyInspectorProps> = ({
  shellMode = 'edit',
  labSurface = 'stage',
  onOpenWatchStage,
  onReturnToLabStage
}) => {
  const { tracks, selectedClipId, updateClip, setTracks } = useEditorStore(
    useShallow((state) => ({
      tracks: state.tracks,
      selectedClipId: state.selectedClipId,
      updateClip: state.updateClip,
      setTracks: state.setTracks
    }))
  )
  const { showToast } = useToastStore()
  const { actors, fetchActors } = useActorsStore(
    useShallow((state) => ({
      actors: state.actors,
      fetchActors: state.fetchActors
    }))
  )
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeTab, setActiveTab] = useState<'properties' | 'lab'>('properties')

  const [spatialX, setSpatialX] = useState(0)
  const [bgmVolume, setBgmVolume] = useState(80)
  const [targetLang, setTargetLang] = useState<'English' | 'Japanese'>('English')
  const [stylePreset, setStylePreset] = useState<'cinematic' | 'van_gogh' | 'cyberpunk'>(
    'cinematic'
  )
  const [styleModel, setStyleModel] = useState<'luma-dream' | 'kling-v1' | 'veo-3.1'>('luma-dream')
  const [vfxType, setVfxType] = useState<'magic-particles' | 'cyber-glitch' | 'neon-bloom'>(
    'magic-particles'
  )
  const [vfxIntensity, setVfxIntensity] = useState(0.8)

  const clipContext = resolveSelectedClipContext(tracks, selectedClipId)
  const selectedClip = clipContext.selectedClip
  const parentTrackId = clipContext.parentTrackId
  const shellMeta = INSPECTOR_MODE_META[shellMode]

  useEffect(() => {
    if (!getAccessToken().trim()) return
    void fetchActors().catch(() => {
      // ignore actor list errors in inspector
    })
  }, [fetchActors])

  const callAuthJson = async <T = unknown,>(path: string, body: Record<string, unknown>) => {
    if (!getAccessToken().trim()) {
      throw new Error('请先登录后再使用 AI 功能')
    }

    const response = await fetch(`${resolveApiBase()}${path}`, {
      method: 'POST',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body ?? {})
    })

    const payload = (await response.json().catch(() => null)) as unknown
    const payloadRecord =
      payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null
    if (!response.ok) {
      throw new Error(extractInspectorErrorMessage(payload, `请求失败 (${response.status})`))
    }
    if (payloadRecord && (payloadRecord.success === false || payloadRecord.status === 'error')) {
      throw new Error(extractInspectorErrorMessage(payload, '请求失败'))
    }
    return payload as T
  }

  const handleUpdate = (updates: Partial<Clip>) => {
    if (parentTrackId && selectedClipId) {
      updateClip(parentTrackId, selectedClipId, updates)
    }
  }

  const handleDataUpdate = (dataUpdates: Record<string, unknown>) => {
    if (selectedClip) {
      handleUpdate({ data: { ...((selectedClip as Clip).data || {}), ...dataUpdates } })
    }
  }

  const cloneSelectedClip = (next: Clip) => {
    if (!selectedClip || !parentTrackId) return

    const nextTracks = tracks.map((track) => {
      if (track.id !== parentTrackId) return track
      return { ...track, clips: [...track.clips, next] }
    })

    setTracks(nextTracks)
  }

  const handleTranslateAndClone = async () => {
    if (!selectedClip) return
    if ((selectedClip as Clip).type !== 'text' && (selectedClip as Clip).type !== 'audio') {
      showToast('仅文字或音频片段支持翻译克隆', 'info')
      return
    }

    setIsProcessing(true)
    try {
      const sourceText = resolveTranslationSourceText(selectedClip as Clip)

      const data = await callAuthJson<{
        translatedText?: string
        detectedLang?: string
        targetLang?: string
      }>('/api/ai/translate', {
        text: sourceText,
        targetLang
      })
      const translation = resolveTranslationResult(data, targetLang)
      const cloned = buildTranslatedClipClone(
        selectedClip as Clip,
        {
          translatedText: translation.translatedText,
          detectedLang: translation.detectedLang,
          targetLang: translation.targetLang
        },
        Date.now()
      )
      cloneSelectedClip(cloned)

      showToast(`已翻译并克隆为 ${translation.targetLang}`, 'success')
    } catch (error: unknown) {
      showToast(resolveErrorMessage(error, '翻译失败'), 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAlchemy = async (type: AlchemyActionType) => {
    if (!selectedClip) return
    setIsProcessing(true)
    showToast(`🧬 正在执行高级炼金: ${type}`, 'info')

    try {
      const request = buildAlchemyRequest(type, selectedClip as Clip, {
        stylePreset,
        styleModel,
        vfxType,
        vfxIntensity
      })
      const payload = await callAuthJson(request.path, request.body)
      const outcome = resolveAlchemyOutcome(type, payload, (selectedClip as Clip).data, {
        stylePreset,
        styleModel,
        vfxType,
        vfxIntensity
      })
      if (outcome.dataUpdate) {
        handleDataUpdate(outcome.dataUpdate)
      }
      showToast(outcome.toastMessage, outcome.toastLevel)
    } catch (error: unknown) {
      showToast(resolveErrorMessage(error, '炼金执行失败'), 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const current = selectedClip as Clip | null
  const currentTrack = parentTrackId
    ? tracks.find((track) => track.id === parentTrackId) || null
    : null

  useEffect(() => {
    const data = current?.data || {}
    setSpatialX(pickNumeric(data.spatialX, 0, -100, 100))
    setBgmVolume(pickNumeric(data.bgmVolume, 80, 0, 100))
    setTargetLang(pickOption(data.targetLang, TARGET_LANG_OPTIONS, 'English'))
    setStylePreset(pickOption(data.stylePreset, STYLE_PRESET_OPTIONS, 'cinematic'))
    setStyleModel(pickOption(data.styleModel, STYLE_MODEL_OPTIONS, 'luma-dream'))
    setVfxType(pickOption(data.vfxType, VFX_TYPE_OPTIONS, 'magic-particles'))
    setVfxIntensity(pickNumeric(data.vfxIntensity, 0.8, 0.1, 1))
  }, [current?.id, current?.data])
  const clipDuration = current
    ? Math.max(0, Number(current.end ?? 0) - Number(current.start ?? 0))
    : 0
  const clipWindow = current
    ? `${formatTimelineValue(current.start)} - ${formatTimelineValue(current.end)}`
    : '--:--'
  const currentStateLabel = isProcessing ? '处理中' : current ? '在线值守' : '待接管'
  const currentStateNote = isProcessing
    ? '已有动作正在执行'
    : current
      ? '参数与上下文已锁定'
      : '等待时间轴选中片段'

  const idleContextReadoutsByMode: Record<ShellMode, InspectorReadoutItem[]> = {
    edit: [
      {
        label: '工位',
        value: activeTab === 'lab' ? '系统值守' : '属性位',
        note: activeTab === 'lab' ? shellMeta.labStatus : '片段工位',
        tone: activeTab === 'lab' ? 'signal' : 'accent'
      },
      {
        label: '素材上下文',
        value: '待绑定',
        note: '尚未选中片段',
        tone: 'muted'
      },
      {
        label: '时间窗',
        value: '--:--',
        note: '等待片段进入',
        tone: 'muted'
      },
      {
        label: '下一动作',
        value: '选中片段',
        note: '先让当前片段接管右侧工位',
        tone: 'accent'
      }
    ],
    color: [
      {
        label: '当前工位',
        value: activeTab === 'lab' ? '实验值守' : '实验总控',
        note: activeTab === 'lab' ? shellMeta.labStatus : '四个阶段已可切换',
        tone: activeTab === 'lab' ? 'signal' : 'accent'
      },
      {
        label: '服务通道',
        value: '待路由',
        note: '进入实验室后绑定当前实验通道',
        tone: 'muted'
      },
      {
        label: '下一动作',
        value: '切到实验室',
        note: '选择当前阶段并接入素材',
        tone: 'accent'
      },
      {
        label: '告警',
        value: '无活跃上下文',
        note: '未发现实验任务接管',
        tone: 'muted'
      }
    ],
    audio: [
      {
        label: '输入源',
        value: '待导入',
        note: '导入素材后建立母带会话',
        tone: 'muted'
      },
      {
        label: '母带总线',
        value: activeTab === 'lab' ? '值守中' : '待命',
        note: activeTab === 'lab' ? shellMeta.labStatus : '等待输入接管',
        tone: activeTab === 'lab' ? 'signal' : 'accent'
      },
      {
        label: '交付状态',
        value: '待校验',
        note: '响度与导出前检查尚未开始',
        tone: 'muted'
      },
      {
        label: '下一动作',
        value: '导入 / 对照',
        note: '先导入素材，再决定是否进入实验室',
        tone: 'accent'
      }
    ]
  }

  const contextReadouts: InspectorReadoutItem[] = current
    ? [
        {
          label: '工位',
          value: activeTab === 'lab' ? '值守台' : '属性位',
          note: activeTab === 'lab' ? shellMeta.labStatus : '片段工位',
          tone: activeTab === 'lab' ? 'signal' : 'accent'
        },
        {
          label: '轨道',
          value: currentTrack?.name || '待绑定',
          note: currentTrack ? `绑定 ${currentTrack.id}` : '未发现有效上下文',
          tone: currentTrack ? 'live' : 'muted'
        },
        {
          label: '时间窗',
          value: clipWindow,
          note: `时长 ${formatDurationValue(clipDuration)}`,
          tone: 'live'
        },
        {
          label: '状态',
          value: currentStateLabel,
          note: currentStateNote,
          tone: isProcessing ? 'hot' : 'live'
        }
      ]
    : idleContextReadoutsByMode[shellMode]

  const propertyReadouts: InspectorReadoutItem[] = [
    {
      label: '片段类型',
      value: resolveClipTypeLabel(current?.type),
      note: current ? `ID ${current.id}` : '无活跃片段',
      tone: 'accent'
    },
    {
      label: '挂载轨道',
      value: currentTrack?.name || '未分配',
      note: currentTrack ? currentTrack.id : '等待绑定',
      tone: currentTrack ? 'signal' : 'muted'
    },
    {
      label: '值守窗口',
      value: clipWindow,
      note: current ? '当前上下文时间范围' : '待接管',
      tone: current ? 'live' : 'muted'
    },
    {
      label: '当前焦点',
      value: resolveClipFocusLabel(current),
      note: current ? '主控面板已同步切换' : '选中片段后自动刷新',
      tone: current ? 'accent' : 'muted'
    }
  ]

  const idleStepsByMode: Record<ShellMode, InspectorStepItem[]> = {
    edit: [
      {
        index: '01',
        title: '先导入素材或选中片段',
        detail: '右栏会立即绑定轨道、时间窗与片段类型。'
      },
      {
        index: '02',
        title: '再进入属性位或系统值守',
        detail: shellMeta.idleAction
      }
    ],
    color: [
      {
        index: '01',
        title: '先切到实验室选择当前工位',
        detail: '从比对、治理、创意或协作里选定这轮实验的主工位。'
      },
      {
        index: '02',
        title: '接入素材或通道后回到右栏值守',
        detail: shellMeta.idleAction
      }
    ],
    audio: [
      {
        index: '01',
        title: '先导入素材并建立母带会话',
        detail: '输入接入后，右栏会开始绑定母带总线与交付状态。'
      },
      {
        index: '02',
        title: '再盯输入、总线与交付检查',
        detail: shellMeta.idleAction
      }
    ]
  }

  const emptyCardTitle =
    shellMode === 'edit'
      ? '先把当前片段接进工位'
      : shellMode === 'color'
        ? '先让实验工位接管上下文'
        : '先建立母带会话'

  return (
    <div className="pro-inspector-inner" data-active-tab={activeTab}>
      <header className="inspector-header">
        <div className="inspector-header-meta">
          <span className="inspector-header-badge" aria-hidden="true">
            <svg viewBox="0 0 20 20" focusable="false">
              <path
                d="M4 5.5h12M4 10h12M4 14.5h8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
              <circle cx="14.5" cy="14.5" r="1.7" fill="currentColor" />
            </svg>
          </span>
          <div className="inspector-header-copy">
            <span className="inspector-header-kicker">右侧面板</span>
            <strong className="inspector-header-title">属性与值守</strong>
          </div>
        </div>

        <div className="inspector-tabs" aria-label="值守台视图切换">
          <button
            type="button"
            aria-pressed={activeTab === 'properties'}
            className={activeTab === 'properties' ? 'active' : ''}
            onClick={() => setActiveTab('properties')}
          >
            <span>属性位</span>
            <small>当前片段</small>
          </button>
          <button
            type="button"
            aria-pressed={activeTab === 'lab'}
            className={activeTab === 'lab' ? 'active' : ''}
            onClick={() => setActiveTab('lab')}
          >
            <span>系统监控</span>
            <small>监控摘要</small>
          </button>
        </div>

        <div className="inspector-header-state">
          <span
            className={`inspector-status-dot ${isProcessing ? 'is-busy' : current ? 'is-live' : ''}`}
            aria-hidden="true"
          />
          <span className="clip-type-badge">{resolveClipTypeLabel(current?.type)}</span>
        </div>
      </header>

      <div className="inspector-context-bar">
        <div className="inspector-context-copy">
          <span className="inspector-context-kicker">
            {activeTab === 'lab' ? '系统监控 / 右侧摘要' : '当前上下文 / 片段属性'}
          </span>
          {activeTab !== 'lab' ? (
            <span hidden aria-hidden="true">
              clip forge / active context
            </span>
          ) : null}
          <strong className="inspector-context-title">
            {current
              ? current.name
              : activeTab === 'lab'
                ? shellMeta.labTitle
                : shellMeta.idleTitle}
          </strong>
          <span className="inspector-context-subtitle">
            {activeTab === 'lab' ? shellMeta.labSubtitle : shellMeta.idleSubtitle}
          </span>
          <div className="inspector-context-pills">
            <span className="inspector-context-pill">{resolveClipTypeLabel(current?.type)}</span>
            <span className={`inspector-context-pill ${activeTab === 'lab' ? 'is-live' : ''}`}>
              {activeTab === 'lab' ? shellMeta.labStatus : current ? '已绑定' : '待命'}
            </span>
          </div>
        </div>

        <div className="inspector-context-readouts">
          {contextReadouts.map((item) => (
            <div
              key={item.label}
              className={`inspector-readout-card ${item.tone ? `tone-${item.tone}` : ''}`}
            >
              <span className="inspector-readout-label">{item.label}</span>
              <strong className="inspector-readout-value">{item.value}</strong>
              <span className="inspector-readout-note">{item.note}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="inspector-body">
        {isProcessing ? (
          <div className="inspector-activity-banner" role="status" aria-live="polite">
            <strong>炼金处理中</strong>
            <span>正在执行上一轮任务；你仍可继续调整下一轮参数，结果会在完成后回写右栏。</span>
          </div>
        ) : null}
        {activeTab === 'lab' ? (
          <div className="inspector-lab-shell">
            <div className="inspector-lab-banner">
              <div className="inspector-lab-banner-copy">
                <span className="inspector-lab-banner-kicker">系统联动</span>
                <strong>{shellMeta.labTitle}</strong>
                <span>
                  {labSurface === 'watch'
                    ? '中央监控台已经展开，右席只保留系统监控摘要与状态提示。'
                    : shellMeta.labSubtitle}
                </span>
              </div>
              <div className="inspector-lab-banner-status">
                <span>值守对象</span>
                <strong>{current ? current.name : '无活跃片段'}</strong>
                <small>{currentTrack?.name || shellMeta.labStatus}</small>
              </div>
            </div>

            <div className="inspector-lab-panel">
              {labSurface === 'watch' ? (
                <div className="inspector-lab-stage-bridge">
                  <div className="inspector-lab-stage-bridge-copy">
                    <span className="inspector-lab-stage-bridge-kicker">中央监控已展开</span>
                    <strong>当前视图已切到系统监控总控</strong>
                    <p>右侧保留系统监控摘要，中央舞台正在承接完整监控、治理与数据库动作。</p>
                  </div>
                  <div className="inspector-lab-stage-bridge-actions">
                    <button type="button" className="pro-master-btn" onClick={onReturnToLabStage}>
                      返回系统监控摘要
                    </button>
                    <button
                      type="button"
                      className="inspector-secondary-btn"
                      onClick={onOpenWatchStage}
                    >
                      保持监控展开
                    </button>
                  </div>
                </div>
              ) : (
                <TelemetryDashboard
                  variant="summary"
                  shellMode={shellMode}
                  onOpenStage={onOpenWatchStage}
                />
              )}
            </div>
          </div>
        ) : !current ? (
          <div className="inspector-empty">
            <div className="inspector-empty-copy">
              <span className="inspector-empty-kicker">属性面板待命</span>
              <strong>{emptyCardTitle}</strong>
              <p>{shellMeta.idleSubtitle}</p>
            </div>

            <div className="inspector-empty-steps">
              {idleStepsByMode[shellMode].map((step) => (
                <div key={step.index} className="inspector-empty-step">
                  <span>{step.index}</span>
                  <strong>{step.title}</strong>
                  <small>{step.detail}</small>
                </div>
              ))}
            </div>

            <div className="inspector-empty-footer">
              <button type="button" className="pro-master-btn" onClick={() => setActiveTab('lab')}>
                切到系统监控
              </button>
              <small>没有片段上下文时，值守台会优先显示空态引导而不是平铺控件。</small>
            </div>
          </div>
        ) : (
          <div className="pro-inspector-content">
            <section className="inspector-section inspector-section--hero">
              <div className="inspector-panel-heading">
                <span className="inspector-panel-kicker">当前片段</span>
                <strong>主控面板已接管当前片段</strong>
                <p>{resolveClipStationSummary(current, currentTrack?.name || null)}</p>
              </div>

              <div className="inspector-readout-grid">
                {propertyReadouts.map((item) => (
                  <div
                    key={item.label}
                    className={`inspector-readout-card ${item.tone ? `tone-${item.tone}` : ''}`}
                  >
                    <span className="inspector-readout-label">{item.label}</span>
                    <strong className="inspector-readout-value">{item.value}</strong>
                    <span className="inspector-readout-note">{item.note}</span>
                  </div>
                ))}
              </div>

              <div className="inspector-field-stack">
                <label>片段名称</label>
                <input
                  name="clipName"
                  type="text"
                  value={current.name}
                  onChange={(event) => handleUpdate({ name: event.target.value })}
                  className="pro-input-mini"
                />
              </div>

              <div className="inspector-command-board">
                <button
                  type="button"
                  className="alchemy-mini-btn"
                  onClick={() => handleAlchemy('repair')}
                >
                  画面修复
                </button>
                <button
                  type="button"
                  className="alchemy-mini-btn"
                  onClick={() => handleAlchemy('style')}
                >
                  风格迁移
                </button>
                <button
                  type="button"
                  className="alchemy-mini-btn"
                  onClick={() => handleAlchemy('lip')}
                >
                  口型同步
                </button>
                <button
                  type="button"
                  className="alchemy-mini-btn"
                  onClick={() => handleAlchemy('enhance')}
                >
                  画质增强
                </button>
              </div>
            </section>

            {current.type === 'video' && (
              <section className="inspector-section inspector-section--support">
                <div className="inspector-panel-heading inspector-panel-heading--compact">
                  <span className="inspector-panel-kicker">风格与特效</span>
                  <strong>风格与特效总线</strong>
                  <p>把风格路由、渲染模型和神经特效集中到一个值守面板里，避免平铺切换。</p>
                </div>

                <div className="inspector-dual-grid">
                  <div className="inspector-field-stack">
                    <label>风格预设</label>
                    <select
                      name="stylePreset"
                      className="pro-select-mini"
                      value={stylePreset}
                      onChange={(event) => {
                        const value = event.target.value as 'cinematic' | 'van_gogh' | 'cyberpunk'
                        setStylePreset(value)
                        handleDataUpdate({ stylePreset: value })
                      }}
                    >
                      <option value="cinematic">Cinematic</option>
                      <option value="van_gogh">Van Gogh</option>
                      <option value="cyberpunk">Cyberpunk</option>
                    </select>
                  </div>

                  <div className="inspector-field-stack">
                    <label>渲染模型</label>
                    <select
                      name="styleModel"
                      className="pro-select-mini"
                      value={styleModel}
                      onChange={(event) => {
                        const value = event.target.value as 'luma-dream' | 'kling-v1' | 'veo-3.1'
                        setStyleModel(value)
                        handleDataUpdate({ styleModel: value })
                      }}
                    >
                      <option value="luma-dream">Luma</option>
                      <option value="kling-v1">Kling</option>
                      <option value="veo-3.1">Veo</option>
                    </select>
                  </div>

                  <div className="inspector-field-stack">
                    <label>神经特效</label>
                    <select
                      name="vfxType"
                      className="pro-select-mini"
                      value={vfxType}
                      onChange={(event) => {
                        const value = event.target.value as
                          | 'magic-particles'
                          | 'cyber-glitch'
                          | 'neon-bloom'
                        setVfxType(value)
                        handleDataUpdate({ vfxType: value })
                      }}
                    >
                      <option value="magic-particles">Magic Particles</option>
                      <option value="cyber-glitch">Cyber Glitch</option>
                      <option value="neon-bloom">Neon Bloom</option>
                    </select>
                  </div>

                  <div className="inspector-field-stack">
                    <label>特效强度</label>
                    <div className="inspector-range-row">
                      <span>{vfxIntensity.toFixed(1)}</span>
                      <input
                        name="vfxIntensity"
                        type="range"
                        min={0.1}
                        max={1}
                        step={0.1}
                        value={vfxIntensity}
                        onChange={(event) => {
                          const value = Number(event.target.value)
                          setVfxIntensity(value)
                          handleDataUpdate({ vfxIntensity: value })
                        }}
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="pro-master-btn"
                  onClick={() => handleAlchemy('vfx')}
                  disabled={isProcessing}
                >
                  {isProcessing ? '特效处理中...' : '应用特效层'}
                </button>
              </section>
            )}

            {current.type === 'video' && (
              <section className="inspector-section inspector-section--support">
                <div className="inspector-panel-heading inspector-panel-heading--compact">
                  <span className="inspector-panel-kicker">一致性 / 演员</span>
                  <strong>一致性与演员绑定</strong>
                  <p>把 world-link、演员绑定和口型同步收拢为同一条上下文链路。</p>
                </div>

                <div className="inspector-dual-grid">
                  <div className="inspector-toggle-card">
                    <span className="inspector-toggle-title">World-Link</span>
                    <label className="inspector-check-row">
                      <input
                        name="worldLinkEnabled"
                        type="checkbox"
                        checked={Boolean(current.data?.worldLink)}
                        onChange={(event) => handleDataUpdate({ worldLink: event.target.checked })}
                      />
                      <span>启用 World-Link</span>
                    </label>
                  </div>

                  <div className="inspector-field-stack">
                    <label>World ID</label>
                    <input
                      name="worldId"
                      type="text"
                      className="pro-input-mini"
                      placeholder="world-id，例如 w-abc123"
                      value={current.data?.worldId || ''}
                      onChange={(event) => handleDataUpdate({ worldId: event.target.value })}
                    />
                  </div>

                  <div className="inspector-field-stack">
                    <label>虚拟演员</label>
                    <select
                      name="actorId"
                      className="pro-select-mini"
                      value={current.data?.actorId || ''}
                      onChange={(event) => handleDataUpdate({ actorId: event.target.value })}
                    >
                      <option value="">不绑定演员</option>
                      {actors.map((actor) => (
                        <option key={actor.id} value={actor.id}>
                          {actor.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="inspector-field-stack">
                    <label>一致性强度</label>
                    <select
                      name="consistencyStrength"
                      className="pro-select-mini"
                      value={String(current.data?.consistencyStrength ?? 1)}
                      onChange={(event) =>
                        handleDataUpdate({ consistencyStrength: Number(event.target.value) })
                      }
                    >
                      <option value="0.6">一致性 0.6</option>
                      <option value="0.8">一致性 0.8</option>
                      <option value="1">一致性 1.0</option>
                    </select>
                  </div>
                </div>

                <label className="inspector-check-row inspector-check-row--wide">
                  <input
                    name="syncLip"
                    type="checkbox"
                    checked={Boolean(current.data?.syncLip)}
                    onChange={(event) => handleDataUpdate({ syncLip: event.target.checked })}
                  />
                  <span>启用口型同步</span>
                </label>
              </section>
            )}

            {current.type === 'video' && (
              <section className="inspector-section inspector-section--focus">
                <div className="inspector-panel-heading inspector-panel-heading--compact">
                  <span className="inspector-panel-kicker">空间渲染</span>
                  <strong>空间 3D 控制</strong>
                  <p>作为主控位的重型动作保留单独区块，避免被普通属性卡片稀释。</p>
                </div>

                <div className="inspector-range-row">
                  <span>水平轴 {spatialX}</span>
                  <input
                    name="spatialX"
                    type="range"
                    min={-100}
                    max={100}
                    value={spatialX}
                    onChange={(event) => {
                      const value = parseInt(event.target.value, 10)
                      setSpatialX(value)
                      handleDataUpdate({ spatialX: value })
                    }}
                  />
                </div>

                <button
                  type="button"
                  className="pro-master-btn"
                  onClick={async () => {
                    setIsProcessing(true)
                    try {
                      const data = await callAuthJson<{
                        status?: string
                        message?: string
                        success?: boolean
                      }>('/api/ai/spatial/render', {
                        clipId: current.id
                      })
                      if (data?.status === 'not_implemented') {
                        showToast(data.message || '3D 重构服务未配置', 'warning')
                      } else if (data?.success) {
                        showToast('✨ 3D 重构完成', 'success')
                      } else {
                        showToast('3D 重构执行失败', 'error')
                      }
                    } catch (error: unknown) {
                      showToast(resolveErrorMessage(error, '3D 重构失败'), 'error')
                    } finally {
                      setIsProcessing(false)
                    }
                  }}
                  disabled={isProcessing}
                >
                  {isProcessing ? '正在重构...' : '执行 NeRF 3D 渲染'}
                </button>
              </section>
            )}

            {current.type === 'text' && (
              <section className="inspector-section inspector-section--support">
                <div className="inspector-panel-heading inspector-panel-heading--compact">
                  <span className="inspector-panel-kicker">文稿处理</span>
                  <strong>TTS 与翻译总线</strong>
                  <p>把文稿编辑、配音触发和翻译克隆压缩进同一工作带。</p>
                </div>

                <div className="inspector-field-stack">
                  <label>文稿内容</label>
                  <textarea
                    name="ttsContent"
                    value={current.data?.content || ''}
                    onChange={(event) => handleDataUpdate({ content: event.target.value })}
                    className="pro-textarea-mini"
                  />
                </div>

                <div className="inspector-dual-grid">
                  <div className="inspector-field-stack">
                    <label>TTS 声线</label>
                    <select name="ttsVoice" className="pro-select-mini">
                      <option>自然男声 (中文)</option>
                      <option>甜美女声 (中文)</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    className="alchemy-mini-btn"
                    onClick={() => handleAlchemy('tts')}
                  >
                    生成配音
                  </button>

                  <div className="inspector-field-stack">
                    <label>翻译目标</label>
                    <select
                      name="textTargetLang"
                      className="pro-select-mini"
                      value={targetLang}
                      onChange={(event) => {
                        const value = event.target.value as 'English' | 'Japanese'
                        setTargetLang(value)
                        handleDataUpdate({ targetLang: value })
                      }}
                    >
                      <option value="English">翻译为英文</option>
                      <option value="Japanese">翻译为日文</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    className="alchemy-mini-btn"
                    onClick={handleTranslateAndClone}
                    disabled={isProcessing}
                  >
                    {isProcessing ? '翻译中...' : '翻译并克隆'}
                  </button>
                </div>
              </section>
            )}

            {current.type === 'audio' && (
              <section className="inspector-section inspector-section--support">
                <div className="inspector-panel-heading inspector-panel-heading--compact">
                  <span className="inspector-panel-kicker">音频翻译</span>
                  <strong>音频翻译总线</strong>
                  <p>值守台会保留当前音频上下文，直接在这里做语言切换与克隆输出。</p>
                </div>

                <div className="inspector-dual-grid">
                  <div className="inspector-field-stack">
                    <label>翻译目标</label>
                    <select
                      name="audioTargetLang"
                      className="pro-select-mini"
                      value={targetLang}
                      onChange={(event) => {
                        const value = event.target.value as 'English' | 'Japanese'
                        setTargetLang(value)
                        handleDataUpdate({ targetLang: value })
                      }}
                    >
                      <option value="English">翻译为英文</option>
                      <option value="Japanese">翻译为日文</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    className="alchemy-mini-btn"
                    onClick={handleTranslateAndClone}
                    disabled={isProcessing}
                  >
                    {isProcessing ? '翻译中...' : '翻译并克隆'}
                  </button>
                </div>
              </section>
            )}

            <section className="inspector-section inspector-section--support">
              <div className="inspector-panel-heading inspector-panel-heading--compact">
                <span className="inspector-panel-kicker">辅助监听</span>
                <strong>辅助监听</strong>
                <p>保留音频辅助，但改为底部值守总线，避免与主控区抢层级。</p>
              </div>

              <div className="inspector-range-row">
                <span>BGM 匹配 {bgmVolume}</span>
                <input
                  name="bgmVolume"
                  type="range"
                  min={0}
                  max={100}
                  value={bgmVolume}
                  onChange={(event) => {
                    const value = parseInt(event.target.value, 10)
                    setBgmVolume(value)
                    handleDataUpdate({ bgmVolume: value })
                  }}
                />
              </div>

              <button
                type="button"
                className="alchemy-mini-btn"
                onClick={() => handleAlchemy('audio')}
              >
                节奏感应分析
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

export default PropertyInspector
