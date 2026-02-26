import React, { useRef, useEffect } from 'react';
import { useEditorStore } from '../../store/editorStore';
import TextOverlay from './TextOverlay';
import './MultiVideoPlayer.css';

const MultiVideoPlayer: React.FC = () => {
  const { tracks, currentTime, isPlaying } = useEditorStore();
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  // 同步音视频及动态特效
  useEffect(() => {
    tracks.forEach(track => {
      track.clips.forEach(clip => {
        const media = track.type === 'video' 
          ? videoRefs.current.get(clip.id) 
          : audioRefs.current.get(clip.id);

        if (media) {
          const isVideo = track.type === 'video';
          const isInRange = currentTime >= clip.start && currentTime <= clip.end;

          if (isInRange) {
            if (isVideo) {
              media.style.display = 'block';
              
              // 1. 转场与重光照逻辑 (保留)
              let filterStr = clip.data?.filter || 'none';
              if (clip.data?.currentLight === 'cyberpunk') filterStr += ' hue-rotate(180deg) saturate(1.5)';
              media.style.filter = filterStr;

              // 2. 神经渲染 VFX 模拟
              const vfx = clip.data?.activeVfx;
              media.className = `player-video-instance ${vfx || ''}`;
            }
            
            const internalTime = currentTime - clip.start;
            if (Math.abs(media.currentTime - internalTime) > 0.15) media.currentTime = internalTime;

            if (isPlaying && media.paused) media.play().catch(() => {});
            else if (!isPlaying && !media.paused) media.pause();
          } else {
            if (isVideo) media.style.display = 'none';
            if (!media.paused) media.pause();
          }
        }
      });
    });
  }, [currentTime, tracks, isPlaying]);

  return (
    <div className="multi-video-player glass-panel">
      <div className="player-stage">
        {tracks.map(track => 
          track.clips.map(clip => (
            track.type === 'video' ? (
              <video
                key={clip.id}
                ref={el => {
                  if (el) videoRefs.current.set(clip.id, el);
                  else videoRefs.current.delete(clip.id);
                }}
                src={clip.src}
                className="player-video-instance"
                muted={false}
                playsInline
              />
            ) : track.type === 'audio' ? (
              <audio key={clip.id} ref={el => { if (el) audioRefs.current.set(clip.id, el); else audioRefs.current.delete(clip.id); }} src={clip.src} />
            ) : null
          ))
        )}
        <div className="vfx-layer-overlay"></div>
        <TextOverlay />
      </div>
    </div>
  );
};

export default MultiVideoPlayer;
