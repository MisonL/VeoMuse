import React, { useState, useEffect } from 'react';
import { Timeline } from '@xzdarcy/react-timeline-editor';
import '@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css';
import { useMeasure } from 'react-use';
import { useEditorStore } from '../../store/editorStore';
import './VideoEditor.css';

const VideoEditor: React.FC = () => {
  const { tracks, markers, currentTime, setCurrentTime, duration } = useEditorStore();
  const [containerRef, { width, height }] = useMeasure<HTMLDivElement>();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (width > 0) setIsReady(true);
  }, [width]);

  // 将标记映射为时间轴支持的格式（如果组件库支持直接渲染标记）
  // 暂且我们将标记信息打印或通过其他 UI 呈现，因为核心库对自定义标记的支持较复杂
  // 我们可以在标尺上方通过绝对定位绘制一些“AI”小图标

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
        <button className="play-btn" onClick={togglePlay}>
          {isPlaying ? '⏸ 暂停' : '▶️ 播放'}
        </button>
        <div className="time-display" style={{ marginLeft: '1rem' }}>
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
