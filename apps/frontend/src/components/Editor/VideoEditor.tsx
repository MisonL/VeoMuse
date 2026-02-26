import React, { useState, useEffect } from 'react';
import { Timeline } from '@xzdarcy/react-timeline-editor';
import '@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css';
import { useMeasure } from 'react-use';
import { useEditorStore } from '../../store/editorStore';
import './VideoEditor.css';

const VideoEditor: React.FC = () => {
  const { tracks, currentTime, setCurrentTime, duration } = useEditorStore();
  const [containerRef, { width, height }] = useMeasure<HTMLDivElement>();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (width > 0) setIsReady(true);
  }, [width]);

  const timelineData = tracks.map(track => ({
    id: track.id,
    actions: track.clips.map(clip => ({
      id: clip.id,
      start: clip.start,
      end: clip.end,
      effectId: 'video',
      data: { src: clip.src, name: clip.name }
    }))
  }));

  return (
    <div className="video-editor-container glass-panel">
      <div className="editor-toolbar">
        <div className="time-display">
          <span>{currentTime.toFixed(2)}s</span>
          <span className="duration-label"> / {duration}s</span>
        </div>
      </div>
      
      <div className="timeline-wrapper" ref={containerRef}>
        {isReady && (
          <Timeline
            onChange={(data) => {
              console.log('时间轴数据变动:', data);
            }}
            editorData={timelineData}
            effects={{
              video: {
                id: 'video',
                name: '视频片段'
              }
            }}
            onTimeChange={(time) => setCurrentTime(time)}
            autoScroll={true}
            maxStep={100}
            minStep={1}
            scale={10} // 调大比例
            width={width}
            height={height - 40} // 减去 toolbar 高度
          />
        )}
      </div>
    </div>
  );
};

export default VideoEditor;
