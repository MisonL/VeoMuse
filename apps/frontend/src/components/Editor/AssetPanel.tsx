import React, { useState, useRef } from 'react';
import { useEditorStore, Asset } from '../../store/editorStore';
import { useToastStore } from '../../store/toastStore';
import './AssetPanel.css';

interface AssetPanelProps {
  mode?: 'assets' | 'director';
}

const AssetPanel: React.FC<AssetPanelProps> = ({ mode = 'assets' }) => {
  const { assets, addAsset, tracks, setTracks } = useEditorStore();
  const { showToast } = useToastStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'video' | 'audio'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 物理导入逻辑
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach(file => {
        const newAsset: Asset = {
          id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          type: file.type.startsWith('video') ? 'video' : 'audio',
          src: URL.createObjectURL(file) // 物理关联本地预览
        };
        addAsset(newAsset);
      });
      showToast(`成功导入 ${files.length} 个媒体资产`, 'success');
    }
  };

  const handleAddToTimeline = (asset: Asset) => {
    const newTracks = JSON.parse(JSON.stringify(tracks));
    const targetTrackId = asset.type === 'video' ? 'track-v1' : 'track-a1';
    const track = newTracks.find((t: any) => t.id === targetTrackId);
    
    if (track) {
      const start = track.clips.length > 0 ? track.clips[track.clips.length - 1].end : 0;
      track.clips.push({
        id: `clip-${Date.now()}`,
        start,
        end: start + 5,
        src: asset.src,
        name: asset.name,
        type: asset.type
      });
      setTracks(newTracks);
      showToast(`已将 ${asset.name} 添加至时间轴`, 'success');
    }
  };

  const filteredAssets = assets.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || a.type === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="pro-asset-panel">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        multiple 
        accept="video/*,audio/*" 
        style={{ display: 'none' }} 
      />

      {mode === 'assets' ? (
        <>
          <div className="asset-header-actions">
            <div className="asset-search-bar">
              <span className="search-icon">🔍</span>
              <input 
                type="text" 
                placeholder="搜索或导入素材..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="import-btn-pro" onClick={handleImportClick} title="导入媒体文件">
              <span>➕</span> 导入
            </button>
          </div>

          <div className="asset-categories">
            {['all', 'video', 'audio'].map(cat => (
              <button 
                key={cat}
                className={`cat-btn ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat as any)}
              >
                {cat === 'all' ? '全部' : cat === 'video' ? '视频' : '音频'}
              </button>
            ))}
          </div>

          <div className="pro-asset-grid">
            {filteredAssets.length > 0 ? (
              filteredAssets.map(asset => (
                <div key={asset.id} className={`asset-tile ${asset.type}`}>
                  <div className="tile-preview">
                    {asset.type === 'video' ? '🎬' : '🎵'}
                    <div className="tile-actions">
                      <button onClick={() => handleAddToTimeline(asset)}>➕</button>
                    </div>
                  </div>
                  <div className="tile-footer">
                    <span className="tile-name">{asset.name}</span>
                    <span className="tile-duration">本地资产</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="pro-empty-state-v2" onClick={handleImportClick}>
                <div className="empty-icon">📁</div>
                <p>暂无媒体素材</p>
                <span>点击此处或拖拽文件进行导入</span>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="director-hub">
          {/* AI 导演内容保持不变，已在上一轮补全 */}
          <div className="hub-section">
            <h4 className="section-label">脚本分析反馈</h4>
            <div className="analysis-card">
              <span className="status-tag">分析完成</span>
              <p className="analysis-text">等待输入脚本进行深度视觉解析...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetPanel;
