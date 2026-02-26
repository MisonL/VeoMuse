import React, { useState, useEffect, useRef } from 'react';
import { Timeline } from '@xzdarcy/react-timeline-editor';
import '@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css';
import { useMeasure } from 'react-use';
import { motion, AnimatePresence } from 'framer-motion';
import { useEditorStore } from '../../store/editorStore';
import { calculateSnap } from '../../utils/snapService';
import ContextMenu from './ContextMenu';
import './VideoEditor.css';

const VideoEditor: React.FC = () => {
  const { 
    tracks, currentTime, setCurrentTime, duration, isPlaying, 
    togglePlay, updateClip, selectedClipId, setSelectedClipId,
    removeClip, splitClip, zoomLevel, setZoomLevel 
  } = useEditorStore();
  
  // @ts-ignore
  const { undo, redo } = useEditorStore.temporal.getState();
  const [containerRef, { width, height }] = useMeasure<HTMLDivElement>();
  const [isReady, setIsReady] = useState(false);
  const [snapLine, setSnapLine] = useState<{ visible: boolean; time: number }>({ visible: false, time: 0 });
  const [menuPos, setMenuPos] = useState<{ x: number, y: number, clipId: string, trackId: string } | null>(null);
  
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    if (width > 0) setIsReady(true);
  }, [width]);

  // 快捷键监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) redo(); else undo();
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClipId) {
        tracks.forEach(t => {
          if (t.clips.some(c => c.id === selectedClipId)) removeClip(t.id, selectedClipId);
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, selectedClipId, tracks, removeClip]);

  // RAF 播放循环
  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = performance.now();
      const loop = (time: number) => {
        const delta = (time - lastTimeRef.current) / 1000;
        lastTimeRef.current = time;
        const nextTime = useEditorStore.getState().currentTime + delta;
        setCurrentTime(nextTime);
        if (nextTime >= duration) { togglePlay(); setCurrentTime(0); }
        else { rafRef.current = requestAnimationFrame(loop); }
      };
      rafRef.current = requestAnimationFrame(loop);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying, duration, setCurrentTime, togglePlay]);

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
    <div className="video-editor-container glass-panel" onContextMenu={(e) => e.preventDefault()}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="editor-toolbar">
        <div className="playback-group">
          <button className="play-btn" onClick={togglePlay}>{isPlaying ? '⏸ 暂停' : '▶️ 播放'}</button>
          <div className="divider-v"></div>
          <button className="history-btn" onClick={() => undo()} title="撤销">↩️</button>
          <button className="history-btn" onClick={() => redo()} title="重做">🔄</button>
        </div>
        <div className="zoom-control"><span>🔍</span><input type="range" min="1" max="50" value={zoomLevel} onChange={(e) => setZoomLevel(parseInt(e.target.value))} /></div>
        <div className="time-display"><span className="current-t">{currentTime.toFixed(2)}s</span><span className="duration-label"> / {duration}s</span></div>
      </motion.div>
      
      <div className="timeline-wrapper" ref={containerRef} onClick={() => { setSelectedClipId(null); setMenuPos(null); }}>
        <AnimatePresence>
          {snapLine.visible && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="snap-guide-line" style={{ left: `${(snapLine.time / duration) * 100}%` }} />}
        </AnimatePresence>

        {isReady && (
          <Timeline
            onChange={(data) => {
              let snapDetected = false;
              data.forEach(track => {
                track.actions.forEach(action => {
                  const snapStart = calculateSnap(action.start, action.id);
                  const finalStart = snapStart.snapped ? snapStart.time : action.start;
                  const finalEnd = finalStart + (action.end - action.start);
                  if (snapStart.snapped) { snapDetected = true; setSnapLine({ visible: true, time: snapStart.time }); }
                  updateClip(track.id, action.id, { start: finalStart, end: finalEnd });
                });
              });
              if (!snapDetected) setSnapLine({ visible: false, time: 0 });
            }}
            onActionClick={(action) => setSelectedClipId(action.id)}
            onActionContextMenu={(action, e) => {
              e.preventDefault();
              setMenuPos({ x: e.clientX, y: e.clientY, clipId: action.id, trackId: action.data.trackId });
            }}
            editorData={timelineData}
            effects={{ video: { id: 'video', name: '视频片段' } }}
            onTimeChange={(time) => setCurrentTime(time)}
            autoScroll={true}
            scale={zoomLevel}
            width={width}
            height={height - 48}
          />
        )}

        {menuPos && (
          <ContextMenu 
            x={menuPos.x} 
            y={menuPos.y} 
            onClose={() => setMenuPos(null)}
            options={[
              { label: '在指针处分割', onClick: () => splitClip(menuPos.trackId, menuPos.clipId, currentTime), shortcut: 'S' },
              { label: '复制片段', onClick: () => { /* 实现逻辑 */ }, shortcut: 'D' },
              { label: '删除', onClick: () => removeClip(menuPos.trackId, menuPos.clipId), shortcut: 'Del', type: 'danger' }
            ]}
          />
        )}
      </div>
    </div>
  );
};

export default VideoEditor;
