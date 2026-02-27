import React, { useState } from 'react';
import MultiVideoPlayer from './MultiVideoPlayer';
import './ComparisonLab.css';

interface ComparisonLabProps {
  modelA?: string;
  modelB?: string;
}

const ComparisonLab: React.FC<ComparisonLabProps> = ({ 
  modelA = 'Gemini Pro 3.1', 
  modelB = 'Local Kling Mock' 
}) => {
  const [syncPlayback, setSyncPlayback] = useState(true);

  return (
    <div className="comparison-lab-pro">
      <div className="lab-toolbar">
        <div className="lab-status">
          <span className="live-dot">●</span> 实验室在线
        </div>
        <div className="lab-actions">
          <label className="sync-toggle">
            <input type="checkbox" checked={syncPlayback} onChange={e => setSyncPlayback(e.target.checked)} />
            <span>同步预览</span>
          </label>
          <button className="lab-btn">导出对比报告</button>
        </div>
      </div>

      <div className="lab-split-engine">
        <div className="model-pane">
          <div className="pane-overlay">
            <span className="model-name">{modelA}</span>
            <div className="metric-chip">Latency: 1.2s</div>
          </div>
          <div className="pane-viewport">
            <MultiVideoPlayer />
          </div>
        </div>

        <div className="lab-axis">
          <div className="axis-line" />
          <div className="axis-handle">VS</div>
        </div>

        <div className="model-pane">
          <div className="pane-overlay">
            <span className="model-name">{modelB}</span>
            <div className="metric-chip secondary">Latency: 0.8s</div>
          </div>
          <div className="pane-viewport">
            <MultiVideoPlayer />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComparisonLab;
