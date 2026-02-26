import { useState, useEffect } from 'react'
import { api } from './utils/eden'
import { useEditorStore } from './store/editorStore'
import VideoEditor from './components/Editor/VideoEditor'
import MultiVideoPlayer from './components/Editor/MultiVideoPlayer'
import AssetPanel from './components/Editor/AssetPanel'
import PropertyInspector from './components/Editor/PropertyInspector'
import ComparisonLab from './components/Editor/ComparisonLab'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState<'generate' | 'assets'>('generate')
  const [isCompareMode, setIsCompareMode] = useState(false)
  const [selectedModel, setSelectedModel] = useState('veo-3.1')
  const [prompt, setPrompt] = useState('')
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [progress, setProgress] = useState('等待开始...')
  const [isExporting, setIsExporting] = useState(false)
  
  const { addAsset, assets, markers, setMarkers, tracks, addClip } = useEditorStore()
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isMusicAnalyzing, setIsMusicAnalyzing] = useState(false)

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

  const handleEnhance = async () => {
    if (!prompt) return;
    setIsEnhancing(true);
    try {
      const { data, error } = await api.api.ai.enhance.post({ prompt });
      if (data && 'enhanced' in data) setPrompt(data.enhanced);
    } catch (e: any) { alert(e.message); } finally { setIsEnhancing(false); }
  }

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    setResult(null);
    try {
      const { data, error } = await api.api.video.generate.post({ 
        text: prompt,
        modelId: selectedModel 
      });
      setResult(data);
    } catch (e: any) { alert(e.message); } finally { setIsGenerating(false); }
  }

  const handleAiMusic = async () => {
    if (!prompt) return;
    setIsMusicAnalyzing(true);
    try {
      const { data } = await api.api.ai['music-advice'].post({ description: prompt });
      if (data && 'mood' in data) {
        addClip('track-a1', {
          id: `bgm-${Date.now()}`, start: 0, end: 30,
          src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
          name: `BGM: ${data.mood}`, type: 'audio'
        });
      }
    } finally { setIsMusicAnalyzing(false); }
  }

  return (
    <>
      <div className="liquid-bg" />
      <div className="app-layout">
        <aside className="glass-panel sidebar">
          <header className="console-header">
            <h1>VeoMuse <span className="badge">V3.1 Pro</span></h1>
            <p className="subtitle">全球模型总线 · 已就绪</p>
          </header>

          <div className="tab-header">
            <button className={`tab-btn ${activeTab === 'generate' ? 'active' : ''}`} onClick={() => setActiveTab('generate')}>✨ 生成</button>
            <button className={`tab-btn ${activeTab === 'assets' ? 'active' : ''}`} onClick={() => setActiveTab('assets')}>📚 资产</button>
          </div>

          {activeTab === 'generate' ? (
            <div className="editor-section">
              <div className="model-selector-mini">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label>选择引擎</label>
                  {recommendation && <span className="ai-rec-tag" title={recommendation.reason}>🤖 建议: {recommendation.id}</span>}
                </div>
                <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
                  <option value="veo-3.1">Gemini Veo 3.1</option>
                  <option value="kling-v1">快手可灵 Kling</option>
                  <option value="sora-preview">OpenAI Sora</option>
                </select>
              </div>
              <textarea 
                className="premium-input" 
                placeholder="输入创意..." 
                value={prompt} 
                onChange={(e) => setPrompt(e.target.value)} 
                onBlur={() => handleRecommend(prompt)}
                disabled={isEnhancing || isGenerating} 
              />
              <div className="action-bar">
                <button className="btn-secondary" onClick={handleEnhance} disabled={isEnhancing}>✨ 增强</button>
                <button className="btn-primary" onClick={handleGenerate} disabled={isGenerating}>📹 生成</button>
              </div>
              <button className="btn-music" onClick={handleAiMusic} disabled={isMusicAnalyzing} style={{ marginTop: '0.5rem', width: '100%', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff', border: 'none', padding: '0.6rem', borderRadius: '8px' }}>
                🪄 AI 智能配乐
              </button>
            </div>
          ) : <AssetPanel />}
        </aside>

        <main className="main-workspace">
          <div className="preview-container">
            <div className="preview-content">
              <div className="lab-controls">
                <label className="pro-toggle">
                  <input type="checkbox" checked={isCompareMode} onChange={(e) => setIsCompareMode(e.target.checked)} />
                  <span className="toggle-slider"></span>
                  🔬 实验室对比模式
                </label>
              </div>
              {isCompareMode ? <ComparisonLab modelA={selectedModel} modelB="kling-v1" /> : <MultiVideoPlayer />}
            </div>
          </div>
          <div className="timeline-container">
            <VideoEditor />
          </div>
        </main>

        <aside className="inspector-sidebar">
          <PropertyInspector />
        </aside>
      </div>
    </>
  )
}

export default App
