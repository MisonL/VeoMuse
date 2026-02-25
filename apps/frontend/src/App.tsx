import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div className="liquid-bg" />
      <div className="glass-panel" style={{ padding: '3rem' }}>
        <h1 style={{ color: '#fff', fontSize: '3.5rem', marginBottom: '0.5rem' }}>VeoMuse 旗舰版</h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.2rem', marginBottom: '2rem' }}>
          基于 Gemini Veo 的顶级 AI 视频创作平台
        </p>
        <div className="card">
          <button 
            onClick={() => setCount((count) => count + 1)}
            style={{ 
              background: 'linear-gradient(90deg, #38bdf8 0%, #818cf8 100%)',
              border: 'none',
              padding: '1rem 2rem',
              borderRadius: '12px',
              fontSize: '1.1rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            灵感计数：{count}
          </button>
        </div>
      </div>
    </>
  )
}

export default App
