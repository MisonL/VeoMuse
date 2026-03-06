import { useEffect, useRef, useState } from 'react'

export const useTelemetryFpsMonitor = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fpsHistory = useRef<number[]>([])
  const [fpsSummary, setFpsSummary] = useState('暂无 FPS 数据')

  useEffect(() => {
    let lastTime = performance.now()
    let frameCount = 0
    let rafId = 0
    let disposed = false

    const drawFps = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = '#0b66ff'
      ctx.lineWidth = 2
      ctx.beginPath()

      const step = canvas.width / 50
      fpsHistory.current.forEach((fps, index) => {
        const x = index * step
        const y = canvas.height - (fps / 60) * canvas.height
        if (index === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
    }

    const loop = () => {
      if (disposed) return
      frameCount += 1
      const now = performance.now()
      if (now - lastTime >= 1000) {
        fpsHistory.current.push(frameCount)
        if (fpsHistory.current.length > 50) fpsHistory.current.shift()
        if (fpsHistory.current.length > 0) {
          const min = Math.min(...fpsHistory.current)
          const max = Math.max(...fpsHistory.current)
          const avg =
            fpsHistory.current.reduce((total, value) => total + value, 0) /
            fpsHistory.current.length
          setFpsSummary(
            `最近 ${fpsHistory.current.length} 秒 FPS：平均 ${avg.toFixed(1)}，最低 ${min}，最高 ${max}`
          )
        }
        frameCount = 0
        lastTime = now
        drawFps()
      }
      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => {
      disposed = true
      cancelAnimationFrame(rafId)
    }
  }, [])

  return {
    canvasRef,
    fpsSummary
  }
}
