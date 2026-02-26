import React, { useState, useEffect, useRef } from 'react';
import { Timeline } from '@xzdarcy/react-timeline-editor';
import '@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css';
import { useMeasure } from 'react-use';
import { motion, AnimatePresence } from 'framer-motion';
import { useEditorStore } from '../../store/editorStore';
import { calculateSnap } from '../../utils/snapService';
import './VideoEditor.css';

const VideoEditor: React.FC = () => {
  const { tracks, currentTime, setCurrentTime, duration, isPlaying, togglePlay, updateClip } = useEditorStore();
  // @ts-ignore
  const { undo, redo } = useEditorStore.temporal.getState();
  const [containerRef, { width, height }] = useMeasure<HTMLDivElement>();
  const [isReady, setIsReady] = useState(false);
  const [snapLine, setSnapLine] = useState<{ visible: boolean; time: number }>({ visible: false, time: 0 });
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    if (width > 0) setIsReady(true);
  }, [width]);

  // 绑定快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // 高性能 RAF 播放引擎
  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = performance.now();
      const loop = (time: number) => {
        const delta = (time - lastTimeRef.current) / 1000;
        lastTimeRef.current = time;
        const nextTime = useEditorStore.getState().currentTime + delta;
        setCurrentTime(nextTime);
        if (nextTime >= duration) {
          togglePlay();
          setCurrentTime(0);
        } else {
          rafRef.current = requestAnimationFrame(loop);
        }
      };
      rafRef.current = requestAnimationFrame(loop);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying, duration]);

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
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="editor-toolbar"
      >
        <div className="playback-group">
          <button className="play-btn" onClick={togglePlay}>
            {isPlaying ? '⏸ 暂停' : '▶️ 播放'}
          </button>
          <div className="divider-v"></div>
          <button className="history-btn" onClick={() => undo()} title="撤销">↩️</button>
          <button className="history-btn" onClick={() => redo()} title="重做">🔄</button>
        </div>
        
        <div className="time-display">
          <span className="current-t">{currentTime.toFixed(2)}s</span>
          <span className="duration-label"> / {duration}s</span>
        </div>
      </motion.div>
      
      <div className="timeline-wrapper" ref={containerRef}>
        <AnimatePresence>
          {snapLine.visible && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="snap-guide-line" 
              style={{ left: `${(snapLine.time / duration) * 100}%` }} 
            />
          )}
        </AnimatePresence>

        {isReady && (
          <Timeline
            onChange={(data) => {
              let snapDetected = false;
              data.forEach(track => {
                track.actions.forEach(action => {
                  const snapStart = calculateSnap(action.start, action.id);
                  if (snapStart.snapped) {
                    snapDetected = true;
                    setSnapLine({ visible: true, time: snapStart.time });
                    const finalStart = snapStart.time;
                    const finalEnd = finalStart + (action.end - action.start);
                    updateClip(track.id, action.id, { start: finalStart, end: finalEnd });
                  }
                });
              });
              if (!snapDetected) setSnapLine({ visible: false, time: 0 });
            }}
            editorData={timelineData}
            effects={{ video: { id: 'video', name: '视频片段' } }}
            onTimeChange={(time) => setCurrentTime(time)}
            autoScroll={true}
            scale={10}
            width={width}
            height={height - 40}
          />
        )}
      </div>
    </div>
  );
};

export default VideoEditor;
