import React, { useState } from 'react';
import { api, getErrorMessage } from '../../utils/eden';
import { useEditorStore, Clip } from '../../store/editorStore';
import { useToastStore } from '../../store/toastStore';
import TelemetryDashboard from './TelemetryDashboard';
import './PropertyInspector.css';

const PropertyInspector: React.FC = () => {
  const { tracks, selectedClipId, updateClip } = useEditorStore();
  const { showToast } = useToastStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'properties' | 'lab'>('properties');

  // 模拟参数状态
  const [spatialX, setSpatialX] = useState(0);
  const [bgmVolume, setBgmVolume] = useState(80);

  let selectedClip: Clip | null = null;
  let parentTrackId: string | null = null;

  tracks.forEach(track => {
    const clip = track.clips.find(c => c.id === selectedClipId);
    if (clip) { 
      selectedClip = clip; 
      parentTrackId = track.id; 
    }
  });

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

  // 物理集成：全量炼金术调用
  const handleAlchemy = async (type: 'repair' | 'style' | 'lip' | 'enhance' | 'audio' | 'tts') => {
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
          result = await api.api.ai.alchemy['style-transfer'].post({ clipId: (selectedClip as Clip).id, style: 'cinematic' });
          break;
        case 'lip':
          result = await api.api.ai['sync-lip'].post({ videoUrl: 'mock-v', audioUrl: 'mock-a' });
          break;
        case 'enhance':
          result = await api.api.ai.enhance.post({ prompt: (selectedClip as Clip).name });
          break;
        case 'audio':
          result = await api.api.ai['analyze-audio'].post({ audioUrl: 'mock-a' });
          break;
        case 'tts':
          result = await api.api.ai.tts.post({ text: (selectedClip as Clip).data?.content || '' });
          break;
      }
      
      if (result?.error) throw new Error(getErrorMessage(result.error));
      showToast(`✨ ${type} 炼金成功`, 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const current = selectedClip as Clip | null;

  return (
    <div className="inspector-panel glass-panel pro-inspector-inner">
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
              <input type="text" value={current.name} onChange={(e) => handleUpdate({ name: e.target.value })} className="pro-input-mini" />
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
                <label>空间 3D 控制 (NeRF)</label>
                <div className="pro-control-row">
                  <span>水平轴</span>
                  <input type="range" value={spatialX} onChange={e => setSpatialX(parseInt(e.target.value))} />
                </div>
                <button className="pro-master-btn" onClick={async () => {
                  setIsProcessing(true);
                  const { data } = await api.api.ai.spatial.render.post({ clipId: current.id });
                  if (data?.success) showToast('✨ 3D 重构完成', 'success');
                  setIsProcessing(false);
                }} disabled={isProcessing}>
                  {isProcessing ? '正在重构...' : '🧊 执行 NeRF 3D 渲染'}
                </button>
              </section>
            )}

            {current.type === 'text' && (
              <section className="inspector-section">
                <label>TTS 配音控制器</label>
                <textarea value={current.data?.content || ''} onChange={(e) => handleDataUpdate({ content: e.target.value })} className="pro-textarea-mini" />
                <div className="pro-control-row mt-4">
                  <select className="pro-select-mini">
                    <option>自然男声 (中文)</option>
                    <option>甜美女声 (中文)</option>
                  </select>
                  <button className="alchemy-mini-btn" onClick={() => handleAlchemy('tts')}>生成</button>
                </div>
              </section>
            )}

            <section className="inspector-section">
              <label>智能音频辅助</label>
              <div className="pro-control-row">
                <span>BGM 匹配</span>
                <input type="range" value={bgmVolume} onChange={e => setBgmVolume(parseInt(e.target.value))} />
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
