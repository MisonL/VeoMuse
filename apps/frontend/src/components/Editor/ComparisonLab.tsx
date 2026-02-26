import React from 'react';
import MultiVideoPlayer from './MultiVideoPlayer';
import './ComparisonLab.css';

interface ComparisonLabProps {
  modelA: string;
  modelB: string;
}

const ComparisonLab: React.FC<ComparisonLabProps> = ({ modelA, modelB }) => {
  return (
    <div className="comparison-lab">
      <div className="lab-split-view">
        <div className="lab-pane">
          <div className="pane-header">
            <span className="model-tag">{modelA}</span>
          </div>
          <div className="pane-content">
            <MultiVideoPlayer />
          </div>
        </div>
        
        <div className="lab-divider">VS</div>

        <div className="lab-pane">
          <div className="pane-header">
            <span className="model-tag">{modelB}</span>
          </div>
          <div className="pane-content">
            <MultiVideoPlayer />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComparisonLab;
