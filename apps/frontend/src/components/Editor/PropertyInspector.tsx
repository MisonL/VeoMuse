import React, { useState } from 'react';
import { api, getErrorMessage } from '../../utils/eden';
import { useEditorStore, Clip } from '../../store/editorStore';
import { useToastStore } from '../../store/toastStore';
import TelemetryDashboard from './TelemetryDashboard';
import './PropertyInspector.css';

const PropertyInspector: React.FC = () => {
  const { tracks, selectedClipId, updateClip, addClip } = useEditorStore();
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

  const handleAlchemy = async (type: string) => {
    setIsProcessing(true);
    showToast(`🧬 正在执行高级炼金: ${type}`, 'info');
    await new Promise(r => setTimeout(r, 1500));
    showToast('✨ 炼金成功', 'success');
    setIsProcessing(false);
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
            {/* 基础设置 */}
            <section className="inspector-section">
              <label>片段元数据</label>
              <input type="text" value={current.name} onChange={(e) => handleUpdate({ name: e.target.value })} className="pro-input-mini" />
            </section>

            {/* 媒体炼金术组 (Alchemy Hub) */}
            <section className="inspector-section">
              <label>媒体炼金术 (Alchemy)</label>
              <div className="alchemy-grid">
                <button className="alchemy-mini-btn" onClick={() => handleAlchemy('画面修复')}>画面修复</button>
                <button className="alchemy-mini-btn" onClick={() => handleAlchemy('风格滤镜')}>风格迁移</button>
                <button className="alchemy-mini-btn" onClick={() => handleAlchemy('口型同步')}>口型同步</button>
                <button className="alchemy-mini-btn" onClick={() => handleAlchemy('动态增强')}>画质增强</button>
              </div>
            </section>

            {/* 空间 3D 与 音频控制 */}
            {current.type === 'video' && (
              <section className="inspector-section">
                <label>空间 3D 控制 (NeRF)</label>
                <div className="pro-control-row">
                  <span>水平位移</span>
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
                    <option>磁性男声 (English)</option>
                  </select>
                  <button className="alchemy-mini-btn" onClick={() => handleAlchemy('TTS')}>生成</button>
                </div>
              </section>
            )}

            <section className="inspector-section">
              <label>智能音频辅助</label>
              <div className="pro-control-row">
                <span>BGM 匹配度</span>
                <input type="range" value={bgmVolume} onChange={e => setBgmVolume(parseInt(e.target.value))} />
              </div>
              <button className="alchemy-mini-btn w-full" onClick={() => handleAlchemy('BGM 匹配')}>一键匹配最佳 BGM</button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertyInspector;
