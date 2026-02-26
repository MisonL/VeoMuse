import { useState, useEffect, useCallback, memo } from 'react'
import { api } from './utils/eden'
import { useEditorStore } from './store/editorStore'
import { useToastStore } from './store/toastStore'
import VideoEditor from './components/Editor/VideoEditor'
import MultiVideoPlayer from './components/Editor/MultiVideoPlayer'
import AssetPanel from './components/Editor/AssetPanel'
import PropertyInspector from './components/Editor/PropertyInspector'
import ComparisonLab from './components/Editor/ComparisonLab'
import ToastContainer from './components/Editor/ToastContainer'
import { GlassCard, ProButton } from './components/Common/Atoms'
import './App.css'

const MemoVideoEditor = memo(VideoEditor)
const MemoMultiVideoPlayer = memo(MultiVideoPlayer)

function App() {
  const { showToast } = useToastStore()
  const [activeTab, setActiveTab] = useState<'generate' | 'assets' | 'director' | 'actors'>('generate')
  const [isCompareMode, setIsCompareMode] = useState(false)
  const [selectedModel, setSelectedModel] = useState('veo-3.1')
  const [prompt, setPrompt] = useState('')
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const { addAsset, assets, tracks } = useEditorStore()

  useEffect(() => {
    if (assets.length === 0) {
      addAsset({ id: 'asset-1', name: '大雄兔 (示例)', src: 'https://www.w3schools.com/html/mov_bbb.mp4', type: 'video' });
    }
  }, [])

  const handleEnhance = useCallback(async () => {
    if (!prompt) return;
    setIsEnhancing(true);
    try {
      const { data } = await api.api.ai.enhance.post({ prompt });
      if (data && 'enhanced' in data) { setPrompt(data.enhanced); showToast('提示词已增强', 'success'); }
    } finally { setIsEnhancing(false); }
  }, [prompt, showToast]);

  const handleGenerate = useCallback(async () => {
    if (!prompt) return;
    setIsGenerating(true);
    try {
      await api.api.video.generate.post({ text: prompt, modelId: selectedModel });
      showToast('任务已提交', 'info');
    } finally { setIsGenerating(false); }
  }, [prompt, selectedModel, showToast]);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const { data } = await api.api.video.compose.post({ timelineData: { tracks } });
      if (data?.success) showToast(`导出成功: ${data.outputPath}`, 'success');
    } finally { setIsExporting(false); }
  }, [tracks, showToast]);

  return (
    <>
      <div className="liquid-bg" />
      <ToastContainer />
      <div className="app-layout">
        {/* 精细调优的交错入场动画：0.1s -> 0.25s -> 0.4s */}
        <GlassCard className="sidebar" delay={0.1}>
          <header className="console-header">
            <h1>VeoMuse <span className="badge">V3.1 Pro</span></h1>
            <p className="subtitle">旗舰版 · 极致卓越</p>
          </header>
          <div className="tab-header">
            {(['generate', 'actors', 'assets', 'director'] as const).map(tab => (
              <button key={tab} className={`tab-btn ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                {tab === 'generate' ? '✨' : tab === 'actors' ? '👤' : tab === 'assets' ? '📚' : '🎬'}
              </button>
            ))}
          </div>
          <div className="tab-content" style={{ flex: 1, overflowY: 'auto' }}>
            {activeTab === 'generate' && (
              <div className="editor-section">
                <select className="premium-select" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
                  <option value="veo-3.1">Gemini Veo 3.1</option><option value="kling-v1">Kling</option><option value="sora-preview">Sora</option>
                </select>
                <textarea className="premium-input" placeholder="输入创意..." value={prompt} onChange={(e) => setPrompt(e.target.value)} />
                <div className="action-bar">
                  <ProButton variant="secondary" onClick={handleEnhance} isLoading={isEnhancing}>增强</ProButton>
                  <ProButton onClick={handleGenerate} isLoading={isGenerating}>生成</ProButton>
                </div>
              </div>
            )}
            {activeTab === 'assets' && <AssetPanel />}
          </div>
          <div className="sidebar-footer">
            <ProButton variant="success" className="w-full" onClick={handleExport} isLoading={isExporting}>🎬 导出作品</ProButton>
          </div>
        </GlassCard>

        <main className="main-workspace">
          <GlassCard className="preview-container" delay={0.25}>
            <div className="preview-content">
              <div className="lab-controls">
                <label className="pro-toggle"><input type="checkbox" checked={isCompareMode} onChange={(e) => setIsCompareMode(e.target.checked)} /><span className="toggle-slider"></span> 🔬 对比模式</label>
              </div>
              {isCompareMode ? <ComparisonLab modelA={selectedModel} modelB="kling-v1" /> : <MemoMultiVideoPlayer />}
            </div>
          </GlassCard>
          {/* 时间轴作为最重组件，最后入场以保证初始流速 */}
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4, type: 'spring' }} className="timeline-container">
            <MemoVideoEditor />
          </motion.div>
        </main>

        <GlassCard className="inspector-sidebar" delay={0.5}>
          <PropertyInspector />
        </GlassCard>
      </div>
    </>
  )
}

export default App
