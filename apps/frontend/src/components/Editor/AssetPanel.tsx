import React, { useState, useRef } from 'react';
import { useEditorStore, Asset } from '../../store/editorStore';
import { useToastStore } from '../../store/toastStore';
import { api, getErrorMessage } from '../../utils/eden';
import './AssetPanel.css';

interface AssetPanelProps {
  mode?: 'assets' | 'director';
  onEnhance?: (text: string) => void;
  onTranslate?: (text: string) => void;
}

const AssetPanel: React.FC<AssetPanelProps> = ({ mode = 'assets' }) => {
  const { assets, addAsset, tracks, setTracks } = useEditorStore();
  const { showToast } = useToastStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'video' | 'audio'>('all');
  const [isAiWorking, setIsAiAiWorking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => { fileInputRef.current?.click(); };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach(file => {
        const newAsset: Asset = {
          id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          type: file.type.startsWith('video') ? 'video' : 'audio',
          src: URL.createObjectURL(file)
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
      track.clips.push({ id: `clip-${Date.now()}`, start, end: start + 5, src: asset.src, name: asset.name, type: asset.type });
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
      <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple accept="video/*,audio/*" style={{ display: 'none' }} />

      {mode === 'assets' ? (
        <>
          <div className="asset-header-actions">
            <div className="asset-search-bar">
              <span className="search-icon">🔍</span>
              <input type="text" placeholder="搜索或导入素材..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <button className="import-btn-pro" onClick={handleImportClick}><span>➕</span> 导入</button>
          </div>

          <div className="asset-categories">
            {['all', 'video', 'audio'].map(cat => (
              <button key={cat} className={`cat-btn ${activeCategory === cat ? 'active' : ''}`} onClick={() => setActiveCategory(cat as any)}>
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
                    <div className="tile-actions"><button onClick={() => handleAddToTimeline(asset)}>➕</button></div>
                  </div>
                  <div className="tile-footer"><span className="tile-name">{asset.name}</span><span className="tile-duration">本地资产</span></div>
                </div>
              ))
            ) : (
              <div className="pro-empty-state-v2" onClick={handleImportClick}>
                <div className="empty-icon">📁</div><p>暂无媒体素材</p><span>点击此处或拖拽文件进行导入</span>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="director-hub">
          <div className="hub-section">
            <h4 className="section-label">脚本分析反馈</h4>
            <div className="analysis-card">
              <span className="status-tag">实时在线</span>
              <p className="analysis-text">使用下方“增强”工具可获得更具电影感的脚本分镜提示词。</p>
            </div>
          </div>
          <div className="hub-section" style={{marginTop: '20px'}}>
            <h4 className="section-label">预设分镜流</h4>
            <div className="scene-card-list">
              <div className="scene-card">
                <div className="scene-index">1</div>
                <div className="scene-info"><div className="scene-title">全景：开场宏叙事</div><div className="scene-meta">5s | 4K 质量</div></div>
                <button className="scene-add-btn">编排</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetPanel;
