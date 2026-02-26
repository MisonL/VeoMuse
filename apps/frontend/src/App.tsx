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
  const [activeTab, setActiveTab] = useState<'generate' | 'assets' | 'director'>('generate')
  const [isCompareMode, setIsCompareMode] = useState(false)
  const [selectedModel, setSelectedModel] = useState('veo-3.1')
  const [prompt, setPrompt] = useState('')
  const [script, setScript] = useState('')
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDirecting, setIsDirecting] = useState(false)
  const [recommendation, setRecommendation] = useState<{ id: string, reason: string } | null>(null)
  const [progress, setProgress] = useState('等待导演指令...')
  const [isExporting, setIsExporting] = useState(false)
  const [isMusicAnalyzing, setIsMusicAnalyzing] = useState(false)
  
  const { addAsset, assets, markers, setMarkers, tracks, addClip } = useEditorStore()

  useEffect(() => {
    if (assets.length === 0) {
      addAsset({ id: 'asset-1', name: '大雄兔 (示例)', src: 'https://www.w3schools.com/html/mov_bbb.mp4', type: 'video' });
    }
  }, [])

  // 增强型自愈 WebSocket 连接
  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: any;
    const connect = () => {
      ws = new WebSocket('ws://localhost:3001/ws/generation')
      ws.onmessage = (e) => {
        try { const d = JSON.parse(e.data); if (d.message) setProgress(d.message); } 
        catch { console.log('RAW WS:', e.data); }
      };
      ws.onopen = () => { console.log('📡 WS Connected'); clearTimeout(reconnectTimer); };
      ws.onclose = () => { 
        console.warn('📡 WS Lost. Reconnecting in 5s...'); 
        reconnectTimer = setTimeout(connect, 5000); 
      };
    };
    if (isGenerating || isDirecting) connect();
    return () => { if (ws) ws.close(); clearTimeout(reconnectTimer); }
  }, [isGenerating, isDirecting])

  const handleRecommend = async (text: string) => {
    if (!text || text.length < 5) return;
    try {
      const { data } = await api.api.models.recommend.post({ prompt: text });
      if (data && 'recommendedModelId' in data) setRecommendation({ id: data.recommendedModelId, reason: data.reason });
    } catch (e) {}
  }

  const handleEnhance = async () => {
    if (!prompt) return;
    setIsEnhancing(true);
    try {
      const { data, error } = await api.api.ai.enhance.post({ prompt });
      if (error) throw error;
      if (data && 'enhanced' in data) { 
        setPrompt(data.enhanced); 
        handleRecommend(data.enhanced);
        showToast('创意已智能增强', 'success');
      }
    } catch (e: any) { showToast(e.message, 'error'); } finally { setIsEnhancing(false); }
  }

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    try {
      const { error } = await api.api.video.generate.post({ text: prompt, modelId: selectedModel });
      if (error) throw error;
      showToast('任务已提交，视频生成中', 'info');
    } catch (e: any) { showToast(e.message, 'error'); } finally { setIsGenerating(false); }
  }

  const handleAiMusic = async () => {
    if (!prompt) return;
    setIsMusicAnalyzing(true);
    try {
      const { data } = await api.api.ai['music-advice'].post({ description: prompt });
      if (data && 'mood' in data) {
        addClip('track-a1', { id: `bgm-${Date.now()}`, start: 0, end: 30, src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', name: `BGM: ${data.mood}`, type: 'audio' });
        showToast(`AI 已匹配 [${data.mood}] 风格配乐`, 'success');
      }
    } finally { setIsMusicAnalyzing(false); }
  }

  const handleAiDirector = async () => {
    if (!script) return;
    setIsDirecting(true);
    setProgress('🎬 正在解析宏大叙事脚本...');
    try {
      const { data, error } = await api.api.ai.director.analyze.post({ script });
      if (error) throw error;
      if (data && data.success) {
        let offset = 0;
        data.scenes.forEach((s: any, i: number) => {
          const d = s.duration || 5;
          addClip('track-v1', { id: `auto-v-${i}`, start: offset, end: offset + d, src: '', name: s.title, type: 'video', data: { prompt: s.videoPrompt } });
          if (s.voiceoverText) addClip('track-t1', { id: `auto-t-${i}`, start: offset, end: offset + d, src: '', name: `字幕: ${s.title}`, type: 'text', data: { content: s.voiceoverText } });
          offset += d;
        });
        showToast(`导演已就位：生成了 ${data.scenes.length} 个分镜`, 'success');
      }
    } catch (e: any) { showToast(e.message, 'error'); } finally { setIsDirecting(false); setProgress('导演已完成工作。'); }
  }

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { data, error } = await api.api.video.compose.post({ timelineData: { tracks } });
      if (error) throw error;
      if (data?.success) showToast(`导出成功！路径: ${data.outputPath}`, 'success');
    } catch (e: any) { showToast(e.message, 'error'); } finally { setIsExporting(false); }
  }

  return (
    <>
      <div className="liquid-bg" />
      <ToastContainer />
      <div className="app-layout">
        <aside className="glass-panel sidebar">
          <header className="console-header">
            <h1>VeoMuse <span className="badge">V3.1 Pro</span></h1>
            <p className="subtitle">旗舰版 · 最终 Bug 猎杀</p>
          </header>

          <div className="tab-header">
            <button className={`tab-btn ${activeTab === 'generate' ? 'active' : ''}`} onClick={() => setActiveTab('generate')}>✨ 生成</button>
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
                <textarea className="premium-input" placeholder="输入创意..." value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={isEnhancing || isGenerating} />
                <div className="action-bar">
                  <button className="btn-secondary" onClick={handleEnhance} disabled={isEnhancing}>✨ 增强</button>
                  <button className="btn-primary" onClick={handleGenerate} disabled={isGenerating}>📹 生成</button>
                </div>
                <button className="btn-music" onClick={handleAiMusic} disabled={isMusicAnalyzing} style={{ marginTop: '0.5rem', width: '100%', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff', border: 'none', padding: '0.6rem', borderRadius: '8px' }}>🪄 AI 智能配乐</button>
              </div>
            )}
            {activeTab === 'assets' && <AssetPanel />}
            {activeTab === 'director' && (
              <div className="editor-section">
                <textarea className="premium-input director-script" placeholder="在此输入脚本..." value={script} onChange={(e) => setScript(e.target.value)} disabled={isDirecting} style={{ height: '300px' }} />
                <button className="btn-director" onClick={handleAiDirector} disabled={isDirecting || !script} style={{ marginTop: '1rem', width: '100%', background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', color: '#fff', border: 'none', padding: '0.8rem', borderRadius: '8px', fontWeight: 'bold' }}>
                  {isDirecting ? '🎬 正在指挥...' : '🚀 启动全自动导演'}
                </button>
                {isDirecting && <div className="auto-progress-hint" style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#38bdf8', textAlign: 'center' }}>{progress}</div>}
              </div>
            )}
          </div>

          <div className="sidebar-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
            <button className="btn-export" onClick={handleExport} disabled={isExporting} style={{ width: '100%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', padding: '0.8rem', borderRadius: '8px', fontWeight: 'bold' }}>
              {isExporting ? '⏳ 合成中...' : '🎬 导出作品'}
            </button>
          </div>
        </aside>

        <main className="main-workspace">
          <div className="preview-container">
            <div className="preview-content">
              <div className="lab-controls">
                <label className="pro-toggle">
                  <input type="checkbox" checked={isCompareMode} onChange={(e) => setIsCompareMode(e.target.checked)} />
                  <span className="toggle-slider"></span> 🔬 实验模式
                </label>
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
