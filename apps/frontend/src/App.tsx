import { useState, useEffect } from 'react'
import { api } from './utils/eden'
import { useEditorStore } from './store/editorStore'
import { useToastStore } from './store/toastStore'
import VideoEditor from './components/Editor/VideoEditor'
import MultiVideoPlayer from './components/Editor/MultiVideoPlayer'
import AssetPanel from './components/Editor/AssetPanel'
import PropertyInspector from './components/Editor/PropertyInspector'
import ComparisonLab from './components/Editor/ComparisonLab'
import ToastContainer from './components/Editor/ToastContainer'
import './App.css'

function App() {
  const { showToast } = useToastStore()
  const [activeTab, setActiveTab] = useState<'generate' | 'assets' | 'director' | 'actors'>('generate')
  const [isCompareMode, setIsCompareMode] = useState(false)
  const [selectedModel, setSelectedModel] = useState('veo-3.1')
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [script, setScript] = useState('')
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDirecting, setIsDirecting] = useState(false)
  const [recommendation, setRecommendation] = useState<{ id: string, reason: string } | null>(null)
  const [progress, setProgress] = useState('等待指令...')
  const [isExporting, setIsExporting] = useState(false)
  const [isMusicAnalyzing, setIsMusicAnalyzing] = useState(false)
  
  const { addAsset, assets, markers, setMarkers, tracks, addClip } = useEditorStore()

  // 1. 生成视频逻辑 (支持虚拟演员一致性)
  const handleGenerate = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    try {
      let res;
      if (selectedActorId) {
        res = await api.api.ai.actors.generate.post({ prompt, actorId: selectedActorId, modelId: selectedModel });
      } else {
        res = await api.api.video.generate.post({ text: prompt, modelId: selectedModel });
      }
      if (res.error) throw res.error;
      showToast(selectedActorId ? `演员已入场，正在生成镜头...` : '视频生成任务已提交', 'info');
    } catch (e: any) { showToast(e.message, 'error'); } finally { setIsGenerating(false); }
  }

  // ... (保留之前的辅助功能函数)
  const handleEnhance = async () => {
    if (!prompt) return;
    setIsEnhancing(true);
    try {
      const { data } = await api.api.ai.enhance.post({ prompt });
      if (data && 'enhanced' in data) { setPrompt(data.enhanced); handleRecommend(data.enhanced); }
    } finally { setIsEnhancing(false); }
  }

  const handleRecommend = async (text: string) => {
    if (!text || text.length < 5) return;
    try {
      const { data } = await api.api.models.recommend.post({ prompt: text });
      if (data && 'recommendedModelId' in data) setRecommendation({ id: data.recommendedModelId, reason: data.reason });
    } catch (e) {}
  }

  return (
    <>
      <div className="liquid-bg" />
      <ToastContainer />
      <div className="app-layout">
        <aside className="glass-panel sidebar">
          <header className="console-header">
            <h1>VeoMuse <span className="badge">V3.1 Pro</span></h1>
            <p className="subtitle">旗舰版 · 数字人永生</p>
          </header>

          <div className="tab-header">
            <button className={`tab-btn ${activeTab === 'generate' ? 'active' : ''}`} onClick={() => setActiveTab('generate')}>✨ 生成</button>
            <button className={`tab-btn ${activeTab === 'actors' ? 'active' : ''}`} onClick={() => setActiveTab('actors')}>👤 演员</button>
            <button className={`tab-btn ${activeTab === 'assets' ? 'active' : ''}`} onClick={() => setActiveTab('assets')}>📚 资产</button>
            <button className={`tab-btn ${activeTab === 'director' ? 'active' : ''}`} onClick={() => setActiveTab('director')}>🎬 导演</button>
          </div>

          <div className="tab-content" style={{ flex: 1, overflowY: 'auto' }}>
            {activeTab === 'generate' && (
              <div className="editor-section">
                <div className="model-selector-mini">
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <label>引擎</label>
                    {recommendation && <span className="ai-rec-tag">🤖 建议: {recommendation.id}</span>}
                  </div>
                  <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
                    <option value="veo-3.1">Gemini Veo 3.1</option>
                    <option value="kling-v1">快手可灵 Kling</option>
                    <option value="sora-preview">OpenAI Sora</option>
                  </select>
                </div>
                {selectedActorId && <div className="selected-actor-hint" style={{ fontSize: '0.7rem', color: '#a855f7', marginBottom: '0.5rem' }}>已绑定演员: {selectedActorId} <button onClick={() => setSelectedActorId(null)} style={{ padding: '0 4px', fontSize: '0.6rem' }}>移除</button></div>}
                <textarea className="premium-input" placeholder="输入创意..." value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={isEnhancing || isGenerating} />
                <div className="action-bar">
                  <button className="btn-secondary" onClick={handleEnhance} disabled={isEnhancing}>✨ 增强</button>
                  <button className="btn-primary" onClick={handleGenerate} disabled={isGenerating}>📹 生成</button>
                </div>
              </div>
            )}
            {activeTab === 'actors' && (
              <div className="actor-selector-grid" style={{ padding: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className={`actor-card ${selectedActorId === 'hero-man' ? 'active' : ''}`} onClick={() => setSelectedActorId('hero-man')} style={{ cursor: 'pointer', textAlign: 'center' }}>
                  <div style={{ fontSize: '3rem' }}>🧔</div>
                  <small>英俊男性</small>
                </div>
                <div className={`actor-card ${selectedActorId === 'smart-girl' ? 'active' : ''}`} onClick={() => setSelectedActorId('smart-girl')} style={{ cursor: 'pointer', textAlign: 'center' }}>
                  <div style={{ fontSize: '3rem' }}>👩‍🎓</div>
                  <small>智慧少女</small>
                </div>
              </div>
            )}
            {activeTab === 'assets' && <AssetPanel />}
            {activeTab === 'director' && <div className="editor-section">...</div>}
          </div>

          <div className="sidebar-footer">
            <button className="btn-export" onClick={() => {}} style={{ width: '100%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', padding: '0.8rem', borderRadius: '8px' }}>🎬 导出作品</button>
          </div>
        </aside>

        <main className="main-workspace">
          <div className="preview-container"><MultiVideoPlayer /></div>
          <div className="timeline-container"><VideoEditor /></div>
        </main>

        <aside className="inspector-sidebar"><PropertyInspector /></aside>
      </div>
    </>
  )
}

export default App
