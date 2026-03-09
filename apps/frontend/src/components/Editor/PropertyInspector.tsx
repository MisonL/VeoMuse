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

type ShellMode = 'edit' | 'color' | 'audio'

interface PropertyInspectorProps {
  shellMode?: ShellMode
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
    labTitle: '系统监控正在值守',
    labSubtitle: '运行态、告警与治理记录会在当前侧栏持续值守显示。',
    labStatus: 'Ops Only'
  },
  color: {
    idleTitle: '实验上下文待接管',
    idleSubtitle: '实验策略、比对判断与协作动作将围绕当前实验阶段集中显示。',
    idleAction: '上方实验室选中当前阶段后，可在这里查看上下文、切换监控并承接后续动作。',
    labTitle: '实验监控与策略值守',
    labSubtitle: 'Provider 健康、治理信号与实验告警会围绕当前实验阶段持续更新。',
    labStatus: 'Lab Watch'
  },
  audio: {
    idleTitle: '母带工位待命',
    idleSubtitle: '旁白、音乐、响度与导出前校验会在这里绑定到当前母带会话。',
    idleAction: '导入素材并进入母带流程后，可在这里查看当前输入、调参并切换到系统监控。',
    labTitle: '母带监控与交付值守',
    labSubtitle: '输入健康、总线状态与交付前检查会围绕当前母带会话持续显示。',
    labStatus: 'Mastering Ops'
  }
}

const PropertyInspector: React.FC<PropertyInspectorProps> = ({ shellMode = 'edit' }) => {
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

  // 模拟参数状态
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

  // 物理集成：全量炼金术调用
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

  return (
    <div className="pro-inspector-inner" data-active-tab={activeTab}>
      <header className="inspector-header">
        <div className="inspector-tabs">
          <button
            className={activeTab === 'properties' ? 'active' : ''}
            onClick={() => setActiveTab('properties')}
          >
            片段属性
          </button>
          <button
            className={activeTab === 'lab' ? 'active' : ''}
            onClick={() => setActiveTab('lab')}
          >
            系统监控
          </button>
        </div>
        {current && <span className="clip-type-badge">{current.type}</span>}
      </header>

      <div className="inspector-context-bar">
        <div className="inspector-context-copy">
          <span className="inspector-context-kicker">
            {activeTab === 'lab' ? 'ops watch / live audit' : 'clip forge / active context'}
          </span>
          <strong className="inspector-context-title">
            {current ? current.name : activeTab === 'lab' ? shellMeta.labTitle : shellMeta.idleTitle}
          </strong>
          <span className="inspector-context-subtitle">
            {activeTab === 'lab'
              ? shellMeta.labSubtitle
              : shellMeta.idleSubtitle}
          </span>
        </div>
        <div className="inspector-context-pills">
          <span className="inspector-context-pill">{current?.type || 'idle'}</span>
          <span className={`inspector-context-pill ${activeTab === 'lab' ? 'is-live' : ''}`}>
            {activeTab === 'lab' ? shellMeta.labStatus : 'clip live'}
          </span>
        </div>
      </div>

      <div className="inspector-body">
        {activeTab === 'lab' ? (
          <div className="inspector-lab-shell">
            <div className="inspector-lab-banner">
              <div className="inspector-lab-banner-copy">
                <span className="inspector-lab-banner-kicker">system room</span>
                <strong>{shellMeta.labTitle}</strong>
                <span>{shellMeta.labSubtitle}</span>
              </div>
              <div className="inspector-lab-banner-status">
                <span>{current ? current.name : '无活跃片段'}</span>
                <strong>{current ? 'Clip Context Bound' : shellMeta.labStatus}</strong>
              </div>
            </div>
            <TelemetryDashboard />
          </div>
        ) : !current ? (
          <div className="inspector-empty">
            <p>{shellMeta.idleTitle}</p>
            <small>{shellMeta.idleAction}</small>
            <button type="button" className="pro-master-btn" onClick={() => setActiveTab('lab')}>
              切到系统监控
            </button>
          </div>
        ) : (
          <div className="pro-inspector-content">
            <section className="inspector-section inspector-section--identity">
              <label>片段名称</label>
              <input
                name="clipName"
                type="text"
                value={current.name}
                onChange={(e) => handleUpdate({ name: e.target.value })}
                className="pro-input-mini"
              />
            </section>

            <section className="inspector-section inspector-section--hero">
              <label>媒体炼金术 (Alchemy)</label>
              <div className="alchemy-grid">
                <button className="alchemy-mini-btn" onClick={() => handleAlchemy('repair')}>
                  画面修复
                </button>
                <button className="alchemy-mini-btn" onClick={() => handleAlchemy('style')}>
                  风格迁移
                </button>
                <button className="alchemy-mini-btn" onClick={() => handleAlchemy('lip')}>
                  口型同步
                </button>
                <button className="alchemy-mini-btn" onClick={() => handleAlchemy('enhance')}>
                  画质增强
                </button>
              </div>
            </section>

            {current.type === 'video' && (
              <section className="inspector-section inspector-section--support">
                <label>风格重塑预设</label>
                <div className="pro-control-row mt-4">
                  <select
                    name="stylePreset"
                    className="pro-select-mini"
                    value={stylePreset}
                    onChange={(e) =>
                      setStylePreset(e.target.value as 'cinematic' | 'van_gogh' | 'cyberpunk')
                    }
                  >
                    <option value="cinematic">Cinematic</option>
                    <option value="van_gogh">Van Gogh</option>
                    <option value="cyberpunk">Cyberpunk</option>
                  </select>
                  <select
                    name="styleModel"
                    className="pro-select-mini"
                    value={styleModel}
                    onChange={(e) =>
                      setStyleModel(e.target.value as 'luma-dream' | 'kling-v1' | 'veo-3.1')
                    }
                  >
                    <option value="luma-dream">Luma</option>
                    <option value="kling-v1">Kling</option>
                    <option value="veo-3.1">Veo</option>
                  </select>
                </div>
              </section>
            )}

            {current.type === 'video' && (
              <section className="inspector-section inspector-section--support">
                <label>神经渲染特效</label>
                <div className="pro-control-row mt-4">
                  <select
                    name="vfxType"
                    className="pro-select-mini"
                    value={vfxType}
                    onChange={(e) =>
                      setVfxType(
                        e.target.value as 'magic-particles' | 'cyber-glitch' | 'neon-bloom'
                      )
                    }
                  >
                    <option value="magic-particles">Magic Particles</option>
                    <option value="cyber-glitch">Cyber Glitch</option>
                    <option value="neon-bloom">Neon Bloom</option>
                  </select>
                  <input
                    name="vfxIntensity"
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.1}
                    value={vfxIntensity}
                    onChange={(e) => setVfxIntensity(Number(e.target.value))}
                  />
                </div>
                <button
                  className="alchemy-mini-btn w-full"
                  onClick={() => handleAlchemy('vfx')}
                  disabled={isProcessing}
                >
                  {isProcessing ? '特效处理中...' : '应用特效层'}
                </button>
              </section>
            )}

            {current.type === 'video' && (
              <section className="inspector-section inspector-section--support">
                <label>World-Link 一致性</label>
                <div className="pro-control-row mt-4">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      name="worldLinkEnabled"
                      type="checkbox"
                      checked={Boolean(current.data?.worldLink)}
                      onChange={(e) => handleDataUpdate({ worldLink: e.target.checked })}
                    />
                    <span>启用 world_link</span>
                  </label>
                </div>
                <input
                  name="worldId"
                  type="text"
                  className="pro-input-mini"
                  placeholder="world-id，例如 w-abc123"
                  value={current.data?.worldId || ''}
                  onChange={(e) => handleDataUpdate({ worldId: e.target.value })}
                />
              </section>
            )}

            {current.type === 'video' && (
              <section className="inspector-section inspector-section--support">
                <label>虚拟演员与口型同步</label>
                <div className="pro-control-row mt-4">
                  <select
                    name="actorId"
                    className="pro-select-mini"
                    value={current.data?.actorId || ''}
                    onChange={(e) => handleDataUpdate({ actorId: e.target.value })}
                  >
                    <option value="">不绑定演员</option>
                    {actors.map((actor) => (
                      <option key={actor.id} value={actor.id}>
                        {actor.name}
                      </option>
                    ))}
                  </select>
                  <select
                    name="consistencyStrength"
                    className="pro-select-mini"
                    value={String(current.data?.consistencyStrength ?? 1)}
                    onChange={(e) =>
                      handleDataUpdate({ consistencyStrength: Number(e.target.value) })
                    }
                  >
                    <option value="0.6">一致性 0.6</option>
                    <option value="0.8">一致性 0.8</option>
                    <option value="1">一致性 1.0</option>
                  </select>
                </div>
                <div className="pro-control-row mt-4">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      name="syncLip"
                      type="checkbox"
                      checked={Boolean(current.data?.syncLip)}
                      onChange={(e) => handleDataUpdate({ syncLip: e.target.checked })}
                    />
                    <span>启用口型同步</span>
                  </label>
                </div>
              </section>
            )}

            {current.type === 'video' && (
              <section className="inspector-section inspector-section--focus">
                <label>空间 3D 控制 (NeRF)</label>
                <div className="pro-control-row">
                  <span>水平轴</span>
                  <input
                    name="spatialX"
                    type="range"
                    value={spatialX}
                    onChange={(e) => setSpatialX(parseInt(e.target.value))}
                  />
                </div>
                <button
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
                      if (data?.status === 'not_implemented')
                        showToast(data.message || '3D 重构服务未配置', 'warning')
                      else if (data?.success) showToast('✨ 3D 重构完成', 'success')
                      else showToast('3D 重构执行失败', 'error')
                    } catch (error: unknown) {
                      showToast(resolveErrorMessage(error, '3D 重构失败'), 'error')
                    } finally {
                      setIsProcessing(false)
                    }
                  }}
                  disabled={isProcessing}
                >
                  {isProcessing ? '正在重构...' : '🧊 执行 NeRF 3D 渲染'}
                </button>
              </section>
            )}

            {current.type === 'text' && (
              <section className="inspector-section inspector-section--support">
                <label>TTS 配音控制器</label>
                <textarea
                  name="ttsContent"
                  value={current.data?.content || ''}
                  onChange={(e) => handleDataUpdate({ content: e.target.value })}
                  className="pro-textarea-mini"
                />
                <div className="pro-control-row mt-4">
                  <select name="ttsVoice" className="pro-select-mini">
                    <option>自然男声 (中文)</option>
                    <option>甜美女声 (中文)</option>
                  </select>
                  <button className="alchemy-mini-btn" onClick={() => handleAlchemy('tts')}>
                    生成
                  </button>
                </div>
                <div className="pro-control-row mt-4">
                  <select
                    name="textTargetLang"
                    className="pro-select-mini"
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value as 'English' | 'Japanese')}
                  >
                    <option value="English">翻译为英文</option>
                    <option value="Japanese">翻译为日文</option>
                  </select>
                  <button
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
                <label>音频翻译克隆</label>
                <div className="pro-control-row mt-4">
                  <select
                    name="audioTargetLang"
                    className="pro-select-mini"
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value as 'English' | 'Japanese')}
                  >
                    <option value="English">翻译为英文</option>
                    <option value="Japanese">翻译为日文</option>
                  </select>
                  <button
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
              <label>智能音频辅助</label>
              <div className="pro-control-row">
                <span>BGM 匹配</span>
                <input
                  name="bgmVolume"
                  type="range"
                  value={bgmVolume}
                  onChange={(e) => setBgmVolume(parseInt(e.target.value))}
                />
              </div>
              <button className="alchemy-mini-btn w-full" onClick={() => handleAlchemy('audio')}>
                🥁 节奏感应分析
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

export default PropertyInspector
