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

  // 3D 空间重构逻辑
  const handleSpatialRender = async () => {
    if (!selectedClip || !selectedClip.id) return;
    setIsProcessing(true);
    showToast('🧊 正在执行神经辐射场 (NeRF) 升维渲染...', 'info');
    try {
      const { data } = await api.api.ai.spatial.render.post({ clipId: selectedClip.id });
      if (data?.success) {
        showToast('✨ 3D 重构完成！您现在可以在预览区开启“3D 视角”。', 'success');
        handleDataUpdate({ spatialData: data.nerfDataUrl, is3DReady: true });
      }
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="inspector-panel glass-panel">
      <header className="inspector-header"><h3>属性检查</h3><span className="clip-type-badge">{selectedClip.type}</span></header>
      <div className="inspector-body">
        <section className="inspector-section">
          <label>片段名称</label>
          <input type="text" value={selectedClip.name} onChange={(e) => handleUpdate({ name: e.target.value })} />
        </section>

        {selectedClip.type === 'video' && (
          <section className="inspector-section">
            <div className="alchemy-tools">
              <label style={{ fontSize: '0.7rem', color: '#38bdf8' }}>🧊 空间升维 (Spatial AI)</label>
              <button 
                onClick={handleSpatialRender} 
                disabled={isProcessing}
                style={{ marginTop: '0.5rem', width: '100%', background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)', color: '#fff', border: 'none', padding: '0.8rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                {isProcessing ? '⏳ 正在计算体素...' : '🧊 执行 NeRF 3D 重构'}
              </button>
            </div>
            
            <div className="alchemy-tools" style={{ marginTop: '1.5rem' }}>
              <label style={{ fontSize: '0.7rem', color: '#a855f7' }}>✨ 神经特效 (VFX)</label>
              <div className="style-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '4px' }}>
                <button onClick={() => {}} style={{ fontSize: '0.7rem', padding: '4px', background: '#333' }}>🧙 魔法粒子</button>
                <button onClick={() => {}} style={{ fontSize: '0.7rem', padding: '4px', background: '#333' }}>📺 赛博故障</button>
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
