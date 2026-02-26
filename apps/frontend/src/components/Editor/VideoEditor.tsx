import React, { useState, useEffect, useRef } from 'react';
import { Timeline } from '@xzdarcy/react-timeline-editor';
import '@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css';
import { useMeasure } from 'react-use';
import { motion, AnimatePresence } from 'framer-motion';
import { useEditorStore } from '../../store/editorStore';
import { calculateSnap } from '../../utils/snapService';
import { syncController } from '../../utils/SyncController';
import { useShortcuts } from '../../hooks/useShortcuts';
import ContextMenu from './ContextMenu';
import './VideoEditor.css';

interface VideoEditorProps {
  activeTool?: 'select' | 'cut' | 'hand';
}

const VideoEditor: React.FC<VideoEditorProps> = ({ activeTool = 'select' }) => {
  const { 
    tracks, currentTime, setCurrentTime, duration, isPlaying, 
    togglePlay, updateClip, selectedClipId, setSelectedClipId,
    removeClip, splitClip, zoomLevel, setZoomLevel, beatPoints 
  } = useEditorStore();
  
  // @ts-ignore
  const { undo, redo } = useEditorStore.temporal.getState();
  const [containerRef, { width, height }] = useMeasure<HTMLDivElement>();
  const [isReady, setIsReady] = useState(false);
  
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  useShortcuts({
    'Space': togglePlay,
    'Cmd+B': () => {
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
    <div className="video-editor-container pro-nle-container" style={{ background: 'transparent' }}>
      <div className="timeline-wrapper" ref={containerRef} style={{ cursor: activeTool === 'cut' ? 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'20\' height=\'20\'><text y=\'15\' font-size=\'16\'>✂️</text></svg>") 0 10, crosshair' : 'default' }}>
        {isReady && (
          <Timeline
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
