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

  const { markers, setMarkers } = useEditorStore()
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const handleAiSuggest = async () => {
    setIsAnalyzing(true)
    try {
      const { data, error } = await api.api.ai['suggest-cuts'].post({
        description: prompt || '默认视频',
        duration: 10
      })
      if (error) throw error
      if (data && 'cutPoints' in data) {
        const newMarkers = data.cutPoints.map((p: any, i: number) => ({
          id: `ai-marker-${i}`,
          time: p.time,
          label: p.reason
        }))
        setMarkers(newMarkers)
      }
    } catch (e: any) {
      alert(`AI 分析失败: ${e.message}`)
    } finally {
      setIsAnalyzing(false)
    }
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
            <div className="preview-content">
              <MultiVideoPlayer />
              <div className="player-controls">
                <button 
                  className={`btn-ai ${isAnalyzing ? 'pulsing' : ''}`}
                  onClick={handleAiSuggest}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? '🤖 AI 分析中...' : '🪄 AI 智能打点'}
                </button>
              </div>
            </div>
          </div>
          
          <div className="timeline-container">
            {markers.length > 0 && (
              <div className="ai-markers-bar">
                {markers.map(m => (
                  <div key={m.id} className="ai-marker-tag" style={{ left: `${(m.time / 60) * 100}%` }}>
                    <span>📍</span>
                    <span className="marker-reason">{m.label}</span>
                  </div>
                ))}
              </div>
            )}
            <VideoEditor />
          </div>
        </main>
      </div>
    </>
  )
}

export default App
