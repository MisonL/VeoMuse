import React, { useState } from 'react';
import { api } from '../../utils/eden';
import { useEditorStore, Clip } from '../../store/editorStore';
import { useToastStore } from '../../store/toastStore';
import './PropertyInspector.css';

const PropertyInspector: React.FC = () => {
  const { tracks, selectedClipId, updateClip, addClip } = useEditorStore();
  const { showToast } = useToastStore();
  const [isProcessing, setIsProcessing] = useState(false);

  let selectedClip: Clip | null = null;
  let parentTrackId: string | null = null;

  tracks.forEach(track => {
    const clip = track.clips.find(c => c.id === selectedClipId);
    if (clip) { selectedClip = clip; parentTrackId = track.id; }
  });

  if (!selectedClip || !parentTrackId) {
    return <div className="inspector-empty glass-panel"><p>未选中片段</p></div>;
  }

  const handleUpdate = (updates: Partial<Clip>) => {
    if (parentTrackId && selectedClipId) { updateClip(parentTrackId, selectedClipId, updates); }
  };

  const handleDataUpdate = (dataUpdates: any) => {
    handleUpdate({ data: { ...(selectedClip?.data || {}), ...dataUpdates } });
  };

  const handleRelighting = async (style: string) => {
    if (!selectedClip || style === 'none') return;
    setIsProcessing(true);
    showToast(`💡 正在重塑光影氛围: [${style}]...`, 'info');
    try {
      const { data } = await api.api.ai.relighting.apply.post({ clipId: selectedClip.id, lightStyle: style });
      if (data?.success) { showToast(`✨ 光影渲染已提交`, 'success'); handleDataUpdate({ currentLight: style }); }
    } finally { setIsProcessing(false); }
  };

  // 神经渲染 VFX 逻辑
  const handleVfx = async (vfx: string) => {
    if (!selectedClip || vfx === 'none') return;
    setIsProcessing(true);
    showToast(`✨ 正在合成神经特效: [${vfx}]...`, 'info');
    try {
      const { data } = await api.api.ai.vfx.apply.post({ clipId: selectedClip.id, vfxType: vfx });
      if (data?.success) {
        showToast(`🎉 特效已提交，正在实时预览效果。`, 'success');
        handleDataUpdate({ activeVfx: vfx });
      }
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="inspector-panel glass-panel">
      <header className="inspector-header"><h3>属性</h3><span className="clip-type-badge">{selectedClip.type}</span></header>
      <div className="inspector-body">
        <section className="inspector-section">
          <label>名称</label>
          <input type="text" value={selectedClip.name} onChange={(e) => handleUpdate({ name: e.target.value })} />
        </section>

        {selectedClip.type === 'video' && (
          <section className="inspector-section">
            <div className="alchemy-tools">
              <label style={{ fontSize: '0.7rem', color: '#38bdf8' }}>💡 AI 重光照 (Relighting)</label>
              <div className="style-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '4px' }}>
                <button onClick={() => handleRelighting('golden-hour')} style={{ fontSize: '0.7rem', padding: '4px', background: selectedClip.data?.currentLight === 'golden-hour' ? '#38bdf8' : '#333' }}>🌅 黄金时刻</button>
                <button onClick={() => handleRelighting('cyberpunk')} style={{ fontSize: '0.7rem', padding: '4px', background: selectedClip.data?.currentLight === 'cyberpunk' ? '#38bdf8' : '#333' }}>🌃 赛博朋克</button>
              </div>
            </div>

            <div className="alchemy-tools" style={{ marginTop: '1rem' }}>
              <label style={{ fontSize: '0.7rem', color: '#a855f7' }}>✨ 神经渲染特效 (VFX)</label>
              <div className="style-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '4px' }}>
                <button onClick={() => handleVfx('magic-particles')} style={{ fontSize: '0.7rem', padding: '4px', background: selectedClip.data?.activeVfx === 'magic-particles' ? '#a855f7' : '#333' }}>🧙 魔法粒子</button>
                <button onClick={() => handleVfx('cyber-glitch')} style={{ fontSize: '0.7rem', padding: '4px', background: selectedClip.data?.activeVfx === 'cyber-glitch' ? '#a855f7' : '#333' }}>📺 赛博故障</button>
              </div>
            </div>
          </section>
        )}

        {selectedClip.type === 'text' && (
          <section className="inspector-section special">
            <textarea value={selectedClip.data?.content || ''} onChange={(e) => handleDataUpdate({ content: e.target.value })} style={{ height: '80px' }} />
            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" checked={selectedClip.data?.use3D || false} onChange={(e) => handleDataUpdate({ use3D: e.target.checked })} />
              <label style={{ fontSize: '0.8rem', color: '#38bdf8' }}>✨ 开启 3D 空间感知</label>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default PropertyInspector;
