import React, { useState, useEffect, useRef } from 'react';
import { Timeline } from '@xzdarcy/react-timeline-editor';
import '@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css';
import { useMeasure } from 'react-use';
import { useEditorStore } from '../../store/editorStore';
import { calculateSnap } from '../../utils/snapService';
import { syncController } from '../../utils/SyncController';
import { useShortcuts } from '../../hooks/useShortcuts';
import './VideoEditor.css';

interface VideoEditorProps {
  activeTool?: 'select' | 'cut' | 'hand';
}

const VideoEditor: React.FC<VideoEditorProps> = ({ activeTool = 'select' }) => {
  const { 
    tracks, currentTime, setCurrentTime, duration, isPlaying, 
    togglePlay, updateClip, setSelectedClipId, splitClip, 
    removeClip, zoomLevel 
  } = useEditorStore();
  
  // @ts-ignore
  const { undo, redo } = useEditorStore.temporal.getState();
  
  // 核心：精确测量容器物理宽度
  const [containerRef, { width, height }] = useMeasure<HTMLDivElement>();
  const [isReady, setIsReady] = useState(false);
  
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  useShortcuts({
    'Space': togglePlay,
    'Cmd+B': () => {
      tracks.forEach(t => {
        const clip = t.clips.find(c => (currentTime >= c.start && currentTime <= c.end));
        if (clip) splitClip(t.id, clip.id, currentTime);
      });
    },
    'Delete': () => {
      // 逻辑暂略
    },
    'Cmd+Z': undo,
    'Cmd+Shift+Z': redo
  });

  useEffect(() => {
    if (width > 0) setIsReady(true);
  }, [width]);

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = performance.now();
      const loop = (time: number) => {
        const delta = (time - lastTimeRef.current) / 1000;
        lastTimeRef.current = time;
        const nextTime = useEditorStore.getState().currentTime + delta;
        setCurrentTime(nextTime);
        syncController.sync(nextTime, true, tracks);
        if (nextTime >= duration) { togglePlay(); setCurrentTime(0); }
        else { rafRef.current = requestAnimationFrame(loop); }
      };
      rafRef.current = requestAnimationFrame(loop);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      syncController.sync(useEditorStore.getState().currentTime, false, tracks);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying, duration, tracks, setCurrentTime, togglePlay]);

  const timelineData = tracks.map(track => ({
    id: track.id,
    actions: track.clips.map(clip => ({
      id: clip.id,
      start: clip.start,
      end: clip.end,
      effectId: 'video',
      data: { ...clip.data, name: clip.name, trackId: track.id }
    }))
  }));

  return (
    <div className="video-editor-container pro-nle-container">
      <div className="timeline-wrapper" ref={containerRef} style={{ cursor: activeTool === 'cut' ? 'crosshair' : 'default' }}>
        {isReady && (
          <Timeline
            key={`timeline-${width}`} // 核心：物理宽度变化时强制组件重绘
            onChange={(data: any) => {
              data.forEach((track: any) => {
                track.actions.forEach((action: any) => {
                  const snap = calculateSnap(action.start, action.id);
                  const finalStart = snap.snapped ? snap.time : action.start;
                  const finalEnd = finalStart + (action.end - action.start);
                  updateClip(track.id, action.id, { start: finalStart, end: finalEnd });
                });
              });
              syncController.sync(useEditorStore.getState().currentTime, false, tracks);
            }}
            // @ts-ignore
            onTimeChange={(time: number) => {
              setCurrentTime(time);
              syncController.sync(time, false, tracks);
            }}
            // @ts-ignore
            onActionClick={(action: any) => {
              if (activeTool === 'cut') {
                splitClip(action.data.trackId, action.id, currentTime);
              } else {
                setSelectedClipId(action.id);
              }
            }}
            editorData={timelineData}
            effects={{ 
              video: { id: 'video', name: '片段' } 
            }}
            autoScroll={true}
            scale={zoomLevel}
            width={width}
            height={height}
          />
        )}
      </div>
    </div>
  );
};

export default VideoEditor;
