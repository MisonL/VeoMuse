import React, { useState } from 'react';
import { useEditorStore, Asset } from '../../store/editorStore';
import { useToastStore } from '../../store/toastStore';
import './AssetPanel.css';

interface AssetPanelProps {
  mode?: 'assets' | 'director';
}

const AssetPanel: React.FC<AssetPanelProps> = ({ mode = 'assets' }) => {
  const { assets, tracks, setTracks } = useEditorStore();
  const { showToast } = useToastStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'video' | 'audio'>('all');

  // 模拟 AI 导演分镜数据
  const mockScenes = [
    { id: 's1', title: '全景：霓虹都市', duration: 5, prompt: 'Cinematic wide shot of neon city' },
    { id: 's2', title: '特写：武士头盔', duration: 3, prompt: 'Cyberpunk samurai helmet close up' }
  ];

  const handleDragStart = (e: React.DragEvent, asset: Asset) => {
    e.dataTransfer.setData('veomuse/asset', JSON.stringify(asset));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleAddToTimeline = (name: string, duration: number) => {
    const newTracks = JSON.parse(JSON.stringify(tracks));
    const vTrack = newTracks.find((t: any) => t.id === 'track-v1');
    if (vTrack) {
      vTrack.clips.push({
        id: `clip-${Date.now()}`,
        start: vTrack.clips.length > 0 ? vTrack.clips[vTrack.clips.length-1].end : 0,
        end: (vTrack.clips.length > 0 ? vTrack.clips[vTrack.clips.length-1].end : 0) + duration,
        src: '',
        name: name,
        type: 'video'
      });
      setTracks(newTracks);
      showToast(`已将 ${name} 编排至时间轴`, 'success');
    }
  };

  const filteredAssets = assets.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || a.type === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="pro-asset-panel">
      {mode === 'assets' ? (
        <>
          <div className="asset-search-bar">
            <span className="search-icon">🔍</span>
            <input 
              type="text" 
              placeholder="搜索素材资产..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="asset-categories">
            <button 
              className={`cat-btn ${activeCategory === 'all' ? 'active' : ''}`}
              onClick={() => setActiveCategory('all')}
            >全部</button>
            <button 
              className={`cat-btn ${activeCategory === 'video' ? 'active' : ''}`}
              onClick={() => setActiveCategory('video')}
            >视频</button>
            <button 
              className={`cat-btn ${activeCategory === 'audio' ? 'active' : ''}`}
              onClick={() => setActiveCategory('audio')}
            >音频</button>
          </div>

          <div className="pro-asset-grid">
            {filteredAssets.map(asset => (
              <div 
                key={asset.id} 
                className={`asset-tile ${asset.type}`}
                draggable
                onDragStart={(e) => handleDragStart(e, asset)}
              >
                <div className="tile-preview">
                  <span className="type-indicator"></span>
                  {asset.type === 'video' ? '🎬' : '🎵'}
                  <div className="tile-actions">
                    <button onClick={() => showToast('预览模块加载中...', 'info')}>👁️</button>
                    <button onClick={() => handleAddToTimeline(asset.name, 10)}>➕</button>
                  </div>
                </div>
                <div className="tile-footer">
                  <span className="tile-name">{asset.name}</span>
                  <span className="tile-duration">00:10</span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="director-hub">
          <div className="hub-section">
            <h4 className="section-label">脚本分析反馈</h4>
            <div className="analysis-card">
              <span className="status-tag">分析完成</span>
              <p className="analysis-text">检测到 2 个核心视觉基调：赛博朋克、高饱和霓虹。</p>
            </div>
          </div>

          <div className="hub-section">
            <h4 className="section-label">自动分镜序列</h4>
            <div className="scene-card-list">
              {mockScenes.map(scene => (
                <div key={scene.id} className="scene-card">
                  <div className="scene-index">{scene.id.replace('s', '')}</div>
                  <div className="scene-info">
                    <div className="scene-title">{scene.title}</div>
                    <div className="scene-meta">{scene.duration}s | AI 增强</div>
                  </div>
                  <button 
                    className="scene-add-btn"
                    onClick={() => handleAddToTimeline(scene.title, scene.duration)}
                  >编排</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {mode === 'assets' && filteredAssets.length === 0 && (
        <div className="pro-empty-state">
          <p>未找到相关资产</p>
        </div>
      )}
    </div>
  );
};

export default AssetPanel;
