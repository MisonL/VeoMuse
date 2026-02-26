import React, { useRef, useEffect } from 'react';
import { useEditorStore } from '../../store/editorStore';
import './MultiVideoPlayer.css';

const MultiVideoPlayer: React.FC = () => {
  const { tracks, currentTime } = useEditorStore();
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  // 核心同步逻辑：根据全局时间同步所有视频帧
  useEffect(() => {
    tracks.forEach(track => {
      track.clips.forEach(clip => {
        const video = videoRefs.current.get(clip.id);
        if (video) {
          if (currentTime >= clip.start && currentTime <= clip.end) {
            // 片段处于激活状态
            video.style.display = 'block';
            const internalTime = currentTime - clip.start;
            
            // 只有当偏差较大时才强制同步，避免卡顿
            if (Math.abs(video.currentTime - internalTime) > 0.1) {
              video.currentTime = internalTime;
            }
          } else {
            video.style.display = 'none';
          }
        }
      });
    });
  }, [currentTime, tracks]);

  return (
    <div className="multi-video-player glass-panel">
      <div className="player-stage">
        {tracks.map(track => 
          track.clips.map(clip => (
            <video
              key={clip.id}
              ref={el => {
                if (el) videoRefs.current.set(clip.id, el);
                else videoRefs.current.delete(clip.id);
              }}
              src={clip.src}
              className="player-video-instance"
              muted
              playsInline
            />
          ))
        )}
        
        {/* 如果没有任何视频在播放，显示空状态 */}
        <div className="player-overlay">
          {/* 这里可以放水印或辅助线 */}
        </div>
      </div>
    </div>
  );
};

export default MultiVideoPlayer;
