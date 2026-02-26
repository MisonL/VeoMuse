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

  const handleSyncLip = async () => {
    if (!selectedClip || !selectedClip.src) return;
    // 寻找同一时间段的音频作为音源
    const audioClip = tracks.find(t => t.type === 'audio')?.clips.find(c => c.start >= selectedClip!.start - 1 && c.start <= selectedClip!.start + 1);
    
    if (!audioClip) {
      showToast('未找到对应的配音片段', 'warning');
      return;
    }

    setIsProcessing(true);
    showToast('👄 正在进行 AI 对口型同步...', 'info');
    try {
      const { data } = await api.api.ai['sync-lip'].post({
        videoUrl: selectedClip.src,
        audioUrl: audioClip.src
      });
      if (data?.success) {
        updateClip(parentTrackId!, selectedClipId!, { src: data.syncedVideoUrl, name: `${selectedClip.name} (已同步)` });
        showToast('对口型同步完成！', 'success');
      }
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="inspector-panel glass-panel">
      <header className="inspector-header"><h3>属性</h3><span className="clip-type-badge">{selectedClip.type}</span></header>
      <div className="inspector-body">
        <section className="inspector-section">
          <label>片段名称</label>
          <input type="text" value={selectedClip.name} onChange={(e) => handleUpdate({ name: e.target.value })} />
        </section>

        {selectedClip.type === 'video' && (
          <section className="inspector-section">
            <label>一致性强度</label>
            <input type="range" min="0" max="1" step="0.1" value={selectedClip.data?.strength || 1} onChange={(e) => handleDataUpdate({ strength: parseFloat(e.target.value) })} />
            
            <button className="btn-sync-lip" onClick={handleSyncLip} disabled={isProcessing} style={{ marginTop: '1rem', width: '100%', background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)', color: '#fff', border: 'none', padding: '0.8rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              {isProcessing ? '⏳ 同步中...' : '👄 执行 AI 对口型'}
            </button>
          </section>
        )}

        {selectedClip.type === 'text' && (
          <section className="inspector-section special">
            <textarea value={selectedClip.data?.content || ''} onChange={(e) => handleDataUpdate({ content: e.target.value })} style={{ height: '80px' }} />
            <select onChange={(e) => {}} style={{ width: '100%', background: '#000', color: '#ccc', border: '1px solid #333', padding: '6px', borderRadius: '4px' }}>
              <option value="none">多语种重塑...</option>
              <option value="English">英语 (西海岸)</option>
            </select>
          </section>
        )}
      </div>
    </div>
  );
};

export default PropertyInspector;
