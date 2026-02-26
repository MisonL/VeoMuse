import { useState, useEffect } from 'react'
import { api } from './utils/eden'
import { useEditorStore } from './store/editorStore'
import { useToastStore } from './store/toastStore'
import VideoEditor from './components/Editor/VideoEditor'
import MultiVideoPlayer from './components/Editor/MultiVideoPlayer'
import PropertyInspector from './components/Editor/PropertyInspector'
import ToastContainer from './components/Editor/ToastContainer'
import './App.css'

function App() {
  const { showToast } = useToastStore()
  const [activeTab, setActiveTab] = useState<'generate' | 'director' | 'assets'>('generate')
  const [prompt, setPrompt] = useState('')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleGenerate = async () => {
    if (!prompt) return;
    showToast('提交任务中...', 'info');
    const { error } = await api.api.video.generate.post({ text: prompt });
    if (error) showToast('请求失败', 'error');
    else showToast('视频正在排队生成', 'success');
  };

  return (
    <div className="app-layout">
      <ToastContainer />
      
      <aside className="sidebar-container">
        <header className="sidebar-header">
          <h1>VeoMuse <span style={{ color: 'var(--sf-accent)' }}>Pro</span></h1>
        </header>

        <nav className="sidebar-nav">
          <button className={`nav-item ${activeTab === 'generate' ? 'active' : ''}`} onClick={() => setActiveTab('generate')}>
            <span>✨</span> 智能生成
          </button>
          <button className={`nav-item ${activeTab === 'director' ? 'active' : ''}`} onClick={() => setActiveTab('director')}>
            <span>🎬</span> AI 导演
          </button>
          <button className={`nav-item ${activeTab === 'assets' ? 'active' : ''}`} onClick={() => setActiveTab('assets')}>
            <span>📚</span> 资产库
          </button>
        </nav>

        <div className="sidebar-content">
          {activeTab === 'generate' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sf-text-secondary)', marginBottom: '8px', display: 'block' }}>创意描述</label>
                <textarea 
                  className="pro-textarea" 
                  rows={8} 
                  placeholder="描述你想要的画面..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>
              <button className="nav-item active" style={{ width: '100%', justifyContent: 'center' }} onClick={handleGenerate}>
                立即生成
              </button>
            </div>
          )}
        </div>

        <footer style={{ padding: '20px', borderTop: '1px solid var(--sf-border)' }}>
          <button className="nav-item" style={{ width: '100%' }} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
            {theme === 'light' ? '🌙 深色模式' : '☀️ 亮色模式'}
          </button>
        </footer>
      </aside>

      <main className="main-stage">
        <section className="stage-preview">
          <MultiVideoPlayer />
        </section>
        <section className="stage-timeline">
          <VideoEditor />
        </section>
      </main>

      <aside className="sidebar-container">
        <PropertyInspector />
      </aside>
    </div>
  )
}

export default App
