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

  // 1. 全自动导演：集成 World-Link 一致性
  const handleFullAutoDirector = async () => {
    if (!script) return;
    setIsDirecting(true);
    setProgress('🎬 正在锁定全局时空一致性 (World-Link)...');
    
    try {
      const { data: story } = await api.api.ai.director.analyze.post({ script });
      if (!story || !story.success) throw new Error('解析失败');
      
      setProgress(`🏁 场景已锁定 [ID: ${story.worldId}]。正在编排分镜...`);
      
      let offset = 0;
      for (const [i, scene] of story.scenes.entries()) {
        const d = scene.duration || 5;
        // 在生成请求中注入全局时空标识 worldId
        addClip('track-v1', { 
          id: `auto-v-${i}`, start: offset, end: offset + d, src: '', 
          name: scene.title, type: 'video', 
          data: { prompt: scene.videoPrompt, worldId: story.worldId } 
        });
        
        if (scene.voiceoverText) {
          const { data: voice } = await api.api.ai.tts.post({ text: scene.voiceoverText });
          addClip('track-a1', { id: `auto-a-${i}`, start: offset, end: offset + d, src: voice?.audioUrl || '', name: `配音: ${scene.title}`, type: 'audio' });
          addClip('track-t1', { id: `auto-t-${i}`, start: offset, end: offset + d, src: '', name: `字幕: ${scene.title}`, type: 'text', data: { content: scene.voiceoverText } });
        }
        offset += d;
      }
      showToast(`全自动导演完成：${story.scenes.length} 个镜头已同步锁定。`, 'success');
    } catch (e: any) { showToast(e.message, 'error'); } 
    finally { setIsDirecting(false); setProgress('导演已完成。'); }
  }

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    try {
      const params = selectedActorId 
        ? { prompt, actorId: selectedActorId, modelId: selectedModel }
        : { text: prompt, modelId: selectedModel };
      await (selectedActorId ? api.api.ai.actors.generate.post(params as any) : api.api.video.generate.post(params as any));
      showToast('视频生成已提交', 'info');
    } finally { setIsGenerating(false); }
  }

  // ... (保留之前的辅助逻辑)
  const handleEnhance = async () => {
    if (!prompt) return;
    setIsEnhancing(true);
    try {
      const { data } = await api.api.ai.enhance.post({ prompt });
      if (data && 'enhanced' in data) { setPrompt(data.enhanced); }
    } finally { setIsEnhancing(false); }
  }

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { data } = await api.api.video.compose.post({ timelineData: { tracks } });
      if (data?.success) showToast(`成功: ${data.outputPath}`, 'success');
    } finally { setIsExporting(false); }
  }

  return (
    <>
      <div className="liquid-bg" />
      <ToastContainer />
      <div className="app-layout">
        <aside className="glass-panel sidebar">
          <header className="console-header">
            <h1>VeoMuse <span className="badge">V3.1 Pro</span></h1>
            <p className="subtitle">旗舰版 · 影棚级全能体</p>
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
                <div className="action-bar"><button className="btn-secondary" onClick={handleEnhance} disabled={isEnhancing}>✨ 增强</button><button className="btn-primary" onClick={handleGenerate} disabled={isGenerating}>📹 生成</button></div>
              </div>
            )}
            {activeTab === 'actors' && (
              <div className="actor-selector-grid" style={{ padding: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className={`actor-card ${selectedActorId === 'hero-man' ? 'active' : ''}`} onClick={() => setSelectedActorId('hero-man')} style={{ cursor: 'pointer', textAlign: 'center' }}><div style={{ fontSize: '3rem' }}>🧔</div><small>英俊男性</small></div>
                <div className={`actor-card ${selectedActorId === 'smart-girl' ? 'active' : ''}`} onClick={() => setSelectedActorId('smart-girl')} style={{ cursor: 'pointer', textAlign: 'center' }}><div style={{ fontSize: '3rem' }}>👩‍🎓</div><small>智慧少女</small></div>
              </div>
            )}
            {activeTab === 'director' && (
              <div className="editor-section">
                <textarea className="premium-input director-script" placeholder="输入长篇脚本..." value={script} onChange={(e) => setScript(e.target.value)} disabled={isDirecting} style={{ height: '300px' }} />
                <button className="btn-director" onClick={handleFullAutoDirector} disabled={isDirecting || !script} style={{ marginTop: '1rem', width: '100%', background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', color: '#fff', border: 'none', padding: '0.8rem', borderRadius: '8px', fontWeight: 'bold' }}>{isDirecting ? '🎬 正在自动驾驶中...' : '🚀 启动全自动导演'}</button>
                {isDirecting && <div className="auto-progress-hint" style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#38bdf8', textAlign: 'center' }}>{progress}</div>}
              </div>
            )}
            {activeTab === 'assets' && <AssetPanel />}
          </div>

          <div className="sidebar-footer">
            <button className="btn-export" onClick={handleExport} disabled={isExporting} style={{ width: '100%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', padding: '0.8rem', borderRadius: '8px', fontWeight: 'bold' }}>🎬 导出作品</button>
          </div>
        </aside>

        <main className="main-workspace">
          <div className="preview-container">
            <div className="preview-content">
              <div className="lab-controls">
                <label className="pro-toggle"><input type="checkbox" checked={isCompareMode} onChange={(e) => setIsCompareMode(e.target.checked)} /><span className="toggle-slider"></span> 🔬 实验室对比</label>
              </div>
              {isCompareMode ? <ComparisonLab modelA={selectedModel} modelB="kling-v1" /> : <MultiVideoPlayer />}
            </div>
          </div>
          <div className="timeline-container"><VideoEditor /></div>
        </main>

        <aside className="inspector-sidebar"><PropertyInspector /></aside>
      </div>
    </>
  )
}

export default App
