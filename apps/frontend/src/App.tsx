import { useState, useEffect } from 'react'
import { api } from './utils/eden'
import './App.css'

function App() {
  const [prompt, setPrompt] = useState('')
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [progress, setProgress] = useState('等待开始...')

  // 建立 WebSocket 监听进度 (Gemini 3.1 时代建议使用原生的 WebSocket)
  useEffect(() => {
    let ws: WebSocket;
    if (isGenerating) {
      ws = new WebSocket('ws://localhost:3001/ws/generation')
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.message) {
            setProgress(data.message)
          }
        } catch (e) {
          console.log('WS 消息:', event.data)
        }
      }

      ws.onopen = () => console.log('✅ 进度频道已连接')
      ws.onclose = () => console.log('❌ 进度频道已关闭')
    }

    return () => {
      if (ws) ws.close()
    }
  }, [isGenerating])

  // 处理 AI 提示词增强 (Gemini 3.1 驱动)
  const handleEnhance = async () => {
    if (!prompt) return
    setIsEnhancing(true)
    try {
      const { data, error } = await api.api.ai.enhance.post({ prompt })
      if (error) throw error
      if (data && 'enhanced' in data) {
        setPrompt(data.enhanced)
        console.log('✨ AI 建议样式:', data.styleSuggestion)
      }
    } catch (e: any) {
      alert(`AI 增强失败: ${e.message}`)
    } finally {
      setIsEnhancing(false)
    }
  }

  // 处理视频生成
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
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <>
      <div className="liquid-bg" />
      
      <div className="glass-panel main-console">
        <header className="console-header">
          <h1>VeoMuse <span className="badge">V3.1 Pro</span></h1>
          <p className="subtitle">灵感工坊 · 旗舰版</p>
        </header>

        <div className="editor-section">
          <textarea 
            className="premium-input"
            placeholder="输入您的创意，或点击下方的 AI 增强..."
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
              {isEnhancing ? '🧠 深度推理中...' : '✨ AI 创意增强'}
            </button>
            
            <button 
              className={`btn-primary ${isGenerating ? 'generating' : ''}`}
              onClick={handleGenerate}
              disabled={isGenerating || isEnhancing || !prompt}
            >
              {isGenerating ? '📹 正在生成视频...' : '🚀 开始生成'}
            </button>
          </div>
        </div>

        {isGenerating && (
          <div className="progress-section glass-panel-inner">
            <div className="spinner"></div>
            <p>{progress}</p>
          </div>
        )}

        {result && result.success && (
          <div className="result-section glass-panel-inner">
            <div className="success-icon">✅</div>
            <h3>任务已提交</h3>
            <p>操作 ID: {result.operationName}</p>
            <p className="hint">视频正在后台生成，稍后可在历史记录中查看。</p>
          </div>
        )}
      </div>
    </>
  )
}

export default App
