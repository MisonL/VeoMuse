import React, { useRef, useEffect } from 'react';
import { useEditorStore } from '../../store/editorStore';
import TextOverlay from './TextOverlay';
import './MultiVideoPlayer.css';

const MultiVideoPlayer: React.FC = () => {
  const { tracks, currentTime, isPlaying } = useEditorStore();
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  // 核心逻辑：计算并同步音视频进度及透明度（转场）
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
              
              // 转场计算 (Fade In / Out)
              let opacity = 1;
              const transIn = clip.data?.transitionIn;
              const transOut = clip.data?.transitionOut;

              // 淡入
              if (transIn?.type === 'fade' && currentTime < clip.start + transIn.duration) {
                opacity = (currentTime - clip.start) / transIn.duration;
              }
              // 淡出
              else if (transOut?.type === 'fade' && currentTime > clip.end - transOut.duration) {
                opacity = (clip.end - currentTime) / transOut.duration;
              }

              media.style.opacity = opacity.toString();
            }
            
            const internalTime = currentTime - clip.start;
            if (Math.abs(media.currentTime - internalTime) > 0.15) {
              media.currentTime = internalTime;
            }

            if (isPlaying && media.paused) {
              media.play().catch(() => {});
            } else if (!isPlaying && !media.paused) {
              media.pause();
            }
          } else {
            if (isVideo) {
              media.style.display = 'none';
              media.style.opacity = '0';
            }
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
                style={{ transition: 'opacity 0.1s linear' }}
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
