import { useState, useEffect, useCallback, memo, useActionState, startTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api, getErrorMessage } from './utils/eden'
import { useEditorStore, Track } from './store/editorStore'
import { useToastStore } from './store/toastStore'
import VideoEditor from './components/Editor/VideoEditor'
import MultiVideoPlayer from './components/Editor/MultiVideoPlayer'
import AssetPanel from './components/Editor/AssetPanel'
import PropertyInspector from './components/Editor/PropertyInspector'
import ComparisonLab from './components/Editor/ComparisonLab'
import ToastContainer from './components/Editor/ToastContainer'
import { GlassCard, ProButton, ProInput } from './components/Common/Atoms'
import './App.css'

const MemoVideoEditor = memo(VideoEditor)
const MemoMultiVideoPlayer = memo(MultiVideoPlayer)

function App() {
  const { showToast } = useToastStore()
  const [activeTab, setActiveTab] = useState<'generate' | 'assets' | 'director' | 'actors'>('generate')
  const [isCompareMode, setIsCompareMode] = useState(false)
  const [selectedModel, setSelectedModel] = useState('veo-3.1')
  const [prompt, setPrompt] = useState('')
  const [script, setScript] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark') // 主题状态
  
  const { assets, addAsset, tracks, setTracks } = useEditorStore()

  // 同步物理主题
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (assets.length === 0) {
      addAsset({ id: 'asset-1', name: '示例素材', src: 'https://www.w3schools.com/html/mov_bbb.mp4', type: 'video' });
    }
  }, [])

  const [enhancedState, enhanceAction, isEnhancing] = useActionState(async (_prev: any, p: string) => {
    if (!p) return null;
    const { data, error } = await api.api.ai.enhance.post({ prompt: p });
    if (error) { showToast(getErrorMessage(error), 'error'); return null; }
    if (data && 'enhanced' in data) {
      setPrompt(data.enhanced);
      showToast('提示词已增强', 'success');
      return data.enhanced;
    }
    return null;
  }, null);

  const [directorState, directorAction, isDirecting] = useActionState(async (_prev: any, s: string) => {
    if (!s) return null;
    showToast('🎬 AI 导演正在规划分镜...', 'info');
    const { data, error } = await api.api.ai.director.analyze.post({ script: s });
    if (error) { showToast(getErrorMessage(error), 'error'); return null; }
    if (data && 'scenes' in data) {
      let offset = 0;
      const newTracks: Track[] = JSON.parse(JSON.stringify(useEditorStore.getState().tracks));
      const vTrack = newTracks.find(t => t.id === 'track-v1');
      if (vTrack) {
        data.scenes.forEach((scene: any, i: number) => {
          const d = scene.duration || 5;
          vTrack.clips.push({ 
            id: `auto-v-${i}-${Date.now()}`, start: offset, end: offset + d, 
            src: '', name: scene.title, type: 'video', 
            data: { prompt: scene.videoPrompt, worldId: data.worldId } 
          });
          offset += d;
        });
        setTracks(newTracks);
        showToast('全自动编排完成', 'success');
      }
    }
    return data;
  }, null);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const { data, error } = await api.api.video.compose.post({ timelineData: { tracks } });
      if (error) showToast(getErrorMessage(error), 'error');
      else if (data && 'outputPath' in data) showToast(`导出成功`, 'success');
    } finally { setIsExporting(false); }
  }, [tracks, showToast]);

  return (
    <div className="app-container pro-theme">
      <div className="liquid-bg" />
      <ToastContainer />
      
      <div className="app-layout">
        <GlassCard className="sidebar-container" delay={0.1}>
          <header className="sidebar-header">
            <div className="logo-section">
              <div className="logo-orb" />
              <h1>VeoMuse <span className="pro-tag">PRO</span></h1>
            </div>
            <button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </header>

          <nav className="sidebar-nav">
            {[
              { id: 'generate', label: '智能生成', icon: '✨' },
              { id: 'director', label: 'AI 导演', icon: '🎬' },
              { id: 'assets', label: '资产库', icon: '📚' },
              { id: 'actors', label: '虚拟角色', icon: '👤' }
            ].map(item => (
              <button 
                key={item.id} 
                className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id as any)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="sidebar-content">
            <AnimatePresence mode="wait">
              {activeTab === 'generate' && (
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="tab-pane">
                  <div className="input-group">
                    <label>创意提示词</label>
                    <ProInput 
                      placeholder="描述你脑海中的画面..." 
                      value={prompt} 
                      onChange={(e) => setPrompt(e.target.value)} 
                      rows={6}
                    />
                  </div>
                  <div className="action-row">
                    <ProButton variant="secondary" onClick={() => startTransition(() => enhanceAction(prompt))} isLoading={isEnhancing}>AI 增强</ProButton>
                    <ProButton className="flex-1">立即生成</ProButton>
                  </div>
                </motion.div>
              )}
              {activeTab === 'director' && (
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="tab-pane">
                  <div className="input-group">
                    <label>剧本脚本</label>
                    <ProInput 
                      placeholder="粘贴完整的分镜剧本..." 
                      value={script} 
                      onChange={(e) => setScript(e.target.value)} 
                      rows={10}
                    />
                  </div>
                  <ProButton variant="danger" className="w-full" onClick={() => startTransition(() => directorAction(script))} isLoading={isDirecting}>启动一键导演</ProButton>
                </motion.div>
              )}
              {activeTab === 'assets' && <AssetPanel />}
            </AnimatePresence>
          </div>

          <footer className="sidebar-footer">
            <ProButton variant="success" className="w-full" onClick={handleExport} isLoading={isExporting} icon="🚀">导出作品</ProButton>
          </footer>
        </GlassCard>

        <main className="main-stage">
          <GlassCard className="stage-preview" delay={0.2}>
            <div className="stage-header">
              <div className="mode-toggle">
                <span className={!isCompareMode ? 'active' : ''}>标准预览</span>
                <div className="pro-switch">
                  <input type="checkbox" checked={isCompareMode} onChange={(e) => setIsCompareMode(e.target.checked)} />
                  <span className="slider" />
                </div>
                <span className={isCompareMode ? 'active' : ''}>实验室对比</span>
              </div>
            </div>
            <div className="stage-content">
              {isCompareMode ? <ComparisonLab modelA={selectedModel} modelB="kling-v1" /> : <MemoMultiVideoPlayer />}
            </div>
          </GlassCard>

          <div className="stage-timeline">
            <MemoVideoEditor />
          </div>
        </main>

        <GlassCard className="inspector-container" delay={0.3}>
          <PropertyInspector />
        </GlassCard>
      </div>
    </div>
  )
}

export default App
