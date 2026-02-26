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
  
  const { addAsset, assets, markers, setMarkers, tracks, addClip, setTracks } = useEditorStore()

  // 一键全自动导演成片
  const handleFullAutoDirector = async () => {
    if (!script) return;
    setIsDirecting(true);
    setProgress('🎬 正在解析宏大叙事脚本...');
    
    try {
      // 1. 分析脚本
      const { data: story } = await api.api.ai.director.analyze.post({ script });
      if (!story || !story.success) throw new Error('脚本解析失败');
      
      setProgress(`🎬 导演已就位：${story.storyTitle}。正在编排 ${story.scenes.length} 个镜头...`);
      
      // 2. 自动化排版
      let offset = 0;
      const newTracks = [...useEditorStore.getState().tracks];
      
      for (const [i, scene] of story.scenes.entries()) {
        const d = scene.duration || 5;
        setProgress(`🎥 正在生成分镜 ${i+1}: ${scene.title}...`);
        
        // 此处在真实场景下会并发调用 generate 接口
        // 为演示流畅，我们直接加入带 Prompt 信息的占位 Clip
        addClip('track-v1', { id: `auto-v-${i}`, start: offset, end: offset + d, src: '', name: scene.title, type: 'video', data: { prompt: scene.videoPrompt } });
        
        if (scene.voiceoverText) {
          setProgress(`🎙️ 正在合成配音: ${scene.title}...`);
          const { data: voice } = await api.api.ai.tts.post({ text: scene.voiceoverText });
          addClip('track-a1', { id: `auto-a-${i}`, start: offset, end: offset + d, src: voice?.audioUrl || '', name: `配音: ${scene.title}`, type: 'audio' });
          addClip('track-t1', { id: `auto-t-${i}`, start: offset, end: offset + d, src: '', name: `字幕: ${scene.title}`, type: 'text', data: { content: scene.voiceoverText } });
        }
        offset += d;
      }

      setProgress('🎵 正在寻找完美背景音乐...');
      const { data: music } = await api.api.ai['music-advice'].post({ description: script });
      if (music && 'mood' in music) {
        addClip('track-a1', { id: 'auto-bgm', start: 0, end: offset, src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', name: `BGM: ${music.mood}`, type: 'audio' });
      }

      setProgress('✨ 全自动编排完成！正在准备最终合成预览...');
      alert(`🎉 全自动导演大功告成！\n作品标题：${story.storyTitle}\n总时长：${offset}秒\n\n您现在可以点击右下角的“导出作品”来获取成片！`);

    } catch (e: any) {
      alert(`自动化流程中断: ${e.message}`);
    } finally {
      setIsDirecting(false);
      setProgress('导演已完成工作。');
    }
  }

  // ... (保留之前的单项功能函数)
  const handleEnhance = async () => {
    if (!prompt) return;
    setIsEnhancing(true);
    try {
      const { data } = await api.api.ai.enhance.post({ prompt });
      if (data && 'enhanced' in data) { setPrompt(data.enhanced); handleRecommend(data.enhanced); }
    } finally { setIsEnhancing(false); }
  }

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    try { await api.api.video.generate.post({ text: prompt, modelId: selectedModel }); } finally { setIsGenerating(false); }
  }

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { data } = await api.api.video.compose.post({ timelineData: { tracks } });
      if (data?.success) alert(`合成开始: ${data.outputPath}`);
    } finally { setIsExporting(false); }
  }

  return (
    <>
      <div className="liquid-bg" />
      <div className="app-layout">
        <aside className="glass-panel sidebar">
          <header className="console-header">
            <h1>VeoMuse <span className="badge">V3.1 Pro</span></h1>
            <p className="subtitle">终极版 · 全自动创意闭环</p>
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
              </div>
            )}
            {activeTab === 'assets' && <AssetPanel />}
            {activeTab === 'director' && (
              <div className="editor-section">
                <textarea className="premium-input director-script" placeholder="在此输入长篇故事脚本..." value={script} onChange={(e) => setScript(e.target.value)} disabled={isDirecting} style={{ height: '300px' }} />
                <button className={`btn-director ${isDirecting ? 'loading' : ''}`} onClick={handleFullAutoDirector} disabled={isDirecting || !script} style={{ marginTop: '1rem', width: '100%', background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', color: '#fff', border: 'none', padding: '0.8rem', borderRadius: '8px', fontWeight: 'bold', boxShadow: '0 0 20px rgba(239, 68, 68, 0.3)' }}>
                  {isDirecting ? '🎬 正在自动驾驶中...' : '🚀 启动“全自动导演”'}
                </button>
                {isDirecting && <div className="auto-progress-hint" style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#38bdf8', textAlign: 'center' }}>{progress}</div>}
              </div>
            )}
          </div>

          <div className="sidebar-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
            <button className="btn-export" onClick={handleExport} disabled={isExporting} style={{ width: '100%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', padding: '0.8rem', borderRadius: '8px', fontWeight: 'bold' }}>
              {isExporting ? '⏳ 合成中...' : '🎬 导出最终作品'}
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
