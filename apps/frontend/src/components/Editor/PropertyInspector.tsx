import React, { useState } from 'react';
import { api } from '../../utils/eden';
import { useEditorStore, Clip } from '../../store/editorStore';
import './PropertyInspector.css';

const PropertyInspector: React.FC = () => {
  const { tracks, selectedClipId, updateClip, addClip } = useEditorStore();
  const [isTtsGenerating, setIsTtsGenerating] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [isMorphing, setIsMorphing] = useState(false);

  let selectedClip: Clip | null = null;
  let parentTrackId: string | null = null;

  tracks.forEach(track => {
    const clip = track.clips.find(c => c.id === selectedClipId);
    if (clip) { selectedClip = clip; parentTrackId = track.id; }
  });

  if (!selectedClip || !parentTrackId) {
    return (
      <div className="inspector-empty glass-panel">
        <p>未选中任何片段</p>
        <small>在时间轴上点击片段进行编辑</small>
      </div>
    );
  }

  const handleUpdate = (updates: Partial<Clip>) => {
    if (parentTrackId && selectedClipId) { updateClip(parentTrackId, selectedClipId, updates); }
  };

  const handleDataUpdate = (dataUpdates: any) => {
    handleUpdate({ data: { ...(selectedClip?.data || {}), ...dataUpdates } });
  };

  const handleTtsGenerate = async () => {
    if (!selectedClip || !selectedClip.data?.content) return;
    setIsTtsGenerating(true);
    try {
      const { data } = await api.api.ai.tts.post({ text: selectedClip.data.content });
      if (data?.success) {
        addClip('track-a1', { id: `voice-${Date.now()}`, start: selectedClip.start, end: selectedClip.end, src: data.audioUrl, name: `配音: ${selectedClip.name}`, type: 'audio' });
        alert('AI 配音已生成！');
      }
    } finally { setIsTtsGenerating(false); }
  };

  const handleAiRepair = async () => {
    if (!selectedClip) return;
    const problem = window.prompt('请描述画面中的问题：');
    if (!problem) return;
    setIsRepairing(true);
    try {
      const { data } = await api.api.ai.repair.post({ description: problem });
      if (data && 'fixPrompt' in data) { alert(`AI 诊断建议：${data.fixPrompt}`); handleDataUpdate({ repairPrompt: data.fixPrompt }); }
    } finally { setIsRepairing(false); }
  };

  const handleVoiceMorph = async (targetId: string) => {
    if (!selectedClip || !selectedClip.src) return;
    setIsMorphing(true);
    try {
      const { data } = await api.api.ai['voice-morph'].post({ audioUrl: selectedClip.src, targetVoiceId: targetId });
      if (data?.success) {
        updateClip(parentTrackId!, selectedClipId!, { src: data.morphedAudioUrl, name: `${selectedClip.name} (${targetId})` });
        alert(`音色克隆成功！已应用：${targetId}`);
      }
    } finally { setIsMorphing(false); }
  };

  return (
    <div className="inspector-panel glass-panel">
      <header className="inspector-header"><h3>属性检查器</h3><span className="clip-type-badge">{selectedClip.type}</span></header>
      <div className="inspector-body">
        <section className="inspector-section">
          <label>名称</label>
          <input type="text" value={selectedClip.name} onChange={(e) => handleUpdate({ name: e.target.value })} />
        </section>

        <section className="inspector-section">
          <label>范围</label>
          <div className="range-inputs">
            <input type="number" step="0.1" value={selectedClip.start.toFixed(1)} onChange={(e) => handleUpdate({ start: parseFloat(e.target.value) })} />
            <input type="number" step="0.1" value={selectedClip.end.toFixed(1)} onChange={(e) => handleUpdate({ end: parseFloat(e.target.value) })} />
          </div>
        </section>

        {selectedClip.type === 'audio' && (
          <section className="inspector-section">
            <label>AI 音色克隆</label>
            <select value="none" onChange={(e) => handleVoiceMorph(e.target.value)} disabled={isMorphing} style={{ background: '#000', color: '#ccc', border: '1px solid #333', padding: '6px', borderRadius: '4px' }}>
              <option value="none">保持原声</option><option value="pro-narrator">专业旁白</option><option value="sweet-girl">元气少女</option><option value="deep-cinema">深沉影评人</option>
            </select>
          </section>
        )}

        {(selectedClip.type === 'video' || selectedClip.type === 'image') && (
          <section className="inspector-section">
            <label>色彩滤镜</label>
            <select value={selectedClip.data?.filter || 'none'} onChange={(e) => handleDataUpdate({ filter: e.target.value })} style={{ background: '#000', color: '#ccc', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '4px' }}>
              <option value="none">无</option><option value="grayscale(100%)">黑白</option><option value="sepia(50%)">复古</option><option value="saturate(200%)">鲜艳</option>
            </select>
            <button className="btn-repair" onClick={handleAiRepair} disabled={isRepairing} style={{ marginTop: '1rem', width: '100%', background: 'rgba(255,255,255,0.05)', color: '#aaa', border: '1px solid #333', padding: '0.6rem', borderRadius: '8px', cursor: 'pointer' }}>{isRepairing ? '🔍 诊断中...' : '🛠️ AI 画面修复'}</button>
          </section>
        )}

        {selectedClip.type === 'text' && (
          <section className="inspector-section special">
            <textarea value={selectedClip.data?.content || ''} onChange={(e) => handleDataUpdate({ content: e.target.value })} style={{ height: '100px' }} />
            <input type="color" value={selectedClip.data?.color || '#ffffff'} onChange={(e) => handleDataUpdate({ color: e.target.value })} />
            <label>动画</label>
            <select value={selectedClip.data?.animation || 'none'} onChange={(e) => handleDataUpdate({ animation: e.target.value })} style={{ background: '#000', color: '#ccc', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '4px' }}>
              <option value="none">无</option><option value="fade">渐显</option><option value="slideUp">滑入</option>
            </select>
            
            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" checked={selectedClip.data?.use3D || false} onChange={(e) => handleDataUpdate({ use3D: e.target.checked })} />
              <label style={{ fontSize: '0.8rem', color: '#38bdf8' }}>✨ 开启 3D 空间感知</label>
            </div>

            <button className="btn-tts" onClick={handleTtsGenerate} disabled={isTtsGenerating} style={{ marginTop: '1rem', width: '100%', background: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)', color: '#fff', border: 'none', padding: '0.8rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>{isTtsGenerating ? '🎙️ 合成中...' : '🎙️ 生成 AI 配音'}</button>
          </section>
        )}
      </div>
    </div>
  );
};

export default PropertyInspector;
