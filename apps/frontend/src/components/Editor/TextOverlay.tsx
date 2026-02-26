import React from 'react';
import { useEditorStore } from '../../store/editorStore';

const TextOverlay: React.FC = () => {
  const { tracks, currentTime } = useEditorStore();

  const activeTextClips = tracks
    .filter(t => t.type === 'text')
    .flatMap(t => t.clips)
    .filter(c => currentTime >= c.start && currentTime <= c.end);

  if (activeTextClips.length === 0) return null;

  return (
    <div className="text-overlay-container" style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10
    }}>
      {activeTextClips.map(clip => (
        <div 
          key={clip.id}
          style={{
            color: clip.data?.color || '#fff',
            fontSize: `${clip.data?.fontSize || 32}px`,
            fontWeight: 'bold',
            textShadow: '0 2px 10px rgba(0,0,0,0.8)',
            textAlign: 'center'
          }}
        >
          {clip.data?.content || ''}
        </div>
      ))}
    </div>
  );
};

export default TextOverlay;
