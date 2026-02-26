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
import { MotionSyncManager } from './utils/motionSync'
import './App.css'

function App() {
  const { showToast } = useToastStore()
  const [activeTab, setActiveTab] = useState<'generate' | 'assets' | 'director' | 'actors'>('generate')
  const [isCompareMode, setIsCompareMode] = useState(false)
  const [selectedModel, setSelectedModel] = useState('veo-3.1')
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null)
  const [isMotionSyncing, setIsMotionSyncing] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [script, setScript] = useState('')
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDirecting, setIsDirecting] = useState(false)
  const [recommendation, setRecommendation] = useState<{ id: string, reason: string } | null>(null)
  const [progress, setProgress] = useState('等待指令...')
  const [isExporting, setIsExporting] = useState(false)
  
  const { addAsset, assets, markers, setMarkers, tracks, addClip } = useEditorStore()

  const handleToggleMotionSync = () => {
    if (isMotionSyncing) {
      MotionSyncManager.stopCapture();
      setIsMotionSyncing(false);
      showToast('动捕同步已关闭', 'info');
    } else {
      MotionSyncManager.startCapture((data) => {
        console.log('📡 正在实时同步骨架点:', data.pose.length);
      });
      setIsMotionSyncing(true);
      showToast('📹 实时动捕已开启', 'success');
    }
  }

  // ... (保留之前的业务函数)
  const handleGenerate = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    try {
      const params = selectedActorId ? { prompt, actorId: selectedActorId, modelId: selectedModel } : { text: prompt, modelId: selectedModel };
      await (selectedActorId ? api.api.ai.actors.generate.post(params as any) : api.api.video.generate.post(params as any));
      showToast('任务已提交', 'info');
    } finally { setIsGenerating(false); }
  }

  return (
    <>
      <div className="liquid-bg" />
      <ToastContainer />
      <div className="app-layout">
        <aside className="glass-panel sidebar">
          <header className="console-header">
            <h1>VeoMuse <span className="badge">V3.1 Pro</span></h1>
            <p className="subtitle">旗舰版 · 虚实共生</p>
          </header>

          <div className="tab-header">
            <button className={`tab-btn ${activeTab === 'generate' ? 'active' : ''}`} onClick={() => setActiveTab('generate')}>✨ 生成</button>
            <button className={`tab-btn ${activeTab === 'actors' ? 'active' : ''}`} onClick={() => setActiveTab('actors')}>👤 演员</button>
            <button className={`tab-btn ${activeTab === 'director' ? 'active' : ''}`} onClick={() => setActiveTab('director')}>🎬 导演</button>
            <button className={`tab-btn ${activeTab === 'assets' ? 'active' : ''}`} onClick={() => setActiveTab('assets')}>📚 资产</button>
          </div>

          <div className="tab-content" style={{ flex: 1, overflowY: 'auto' }}>
            {activeTab === 'generate' && (
              <div className="editor-section">
                <div className="model-selector-mini"><label>引擎</label>
                  <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
                    <option value="veo-3.1">Gemini Veo 3.1</option><option value="kling-v1">Kling</option><option value="sora-preview">Sora</option>
                  </select>
                </div>
                <textarea className="premium-input" placeholder="输入创意..." value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={isEnhancing || isGenerating} />
                <div className="action-bar"><button className="btn-secondary" onClick={() => {}} disabled={isEnhancing}>✨ 增强</button><button className="btn-primary" onClick={handleGenerate} disabled={isGenerating}>📹 生成</button></div>
              </div>
            )}
            {activeTab === 'actors' && (
              <div className="actor-workspace" style={{ padding: '1rem' }}>
                <div className="actor-selector-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className={`actor-card ${selectedActorId === 'hero-man' ? 'active' : ''}`} onClick={() => setSelectedActorId('hero-man')} style={{ cursor: 'pointer', textAlign: 'center' }}><div style={{ fontSize: '3rem' }}>🧔</div><small>英俊男性</small></div>
                  <div className={`actor-card ${selectedActorId === 'smart-girl' ? 'active' : ''}`} onClick={() => setSelectedActorId('smart-girl')} style={{ cursor: 'pointer', textAlign: 'center' }}><div style={{ fontSize: '3rem' }}>👩‍🎓</div><small>智慧少女</small></div>
                </div>
                <div className="motion-control-hub" style={{ marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                  <label style={{ fontSize: '0.7rem', color: '#a855f7' }}>🧬 神经动捕实验室</label>
                  <button onClick={handleToggleMotionSync} style={{ marginTop: '0.5rem', width: '100%', background: isMotionSyncing ? '#ef4444' : 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)', color: '#fff', border: 'none', padding: '0.8rem', borderRadius: '8px', fontWeight: 'bold' }}>{isMotionSyncing ? '🛑 关闭动捕' : '🔴 开启实时动捕'}</button>
                </div>
              </div>
            )}
            {activeTab === 'director' && <div className="editor-section">...</div>}
            {activeTab === 'assets' && <AssetPanel />}
          </div>

          <div className="sidebar-footer">
            <button className="btn-export" style={{ width: '100%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', padding: '0.8rem', borderRadius: '8px', fontWeight: 'bold' }}>🎬 导出作品</button>
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
