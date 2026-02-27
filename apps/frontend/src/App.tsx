import { useState, memo, useEffect } from 'react'
import { useEditorStore } from './store/editorStore'
import { useToastStore } from './store/toastStore'
import { useThemeSync } from './hooks/useThemeSync'
import VideoEditor from './components/Editor/VideoEditor'
import MultiVideoPlayer from './components/Editor/MultiVideoPlayer'
import PropertyInspector from './components/Editor/PropertyInspector'
import AssetPanel from './components/Editor/AssetPanel'
import ToastContainer from './components/Editor/ToastContainer'
import ThemeSwitcher from './components/Common/ThemeSwitcher'

function App() {
  useThemeSync(); 
  const { showToast } = useToastStore()
  const [activeMode, setActiveMode] = useState('edit')
  const [activeTool, setActiveTool] = useState('select')
  const [activeSidebar, setActiveSidebar] = useState('assets')

  return (
    <div className="pro-master-shell" onContextMenu={e => e.preventDefault()}>
      <style>{`
        :root {
          --pro-bg: #000000;
          --pro-surface: #161617;
          --pro-panel: #1C1C1E;
          --pro-border: rgba(255, 255, 255, 0.1);
          --pro-accent: #007AFF;
          --pro-accent-glow: rgba(0, 122, 255, 0.4);
          --pro-text: #F5F5F7;
          --pro-text-dim: #8E8E93;
          --pro-radius: 10px;
        }

        [data-theme='light'] {
          --pro-bg: #E5E5EA;
          --pro-surface: #FFFFFF;
          --pro-panel: #F2F2F7;
          --pro-border: rgba(0, 0, 0, 0.08);
          --pro-text: #1C1C1E;
          --pro-text-dim: #8E8E93;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
        body { background: var(--pro-bg); color: var(--pro-text); font-family: "SF Pro Text", -apple-system, sans-serif; overflow: hidden; }

        /* 主架构：四象限布局 */
        .pro-master-shell {
          height: 100vh; width: 100vw; display: flex; flex-direction: column; background: var(--pro-bg); padding: 6px; gap: 6px;
        }

        /* 统一卡片质感 */
        .pro-card {
          background: var(--pro-surface);
          border: 1px solid var(--pro-border);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.2);
          display: flex;
          flex-direction: column;
        }

        /* 顶部导航 */
        .os-header {
          height: 52px; padding: 0 20px; display: flex; align-items: center; justify-content: space-between;
        }
        .os-logo { font-weight: 800; font-size: 16px; letter-spacing: -0.5px; color: var(--pro-text); }
        .os-logo span { color: var(--pro-accent); margin-left: 2px; }
        
        .os-nav-group { display: flex; gap: 8px; background: rgba(128,128,128,0.08); padding: 4px; border-radius: 10px; }
        .os-nav-tab { 
          color: var(--pro-text-dim); font-size: 12px; font-weight: 600; cursor: pointer; border: none; background: none; 
          padding: 6px 16px; border-radius: 7px; transition: 0.2s; 
        }
        .os-nav-tab.active { color: var(--pro-text); background: var(--pro-surface); box-shadow: 0 2px 8px rgba(0,0,0,0.15); }

        /* 中部核心 */
        .os-main { flex: 1; display: grid; grid-template-columns: 320px 1fr 340px; gap: 6px; min-height: 0; }
        
        .panel-header {
          height: 44px; padding: 0 16px; border-bottom: 1px solid var(--pro-border); display: flex; align-items: center; gap: 16px;
        }
        .header-tab { background: none; border: none; font-size: 11px; font-weight: 700; color: var(--pro-text-dim); cursor: pointer; text-transform: uppercase; letter-spacing: 1px; }
        .header-tab.active { color: var(--pro-accent); }

        /* 监视器：电影级氛围 */
        .os-monitor { background: #000 !important; border: 1px solid #222 !important; position: relative; }
        .monitor-meta { position: absolute; top: 20px; left: 24px; right: 24px; display: flex; justify-content: space-between; align-items: center; z-index: 10; pointer-events: none; }
        .monitor-timecode { font-family: "SF Mono", monospace; color: var(--pro-accent); font-size: 24px; font-weight: 600; }
        .monitor-live { color: #FF3B30; font-size: 10px; font-weight: 900; background: rgba(255,59,48,0.15); padding: 2px 8px; border-radius: 4px; }

        .monitor-stage { flex: 1; display: flex; align-items: center; justify-content: center; }
        .monitor-controls { height: 60px; display: flex; justify-content: center; gap: 32px; align-items: center; border-top: 1px solid rgba(255,255,255,0.05); }
        .ctrl-btn { background: none; border: none; color: #fff; cursor: pointer; transition: 0.2s; opacity: 0.7; }
        .ctrl-btn:hover { opacity: 1; transform: scale(1.1); }
        .ctrl-btn.play { color: var(--pro-accent); font-size: 32px; opacity: 1; }

        /* 底部时间轴 */
        .os-footer { height: 380px; }
        .timeline-toolbar { height: 44px; border-bottom: 1px solid var(--pro-border); display: flex; align-items: center; padding: 0 16px; justify-content: space-between; }
        .tool-group { display: flex; gap: 8px; }
        .tool-btn { 
          width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; 
          border-radius: 6px; border: none; background: transparent; cursor: pointer; color: var(--pro-text-dim); font-size: 18px; 
        }
        .tool-btn.active { background: var(--pro-accent); color: #fff; box-shadow: 0 0 12px var(--pro-accent-glow); }

        .engine-meta { font-size: 10px; font-weight: 700; color: var(--pro-text-dim); text-transform: uppercase; letter-spacing: 1px; }

        /* 统一导出按钮 */
        .btn-export { background: var(--pro-accent); color: #fff; border: none; padding: 8px 20px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 12px var(--pro-accent-glow); }
      `}</style>

      <ToastContainer />
      
      <header className="pro-card os-header">
        <div className="os-logo">VEOMUSE<span>PRO</span></div>
        <div className="os-nav-group">
          <button className={`os-nav-tab ${activeMode === 'edit' ? 'active' : ''}`} onClick={() => setActiveMode('edit')}>编辑器</button>
          <button className={`os-nav-tab ${activeMode === 'color' ? 'active' : ''}`} onClick={() => setActiveMode('color')}>调色</button>
          <button className={`os-nav-tab ${activeMode === 'audio' ? 'active' : ''}`} onClick={() => setActiveMode('audio')}>音频</button>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <ThemeSwitcher />
          <button className="btn-export">导出作品</button>
        </div>
      </header>

      <div className="os-main">
        <aside className="pro-card">
          <div className="panel-header">
            <button className={`header-tab ${activeSidebar === 'assets' ? 'active' : ''}`} onClick={() => setActiveSidebar('assets')}>项目资产</button>
            <button className={`header-tab ${activeSidebar === 'director' ? 'active' : ''}`} onClick={() => setActiveSidebar('director')}>AI 导演</button>
          </div>
          <div style={{ flex: 1, padding: '16px', overflow: 'hidden' }}>
            {activeSidebar === 'assets' ? <AssetPanel /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
                <textarea placeholder="描述你的视觉愿景..." style={{ flex: 1, background: 'rgba(128,128,128,0.05)', border: '1px solid var(--pro-border)', borderRadius: '10px', padding: '16px', color: 'var(--pro-text)', resize: 'none', outline: 'none', fontSize: '14px' }} />
                <button style={{ background: 'var(--pro-accent)', color: '#fff', border: 'none', height: '44px', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}>启动全自动导演</button>
              </div>
            )}
          </div>
        </aside>

        <section className="pro-card os-monitor">
          <div className="monitor-meta">
            <div className="monitor-live">● LIVE</div>
            <div className="monitor-timecode">00:00:00:00</div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#888' }}>4K HDR | REC.709</div>
          </div>
          <div className="monitor-stage">
            <MultiVideoPlayer />
          </div>
          <div className="monitor-controls">
            <button className="ctrl-btn">⏮</button>
            <button className="ctrl-btn play">▶</button>
            <button className="ctrl-btn">⏭</button>
          </div>
        </section>

        <aside className="pro-card">
          <PropertyInspector />
        </aside>
      </div>

      <footer className="pro-card os-footer">
        <div className="timeline-toolbar">
          <div className="tool-group">
            <button className={`tool-btn ${activeTool === 'select' ? 'active' : ''}`} onClick={() => setActiveTool('select')}>↖</button>
            <button className={`tool-btn ${activeTool === 'cut' ? 'active' : ''}`} onClick={() => setActiveTool('cut')}>✂</button>
            <button className={`tool-btn ${activeTool === 'hand' ? 'active' : ''}`} onClick={() => setActiveTool('hand')}>✋</button>
          </div>
          <div className="engine-meta">
            FPS: 60 | ENGINE: ROL DOWN 8.0 | SNAP: ON
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <VideoEditor activeTool={activeTool as any} />
        </div>
      </footer>
    </div>
  )
}

export default App
