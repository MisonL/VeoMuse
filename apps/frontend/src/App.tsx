import { useState, useEffect } from 'react'
import { api } from './utils/eden'
import { useEditorStore } from './store/editorStore'
import VideoEditor from './components/Editor/VideoEditor'
import MultiVideoPlayer from './components/Editor/MultiVideoPlayer'
import AssetPanel from './components/Editor/AssetPanel'
import PropertyInspector from './components/Editor/PropertyInspector'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState<'generate' | 'assets'>('generate')
  const [prompt, setPrompt] = useState('')
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [progress, setProgress] = useState('等待开始...')
  const [isExporting, setIsExporting] = useState(false)
  
  const { addAsset, assets, markers, setMarkers, tracks } = useEditorStore()
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // 模拟一些初始资产
  useEffect(() => {
    if (assets.length === 0) {
      addAsset({
        id: 'asset-1',
        name: '大雄兔 (示例)',
        src: 'https://www.w3schools.com/html/mov_bbb.mp4',
        type: 'video'
      });
    }
  }, [])

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

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const { data, error } = await api.api.video.compose.post({
        timelineData: { tracks }
      })
      if (error) throw error
      if (data && data.success) {
        alert(`视频已开始合成！输出路径: ${data.outputPath}`)
      }
    } catch (e: any) {
      alert(`导出失败: ${e.message}`)
    } finally { setIsExporting(false) }
  }

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
    } finally { setIsAnalyzing(false) }
  }

  return (
    <>
      <div className="liquid-bg" />
      
      <div className="app-layout">
        {/* 左侧：控制台 */}
        <aside className="glass-panel sidebar">
          <header className="console-header">
            <h1>VeoMuse <span className="badge">V3.1 Pro</span></h1>
            <p className="subtitle">灵感工坊 · 旗舰版</p>
          </header>

          <div className="tab-header">
            <button className={`tab-btn ${activeTab === 'generate' ? 'active' : ''}`} onClick={() => setActiveTab('generate')}>✨ 生成</button>
            <button className={`tab-btn ${activeTab === 'assets' ? 'active' : ''}`} onClick={() => setActiveTab('assets')}>📚 资产</button>
          </div>

          {activeTab === 'generate' ? (
            <div className="editor-section">
              <textarea className="premium-input" placeholder="输入创意..." value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={isEnhancing || isGenerating} />
              <div className="action-bar">
                <button className={`btn-secondary ${isEnhancing ? 'loading' : ''}`} onClick={handleEnhance} disabled={isEnhancing || isGenerating || !prompt}>
                  {isEnhancing ? '🧠 推理中' : '✨ 增强'}
                </button>
                <button className={`btn-primary ${isGenerating ? 'generating' : ''}`} onClick={handleGenerate} disabled={isGenerating || isEnhancing || !prompt}>📹 生成</button>
              </div>
              <div className="action-bar" style={{ marginTop: '1rem' }}>
                <button className="btn-export" onClick={handleExport} disabled={isExporting} style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', width: '100%' }}>
                  {isExporting ? '⏳ 合成中...' : '🎬 导出'}
                </button>
              </div>
            </div>
          ) : <AssetPanel />}
        </aside>

        {/* 中间：工作区 */}
        <main className="main-workspace">
          <div className="preview-container">
            <div className="preview-content">
              <MultiVideoPlayer />
              <div className="player-controls">
                <button className={`btn-ai ${isAnalyzing ? 'pulsing' : ''}`} onClick={handleAiSuggest} disabled={isAnalyzing}>
                  {isAnalyzing ? '🤖 思考中...' : '🪄 AI 建议剪辑'}
                </button>
              </div>
            </div>
          </div>
          
          <div className="timeline-container">
            {markers.length > 0 && (
              <div className="ai-markers-bar">
                {markers.map(m => <div key={m.id} className="ai-marker-tag" style={{ left: `${(m.time / 60) * 100}%` }}><span>📍</span><span className="marker-reason">{m.label}</span></div>)}
              </div>
            )}
            <VideoEditor />
          </div>
        </main>

        {/* 右侧：检查器 */}
        <aside className="inspector-sidebar">
          <PropertyInspector />
        </aside>
      </div>
    </>
  )
}

export default App
