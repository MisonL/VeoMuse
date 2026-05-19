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

interface PropertyInspectorProps {
  shellMode?: ShellMode
  onOpenWatchStage?: () => void
}

const PropertyInspector: React.FC<PropertyInspectorProps> = ({
  shellMode = 'edit',
  onOpenWatchStage
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
    showToast(`正在执行高级炼金: ${type}`, 'info')

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

  return (
    <div className="pro-inspector-inner property-inspector" data-active-tab={activeTab}>
      <header className="inspector-header-compact">
        <div className="inspector-tabs-lite">
          <button
            type="button"
            className={activeTab === 'properties' ? 'active' : ''}
            aria-pressed={activeTab === 'properties'}
            onClick={() => setActiveTab('properties')}
          >
            属性
          </button>
          <button
            type="button"
            className={activeTab === 'lab' ? 'active' : ''}
            aria-pressed={activeTab === 'lab'}
            onClick={() => setActiveTab('lab')}
          >
            监控
          </button>
        </div>
        <div className="inspector-header-status">
          {current ? (
            <span className="badge-live">在线</span>
          ) : (
            <span className="badge-idle">待命</span>
          )}
        </div>
      </header>

      <div className="inspector-body-refined">
        {activeTab === 'lab' ? (
          <div className="inspector-lab-lite">
            <TelemetryDashboard
              variant="summary"
              shellMode={shellMode}
              onOpenStage={onOpenWatchStage}
            />
          </div>
        ) : !current ? (
          <div
            className="inspector-empty-lite inspector-console-empty"
            data-testid="inspector-console-empty"
            data-visual-system="nebula-flow"
          >
            <div className="empty-hint">
              <span className="inspector-console-kicker">Inspector Console</span>
              <strong>未选中轨道片段</strong>
              <p>从时间轴选择镜头后，在这里校准风格、修复与交付参数。</p>
              <div className="inspector-console-spine" aria-label="属性检查链路">
                <span>Inspect</span>
                <span>Tune</span>
                <span>Render</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="pro-inspector-content-refined">
            <section className="inspector-section-lite">
              <div className="section-head">
                <span className="kicker">基础属性</span>
                <strong>{current.name}</strong>
              </div>

              <div className="inspector-grid-lite">
                <div className="readout-lite">
                  <span className="label">类型</span>
                  <strong className="value">{resolveClipTypeLabel(current.type)}</strong>
                </div>
                <div className="readout-lite">
                  <span className="label">时长</span>
                  <strong className="value">{formatDurationValue(clipDuration)}</strong>
                </div>
              </div>

              <div className="field-group-lite">
                <label>片段重命名</label>
                <input
                  type="text"
                  value={current.name}
                  onChange={(event) => handleUpdate({ name: event.target.value })}
                  className="pro-input-refined"
                />
              </div>

              <div className="quick-actions-refined">
                <button onClick={() => handleAlchemy('repair')}>修复</button>
                <button onClick={() => handleAlchemy('enhance')}>增强</button>
                <button onClick={() => handleAlchemy('lip')}>口型同步</button>
              </div>
            </section>

            {current.type === 'video' && (
              <section className="inspector-section-lite">
                <div className="section-head">
                  <span className="kicker">视觉炼金</span>
                  <strong>风格与模型</strong>
                </div>

                <div className="field-grid-lite">
                  <div className="field-item">
                    <label>预设风格</label>
                    <select
                      value={stylePreset}
                      onChange={(event) => {
                        const value = event.target.value as (typeof STYLE_PRESET_OPTIONS)[number]
                        setStylePreset(value)
                        handleDataUpdate({ stylePreset: value })
                      }}
                    >
                      <option value="cinematic">电影感</option>
                      <option value="cyberpunk">赛博朋克</option>
                      <option value="van_gogh">梵高</option>
                    </select>
                  </div>
                  <div className="field-item">
                    <label>渲染引擎</label>
                    <select
                      value={styleModel}
                      onChange={(event) => {
                        const value = event.target.value as (typeof STYLE_MODEL_OPTIONS)[number]
                        setStyleModel(value)
                        handleDataUpdate({ styleModel: value })
                      }}
                    >
                      <option value="luma-dream">Luma Dream</option>
                      <option value="kling-v1">Kling V1</option>
                      <option value="veo-3.1">Veo 3.1</option>
                    </select>
                  </div>
                  <div className="field-item">
                    <label>特效类型</label>
                    <select
                      value={vfxType}
                      onChange={(event) => {
                        const value = event.target.value as (typeof VFX_TYPE_OPTIONS)[number]
                        setVfxType(value)
                        handleDataUpdate({ vfxType: value })
                      }}
                    >
                      <option value="magic-particles">粒子</option>
                      <option value="cyber-glitch">故障</option>
                      <option value="neon-bloom">霓虹</option>
                    </select>
                  </div>
                  <div className="field-item field-item--range">
                    <label>特效强度</label>
                    <div className="range-inline">
                      <input
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
                      <span>{vfxIntensity.toFixed(1)}</span>
                    </div>
                  </div>
                </div>

                <button
                  className="pro-btn-primary"
                  onClick={() => handleAlchemy('vfx')}
                  disabled={isProcessing}
                >
                  {isProcessing ? '处理中...' : '应用高级特效'}
                </button>
              </section>
            )}

            {current.type === 'video' && (
              <section className="inspector-section-lite">
                <div className="section-head">
                  <span className="kicker">一致性</span>
                  <strong>角色与世界设定</strong>
                </div>
                <div className="field-grid-lite">
                  <div className="field-item field-item--checkbox">
                    <label>World-Link</label>
                    <label className="toggle-chip">
                      <input
                        type="checkbox"
                        checked={Boolean(current.data?.worldLink)}
                        onChange={(event) => handleDataUpdate({ worldLink: event.target.checked })}
                      />
                      <span>启用世界上下文</span>
                    </label>
                  </div>
                  <div className="field-item">
                    <label>World ID</label>
                    <input
                      type="text"
                      value={String(current.data?.worldId || '')}
                      onChange={(event) => handleDataUpdate({ worldId: event.target.value })}
                      className="pro-input-refined"
                      placeholder="w-abc123"
                    />
                  </div>
                  <div className="field-item">
                    <label>虚拟演员</label>
                    <select
                      value={String(current.data?.actorId || '')}
                      onChange={(event) => handleDataUpdate({ actorId: event.target.value })}
                    >
                      <option value="">不绑定</option>
                      {actors.map((actor) => (
                        <option key={actor.id} value={actor.id}>
                          {actor.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field-item">
                    <label>一致性强度</label>
                    <select
                      value={String(current.data?.consistencyStrength ?? 1)}
                      onChange={(event) =>
                        handleDataUpdate({ consistencyStrength: Number(event.target.value) })
                      }
                    >
                      <option value="0.6">0.6</option>
                      <option value="0.8">0.8</option>
                      <option value="1">1.0</option>
                    </select>
                  </div>
                </div>
                <label className="toggle-chip toggle-chip--wide">
                  <input
                    type="checkbox"
                    checked={Boolean(current.data?.syncLip)}
                    onChange={(event) => handleDataUpdate({ syncLip: event.target.checked })}
                  />
                  <span>启用口型同步约束</span>
                </label>
              </section>
            )}

            {current.type === 'video' && (
              <section className="inspector-section-lite">
                <div className="section-head">
                  <span className="kicker">空间渲染</span>
                  <strong>3D 景深与机位</strong>
                </div>
                <div className="field-item field-item--range">
                  <label>水平轴</label>
                  <div className="range-inline">
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      value={spatialX}
                      onChange={(event) => {
                        const value = Number.parseInt(event.target.value, 10)
                        setSpatialX(value)
                        handleDataUpdate({ spatialX: value })
                      }}
                    />
                    <span>{spatialX}</span>
                  </div>
                </div>
                <button
                  className="pro-btn-primary"
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
                        showToast('3D 重构完成', 'success')
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
                  {isProcessing ? '处理中...' : '执行 3D 重构'}
                </button>
              </section>
            )}

            {current.type === 'text' && (
              <section className="inspector-section-lite">
                <div className="section-head">
                  <span className="kicker">文稿处理</span>
                  <strong>AI 语音合成</strong>
                </div>
                <div className="field-group-lite">
                  <textarea
                    value={current.data?.content || ''}
                    onChange={(event) => handleDataUpdate({ content: event.target.value })}
                    className="pro-textarea-refined"
                  />
                </div>
                <div className="field-grid-lite">
                  <div className="field-item">
                    <label>翻译目标</label>
                    <select
                      value={targetLang}
                      onChange={(event) => {
                        const value = event.target.value as (typeof TARGET_LANG_OPTIONS)[number]
                        setTargetLang(value)
                        handleDataUpdate({ targetLang: value })
                      }}
                    >
                      <option value="English">英文</option>
                      <option value="Japanese">日文</option>
                    </select>
                  </div>
                </div>
                <div className="action-row-lite">
                  <button className="pro-btn-primary" onClick={() => handleAlchemy('tts')}>
                    生成配音
                  </button>
                  <button
                    className="pro-btn-secondary"
                    onClick={handleTranslateAndClone}
                    disabled={isProcessing}
                  >
                    {isProcessing ? '翻译中...' : '翻译并克隆'}
                  </button>
                </div>
              </section>
            )}

            {current.type === 'audio' && (
              <section className="inspector-section-lite">
                <div className="section-head">
                  <span className="kicker">音频处理</span>
                  <strong>翻译与节奏分析</strong>
                </div>
                <div className="field-grid-lite">
                  <div className="field-item">
                    <label>翻译目标</label>
                    <select
                      value={targetLang}
                      onChange={(event) => {
                        const value = event.target.value as (typeof TARGET_LANG_OPTIONS)[number]
                        setTargetLang(value)
                        handleDataUpdate({ targetLang: value })
                      }}
                    >
                      <option value="English">英文</option>
                      <option value="Japanese">日文</option>
                    </select>
                  </div>
                </div>
                <div className="action-row-lite">
                  <button
                    className="pro-btn-primary"
                    onClick={handleTranslateAndClone}
                    disabled={isProcessing}
                  >
                    {isProcessing ? '翻译中...' : '翻译并克隆'}
                  </button>
                  <button className="pro-btn-secondary" onClick={() => handleAlchemy('audio')}>
                    节奏感应分析
                  </button>
                </div>
              </section>
            )}

            <section className="inspector-section-lite">
              <div className="section-head">
                <span className="kicker">辅助监听</span>
                <strong>背景与节奏参考</strong>
              </div>
              <div className="field-item field-item--range">
                <label>BGM 匹配</label>
                <div className="range-inline">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={bgmVolume}
                    onChange={(event) => {
                      const value = Number.parseInt(event.target.value, 10)
                      setBgmVolume(value)
                      handleDataUpdate({ bgmVolume: value })
                    }}
                  />
                  <span>{bgmVolume}</span>
                </div>
              </div>
              {current.type !== 'audio' ? (
                <button className="pro-btn-secondary" onClick={() => handleAlchemy('audio')}>
                  节奏感应分析
                </button>
              ) : null}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

export default PropertyInspector
