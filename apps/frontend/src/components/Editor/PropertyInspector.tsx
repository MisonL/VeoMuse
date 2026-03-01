import React, { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useActorsStore } from '../../store/actorsStore';
import { api, getErrorMessage } from '../../utils/eden';
import { useEditorStore, Clip } from '../../store/editorStore';
import { useToastStore } from '../../store/toastStore';
import {
  applyStyleDataUpdate,
  applyVfxDataUpdate,
  buildTranslatedClipClone
} from '../../utils/clipOperations';
import TelemetryDashboard from './TelemetryDashboard';
import './PropertyInspector.css';

const PropertyInspector: React.FC = () => {
  const { tracks, selectedClipId, updateClip, setTracks } = useEditorStore(
    useShallow(state => ({
      tracks: state.tracks,
      selectedClipId: state.selectedClipId,
      updateClip: state.updateClip,
      setTracks: state.setTracks
    }))
  );
  const { showToast } = useToastStore();
  const { actors, fetchActors } = useActorsStore(
    useShallow(state => ({
      actors: state.actors,
      fetchActors: state.fetchActors
    }))
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'properties' | 'lab'>('properties');

  // 模拟参数状态
  const [spatialX, setSpatialX] = useState(0);
  const [bgmVolume, setBgmVolume] = useState(80);
  const [targetLang, setTargetLang] = useState<'English' | 'Japanese'>('English');
  const [stylePreset, setStylePreset] = useState<'cinematic' | 'van_gogh' | 'cyberpunk'>('cinematic');
  const [styleModel, setStyleModel] = useState<'luma-dream' | 'kling-v1' | 'veo-3.1'>('luma-dream');
  const [vfxType, setVfxType] = useState<'magic-particles' | 'cyber-glitch' | 'neon-bloom'>('magic-particles');
  const [vfxIntensity, setVfxIntensity] = useState(0.8);

  let selectedClip: Clip | null = null;
  let parentTrackId: string | null = null;

  tracks.forEach(track => {
    const clip = track.clips.find(c => c.id === selectedClipId);
    if (clip) { 
      selectedClip = clip; 
      parentTrackId = track.id; 
    }
  });

  useEffect(() => {
    void fetchActors().catch(() => {
      // ignore actor list errors in inspector
    });
  }, [fetchActors]);

  const handleUpdate = (updates: Partial<Clip>) => {
    if (parentTrackId && selectedClipId) { 
      updateClip(parentTrackId, selectedClipId, updates); 
    }
  };

  const handleDataUpdate = (dataUpdates: any) => {
    if (selectedClip) {
      handleUpdate({ data: { ...((selectedClip as Clip).data || {}), ...dataUpdates } });
    }
  };

  const cloneSelectedClip = (next: Clip) => {
    if (!selectedClip || !parentTrackId) return;

    const nextTracks = tracks.map(track => {
      if (track.id !== parentTrackId) return track;
      return { ...track, clips: [...track.clips, next] };
    });

    setTracks(nextTracks);
  };

  const handleTranslateAndClone = async () => {
    if (!selectedClip) return;
    if ((selectedClip as Clip).type !== 'text' && (selectedClip as Clip).type !== 'audio') {
      showToast('仅文字或音频片段支持翻译克隆', 'info');
      return;
    }

    setIsProcessing(true);
    try {
      const sourceText = (selectedClip as Clip).type === 'text'
        ? ((selectedClip as Clip).data?.content || (selectedClip as Clip).name)
        : (selectedClip as Clip).name;

      const { data, error } = await api.api.ai.translate.post({
        text: sourceText,
        targetLang
      });

      if (error) throw new Error(getErrorMessage(error));
      if (!data?.translatedText) throw new Error('翻译结果为空');
      const cloned = buildTranslatedClipClone(selectedClip as Clip, {
        translatedText: data.translatedText,
        detectedLang: data.detectedLang,
        targetLang: data.targetLang
      }, Date.now());
      cloneSelectedClip(cloned);

      showToast(`已翻译并克隆为 ${data.targetLang}`, 'success');
    } catch (e: any) {
      showToast(e.message || '翻译失败', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // 物理集成：全量炼金术调用
  const handleAlchemy = async (type: 'repair' | 'style' | 'lip' | 'enhance' | 'audio' | 'tts' | 'vfx') => {
    if (!selectedClip) return;
    setIsProcessing(true);
    showToast(`🧬 正在执行高级炼金: ${type}`, 'info');
    
    try {
      let result;
      switch (type) {
        case 'repair':
          result = await api.api.ai.repair.post({ description: (selectedClip as Clip).name });
          break;
        case 'style':
          result = await api.api.ai.alchemy['style-transfer'].post({
            clipId: (selectedClip as Clip).id,
            style: stylePreset,
            referenceModel: styleModel
          });
          break;
        case 'lip':
          result = await api.api.ai['sync-lip'].post({ videoUrl: (selectedClip as Clip).src, audioUrl: (selectedClip as Clip).src });
          break;
        case 'enhance':
          result = await api.api.ai.enhance.post({ prompt: (selectedClip as Clip).name });
          break;
        case 'audio':
          result = await api.api.ai['analyze-audio'].post({ audioUrl: (selectedClip as Clip).src });
          break;
        case 'tts':
          result = await api.api.ai.tts.post({ text: (selectedClip as Clip).data?.content || '' });
          break;
        case 'vfx':
          result = await api.api.ai.vfx.apply.post({
            clipId: (selectedClip as Clip).id,
            vfxType,
            intensity: vfxIntensity
          });
          break;
      }
      
      if (result?.error) throw new Error(getErrorMessage(result.error));
      const payload = result?.data as any;
      if (payload?.status === 'not_implemented') {
        showToast(payload.message || '该能力未配置 provider', 'warning');
      } else if (payload?.success === false) {
        showToast(payload.message || '该能力执行失败', 'error');
      } else {
        if (type === 'style') {
          handleDataUpdate(applyStyleDataUpdate((selectedClip as Clip).data, {
            stylePreset,
            styleModel,
            operationId: payload?.operationId || ''
          }));
        }
        if (type === 'vfx') {
          handleDataUpdate(applyVfxDataUpdate((selectedClip as Clip).data, {
            vfxType,
            vfxIntensity,
            operationId: payload?.operationId || ''
          }));
        }
        showToast(`✨ ${type} 炼金成功`, 'success');
      }
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const current = selectedClip as Clip | null;

  return (
    <div className="pro-inspector-inner">
      <header className="inspector-header">
        <div className="inspector-tabs">
          <button className={activeTab === 'properties' ? 'active' : ''} onClick={() => setActiveTab('properties')}>属性</button>
          <button className={activeTab === 'lab' ? 'active' : ''} onClick={() => setActiveTab('lab')}>监控</button>
        </div>
        {current && <span className="clip-type-badge">{current.type}</span>}
      </header>

      <div className="inspector-body">
        {activeTab === 'lab' ? (
          <TelemetryDashboard />
        ) : !current ? (
          <div className="inspector-empty"><p>未选中片段</p><small>点击时间轴片段开始炼金</small></div>
        ) : (
          <div className="pro-inspector-content">
            <section className="inspector-section">
              <label>片段名称</label>
              <input name="clipName" type="text" value={current.name} onChange={(e) => handleUpdate({ name: e.target.value })} className="pro-input-mini" />
            </section>

            <section className="inspector-section">
              <label>媒体炼金术 (Alchemy)</label>
              <div className="alchemy-grid">
                <button className="alchemy-mini-btn" onClick={() => handleAlchemy('repair')}>画面修复</button>
                <button className="alchemy-mini-btn" onClick={() => handleAlchemy('style')}>风格迁移</button>
                <button className="alchemy-mini-btn" onClick={() => handleAlchemy('lip')}>口型同步</button>
                <button className="alchemy-mini-btn" onClick={() => handleAlchemy('enhance')}>画质增强</button>
              </div>
            </section>

            {current.type === 'video' && (
              <section className="inspector-section">
                <label>风格重塑预设</label>
                <div className="pro-control-row mt-4">
                  <select
                    name="stylePreset"
                    className="pro-select-mini"
                    value={stylePreset}
                    onChange={(e) => setStylePreset(e.target.value as 'cinematic' | 'van_gogh' | 'cyberpunk')}
                  >
                    <option value="cinematic">Cinematic</option>
                    <option value="van_gogh">Van Gogh</option>
                    <option value="cyberpunk">Cyberpunk</option>
                  </select>
                  <select
                    name="styleModel"
                    className="pro-select-mini"
                    value={styleModel}
                    onChange={(e) => setStyleModel(e.target.value as 'luma-dream' | 'kling-v1' | 'veo-3.1')}
                  >
                    <option value="luma-dream">Luma</option>
                    <option value="kling-v1">Kling</option>
                    <option value="veo-3.1">Veo</option>
                  </select>
                </div>
              </section>
            )}

            {current.type === 'video' && (
              <section className="inspector-section">
                <label>神经渲染特效</label>
                <div className="pro-control-row mt-4">
                  <select
                    name="vfxType"
                    className="pro-select-mini"
                    value={vfxType}
                    onChange={(e) => setVfxType(e.target.value as 'magic-particles' | 'cyber-glitch' | 'neon-bloom')}
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
                <button className="alchemy-mini-btn w-full" onClick={() => handleAlchemy('vfx')} disabled={isProcessing}>
                  {isProcessing ? '特效处理中...' : '应用特效层'}
                </button>
              </section>
            )}

            {current.type === 'video' && (
              <section className="inspector-section">
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
              <section className="inspector-section">
                <label>虚拟演员与口型同步</label>
                <div className="pro-control-row mt-4">
                  <select
                    name="actorId"
                    className="pro-select-mini"
                    value={current.data?.actorId || ''}
                    onChange={(e) => handleDataUpdate({ actorId: e.target.value })}
                  >
                    <option value="">不绑定演员</option>
                    {actors.map(actor => (
                      <option key={actor.id} value={actor.id}>{actor.name}</option>
                    ))}
                  </select>
                  <select
                    name="consistencyStrength"
                    className="pro-select-mini"
                    value={String(current.data?.consistencyStrength ?? 1)}
                    onChange={(e) => handleDataUpdate({ consistencyStrength: Number(e.target.value) })}
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
              <section className="inspector-section">
                <label>空间 3D 控制 (NeRF)</label>
                <div className="pro-control-row">
                  <span>水平轴</span>
                  <input name="spatialX" type="range" value={spatialX} onChange={e => setSpatialX(parseInt(e.target.value))} />
                </div>
                <button className="pro-master-btn" onClick={async () => {
                  setIsProcessing(true);
                  try {
                    const { data, error } = await api.api.ai.spatial.render.post({ clipId: current.id });
                    if (error) throw new Error(getErrorMessage(error));
                    if (data?.status === 'not_implemented') showToast(data.message || '3D 重构服务未配置', 'warning');
                    else if (data?.success) showToast('✨ 3D 重构完成', 'success');
                    else showToast('3D 重构执行失败', 'error');
                  } catch (e: any) {
                    showToast(e.message || '3D 重构失败', 'error');
                  } finally {
                    setIsProcessing(false);
                  }
                }} disabled={isProcessing}>
                  {isProcessing ? '正在重构...' : '🧊 执行 NeRF 3D 渲染'}
                </button>
              </section>
            )}

            {current.type === 'text' && (
              <section className="inspector-section">
                <label>TTS 配音控制器</label>
                <textarea name="ttsContent" value={current.data?.content || ''} onChange={(e) => handleDataUpdate({ content: e.target.value })} className="pro-textarea-mini" />
                <div className="pro-control-row mt-4">
                  <select name="ttsVoice" className="pro-select-mini">
                    <option>自然男声 (中文)</option>
                    <option>甜美女声 (中文)</option>
                  </select>
                  <button className="alchemy-mini-btn" onClick={() => handleAlchemy('tts')}>生成</button>
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
                  <button className="alchemy-mini-btn" onClick={handleTranslateAndClone} disabled={isProcessing}>
                    {isProcessing ? '翻译中...' : '翻译并克隆'}
                  </button>
                </div>
              </section>
            )}

            {current.type === 'audio' && (
              <section className="inspector-section">
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
                  <button className="alchemy-mini-btn" onClick={handleTranslateAndClone} disabled={isProcessing}>
                    {isProcessing ? '翻译中...' : '翻译并克隆'}
                  </button>
                </div>
              </section>
            )}

            <section className="inspector-section">
              <label>智能音频辅助</label>
              <div className="pro-control-row">
                <span>BGM 匹配</span>
                <input name="bgmVolume" type="range" value={bgmVolume} onChange={e => setBgmVolume(parseInt(e.target.value))} />
              </div>
              <button className="alchemy-mini-btn w-full" onClick={() => handleAlchemy('audio')}>🥁 节奏感应分析</button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertyInspector;
