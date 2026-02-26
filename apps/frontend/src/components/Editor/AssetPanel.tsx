import React, { useState } from 'react';
import { useEditorStore, Asset } from '../../store/editorStore';
import './AssetPanel.css';

const AssetPanel: React.FC = () => {
  const { assets } = useEditorStore();
  const [searchQuery, setSearchQuery] = useState('');

  const handleDragStart = (e: React.DragEvent, asset: Asset) => {
    e.dataTransfer.setData('veomuse/asset', JSON.stringify(asset));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const filteredAssets = assets.filter(a => 
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="pro-asset-panel">
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
        <button className="cat-btn active">全部</button>
        <button className="cat-btn">视频</button>
        <button className="cat-btn">音频</button>
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
              {asset.type === 'video' ? '🎬' : '🖼️'}
              <div className="tile-actions">
                <button title="预览">👁️</button>
                <button title="添加">➕</button>
              </div>
            </div>
            <div className="tile-footer">
              <span className="tile-name">{asset.name}</span>
              <span className="tile-duration">00:10</span>
            </div>
          </div>
        ))}
      </div>

      {filteredAssets.length === 0 && (
        <div className="pro-empty-state">
          <p>未找到相关资产</p>
        </div>
      )}
    </div>
  );
};

export default AssetPanel;
