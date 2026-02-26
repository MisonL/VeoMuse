import React from 'react';
import { useEditorStore, Clip } from '../../store/editorStore';
import './PropertyInspector.css';

const PropertyInspector: React.FC = () => {
  const { tracks, selectedClipId, updateClip } = useEditorStore();

  // 寻找选中的片段及其所属轨道
  let selectedClip: Clip | null = null;
  let parentTrackId: string | null = null;

  tracks.forEach(track => {
    const clip = track.clips.find(c => c.id === selectedClipId);
    if (clip) {
      selectedClip = clip;
      parentTrackId = track.id;
    }
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
    if (parentTrackId && selectedClipId) {
      updateClip(parentTrackId, selectedClipId, updates);
    }
  };

  const handleDataUpdate = (dataUpdates: any) => {
    handleUpdate({
      data: { ...(selectedClip?.data || {}), ...dataUpdates }
    });
  };

  return (
    <div className="inspector-panel glass-panel">
      <header className="inspector-header">
        <h3>属性检查器</h3>
        <span className="clip-type-badge">{selectedClip.type}</span>
      </header>

      <div className="inspector-body">
        <section className="inspector-section">
          <label>片段名称</label>
          <input 
            type="text" 
            value={selectedClip.name} 
            onChange={(e) => handleUpdate({ name: e.target.value })}
          />
        </section>

        <section className="inspector-section">
          <label>时间范围</label>
          <div className="range-inputs">
            <div>
              <small>起始</small>
              <input 
                type="number" 
                step="0.1"
                value={selectedClip.start.toFixed(1)} 
                onChange={(e) => handleUpdate({ start: parseFloat(e.target.value) })}
              />
            </div>
            <div>
              <small>结束</small>
              <input 
                type="number" 
                step="0.1"
                value={selectedClip.end.toFixed(1)} 
                onChange={(e) => handleUpdate({ end: parseFloat(e.target.value) })}
              />
            </div>
          </div>
        </section>

        {selectedClip.type === 'text' && (
          <section className="inspector-section special">
            <label>文字内容</label>
            <textarea 
              value={selectedClip.data?.content || ''} 
              onChange={(e) => handleDataUpdate({ content: e.target.value })}
            />
            
            <label>颜色</label>
            <input 
              type="color" 
              value={selectedClip.data?.color || '#ffffff'} 
              onChange={(e) => handleDataUpdate({ color: e.target.value })}
            />
          </section>
        )}
      </div>
    </div>
  );
};

export default PropertyInspector;
