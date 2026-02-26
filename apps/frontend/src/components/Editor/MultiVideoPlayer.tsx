import React, { useRef, useEffect } from 'react';
import { useEditorStore } from '../../store/editorStore';
import TextOverlay from './TextOverlay';
import './MultiVideoPlayer.css';

const MultiVideoPlayer: React.FC = () => {
  const { tracks, currentTime, isPlaying } = useEditorStore();
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  // 同步音视频进度
  useEffect(() => {
    tracks.forEach(track => {
      track.clips.forEach(clip => {
        const media = track.type === 'video' 
          ? videoRefs.current.get(clip.id) 
          : audioRefs.current.get(clip.id);

        if (media) {
          if (currentTime >= clip.start && currentTime <= clip.end) {
            // 激活状态
            if (track.type === 'video') media.style.display = 'block';
            
            const internalTime = currentTime - clip.start;
            if (Math.abs(media.currentTime - internalTime) > 0.15) {
              media.currentTime = internalTime;
            }

            // 如果全局正在播放，确保媒体也在播放
            if (isPlaying && media.paused) {
              media.play().catch(() => {});
            } else if (!isPlaying && !media.paused) {
              media.pause();
            }
          } else {
            if (track.type === 'video') media.style.display = 'none';
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
              <audio
                key={clip.id}
                ref={el => {
                  if (el) audioRefs.current.set(clip.id, el);
                  else audioRefs.current.delete(clip.id);
                }}
                src={clip.src}
              />
            ) : null
          ))
        )}
        
        <div className="player-overlay"></div>
        <TextOverlay />
      </div>
    </div>
  );
};

export default MultiVideoPlayer;
