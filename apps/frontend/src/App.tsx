import { useState, memo } from 'react'
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
  useThemeSync(); // 物理激活主题同步
  const { showToast } = useToastStore()
  const [activeMode, setActiveMode] = useState('edit')
  const [activeTool, setActiveTool] = useState('select')
  const [activeSidebar, setActiveSidebar] = useState('assets')

  return (
    <div className="pro-master-shell" onContextMenu={e => e.preventDefault()}>
      <style>{`
        :root {
          --pro-bg: #000000;
          --pro-surface: #121212;
          --pro-panel: #1A1A1B;
          --pro-accent: #007AFF;
          --pro-accent-glow: rgba(0, 122, 255, 0.4);
          --pro-border: rgba(255, 255, 255, 0.08);
          --pro-text: #E5E5E5;
          --pro-text-dim: #888888;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
        body { background: #000; color: var(--pro-text); font-family: -apple-system, "SF Pro Display", sans-serif; overflow: hidden; }

        .pro-master-shell {
          height: 100vh;
          width: 100vw;
          display: grid;
          grid-template-rows: 48px 1fr 380px;
          gap: 2px;
          background: #000;
          padding: 2px;
        }

        .os-header {
          background: var(--pro-surface);
          display: flex;
          align-items: center;
          padding: 0 20px;
          justify-content: space-between;
          border-bottom: 1px solid var(--pro-border);
        }
        .os-logo { font-weight: 900; font-size: 14px; letter-spacing: 1px; color: #fff; }
        .os-logo span { color: var(--pro-accent); }
        
        .os-nav-group { display: flex; gap: 32px; }
        .os-nav-tab { 
          color: var(--pro-text-dim); font-size: 12px; font-weight: 700; cursor: pointer; border: none; background: none; 
          padding: 4px 12px; border-radius: 4px; transition: 0.2s;
        }
        .os-nav-tab.active { color: #fff; background: rgba(255,255,255,0.05); }

        .os-btn-export { background: var(--pro-accent); color: #fff; border: none; padding: 6px 16px; border-radius: 6px; font-size: 11px; font-weight: 800; cursor: pointer; }

        .os-main {
          display: grid;
          grid-template-columns: 320px 1fr 340px;
          gap: 2px;
          min-height: 0;
        }
        .os-panel { background: var(--pro-surface); display: flex; flex-direction: column; overflow: hidden; }
        .os-panel-header { 
          padding: 12px 16px; border-bottom: 1px solid var(--pro-border); 
          display: flex; gap: 16px; background: rgba(255,255,255,0.02);
        }
        .panel-tab { background: none; border: none; font-size: 11px; font-weight: 800; color: var(--pro-text-dim); cursor: pointer; }
        .panel-tab.active { color: var(--pro-accent); }

        .os-monitor { background: #080808 !important; padding: 20px; display: flex; flex-direction: column; }
        .monitor-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .monitor-timecode { font-family: "SF Mono", monospace; color: var(--pro-accent); font-size: 22px; font-weight: 700; letter-spacing: -1px; }
        .monitor-stage-box { flex: 1; background: #000; border-radius: 8px; border: 1px solid var(--pro-border); box-shadow: 0 30px 80px rgba(0,0,0,0.8); overflow: hidden; }
        
        .monitor-transport { display: flex; justify-content: center; gap: 24px; padding-top: 16px; align-items: center; }
        .transport-btn { background: none; border: none; color: #fff; cursor: pointer; opacity: 0.6; font-size: 18px; transition: 0.2s; }
        .transport-btn.play { color: var(--pro-accent); font-size: 28px; opacity: 1; }

        /* 属性面板物理穿透 */
        .pro-inspector-outer { background: var(--pro-surface) !important; }
        .inspector-panel.glass-panel { background: transparent !important; border: none !important; box-shadow: none !important; }

        .os-footer { background: var(--pro-surface); display: flex; flex-direction: column; }
        .footer-tools { height: 40px; border-bottom: 1px solid var(--pro-border); display: flex; align-items: center; padding: 0 16px; justify-content: space-between; }
        .tool-icons { display: flex; gap: 12px; }
        .tool-icon-btn { 
          width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; 
          border-radius: 6px; border: 1px solid transparent; background: transparent; cursor: pointer; color: var(--pro-text-dim); font-size: 18px; 
        }
        .tool-icon-btn.active { background: rgba(0, 122, 255, 0.15); color: var(--pro-accent); border-color: var(--pro-accent); }
      `}</style>

      <ToastContainer />
      
      <header className="os-header">
        <div className="os-logo">VEOMUSE <span>PRO</span></div>
        <nav className="os-nav-group">
          <button className={`os-nav-tab ${activeMode === 'edit' ? 'active' : ''}`} onClick={() => setActiveMode('edit')}>编辑器</button>
          <button className={`os-nav-tab ${activeMode === 'color' ? 'active' : ''}`} onClick={() => setActiveMode('color')}>调色</button>
          <button className={`os-nav-tab ${activeMode === 'audio' ? 'active' : ''}`} onClick={() => setActiveMode('audio')}>音频</button>
        </nav>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <ThemeSwitcher />
          <button className="os-btn-export">导出作品</button>
        </div>
      </header>

      <main className="os-main">
        <aside className="os-panel">
          <div className="os-panel-header">
            <button className={`panel-tab ${activeSidebar === 'assets' ? 'active' : ''}`} onClick={() => setActiveSidebar('assets')}>资产</button>
            <button className={`panel-tab ${activeSidebar === 'director' ? 'active' : ''}`} onClick={() => setActiveSidebar('director')}>导演</button>
          </div>
          <div style={{ flex: 1, padding: '12px' }}>
            <AssetPanel />
          </div>
        </aside>

        <section className="os-panel os-monitor">
          <div className="monitor-top">
            <div style={{ color: '#FF3B30', fontSize: '10px', fontWeight: 900 }}>● LIVE</div>
            <div className="monitor-timecode">00:00:00:00</div>
            <div style={{ fontSize: '10px', color: '#888' }}>4K HDR</div>
          </div>
          <div className="monitor-stage-box">
            <MultiVideoPlayer />
          </div>
          <div className="monitor-transport">
            <button className="transport-btn">⏮</button>
            <button className="transport-btn play">▶</button>
            <button className="transport-btn">⏭</button>
          </div>
        </section>

        <aside className="os-panel pro-inspector-outer">
          <PropertyInspector />
        </aside>
      </main>

      <footer className="os-footer">
        <div className="footer-tools">
          <div className="tool-icons">
            <button className={`tool-icon-btn ${activeTool === 'select' ? 'active' : ''}`} onClick={() => setActiveTool('select')}>↖</button>
            <button className={`tool-icon-btn ${activeTool === 'cut' ? 'active' : ''}`} onClick={() => setActiveTool('cut')}>✂</button>
            <button className={`tool-icon-btn ${activeTool === 'hand' ? 'active' : ''}`} onClick={() => setActiveTool('hand')}>✋</button>
          </div>
          <div style={{ fontSize: '10px', color: '#888' }}>
            FPS: 60 | ENGINE: ROL DOWN 8.0
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <VideoEditor activeTool={activeTool as any} />
        </div>
      </footer>
    </div>
  )
}

export default memo(App)
