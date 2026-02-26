import { useState, useEffect, useCallback, memo } from 'react'
import { motion } from 'framer-motion'
import { api } from './utils/eden'
import { useEditorStore, Track, Clip } from './store/editorStore'
import { useToastStore } from './store/toastStore'
import VideoEditor from './components/Editor/VideoEditor'
import MultiVideoPlayer from './components/Editor/MultiVideoPlayer'
import AssetPanel from './components/Editor/AssetPanel'
import PropertyInspector from './components/Editor/PropertyInspector'
import ComparisonLab from './components/Editor/ComparisonLab'
import ToastContainer from './components/Editor/ToastContainer'
import { GlassCard, ProButton } from './components/Common/Atoms'
import { MotionSyncManager } from './utils/motionSync'
import './App.css'

const MemoVideoEditor = memo(VideoEditor)
const MemoMultiVideoPlayer = memo(MultiVideoPlayer)

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
  const [isExporting, setIsExporting] = useState(false)
  const { addAsset, assets, tracks, setTracks } = useEditorStore()

  useEffect(() => {
    if (assets.length === 0) {
      addAsset({ id: 'asset-1', name: '大雄兔 (示例)', src: 'https://www.w3schools.com/html/mov_bbb.mp4', type: 'video' });
    }
  }, [])

  const handleFullAutoDirector = async () => {
    if (!script) return;
    setIsDirecting(true);
    showToast('🎬 AI 导演正在规划分镜...', 'info');
    try {
      const { data } = await api.api.ai.director.analyze.post({ script });
      if (data?.success) {
        let offset = 0;
        // 高性能重构：本地计算所有片段，避免频繁触发 Zustand 更新
        const newTracks: Track[] = JSON.parse(JSON.stringify(useEditorStore.getState().tracks));
        const vTrack = newTracks.find(t => t.id === 'track-v1');
        
        if (vTrack) {
          data.scenes.forEach((s: any, i: number) => {
            const d = s.duration || 5;
            const newClip: Clip = { 
              id: `auto-v-${i}-${Date.now()}`, start: offset, end: offset + d, 
              src: '', name: s.title, type: 'video', 
              data: { prompt: s.videoPrompt, worldId: data.worldId } 
            };
            vTrack.clips.push(newClip);
            offset += d;
          });
          // 原子更新：一次性推送全量变更
          setTracks(newTracks);
          showToast(`全自动编排完成：共 ${data.scenes.length} 个镜头`, 'success');
        }
      }
    } catch (e: any) { showToast(e.message, 'error'); } finally { setIsDirecting(false); }
  }

  // ... (保留之前的单项业务函数)
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
      const params = selectedActorId ? { prompt, actorId: selectedActorId, modelId: selectedModel } : { text: prompt, modelId: selectedModel };
      await (selectedActorId ? api.api.ai.actors.generate.post(params as any) : api.api.video.generate.post(params as any));
      showToast('任务已提交', 'info');
    } finally { setIsGenerating(false); }
  }, [prompt, selectedActorId, selectedModel, showToast]);

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
            {activeTab === 'director' && (
              <div className="editor-section">
                <textarea className="premium-input" style={{ height: '200px' }} placeholder="输入脚本..." value={script} onChange={(e) => setScript(e.target.value)} />
                <ProButton variant="danger" className="w-full mt-2" onClick={handleFullAutoDirector} isLoading={isDirecting}>启动一键导演</ProButton>
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
                <label className="pro-toggle"><input type="checkbox" checked={isCompareMode} onChange={(e) => setIsCompareMode(e.target.checked)} /><span className="toggle-slider"></span> 🔬 实验室模式</label>
              </div>
              {isCompareMode ? <ComparisonLab modelA={selectedModel} modelB="kling-v1" /> : <MemoMultiVideoPlayer />}
            </div>
          </GlassCard>
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
