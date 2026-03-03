import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useEditorStore } from '../../store/editorStore'

const TextOverlay: React.FC = () => {
  const { tracks, currentTime } = useEditorStore()

  const activeTextClips = tracks
    .filter((t) => t.type === 'text')
    .flatMap((t) => t.clips)
    .filter((c) => currentTime >= c.start && currentTime <= c.end)

  const getAnimation = (preset: string) => {
    switch (preset) {
      case 'fade':
        return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
      case 'slideUp':
        return {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: -20 }
        }
      case 'zoom':
        return {
          initial: { opacity: 0, scale: 0.8 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 1.2 }
        }
      default:
        return { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } }
    }
  }

  return (
    <div
      className="text-overlay-container"
      style={{
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
        zIndex: 10,
        contain: 'strict' // 性能优化：限制重绘范围
      }}
    >
      <AnimatePresence>
        {activeTextClips.map((clip) => {
          const anim = getAnimation(clip.data?.animation || 'fade')
          const is3D = clip.data?.use3D || false

          return (
            <motion.div
              key={clip.id}
              initial={anim.initial}
              animate={anim.animate}
              exit={anim.exit}
              transition={{ duration: 0.4, type: 'spring', damping: 20 }}
              style={{
                color: clip.data?.color || '#fff',
                fontSize: `${clip.data?.fontSize || 32}px`,
                fontWeight: 'bold',
                textShadow: '0 2px 15px rgba(0,0,0,0.8)',
                textAlign: 'center',
                mixBlendMode: is3D ? 'screen' : 'normal',
                transform: is3D
                  ? 'perspective(800px) rotateX(10deg) translate3d(0,0,0)'
                  : 'translate3d(0,0,0)',
                willChange: 'transform, opacity' // 强制 GPU 加速
              }}
            >
              {clip.data?.content || ''}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

export default TextOverlay
