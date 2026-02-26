import React, { memo } from 'react';
import { useEditorStore } from '../../store/editorStore';
import TextOverlay from './TextOverlay';
import { syncController } from '../../utils/SyncController';
import './MultiVideoPlayer.css';

const MultiVideoPlayer: React.FC = () => {
  const { tracks } = useEditorStore();

  // 注意：我们移除了对 currentTime 和 isPlaying 的依赖，防止频繁渲染
  // 同步逻辑现在由外部的 syncController 驱动

  return (
    <div className="multi-video-player glass-panel">
      <div className="player-stage">
        {tracks.map(track => 
          track.clips.map(clip => (
            track.type === 'video' ? (
              <video
                key={clip.id}
                ref={el => syncController.registerVideo(clip.id, el)}
                src={clip.src}
                className="player-video-instance"
                muted={false}
                playsInline
              />
            ) : track.type === 'audio' ? (
              <audio
                key={clip.id}
                ref={el => syncController.registerAudio(clip.id, el)}
                src={clip.src}
              />
            ) : null
          ))
        )}
        <div className="vfx-layer-overlay"></div>
        <TextOverlay />
      </div>
    </div>
  );
};

export default memo(MultiVideoPlayer);
