import React, { useState, useEffect, useRef } from 'react';
import { Timeline } from '@xzdarcy/react-timeline-editor';
import '@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css';
import { useMeasure } from 'react-use';
import { motion, AnimatePresence } from 'framer-motion';
import { useEditorStore } from '../../store/editorStore';
import { calculateSnap } from '../../utils/snapService';
import { syncController } from '../../utils/SyncController';
import { useShortcuts } from '../../hooks/useShortcuts'; // 引入钩子
import ContextMenu from './ContextMenu';
import './VideoEditor.css';

const VideoEditor: React.FC = () => {
  const { 
    tracks, currentTime, setCurrentTime, duration, isPlaying, 
    togglePlay, updateClip, selectedClipId, setSelectedClipId,
    removeClip, splitClip, zoomLevel, setZoomLevel, beatPoints 
  } = useEditorStore();
  
  // @ts-ignore
  const { undo, redo } = useEditorStore.temporal.getState();
  const [containerRef, { width, height }] = useMeasure<HTMLDivElement>();
  const [isReady, setIsReady] = useState(false);
  const [snapLine, setSnapLine] = useState<{ visible: boolean; time: number; type: string }>({ visible: false, time: 0, type: 'clip' });
  const [menuPos, setMenuPos] = useState<{ x: number, y: number, clipId: string, trackId: string } | null>(null);
  
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // 1. 快捷键联动逻辑
  useShortcuts({
    'Space': togglePlay,
    'Cmd+B': () => {
      // 自动分割选中或播放头位置的片段
      tracks.forEach(t => {
        const clip = t.clips.find(c => (selectedClipId ? c.id === selectedClipId : (currentTime >= c.start && currentTime <= c.end)));
        if (clip) splitClip(t.id, clip.id, currentTime);
      });
    },
    'Delete': () => {
      if (selectedClipId) {
        tracks.forEach(t => {
          if (t.clips.some(c => c.id === selectedClipId)) removeClip(t.id, selectedClipId);
        });
      }
    },
    'Left': () => setCurrentTime(Math.max(0, currentTime - 0.1)),
    'Right': () => setCurrentTime(Math.min(duration, currentTime + 0.1)),
    'Shift+Left': () => setCurrentTime(Math.max(0, currentTime - 1)),
    'Shift+Right': () => setCurrentTime(Math.min(duration, currentTime + 1)),
    'Cmd+Z': undo,
    'Cmd+Shift+Z': redo,
    'S': () => { /* 磁吸开关逻辑可在此联动 */ }
  });

  useEffect(() => {
    if (width > 0) setIsReady(true);
  }, [width]);

  // 高性能 Native 同步引擎
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
  }, [isPlaying, duration, tracks]);

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
          <button className="history-btn" onClick={() => undo()}>↩️</button>
          <button className="history-btn" onClick={() => redo()}>🔄</button>
        </div>
        <div className="zoom-control"><span>🔍</span><input type="range" min="1" max="50" value={zoomLevel} onChange={(e) => setZoomLevel(parseInt(e.target.value))} /></div>
        <div className="time-display"><span className="current-t">{currentTime.toFixed(2)}s</span><span className="duration-label"> / {duration}s</span></div>
      </motion.div>
      
      <div className="timeline-wrapper" ref={containerRef} onClick={() => { setSelectedClipId(null); setMenuPos(null); }}>
        <div className="beats-overlay">
          {beatPoints.map((bp, i) => <div key={i} className="beat-tick" style={{ left: `${(bp / duration) * 100}%` }} />)}
        </div>

        <AnimatePresence>
          {snapLine.visible && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`snap-guide-line ${snapLine.type}`} style={{ left: `${(snapLine.time / duration) * 100}%` }} />}
        </AnimatePresence>

        {isReady && (
          <Timeline
            onChange={(data: any) => {
              let snapDetected = false;
              data.forEach((track: any) => {
                track.actions.forEach((action: any) => {
                  const snap = calculateSnap(action.start, action.id);
                  const finalStart = snap.snapped ? snap.time : action.start;
                  const finalEnd = finalStart + (action.end - action.start);
                  if (snap.snapped) { snapDetected = true; setSnapLine({ visible: true, time: snap.time, type: snap.type || 'clip' }); }
                  updateClip(track.id, action.id, { start: finalStart, end: finalEnd });
                });
              });
              if (!snapDetected) setSnapLine({ visible: false, time: 0, type: 'clip' });
              syncController.sync(useEditorStore.getState().currentTime, false, tracks);
            }}
            // @ts-ignore
            onTimeChange={(time: number) => {
              setCurrentTime(time);
              syncController.sync(time, false, tracks);
            }}
            // @ts-ignore
            onActionClick={(action: any) => setSelectedClipId(action.id)}
            // @ts-ignore
            onActionContextMenu={(action: any, e: React.MouseEvent) => {
              e.preventDefault();
              setMenuPos({ x: e.clientX, y: e.clientY, clipId: action.id, trackId: action.data.trackId });
            }}
            editorData={timelineData}
            effects={{ video: { id: 'video', name: '片段' } }}
            autoScroll={true}
            scale={zoomLevel}
            width={width}
            height={height - 48}
          />
        )}

        {menuPos && (
          <ContextMenu x={menuPos.x} y={menuPos.y} onClose={() => setMenuPos(null)}
            options={[
              { label: '在此分割', onClick: () => splitClip(menuPos.trackId, menuPos.clipId, currentTime), shortcut: 'S' },
              { label: '复制', onClick: () => {}, shortcut: 'D' },
              { label: '删除', onClick: () => removeClip(menuPos.trackId, menuPos.clipId), shortcut: 'Del', type: 'danger' }
            ]}
          />
        )}
      </div>
    </div>
  );
};

export default VideoEditor;
