import { useState, useEffect } from 'react'
import { api } from './utils/eden'
import { useEditorStore } from './store/editorStore'
import VideoEditor from './components/Editor/VideoEditor'
import MultiVideoPlayer from './components/Editor/MultiVideoPlayer'
import './App.css'

function App() {
  const [prompt, setPrompt] = useState('')
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [progress, setProgress] = useState('等待开始...')
  
  // 建立 WebSocket 监听进度
  useEffect(() => {
    let ws: WebSocket;
    if (isGenerating) {
      ws = new WebSocket('ws://localhost:3001/ws/generation')
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.message) setProgress(data.message)
        } catch (e) {
          console.log('WS 消息:', event.data)
        }
      }
    }
    return () => { if (ws) ws.close() }
  }, [isGenerating])

  const handleEnhance = async () => {
    if (!prompt) return
    setIsEnhancing(true)
    try {
      const { data, error } = await api.api.ai.enhance.post({ prompt })
      if (error) throw error
      if (data && 'enhanced' in data) setPrompt(data.enhanced)
    } catch (e: any) {
      alert(`AI 增强失败: ${e.message}`)
    } finally { setIsEnhancing(false) }
  }

  const handleGenerate = async () => {
    if (!prompt) return
    setIsGenerating(true)
    setResult(null)
    try {
      const { data, error } = await api.api.video.generate.post({ text: prompt })
      if (error) throw error
      setResult(data)
    } catch (e: any) {
      alert(`生成失败: ${e.message}`)
    } finally { setIsGenerating(false) }
  }

  return (
    <>
      <div className="liquid-bg" />
      
      <div className="app-layout">
        <aside className="glass-panel sidebar">
          <header className="console-header">
            <h1>VeoMuse <span className="badge">V3.1 Pro</span></h1>
            <p className="subtitle">灵感工坊 · 旗舰版</p>
          </header>

          <div className="editor-section">
            <textarea 
              className="premium-input"
              placeholder="输入您的创意..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isEnhancing || isGenerating}
            />
            
            <div className="action-bar">
              <button 
                className={`btn-secondary ${isEnhancing ? 'loading' : ''}`}
                onClick={handleEnhance}
                disabled={isEnhancing || isGenerating || !prompt}
              >
                {isEnhancing ? '🧠 推理中' : '✨ AI 增强'}
              </button>
              
              <button 
                className={`btn-primary ${isGenerating ? 'generating' : ''}`}
                onClick={handleGenerate}
                disabled={isGenerating || isEnhancing || !prompt}
              >
                📹 生成
              </button>
            </div>
          </div>

          {isGenerating && (
            <div className="progress-section glass-panel-inner">
              <div className="spinner"></div>
              <p>{progress}</p>
            </div>
          )}
        </aside>

        <main className="main-workspace">
          <div className="preview-container">
            <MultiVideoPlayer />
          </div>
          
          <div className="timeline-container">
            <VideoEditor />
          </div>
        </main>
      </div>
    </>
  )
}

export default App
